using System.ComponentModel.DataAnnotations;

namespace API.Auth.DTOs;

public class RegisterDTO
{
    [Required]
    public string Name { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    public string? Phone { get; set; }

    [Required]
    [MinLength(6)]
    public string Password { get; set; } = string.Empty;

    public string? OtpCode { get; set; }

    public string? RecaptchaToken { get; set; }
}
