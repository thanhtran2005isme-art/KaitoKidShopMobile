-- PHASE 4 - Bảo đảm các cột giữ tồn kho cho Wishlist + Add to Cart
-- MariaDB 10.4+
-- Script idempotent: có thể chạy lại, không xóa dữ liệu.

SET NAMES utf8mb4;

ALTER TABLE SanPham
    ADD COLUMN IF NOT EXISTS SoLuongDaGiu INT NOT NULL DEFAULT 0;

ALTER TABLE TonKhoBienThe
    ADD COLUMN IF NOT EXISTS SoLuongDaGiu INT NOT NULL DEFAULT 0;

ALTER TABLE GioHang
    ADD COLUMN IF NOT EXISTS GiuDenLuc DATETIME(6) NULL;

-- Không reset reservation đang tồn tại. Chỉ sửa giá trị âm nếu dữ liệu cũ bị lỗi.
UPDATE SanPham
SET SoLuongDaGiu = 0
WHERE SoLuongDaGiu < 0;

UPDATE TonKhoBienThe
SET SoLuongDaGiu = 0
WHERE SoLuongDaGiu < 0;

SELECT
    'SanPham.SoLuongDaGiu' AS cot,
    COUNT(*) AS so_dong,
    SUM(SoLuongDaGiu) AS tong_dang_giu
FROM SanPham
UNION ALL
SELECT
    'TonKhoBienThe.SoLuongDaGiu',
    COUNT(*),
    SUM(SoLuongDaGiu)
FROM TonKhoBienThe;
