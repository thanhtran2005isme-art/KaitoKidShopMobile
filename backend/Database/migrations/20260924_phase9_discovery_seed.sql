-- PHASE 9 — Discovery seed cho Collection/Lookbook.
-- Idempotent: có thể chạy lại; tra theo title/SKU thay vì phụ thuộc ID cố định.

UPDATE Lookbook
SET Season = 'Tựu trường',
    Style = 'Gọn gàng'
WHERE TieuDe = 'Ngày Đến Trường';

UPDATE Lookbook
SET Season = 'Cuối tuần',
    Style = 'Năng động'
WHERE TieuDe = 'Cuối Tuần Phiêu Lưu';

INSERT INTO LookbookHotspot (LookbookId, SanPhamId, ToaDoX, ToaDoY, GhiChu, ThuTu)
SELECT l.Id, p.Id, 38.00, 28.00, 'Áo sơ mi mềm cho outfit đi học', 1
FROM Lookbook l
JOIN SanPham p ON p.MaSanPham = 'KK-SM-001'
WHERE l.TieuDe = 'Ngày Đến Trường'
  AND NOT EXISTS (
      SELECT 1 FROM LookbookHotspot h
      WHERE h.LookbookId = l.Id AND h.SanPhamId = p.Id
  );

INSERT INTO LookbookHotspot (LookbookId, SanPhamId, ToaDoX, ToaDoY, GhiChu, ThuTu)
SELECT l.Id, p.Id, 52.00, 68.00, 'Quần kaki gọn gàng, dễ vận động', 2
FROM Lookbook l
JOIN SanPham p ON p.MaSanPham = 'KK-QK-001'
WHERE l.TieuDe = 'Ngày Đến Trường'
  AND NOT EXISTS (
      SELECT 1 FROM LookbookHotspot h
      WHERE h.LookbookId = l.Id AND h.SanPhamId = p.Id
  );

INSERT INTO LookbookHotspot (LookbookId, SanPhamId, ToaDoX, ToaDoY, GhiChu, ThuTu)
SELECT l.Id, p.Id, 42.00, 30.00, 'Hoodie ấm nhẹ cho chuyến đi cuối tuần', 1
FROM Lookbook l
JOIN SanPham p ON p.MaSanPham = 'KK-AK-001'
WHERE l.TieuDe = 'Cuối Tuần Phiêu Lưu'
  AND NOT EXISTS (
      SELECT 1 FROM LookbookHotspot h
      WHERE h.LookbookId = l.Id AND h.SanPhamId = p.Id
  );

INSERT INTO LookbookHotspot (LookbookId, SanPhamId, ToaDoX, ToaDoY, GhiChu, ThuTu)
SELECT l.Id, p.Id, 55.00, 70.00, 'Quần jean co giãn để bé thoải mái chạy nhảy', 2
FROM Lookbook l
JOIN SanPham p ON p.MaSanPham = 'KK-QJ-002'
WHERE l.TieuDe = 'Cuối Tuần Phiêu Lưu'
  AND NOT EXISTS (
      SELECT 1 FROM LookbookHotspot h
      WHERE h.LookbookId = l.Id AND h.SanPhamId = p.Id
  );
