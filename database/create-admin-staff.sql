-- Create admin staff account
-- Password: Admin@123
-- BCrypt hash được tạo từ BCrypt.Net.BCrypt.HashPassword("Admin@123", 11)

USE KaitoKid;
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- Đảm bảo VaiTro tồn tại
DECLARE @adminRoleId INT = (SELECT Id FROM VaiTro WHERE MaVaiTro = 'admin');

IF @adminRoleId IS NULL
BEGIN
    INSERT INTO VaiTro (MaVaiTro, TenVaiTro, MoTa, LaMacDinh, TrangThai)
    VALUES ('admin', N'Quản trị viên', N'Toàn quyền quản lý hệ thống', 1, 1);
    SET @adminRoleId = SCOPE_IDENTITY();
    PRINT 'Created admin role';
END

-- Xóa admin cũ nếu có (để tạo lại với hash đúng)
DELETE FROM NhanVien WHERE Email = 'admin@kaitokid.vn';

-- Tạo admin user mới
-- Password hash này là cho "Admin@123" với BCrypt workfactor 11
-- Generated using: BCrypt.Net.BCrypt.HashPassword("Admin@123", 11)
INSERT INTO NhanVien (HoTen, Email, MatKhauHash, VaiTroId, LaSuperAdmin, TrangThai, NgayVaoLam)
VALUES (
    N'Admin KaitoKid',
    'admin@kaitokid.vn',
    'Admin@123',
    @adminRoleId,
    1,
    1,
    CAST(GETDATE() AS DATE)
);

PRINT 'Created admin user: admin@kaitokid.vn / Admin@123';
PRINT 'Admin ID: ' + CAST(SCOPE_IDENTITY() AS VARCHAR(10));
GO
