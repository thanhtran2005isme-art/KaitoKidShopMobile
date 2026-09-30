using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace API.Auth.Services;

public interface IGoogleAuthService
{
    Task<GoogleUserInfo?> VerifyIdTokenAsync(string idToken);
    Task<GoogleUserInfo?> VerifyAccessTokenAsync(string accessToken);
}

public class GoogleUserInfo
{
    public string Subject { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool EmailVerified { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Picture { get; set; }
}

/// <summary>
/// Xác thực credential Google ở backend.
/// - Native Android/iOS gửi ID token.
/// - Expo Web gửi OAuth access token từ Google Identity Services.
/// Cả hai đều phải thuộc đúng Google:ClientId (Web Client ID của KaitoKid).
/// </summary>
public class GoogleAuthService(
    HttpClient http,
    IConfiguration config,
    ILogger<GoogleAuthService> logger) : IGoogleAuthService
{
    public async Task<GoogleUserInfo?> VerifyIdTokenAsync(string idToken)
    {
        var clientId = GetClientId();
        if (clientId is null || string.IsNullOrWhiteSpace(idToken)) return null;

        try
        {
            var url =
                $"https://oauth2.googleapis.com/tokeninfo?id_token={Uri.EscapeDataString(idToken)}";
            var res = await http.GetAsync(url);
            if (!res.IsSuccessStatusCode)
            {
                var body = await res.Content.ReadAsStringAsync();
                logger.LogWarning(
                    "Google ID tokeninfo {Status}: {Body}",
                    (int)res.StatusCode,
                    body);
                return null;
            }

            var info = await res.Content.ReadFromJsonAsync<GoogleIdTokenInfo>();
            if (info is null) return null;

            if (!string.Equals(info.Aud, clientId, StringComparison.Ordinal))
            {
                logger.LogWarning(
                    "Google ID token audience mismatch: expect {Exp} got {Got}",
                    clientId,
                    info.Aud);
                return null;
            }

            if (long.TryParse(info.Exp, out var expEpoch) &&
                DateTimeOffset.FromUnixTimeSeconds(expEpoch) <
                DateTimeOffset.UtcNow)
            {
                logger.LogWarning("Google ID token expired");
                return null;
            }

            if (string.IsNullOrWhiteSpace(info.Sub) ||
                string.IsNullOrWhiteSpace(info.Email))
            {
                return null;
            }

            return new GoogleUserInfo
            {
                Subject = info.Sub,
                Email = info.Email,
                EmailVerified = string.Equals(
                    info.EmailVerified,
                    "true",
                    StringComparison.OrdinalIgnoreCase),
                Name = info.Name ?? info.Email,
                Picture = info.Picture,
            };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Google ID token verify exception");
            return null;
        }
    }

    public async Task<GoogleUserInfo?> VerifyAccessTokenAsync(string accessToken)
    {
        var clientId = GetClientId();
        if (clientId is null || string.IsNullOrWhiteSpace(accessToken)) return null;

        try
        {
            var tokenInfoUrl =
                $"https://oauth2.googleapis.com/tokeninfo?access_token={Uri.EscapeDataString(accessToken)}";
            var tokenResponse = await http.GetAsync(tokenInfoUrl);
            var tokenBody = await tokenResponse.Content.ReadAsStringAsync();

            if (!tokenResponse.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "Google access tokeninfo {Status}: {Body}",
                    (int)tokenResponse.StatusCode,
                    tokenBody);
                return null;
            }

            using var tokenDocument = JsonDocument.Parse(tokenBody);
            var tokenInfo = tokenDocument.RootElement;

            if (!HasExpectedAudience(tokenInfo, clientId))
            {
                logger.LogWarning(
                    "Google access token audience mismatch: expect {Exp}; aud={Aud}; azp={Azp}; audience={Audience}; issued_to={IssuedTo}",
                    clientId,
                    GetString(tokenInfo, "aud"),
                    GetString(tokenInfo, "azp"),
                    GetString(tokenInfo, "audience"),
                    GetString(tokenInfo, "issued_to"));
                return null;
            }

            var hasRemainingLifetime =
                TryGetInt64(tokenInfo, "expires_in", out var expiresIn);
            var hasAbsoluteExpiry =
                TryGetInt64(tokenInfo, "exp", out var expEpoch);

            if ((hasRemainingLifetime && expiresIn <= 0) ||
                (hasAbsoluteExpiry &&
                 DateTimeOffset.FromUnixTimeSeconds(expEpoch) <=
                 DateTimeOffset.UtcNow))
            {
                logger.LogWarning("Google access token expired");
                return null;
            }

            if (!hasRemainingLifetime && !hasAbsoluteExpiry)
            {
                logger.LogWarning("Google access tokeninfo không có thời hạn token.");
                return null;
            }

            using var profileRequest = new HttpRequestMessage(
                HttpMethod.Get,
                "https://openidconnect.googleapis.com/v1/userinfo");
            profileRequest.Headers.Authorization =
                new AuthenticationHeaderValue("Bearer", accessToken);

            var profileResponse = await http.SendAsync(profileRequest);
            if (!profileResponse.IsSuccessStatusCode)
            {
                var body = await profileResponse.Content.ReadAsStringAsync();
                logger.LogWarning(
                    "Google userinfo {Status}: {Body}",
                    (int)profileResponse.StatusCode,
                    body);
                return null;
            }

            var profile =
                await profileResponse.Content.ReadFromJsonAsync<GoogleProfileInfo>();

            var subject =
                profile?.Sub ??
                GetString(tokenInfo, "sub", "user_id");
            var email =
                profile?.Email ??
                GetString(tokenInfo, "email");
            var emailVerified =
                profile?.EmailVerified ??
                GetBoolean(tokenInfo, "email_verified", "verified_email") ??
                false;

            if (string.IsNullOrWhiteSpace(subject) ||
                string.IsNullOrWhiteSpace(email))
            {
                logger.LogWarning(
                    "Google token/profile thiếu subject hoặc email.");
                return null;
            }

            return new GoogleUserInfo
            {
                Subject = subject,
                Email = email,
                EmailVerified = emailVerified,
                Name = profile?.Name ?? email,
                Picture = profile?.Picture,
            };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Google access token verify exception");
            return null;
        }
    }

    private static bool HasExpectedAudience(
        JsonElement root,
        string expectedClientId)
    {
        foreach (var field in new[] { "aud", "azp", "audience", "issued_to" })
        {
            var value = GetString(root, field);
            if (string.Equals(
                    value,
                    expectedClientId,
                    StringComparison.Ordinal))
            {
                return true;
            }
        }

        return false;
    }

    private static string? GetString(
        JsonElement root,
        params string[] propertyNames)
    {
        foreach (var propertyName in propertyNames)
        {
            if (!root.TryGetProperty(propertyName, out var value))
                continue;

            if (value.ValueKind == JsonValueKind.String)
                return value.GetString();

            if (value.ValueKind is JsonValueKind.Number or
                JsonValueKind.True or
                JsonValueKind.False)
            {
                return value.GetRawText().Trim('"');
            }
        }

        return null;
    }

    private static bool? GetBoolean(
        JsonElement root,
        params string[] propertyNames)
    {
        foreach (var propertyName in propertyNames)
        {
            if (!root.TryGetProperty(propertyName, out var value))
                continue;

            if (value.ValueKind == JsonValueKind.True) return true;
            if (value.ValueKind == JsonValueKind.False) return false;

            if (value.ValueKind == JsonValueKind.String &&
                bool.TryParse(value.GetString(), out var parsed))
            {
                return parsed;
            }
        }

        return null;
    }

    private static bool TryGetInt64(
        JsonElement root,
        string propertyName,
        out long result)
    {
        result = 0;
        if (!root.TryGetProperty(propertyName, out var value))
            return false;

        if (value.ValueKind == JsonValueKind.Number)
            return value.TryGetInt64(out result);

        return value.ValueKind == JsonValueKind.String &&
               long.TryParse(value.GetString(), out result);
    }

    private string? GetClientId()
    {
        var clientId = config["Google:ClientId"]?.Trim();
        if (!string.IsNullOrWhiteSpace(clientId)) return clientId;

        logger.LogWarning("Google:ClientId chưa cấu hình.");
        return null;
    }

    private sealed class GoogleIdTokenInfo
    {
        [JsonPropertyName("sub")] public string? Sub { get; set; }
        [JsonPropertyName("email")] public string? Email { get; set; }
        [JsonPropertyName("email_verified")] public string? EmailVerified { get; set; }
        [JsonPropertyName("name")] public string? Name { get; set; }
        [JsonPropertyName("picture")] public string? Picture { get; set; }
        [JsonPropertyName("aud")] public string? Aud { get; set; }
        [JsonPropertyName("exp")] public string? Exp { get; set; }
    }

    private sealed class GoogleProfileInfo
    {
        [JsonPropertyName("sub")] public string? Sub { get; set; }
        [JsonPropertyName("email")] public string? Email { get; set; }
        [JsonPropertyName("email_verified")] public bool? EmailVerified { get; set; }
        [JsonPropertyName("name")] public string? Name { get; set; }
        [JsonPropertyName("picture")] public string? Picture { get; set; }
    }
}
