using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using API.Auth.Data;
using API.Auth.DTOs;
using API.Auth.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Auth.Services;

public class AuthService(
    AuthDbContext db,
    IJwtService jwtService,
    IConfiguration config,
    IRecaptchaService recaptcha,
    IOtpService otp,
    IEmailService email,
    IGoogleAuthService google,
    IFacebookAuthService facebook,
    ITwoFactorService twoFactor,
    ILoginActivityService activity) : IAuthService
{
    private readonly int _refreshTokenDays = int.Parse(config["Jwt:RefreshTokenDays"] ?? "7");
    private bool RequireOtp => bool.Parse(config["Auth:RequireOtpForRegister"] ?? "false");
    private bool RequireRecaptcha => bool.Parse(config["Auth:RequireRecaptcha"] ?? "false");
    private int MaxFailedAttempts => int.Parse(config["Auth:MaxFailedAttempts"] ?? "5");
    private int LockoutMinutes => int.Parse(config["Auth:LockoutMinutes"] ?? "15");

    // ============ REGISTER ============
    public async Task<RegistrationPendingDTO> RegisterAsync(RegisterDTO dto)
    {
        if (RequireRecaptcha)
        {
            var ok = await recaptcha.VerifyAsync(dto.RecaptchaToken ?? "", "register");
            if (!ok) throw new InvalidOperationException("Bạn có vẻ là bot. Vui lòng thử lại.");
        }

        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new InvalidOperationException("Tên không được để trống");
        if (string.IsNullOrWhiteSpace(dto.Password) || dto.Password.Length < 6)
            throw new InvalidOperationException("Mật khẩu phải có ít nhất 6 ký tự");

        var emailLower = dto.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == emailLower))
            throw new InvalidOperationException("Email đã được sử dụng");

        // OTP (nếu bật) chỉ là lớp xác minh bổ sung. Tài khoản vẫn chưa được
        // tạo cho tới khi người dùng click link xác nhận email.
        if (RequireOtp)
        {
            if (string.IsNullOrWhiteSpace(dto.OtpCode))
                throw new InvalidOperationException("Vui lòng nhập mã OTP đã gửi tới email.");
            var verified = await otp.VerifyAsync(emailLower, "register", dto.OtpCode);
            if (!verified)
                throw new InvalidOperationException("Mã OTP không đúng hoặc đã hết hạn.");
        }

        var now = DateTime.UtcNow;
        var verifyHours = int.TryParse(
            config["Auth:RegistrationVerificationHours"],
            out var configuredHours)
            ? Math.Clamp(configuredHours, 1, 168)
            : 24;
        var expiresAt = now.AddHours(verifyHours);

        var rawToken = Convert
            .ToHexString(RandomNumberGenerator.GetBytes(32))
            .ToLowerInvariant();
        var tokenHash = HashVerificationToken(rawToken);
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);

        var pending = await db.PendingRegistrations
            .FirstOrDefaultAsync(p => p.Email == emailLower);

        if (pending is null)
        {
            pending = new PendingRegistration
            {
                Name = dto.Name.Trim(),
                Email = emailLower,
                Phone = string.IsNullOrWhiteSpace(dto.Phone)
                    ? null
                    : dto.Phone.Trim(),
                PasswordHash = passwordHash,
                TokenHash = tokenHash,
                ExpiresAt = expiresAt,
                CreatedAt = now,
            };
            db.PendingRegistrations.Add(pending);
        }
        else
        {
            // Đăng ký lại cùng email trước khi xác nhận = thay yêu cầu cũ và
            // vô hiệu link cũ, không tạo thêm tài khoản/bản ghi trùng.
            pending.Name = dto.Name.Trim();
            pending.Phone = string.IsNullOrWhiteSpace(dto.Phone)
                ? null
                : dto.Phone.Trim();
            pending.PasswordHash = passwordHash;
            pending.TokenHash = tokenHash;
            pending.ExpiresAt = expiresAt;
            pending.UpdatedAt = now;
        }

        await db.SaveChangesAsync();

        var verifyBaseUrl =
            config["Auth:EmailVerifyUrl"] ??
            "http://localhost:5173/verify-email";
        var separator = verifyBaseUrl.Contains('?') ? '&' : '?';
        var verifyUrl =
            $"{verifyBaseUrl}{separator}token={Uri.EscapeDataString(rawToken)}";

        var html = BuildEmailTemplate("Xác nhận đăng ký", $@"
            <p>Bạn vừa yêu cầu đăng ký tài khoản KaitoKid bằng email <strong>{emailLower}</strong>.</p>
            <p><strong>Tài khoản chưa được tạo.</strong> Hãy nhấn nút dưới đây để xác nhận bạn sở hữu email này và hoàn tất việc tạo tài khoản.</p>
            <p style='text-align:center;margin:24px 0'>
                <a href='{verifyUrl}' style='background:#7c3aed;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600'>Xác nhận và tạo tài khoản</a>
            </p>
            <p style='color:#64748b;font-size:13px'>Link có hiệu lực trong {verifyHours} giờ. Link cũ sẽ mất hiệu lực nếu bạn gửi lại đăng ký.</p>
            <p style='color:#94a3b8;font-size:12px'>Nếu nút không mở được, copy link: <br />{verifyUrl}</p>");

        await email.SendAsync(
            emailLower,
            "[KaitoKid] Xác nhận đăng ký tài khoản",
            html);

        return new RegistrationPendingDTO
        {
            Message =
                "Đã gửi email xác nhận. Tài khoản chỉ được tạo sau khi bạn mở liên kết xác nhận trong email.",
            Email = emailLower,
            ExpiresAt = expiresAt,
            RequiresEmailVerification = true,
        };
    }

    // ============ LOGIN ============
    public async Task<TokenDTO> LoginAsync(LoginDTO dto)
    {
        if (RequireRecaptcha)
        {
            var ok = await recaptcha.VerifyAsync(dto.RecaptchaToken ?? "", "login");
            if (!ok) throw new InvalidOperationException("Vui lòng thử lại.");
        }

        var id = dto.Identifier.Trim().ToLower();
        if (string.IsNullOrEmpty(id) || string.IsNullOrEmpty(dto.Password))
            throw new UnauthorizedAccessException("Thiếu thông tin đăng nhập");

        var isPhone = id.All(c => char.IsDigit(c) || c == '+' || c == '.' || c == '-');
        var user = isPhone
            ? await db.Users.FirstOrDefaultAsync(u => u.Phone == dto.Identifier.Trim())
            : await db.Users.FirstOrDefaultAsync(u => u.Email == id);

        if (user is null)
        {
            await activity.LogAsync(null, dto.Identifier, "local", false, "Tài khoản không tồn tại");
            throw new UnauthorizedAccessException("Tài khoản hoặc mật khẩu không đúng");
        }

        // Check lockout
        if (user.LockedUntil.HasValue && user.LockedUntil.Value > DateTime.UtcNow)
        {
            var remaining = (int)(user.LockedUntil.Value - DateTime.UtcNow).TotalMinutes + 1;
            await activity.LogAsync(user.Id, user.Email, "local", false, "Tài khoản đang bị khóa");
            throw new UnauthorizedAccessException($"Tài khoản tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau {remaining} phút.");
        }

        if (string.IsNullOrEmpty(user.PasswordHash))
        {
            await activity.LogAsync(user.Id, user.Email, "local", false, "Account social — không có password");
            throw new UnauthorizedAccessException("Tài khoản này được tạo qua Google/Facebook. Hãy đăng nhập qua nút tương ứng.");
        }

        bool isPasswordValid = false;
        try
        {
            isPasswordValid = BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash);
        }
        catch (BCrypt.Net.SaltParseException)
        {
            // Fallback nếu hash trong DB bị lỗi định dạng salt hoặc là plain text
            isPasswordValid = dto.Password == user.PasswordHash;
            if (isPasswordValid)
            {
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
                await db.SaveChangesAsync();
            }
        }
        catch (Exception)
        {
            isPasswordValid = dto.Password == user.PasswordHash;
        }

        if (!isPasswordValid)
        {
            user.FailedAttempts += 1;
            if (user.FailedAttempts >= MaxFailedAttempts)
            {
                user.LockedUntil = DateTime.UtcNow.AddMinutes(LockoutMinutes);
                user.FailedAttempts = 0;
                await db.SaveChangesAsync();
                await activity.LogAsync(user.Id, user.Email, "local", false, $"Bị khóa {LockoutMinutes} phút");
                throw new UnauthorizedAccessException($"Sai quá {MaxFailedAttempts} lần. Tài khoản bị khóa {LockoutMinutes} phút.");
            }
            await db.SaveChangesAsync();
            await activity.LogAsync(user.Id, user.Email, "local", false, $"Sai mật khẩu (lần {user.FailedAttempts})");
            var left = MaxFailedAttempts - user.FailedAttempts;
            throw new UnauthorizedAccessException($"Mật khẩu không đúng. Còn {left} lần thử trước khi tài khoản bị khóa.");
        }

        // Reset counter khi login đúng
        user.FailedAttempts = 0;
        user.LockedUntil = null;

        // Nếu đã bật 2FA → trả về token tạm với cờ TwoFactorRequired = true
        if (user.TwoFactorEnabled)
        {
            await db.SaveChangesAsync();
            return new TokenDTO
            {
                AccessToken = "",
                RefreshToken = "",
                ExpiresAt = DateTime.UtcNow,
                TwoFactorRequired = true,
                User = MapToUserInfo(user),
            };
        }

        await activity.LogAsync(user.Id, user.Email, "local", true);
        return GenerateTokenResponse(user);
    }

    public async Task<TokenDTO> LoginWithTwoFactorAsync(TwoFactorLoginDTO dto)
    {
        var id = dto.Identifier.Trim().ToLower();
        var isPhone = id.All(c => char.IsDigit(c) || c == '+' || c == '.' || c == '-');
        var user = isPhone
            ? await db.Users.FirstOrDefaultAsync(u => u.Phone == dto.Identifier.Trim())
            : await db.Users.FirstOrDefaultAsync(u => u.Email == id);
        if (user is null) throw new UnauthorizedAccessException("Tài khoản không hợp lệ");
        if (string.IsNullOrEmpty(user.PasswordHash) ||
            !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Sai mật khẩu");
        if (!user.TwoFactorEnabled || string.IsNullOrEmpty(user.TwoFactorSecret))
            throw new UnauthorizedAccessException("Tài khoản chưa bật 2FA");
        if (!twoFactor.VerifyCode(user.TwoFactorSecret, dto.Code))
        {
            await activity.LogAsync(user.Id, user.Email, "local", false, "Sai mã 2FA");
            throw new UnauthorizedAccessException("Mã 2FA không đúng hoặc đã hết hạn.");
        }

        await activity.LogAsync(user.Id, user.Email, "local+2fa", true);
        return GenerateTokenResponse(user);
    }

    // ============ REFRESH ============
    public async Task<TokenDTO> RefreshTokenAsync(string refreshToken)
    {
        var user = await db.Users
            .FirstOrDefaultAsync(u => u.RefreshToken == refreshToken && u.RefreshTokenExpiry > DateTime.UtcNow);
        if (user is null) throw new UnauthorizedAccessException("Refresh token không hợp lệ hoặc đã hết hạn");
        return GenerateTokenResponse(user);
    }

    // ============ CHANGE PASSWORD ============
    public async Task ChangePasswordAsync(int userId, ChangePasswordDTO dto)
    {
        var user = await db.Users.FindAsync(userId)
            ?? throw new InvalidOperationException("Không tìm thấy tài khoản");
        if (string.IsNullOrEmpty(user.PasswordHash))
            throw new InvalidOperationException("Tài khoản social không có mật khẩu để đổi.");
        if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash))
            throw new InvalidOperationException("Mật khẩu hiện tại không đúng");
        if (string.IsNullOrWhiteSpace(dto.NewPassword) || dto.NewPassword.Length < 6)
            throw new InvalidOperationException("Mật khẩu mới phải có ít nhất 6 ký tự");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        user.RefreshToken = null;
        user.RefreshTokenExpiry = null;
        await db.SaveChangesAsync();
    }

    public async Task<UserInfoDTO> GetProfileAsync(int userId)
    {
        var user = await db.Users.FindAsync(userId)
            ?? throw new InvalidOperationException("Không tìm thấy tài khoản");
        return MapToUserInfo(user);
    }

    // ============ FORGOT / RESET PASSWORD ============
    public async Task RequestPasswordResetAsync(string emailRaw)
    {
        var emailLower = emailRaw.Trim().ToLower();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == emailLower);
        if (user is null) return;

        var bytes = RandomNumberGenerator.GetBytes(32);
        var token = Convert.ToHexString(bytes).ToLowerInvariant();
        db.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id, Email = user.Email, Token = token,
            ExpiresAt = DateTime.UtcNow.AddMinutes(30),
        });
        await db.SaveChangesAsync();

        var resetUrl = $"{config["Auth:ResetPasswordUrl"] ?? "http://localhost:5173/reset-password"}?token={token}";
        var html = BuildEmailTemplate("Đặt lại mật khẩu", $@"
            <p>Click vào nút dưới để đặt lại mật khẩu:</p>
            <p style='text-align:center;margin:24px 0'>
                <a href='{resetUrl}' style='background:#ec4899;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600'>Đặt lại mật khẩu</a>
            </p>
            <p style='color:#64748b;font-size:13px'>Link có hiệu lực trong 30 phút.</p>
            <p style='color:#94a3b8;font-size:12px'>Hoặc copy link: <br />{resetUrl}</p>");
        await email.SendAsync(user.Email, "[KaitoKid] Đặt lại mật khẩu", html);
    }

    public async Task ResetPasswordAsync(string token, string newPassword)
    {
        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 6)
            throw new InvalidOperationException("Mật khẩu mới phải có ít nhất 6 ký tự");

        var record = await db.PasswordResetTokens
            .FirstOrDefaultAsync(r => r.Token == token && r.UsedAt == null && r.ExpiresAt > DateTime.UtcNow);
        if (record is null)
            throw new InvalidOperationException("Link đặt lại không hợp lệ hoặc đã hết hạn.");

        var user = await db.Users.FindAsync(record.UserId);
        if (user is null) throw new InvalidOperationException("Tài khoản không tồn tại");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        user.UpdatedAt = DateTime.UtcNow;
        user.RefreshToken = null;
        user.RefreshTokenExpiry = null;
        user.FailedAttempts = 0;
        user.LockedUntil = null;
        record.UsedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    // ============ EMAIL VERIFY ============
    public async Task SendEmailVerifyAsync(int userId)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null) return;
        if (user.EmailVerified) return;

        var bytes = RandomNumberGenerator.GetBytes(32);
        var token = Convert.ToHexString(bytes).ToLowerInvariant();
        db.EmailVerificationTokens.Add(new EmailVerificationToken
        {
            UserId = user.Id, Email = user.Email, Token = token,
            ExpiresAt = DateTime.UtcNow.AddDays(1),
        });
        await db.SaveChangesAsync();

        var verifyUrl = $"{config["Auth:EmailVerifyUrl"] ?? "http://localhost:5173/verify-email"}?token={token}";
        var html = BuildEmailTemplate("Xác thực email", $@"
            <p>Cảm ơn bạn đã đăng ký KaitoKid! Vui lòng xác thực email để hoàn tất đăng ký.</p>
            <p style='text-align:center;margin:24px 0'>
                <a href='{verifyUrl}' style='background:#16a34a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600'>Xác thực email</a>
            </p>
            <p style='color:#64748b;font-size:13px'>Link có hiệu lực trong 24 giờ.</p>
            <p style='color:#94a3b8;font-size:12px'>Hoặc copy link: <br />{verifyUrl}</p>");
        await email.SendAsync(user.Email, "[KaitoKid] Xác thực địa chỉ email", html);
    }

    public async Task<string> VerifyEmailAsync(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            throw new InvalidOperationException("Link xác thực không hợp lệ.");

        var now = DateTime.UtcNow;
        var tokenHash = HashVerificationToken(token);

        // Luồng đăng ký mới: chỉ khi token email hợp lệ mới tạo NguoiDung.
        var pending = await db.PendingRegistrations
            .FirstOrDefaultAsync(p => p.TokenHash == tokenHash);

        if (pending is not null)
        {
            if (pending.ExpiresAt <= now)
            {
                db.PendingRegistrations.Remove(pending);
                await db.SaveChangesAsync();
                throw new InvalidOperationException(
                    "Link xác nhận đã hết hạn. Vui lòng đăng ký lại để nhận email mới.");
            }

            var existing = await db.Users
                .FirstOrDefaultAsync(u => u.Email == pending.Email);

            if (existing is not null)
            {
                // Trường hợp hiếm do request verify đồng thời hoặc dữ liệu đã
                // được tạo bởi một provider khác: không tạo bản ghi trùng.
                db.PendingRegistrations.Remove(pending);
                await db.SaveChangesAsync();
                return "Email này đã có tài khoản KaitoKid. Bạn có thể đăng nhập.";
            }

            var user = new User
            {
                Name = pending.Name,
                Email = pending.Email,
                PasswordHash = pending.PasswordHash,
                Phone = pending.Phone,
                Role = "user",
                EmailVerified = true,
                Provider = "local",
                CreatedAt = now,
            };

            db.Users.Add(user);
            db.PendingRegistrations.Remove(pending);
            await db.SaveChangesAsync();

            await activity.LogAsync(
                user.Id,
                user.Email,
                "local",
                true,
                "register-email-verified");

            return "Xác thực email thành công. Tài khoản KaitoKid đã được tạo. Bạn có thể đăng nhập.";
        }

        // Backward compatibility cho các tài khoản local cũ từng được tạo
        // trước khi bắt buộc xác nhận email trước khi tạo NguoiDung.
        var record = await db.EmailVerificationTokens
            .FirstOrDefaultAsync(t =>
                t.Token == token &&
                t.VerifiedAt == null &&
                t.ExpiresAt > now);

        if (record is null)
            throw new InvalidOperationException(
                "Link xác thực không hợp lệ, đã được sử dụng hoặc đã hết hạn.");

        var legacyUser = await db.Users.FindAsync(record.UserId);
        if (legacyUser is null)
            throw new InvalidOperationException("Tài khoản không tồn tại");

        legacyUser.EmailVerified = true;
        record.VerifiedAt = now;
        await db.SaveChangesAsync();
        return "Xác thực email thành công. Bạn có thể đăng nhập.";
    }

    // ============ GOOGLE LOGIN ============
    public async Task<TokenDTO> LoginWithGoogleAsync(string? idToken, string? accessToken)
    {
        GoogleUserInfo? info = null;

        if (!string.IsNullOrWhiteSpace(idToken))
        {
            info = await google.VerifyIdTokenAsync(idToken);
        }
        else if (!string.IsNullOrWhiteSpace(accessToken))
        {
            info = await google.VerifyAccessTokenAsync(accessToken);
        }

        if (info is null)
            throw new UnauthorizedAccessException("Token Google không hợp lệ");
        if (!info.EmailVerified)
            throw new UnauthorizedAccessException("Email Google chưa xác thực");

        var user = await UpsertSocialUser(info.Email, info.Name, info.Picture, "google", info.Subject);
        await activity.LogAsync(user.Id, user.Email, "google", true);
        return GenerateTokenResponse(user);
    }

    // ============ FACEBOOK LOGIN ============
    public async Task<TokenDTO> LoginWithFacebookAsync(string accessToken)
    {
        var info = await facebook.VerifyAccessTokenAsync(accessToken)
            ?? throw new UnauthorizedAccessException("Token Facebook không hợp lệ");
        if (string.IsNullOrEmpty(info.Email))
            throw new UnauthorizedAccessException("Vui lòng cấp quyền email cho Facebook để đăng nhập.");

        var user = await UpsertSocialUser(info.Email, info.Name, info.Picture, "facebook", info.Id);
        await activity.LogAsync(user.Id, user.Email, "facebook", true);
        return GenerateTokenResponse(user);
    }

    // ============ 2FA ============
    public async Task<TwoFactorSetupDTO> Setup2FaAsync(int userId)
    {
        var user = await db.Users.FindAsync(userId)
            ?? throw new InvalidOperationException("Không tìm thấy tài khoản");
        var setup = twoFactor.GenerateSetup(user.Email);
        // Lưu secret tạm — chỉ kích hoạt khi user xác nhận đã quét và nhập đúng code
        user.TwoFactorSecret = setup.Secret;
        await db.SaveChangesAsync();
        return new TwoFactorSetupDTO { Secret = setup.Secret, OtpAuthUri = setup.OtpAuthUri };
    }

    public async Task<bool> Enable2FaAsync(int userId, string code)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null || string.IsNullOrEmpty(user.TwoFactorSecret)) return false;
        if (!twoFactor.VerifyCode(user.TwoFactorSecret, code)) return false;
        user.TwoFactorEnabled = true;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> Disable2FaAsync(int userId, string code)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null || !user.TwoFactorEnabled || string.IsNullOrEmpty(user.TwoFactorSecret)) return false;
        if (!twoFactor.VerifyCode(user.TwoFactorSecret, code)) return false;
        user.TwoFactorEnabled = false;
        user.TwoFactorSecret = null;
        await db.SaveChangesAsync();
        return true;
    }

    // ============ ACTIVITY ============
    public async Task<List<LoginActivityItemDTO>> GetMyActivityAsync(int userId)
    {
        var list = await activity.GetByUserAsync(userId);
        return list.Select(a => new LoginActivityItemDTO
        {
            Id = a.Id,
            Provider = a.Provider,
            Ip = a.Ip,
            Browser = a.Browser,
            Os = a.Os,
            DeviceType = a.DeviceType,
            Success = a.Success,
            FailReason = a.FailReason,
            CreatedAt = a.CreatedAt,
        }).ToList();
    }

    // ============ HELPERS ============
    private async Task<User> UpsertSocialUser(string emailRaw, string name, string? picture, string provider, string providerId)
    {
        var emailLower = emailRaw.Trim().ToLower();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == emailLower);
        if (user is null)
        {
            user = new User
            {
                Name = name, Email = emailLower, PasswordHash = "",
                Avatar = picture, Role = "user", EmailVerified = true,
                Provider = provider, ProviderId = providerId,
            };
            db.Users.Add(user);
        }
        else
        {
            user.Provider = string.IsNullOrEmpty(user.Provider) ? provider
                            : user.Provider.Contains(provider) ? user.Provider
                            : $"{user.Provider}+{provider}";
            user.ProviderId = providerId;
            user.EmailVerified = true;
            if (string.IsNullOrEmpty(user.Avatar)) user.Avatar = picture;
        }
        await db.SaveChangesAsync();
        return user;
    }

    private TokenDTO GenerateTokenResponse(User user)
    {
        var accessToken = jwtService.GenerateAccessToken(user);
        var refreshToken = jwtService.GenerateRefreshToken();
        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(_refreshTokenDays);
        user.UpdatedAt = DateTime.UtcNow;
        db.SaveChanges();
        var expiryMinutes = int.Parse(config["Jwt:ExpiryMinutes"] ?? "60");
        return new TokenDTO
        {
            AccessToken = accessToken, RefreshToken = refreshToken,
            ExpiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes),
            User = MapToUserInfo(user),
        };
    }

    private static UserInfoDTO MapToUserInfo(User user) => new()
    {
        Id = user.Id, Name = user.Name, Email = user.Email,
        Phone = user.Phone, Avatar = user.Avatar, Role = user.Role,
        CreatedAt = user.CreatedAt,
    };

    private static string HashVerificationToken(string token)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static string BuildEmailTemplate(string title, string content) => $@"
        <div style='font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden'>
            <div style='background:linear-gradient(135deg,#ec4899,#be185d);color:#fff;padding:24px;text-align:center'>
                <h2 style='margin:0;font-size:22px'>KaitoKid Shop</h2>
                <p style='margin:6px 0 0;opacity:.9'>{title}</p>
            </div>
            <div style='padding:28px'>
                {content}
                <p style='color:#94a3b8;font-size:12px;margin-top:24px;border-top:1px solid #f1f5f9;padding-top:16px'>
                    Email tự động — không trả lời. © 2026 KaitoKid Shop.
                </p>
            </div>
        </div>";
}
