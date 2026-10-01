-- Phase 11 Node-only retirement: bảo đảm schema lịch sử tồn kho khớp contract Admin cũ.
-- Idempotent cho MariaDB 10.4+.

ALTER TABLE TonKho_LichSu
  ADD COLUMN IF NOT EXISTS TenSanPham VARCHAR(200) NOT NULL DEFAULT '' AFTER SanPhamId;

UPDATE TonKho_LichSu t
JOIN SanPham p ON p.Id = t.SanPhamId
SET t.TenSanPham = p.TenSanPham
WHERE t.TenSanPham IS NULL OR TRIM(t.TenSanPham) = '';
