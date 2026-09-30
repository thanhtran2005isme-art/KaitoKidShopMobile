using System.Net.Http.Headers;
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
            if (!tokenResponse.IsSuccessStatusCode)
            {
                var body = await tokenResponse.Content.ReadAsStringAsync();
                logger.LogWarning(
                    "Google access tokeninfo {Status}: {Body}",
                    (int)tokenResponse.StatusCode,
                    body);
                return null;
            }

            var tokenInfo =
                await tokenResponse.Content.ReadFromJsonAsync<GoogleAccessTokenInfo>();
            if (tokenInfo is null) return null;

            var audience = tokenInfo.Audience ?? tokenInfo.IssuedTo;
            if (!string.Equals(audience, clientId, StringComparison.Ordinal))
            {
                logger.LogWarning(
                    "Google access token audience mismatch: expect {Exp} got {Got}",
                    clientId,
                    audience);
                return null;
            }

            if (tokenInfo.ExpiresIn <= 0)
            {
                logger.LogWarning("Google access token expired");
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
            var subject = profile?.Sub ?? tokenInfo.UserId;
            var email = profile?.Email ?? tokenInfo.Email;
            var emailVerified =
                profile?.EmailVerified ?? tokenInfo.VerifiedEmail ?? false;

            if (string.IsNullOrWhiteSpace(subject) ||
                string.IsNullOrWhiteSpace(email))
            {
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

    private sealed class GoogleAccessTokenInfo
    {
        [JsonPropertyName("audience")] public string? Audience { get; set; }
        [JsonPropertyName("issued_to")] public string? IssuedTo { get; set; }
        [JsonPropertyName("user_id")] public string? UserId { get; set; }
        [JsonPropertyName("email")] public string? Email { get; set; }
        [JsonPropertyName("verified_email")] public bool? VerifiedEmail { get; set; }
        [JsonPropertyName("expires_in")] public int ExpiresIn { get; set; }
        [JsonPropertyName("scope")] public string? Scope { get; set; }
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
