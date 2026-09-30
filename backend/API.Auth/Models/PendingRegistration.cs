using System.ComponentModel.DataAnnotations.Schema;

namespace API.Auth.Models;

/// <summary>
/// Dữ liệu đăng ký tạm thời. Chưa phải tài khoản NguoiDung.
/// Password chỉ lưu BCrypt hash; token xác nhận chỉ lưu SHA-256 hash.
/// Bản ghi bị xóa ngay sau khi email được xác nhận và NguoiDung được tạo.
/// </summary>
[Table("PendingRegistration")]
public class PendingRegistration
{
    public int Id { get; set; }
    [Column("HoTen")] public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    [Column("SoDienThoai")] public string? Phone { get; set; }
    [Column("MatKhauHash")] public string PasswordHash { get; set; } = string.Empty;
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
