-- KaitoKid - đăng ký email phải xác nhận trước khi tạo NguoiDung
-- Idempotent: có thể chạy nhiều lần an toàn.

CREATE TABLE IF NOT EXISTS PendingRegistration (
    Id              INT AUTO_INCREMENT PRIMARY KEY,
    HoTen           VARCHAR(255) NOT NULL,
    Email           VARCHAR(255) NOT NULL,
    SoDienThoai     VARCHAR(50) NULL,
    MatKhauHash     VARCHAR(255) NOT NULL,
    TokenHash       CHAR(64) NOT NULL,
    ExpiresAt       DATETIME(6) NOT NULL,
    CreatedAt       DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UpdatedAt       DATETIME(6) NULL,
    UNIQUE KEY UX_PendingRegistration_Email (Email),
    UNIQUE KEY UX_PendingRegistration_TokenHash (TokenHash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
