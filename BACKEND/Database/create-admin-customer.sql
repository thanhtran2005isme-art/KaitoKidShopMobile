USE KaitoKid;
SET QUOTED_IDENTIFIER ON;
GO

-- Xóa admin cũ
DELETE FROM NguoiDung WHERE Email = 'admin@kaitokid.vn';
GO

-- Tạo admin mới
-- Password: Admin@123
-- BCrypt hash được tạo với cost factor 11
INSERT INTO NguoiDung (
    HoTen,
    Email, 
    MatKhauHash,
    VaiTro,
    TrangThai,
    NgayTao,
    NgayCapNhat,
    XacThucEmail,
    SoDienThoai,
    DiaChi
)
VALUES (
    N'Admin KaitoKid',
    'admin@kaitokid.vn',
    'Admin@123',
    'admin',
    1,
    GETDATE(),
    GETDATE(),
    1,
    '0123456789',
    N'Admin Office'
);
GO

-- Verify
SELECT 
    HoTen,
    Email,
    VaiTro,
    TrangThai,
    XacThucEmail,
    LEN(MatKhauHash) as PasswordHashLength
FROM NguoiDung 
WHERE Email = 'admin@kaitokid.vn';
GO
