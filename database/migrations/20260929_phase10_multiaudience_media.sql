-- PHASE 10 - Đồng bộ catalog Nam/Nữ/Trẻ em + media demo thật từ URL trong CSDL
-- Idempotent cho MariaDB 10.4+. Chỉ cập nhật các seed SKU/row chuẩn của repository.
-- Ảnh HTTPS là media demo từ Unsplash; production vẫn nên dùng media do shop sở hữu/upload.
SET NAMES utf8mb4;

-- PHASE 9 từng yêu cầu hai cột này. Tự bảo đảm để PHASE 10 có thể chạy an toàn trên DB local cũ.
ALTER TABLE Lookbook ADD COLUMN IF NOT EXISTS Season VARCHAR(50) NULL;
ALTER TABLE Lookbook ADD COLUMN IF NOT EXISTS Style VARCHAR(80) NULL;

START TRANSACTION;

-- 1) Danh mục dùng chung cho nhiều lứa tuổi.
UPDATE DanhMuc SET TenDanhMuc='Áo', Slug='ao', MoTa='Áo nam, nữ và trẻ em', GioiTinh='all' WHERE Id=1;
UPDATE DanhMuc SET TenDanhMuc='Quần', Slug='quan', MoTa='Quần nam, nữ và trẻ em', GioiTinh='all' WHERE Id=2;
UPDATE DanhMuc SET TenDanhMuc='Váy', Slug='vay', MoTa='Váy nữ và bé gái', GioiTinh='all' WHERE Id=3;
UPDATE DanhMuc SET TenDanhMuc='Đầm', Slug='dam', MoTa='Đầm nữ và bé gái', GioiTinh='all' WHERE Id=4;
UPDATE DanhMuc SET TenDanhMuc='Phụ kiện', Slug='phu-kien', MoTa='Phụ kiện thời trang đa lứa tuổi', GioiTinh='all' WHERE Id=5;
UPDATE DanhMuc SET TenDanhMuc='Áo thun', Slug='ao-thun', MoTa='Áo thun nhiều kiểu dáng', GioiTinh='all' WHERE Id=6;
UPDATE DanhMuc SET TenDanhMuc='Áo sơ mi', Slug='ao-so-mi', MoTa='Áo sơ mi đi làm, đi học và đi chơi', GioiTinh='all' WHERE Id=7;
UPDATE DanhMuc SET TenDanhMuc='Áo khoác', Slug='ao-khoac', MoTa='Áo khoác, hoodie và bomber', GioiTinh='all' WHERE Id=8;
UPDATE DanhMuc SET TenDanhMuc='Áo polo', Slug='ao-polo', MoTa='Áo polo nam, nữ và trẻ em', GioiTinh='all' WHERE Id=9;
UPDATE DanhMuc SET TenDanhMuc='Quần jean', Slug='quan-jean', MoTa='Jean nhiều phom dáng', GioiTinh='all' WHERE Id=10;
UPDATE DanhMuc SET TenDanhMuc='Quần kaki', Slug='quan-kaki', MoTa='Kaki và chinos', GioiTinh='all' WHERE Id=11;
UPDATE DanhMuc SET TenDanhMuc='Quần short', Slug='quan-short', MoTa='Short mặc hằng ngày và thể thao', GioiTinh='all' WHERE Id=12;

-- 2) Giữ catalog trẻ em hiện có nhưng đưa category về tên dùng chung và thay URL ảnh seed bị thiếu.
UPDATE SanPham SET DanhMuc='Áo', DanhMucPhu='Áo thun' WHERE MaSanPham IN ('KK-AT-001','KK-AT-002','KK-AT-003');
UPDATE SanPham SET DanhMuc='Áo', DanhMucPhu='Áo sơ mi' WHERE MaSanPham IN ('KK-SM-001','KK-SM-002');
UPDATE SanPham SET DanhMuc='Áo', DanhMucPhu='Áo khoác' WHERE MaSanPham IN ('KK-AK-001','KK-AK-002');
UPDATE SanPham SET DanhMuc='Áo', DanhMucPhu='Áo polo' WHERE MaSanPham='KK-PL-001';
UPDATE SanPham SET DanhMuc='Quần', DanhMucPhu='Quần jean' WHERE MaSanPham IN ('KK-QJ-001','KK-QJ-002');
UPDATE SanPham SET DanhMuc='Quần', DanhMucPhu='Quần kaki' WHERE MaSanPham='KK-QK-001';
UPDATE SanPham SET DanhMuc='Quần', DanhMucPhu='Quần short' WHERE MaSanPham='KK-QS-001';
UPDATE SanPham SET DanhMuc='Váy', DanhMucPhu=NULL WHERE MaSanPham IN ('KK-VY-001','KK-VY-002');
UPDATE SanPham SET DanhMuc='Đầm', DanhMucPhu=NULL WHERE MaSanPham IN ('KK-DM-001','KK-DM-002');
UPDATE SanPham SET DanhMuc='Phụ kiện', DanhMucPhu=NULL WHERE MaSanPham IN ('KK-PK-001','KK-PK-002','KK-PK-003');

UPDATE SanPham
SET HinhAnh = CASE MaSanPham
  WHEN 'KK-AT-001' THEN 'https://images.unsplash.com/photo-1566454544259-f4b94c3d758c?auto=format&fit=crop&w=900&q=82'
  WHEN 'KK-AT-002' THEN 'https://images.unsplash.com/photo-1560859259-fcf2b952aed8?auto=format&fit=crop&w=900&q=82'
  WHEN 'KK-AT-003' THEN 'https://images.unsplash.com/photo-1611428813653-aa606c998586?auto=format&fit=crop&w=900&q=82'
  WHEN 'KK-SM-001' THEN 'https://images.unsplash.com/photo-1758782213532-bbb5fd89885e?auto=format&fit=crop&w=900&q=82'
  WHEN 'KK-SM-002' THEN 'https://images.unsplash.com/photo-1695263747144-a52aa3739d62?auto=format&fit=crop&w=900&q=82'
  WHEN 'KK-AK-001' THEN 'https://images.unsplash.com/photo-1741992556912-3b2d62461e75?auto=format&fit=crop&w=900&q=82'
  WHEN 'KK-AK-002' THEN 'https://images.unsplash.com/photo-1604303768345-038b79a8c47a?auto=format&fit=crop&w=900&q=82'
  WHEN 'KK-PL-001' THEN 'https://images.unsplash.com/photo-1632232963035-bc14755747c9?auto=format&fit=crop&w=900&q=82'
  WHEN 'KK-QJ-001' THEN 'https://images.unsplash.com/photo-1620774760711-caa4c94d683a?auto=format&fit=crop&w=900&q=82'
  WHEN 'KK-QJ-002' THEN 'https://images.unsplash.com/photo-1634188157846-c6e3bdf99420?auto=format&fit=crop&w=900&q=82'
  WHEN 'KK-QK-001' THEN 'https://images.unsplash.com/photo-1541580621-cb65cc53084b?auto=format&fit=crop&w=900&q=82'
  WHEN 'KK-QS-001' THEN 'https://images.unsplash.com/photo-1502451885777-16c98b07834a?auto=format&fit=crop&w=900&q=82'
  WHEN 'KK-VY-001' THEN 'https://images.unsplash.com/photo-1725147874938-7904e3362841?auto=format&fit=crop&w=900&q=82'
  WHEN 'KK-VY-002' THEN 'https://images.unsplash.com/photo-1670014543471-3b5412baa677?auto=format&fit=crop&w=900&q=82'
  WHEN 'KK-DM-001' THEN 'https://images.unsplash.com/photo-1604482858862-1db908a653e4?auto=format&fit=crop&w=900&q=82'
  WHEN 'KK-DM-002' THEN 'https://images.unsplash.com/photo-1560859259-fcf2b952aed8?auto=format&fit=crop&w=900&q=82'
  WHEN 'KK-PK-001' THEN 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=900&q=82'
  WHEN 'KK-PK-002' THEN 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=900&q=82'
  WHEN 'KK-PK-003' THEN 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=900&q=82'
  ELSE HinhAnh
END
WHERE MaSanPham IN (
  'KK-AT-001','KK-AT-002','KK-AT-003','KK-SM-001','KK-SM-002','KK-AK-001','KK-AK-002','KK-PL-001',
  'KK-QJ-001','KK-QJ-002','KK-QK-001','KK-QS-001','KK-VY-001','KK-VY-002','KK-DM-001','KK-DM-002',
  'KK-PK-001','KK-PK-002','KK-PK-003'
);

-- 3) Bổ sung sample người lớn để Mobile/Web thể hiện đúng D020.
INSERT INTO SanPham
(TenSanPham, DanhMucId, DanhMuc, DanhMucPhu, PhongCach, NhomTuoi, GioiTinh, Gia, GiaCu, TonKho, TrangThai,
 HinhAnh, MoTaNgan, MoTaChiTiet, MaSanPham, Slug, LaSanPhamMoi, DangGiamGia, BanChayNhat, DiemDanhGia,
 SoLuongDaBan, DanhSachMau, DanhSachSize, BoSuuTapId)
VALUES
('Áo Thun Nữ Form Relaxed', 6, 'Áo', 'Áo thun', 'Casual', 'NguoiLon', 'Nu', 329000, NULL, 90, 'active',
 'https://images.unsplash.com/photo-1617113930975-f9c7243ae527?auto=format&fit=crop&w=900&q=82',
 'Áo thun nữ form relaxed dễ phối cho ngày thường.',
 '<p>Áo thun nữ form relaxed, chất liệu mềm và thoáng, phù hợp đi làm cuối tuần hoặc dạo phố.</p>',
 'KK-AD-N-001', 'ao-thun-nu-form-relaxed', 1, 0, 1, 4.7, 218, '["Trắng","Đen","Be"]', '["S","M","L","XL"]', 1),

('Áo Sơ Mi Nữ Thanh Lịch', 7, 'Áo', 'Áo sơ mi', 'Smart Casual', 'NguoiLon', 'Nu', 529000, 649000, 65, 'active',
 'https://images.unsplash.com/photo-1559582798-678dfc71ccd8?auto=format&fit=crop&w=900&q=82',
 'Sơ mi nữ tối giản, phù hợp công sở và gặp gỡ.',
 '<p>Sơ mi nữ phom gọn, chất vải nhẹ, dễ phối cùng quần tây, jean hoặc chân váy.</p>',
 'KK-AD-N-002', 'ao-so-mi-nu-thanh-lich', 1, 1, 0, 4.8, 176, '["Trắng","Xanh pastel","Be"]', '["S","M","L"]', 3),

('Váy Midi Nữ Xếp Ly', 3, 'Váy', NULL, 'Elegant', 'NguoiLon', 'Nu', 649000, 799000, 48, 'active',
 'https://images.unsplash.com/photo-1532453288672-3a27e9be9efd?auto=format&fit=crop&w=900&q=82',
 'Váy midi nữ xếp ly thanh lịch, dễ phối.',
 '<p>Váy midi xếp ly với phom rủ nhẹ, phù hợp đi làm, gặp gỡ và các dịp cuối tuần.</p>',
 'KK-AD-N-003', 'vay-midi-nu-xep-ly', 1, 1, 1, 4.9, 241, '["Đen","Be","Nâu"]', '["S","M","L"]', 3),

('Đầm Nữ Tối Giản Dự Tiệc', 4, 'Đầm', NULL, 'Elegant', 'NguoiLon', 'Nu', 899000, 1099000, 35, 'active',
 'https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=900&q=82',
 'Đầm nữ tối giản cho tiệc và sự kiện.',
 '<p>Đầm nữ phom thanh lịch, đường nét tối giản, phù hợp tiệc tối và sự kiện trang trọng.</p>',
 'KK-AD-N-004', 'dam-nu-toi-gian-du-tiec', 1, 1, 0, 4.8, 112, '["Đen","Đỏ đô"]', '["S","M","L"]', 3),

('Áo Thun Nam Cotton Premium', 6, 'Áo', 'Áo thun', 'Casual', 'NguoiLon', 'Nam', 349000, NULL, 110, 'active',
 'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=900&q=82',
 'Áo thun nam cotton phom regular, mặc hằng ngày.',
 '<p>Áo thun nam cotton mềm, phom regular dễ mặc và dễ phối với jean, kaki hoặc short.</p>',
 'KK-AD-M-001', 'ao-thun-nam-cotton-premium', 1, 0, 1, 4.8, 304, '["Đen","Trắng","Xanh navy"]', '["S","M","L","XL","XXL"]', 1),

('Áo Sơ Mi Nam Oxford', 7, 'Áo', 'Áo sơ mi', 'Smart Casual', 'NguoiLon', 'Nam', 579000, 699000, 72, 'active',
 'https://images.unsplash.com/photo-1507680434567-5739c80be1ac?auto=format&fit=crop&w=900&q=82',
 'Sơ mi Oxford nam gọn gàng cho công sở và cuối tuần.',
 '<p>Sơ mi Oxford nam phom regular, dễ phối với quần kaki hoặc jean cho nhiều hoàn cảnh.</p>',
 'KK-AD-M-002', 'ao-so-mi-nam-oxford', 1, 1, 0, 4.7, 194, '["Trắng","Xanh nhạt","Xám"]', '["M","L","XL","XXL"]', 3),

('Quần Jean Nam Slim Fit', 10, 'Quần', 'Quần jean', 'Casual', 'NguoiLon', 'Nam', 629000, NULL, 82, 'active',
 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?auto=format&fit=crop&w=900&q=82',
 'Jean nam slim fit co giãn nhẹ, dễ mặc.',
 '<p>Quần jean nam slim fit với denim co giãn nhẹ, phù hợp đi làm và đi chơi.</p>',
 'KK-AD-M-003', 'quan-jean-nam-slim-fit', 0, 0, 1, 4.6, 287, '["Xanh đậm","Đen"]', '["29","30","31","32","33","34"]', 4),

('Áo Polo Nam Pique Classic', 9, 'Áo', 'Áo polo', 'Classic', 'NguoiLon', 'Nam', 449000, NULL, 95, 'active',
 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=900&q=82',
 'Polo nam pique classic, lịch sự và thoáng.',
 '<p>Áo polo nam chất pique thoáng, cổ bẻ gọn gàng và phù hợp nhiều hoàn cảnh.</p>',
 'KK-AD-M-004', 'ao-polo-nam-pique-classic', 1, 0, 1, 4.7, 226, '["Đen","Trắng","Xanh navy"]', '["S","M","L","XL"]', 4)
ON DUPLICATE KEY UPDATE
  TenSanPham=VALUES(TenSanPham), DanhMucId=VALUES(DanhMucId), DanhMuc=VALUES(DanhMuc),
  DanhMucPhu=VALUES(DanhMucPhu), PhongCach=VALUES(PhongCach), NhomTuoi=VALUES(NhomTuoi),
  GioiTinh=VALUES(GioiTinh), Gia=VALUES(Gia), GiaCu=VALUES(GiaCu), TonKho=VALUES(TonKho),
  TrangThai=VALUES(TrangThai), HinhAnh=VALUES(HinhAnh), MoTaNgan=VALUES(MoTaNgan),
  MoTaChiTiet=VALUES(MoTaChiTiet), Slug=VALUES(Slug), LaSanPhamMoi=VALUES(LaSanPhamMoi),
  DangGiamGia=VALUES(DangGiamGia), BanChayNhat=VALUES(BanChayNhat), DiemDanhGia=VALUES(DiemDanhGia),
  SoLuongDaBan=VALUES(SoLuongDaBan), DanhSachMau=VALUES(DanhSachMau), DanhSachSize=VALUES(DanhSachSize),
  BoSuuTapId=VALUES(BoSuuTapId);

-- Snapshot đơn hàng cũ dùng ảnh sản phẩm hiện tại thay cho /products/*.jpg bị thiếu.
UPDATE ChiTietDonHang c
JOIN SanPham p ON p.Id = c.SanPhamId
SET c.HinhAnhSP = p.HinhAnh
WHERE p.MaSanPham IN (
  'KK-AT-001','KK-AT-002','KK-AT-003','KK-SM-001','KK-SM-002','KK-AK-001','KK-AK-002','KK-PL-001',
  'KK-QJ-001','KK-QJ-002','KK-QK-001','KK-QS-001','KK-VY-001','KK-VY-002','KK-DM-001','KK-DM-002',
  'KK-PK-001','KK-PK-002','KK-PK-003'
);

-- 4) Merchandising đa audience.
UPDATE BoSuuTap SET TenBoSuuTap='New Season Essentials', Slug='new-season-essentials',
  MoTa='Thiết kế mới dễ phối cho nhiều phong cách và lứa tuổi' WHERE Id=1;
UPDATE BoSuuTap SET TenBoSuuTap='Streetwear Edit', Slug='streetwear-edit',
  MoTa='Các thiết kế năng động cho phong cách đường phố' WHERE Id=2;
UPDATE BoSuuTap SET TenBoSuuTap='Office & Smart', Slug='office-smart',
  MoTa='Trang phục gọn gàng cho công sở, sự kiện và dịp cần lịch sự' WHERE Id=3;
UPDATE BoSuuTap SET TenBoSuuTap='Weekend Casual', Slug='weekend-casual',
  MoTa='Trang phục thoải mái cho những ngày cuối tuần' WHERE Id=4;

UPDATE Banner SET TieuDe='Phong Cách Nữ Mới', TieuDePhu='Thanh lịch · Hiện đại · Dễ phối',
  LienKet='/categories?gender=Nu&ageGroup=NguoiLon' WHERE ThuTu=1 AND ViTri='homepage';
UPDATE Banner SET TieuDe='Essential Cho Nam', TieuDePhu='Gọn gàng · Năng động · Linh hoạt',
  LienKet='/categories?gender=Nam&ageGroup=NguoiLon' WHERE ThuTu=2 AND ViTri='homepage';
UPDATE Banner SET TieuDe='KaitoKid Cho Trẻ Em', TieuDePhu='Thoải mái · Dễ vận động · Tươi vui',
  LienKet='/categories?ageGroup=TreEm' WHERE ThuTu=3 AND ViTri='homepage';

UPDATE Lookbook
SET HinhAnh='https://images.unsplash.com/photo-1566454544259-f4b94c3d758c?auto=format&fit=crop&w=900&q=82'
WHERE Id=1;
UPDATE Lookbook
SET HinhAnh='https://images.unsplash.com/photo-1634188157846-c6e3bdf99420?auto=format&fit=crop&w=900&q=82'
WHERE Id=2;

INSERT INTO Lookbook (TieuDe, TieuDePhu, MoTa, HinhAnh, LienKet, Season, Style, ThuTu)
SELECT 'Office & Smart', 'Women Edit', 'Gợi ý phối đồ nữ thanh lịch cho công sở và gặp gỡ.',
       'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=900&q=82',
       '/categories?gender=Nu&ageGroup=NguoiLon', 'All Season', 'Smart Casual', 3
WHERE NOT EXISTS (SELECT 1 FROM Lookbook WHERE TieuDe='Office & Smart');

INSERT INTO Lookbook (TieuDe, TieuDePhu, MoTa, HinhAnh, LienKet, Season, Style, ThuTu)
SELECT 'Weekend Street', 'Men Edit', 'Layering và denim cho phong cách nam cuối tuần.',
       'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=900&q=82',
       '/categories?gender=Nam&ageGroup=NguoiLon', 'All Season', 'Streetwear', 4
WHERE NOT EXISTS (SELECT 1 FROM Lookbook WHERE TieuDe='Weekend Street');

INSERT INTO LookbookHotspot (LookbookId, SanPhamId, ToaDoX, ToaDoY, GhiChu, ThuTu)
SELECT l.Id, p.Id, 40.00, 32.00, 'Áo sơ mi nữ thanh lịch', 1
FROM Lookbook l JOIN SanPham p ON p.MaSanPham='KK-AD-N-002'
WHERE l.TieuDe='Office & Smart'
  AND NOT EXISTS (
    SELECT 1 FROM LookbookHotspot h WHERE h.LookbookId=l.Id AND h.SanPhamId=p.Id
  );

INSERT INTO LookbookHotspot (LookbookId, SanPhamId, ToaDoX, ToaDoY, GhiChu, ThuTu)
SELECT l.Id, p.Id, 55.00, 72.00, 'Váy midi nữ xếp ly', 2
FROM Lookbook l JOIN SanPham p ON p.MaSanPham='KK-AD-N-003'
WHERE l.TieuDe='Office & Smart'
  AND NOT EXISTS (
    SELECT 1 FROM LookbookHotspot h WHERE h.LookbookId=l.Id AND h.SanPhamId=p.Id
  );

INSERT INTO LookbookHotspot (LookbookId, SanPhamId, ToaDoX, ToaDoY, GhiChu, ThuTu)
SELECT l.Id, p.Id, 42.00, 30.00, 'Áo thun nam cotton', 1
FROM Lookbook l JOIN SanPham p ON p.MaSanPham='KK-AD-M-001'
WHERE l.TieuDe='Weekend Street'
  AND NOT EXISTS (
    SELECT 1 FROM LookbookHotspot h WHERE h.LookbookId=l.Id AND h.SanPhamId=p.Id
  );

INSERT INTO LookbookHotspot (LookbookId, SanPhamId, ToaDoX, ToaDoY, GhiChu, ThuTu)
SELECT l.Id, p.Id, 55.00, 70.00, 'Quần jean nam slim fit', 2
FROM Lookbook l JOIN SanPham p ON p.MaSanPham='KK-AD-M-003'
WHERE l.TieuDe='Weekend Street'
  AND NOT EXISTS (
    SELECT 1 FROM LookbookHotspot h WHERE h.LookbookId=l.Id AND h.SanPhamId=p.Id
  );

UPDATE HomepageBlock SET TieuDe='Nữ', TieuDePhu='Thanh lịch mỗi ngày', HinhAnh='/slide_1.jpg',
  LienKet='/categories?gender=Nu&ageGroup=NguoiLon'
WHERE BlockType='categoryTile' AND ThuTu=1;
UPDATE HomepageBlock SET TieuDe='Nam', TieuDePhu='Gọn gàng, linh hoạt', HinhAnh='/slide_2.jpg',
  LienKet='/categories?gender=Nam&ageGroup=NguoiLon'
WHERE BlockType='categoryTile' AND ThuTu=2;
UPDATE HomepageBlock SET TieuDe='Trẻ em', TieuDePhu='Thoải mái để khám phá', HinhAnh='/slide_3.jpg',
  LienKet='/categories?ageGroup=TreEm'
WHERE BlockType='categoryTile' AND ThuTu=3;
UPDATE HomepageBlock SET TieuDe='Phụ kiện', TieuDePhu='Hoàn thiện phong cách', HinhAnh='/slide_1.jpg',
  LienKet='/categories/phu-kien'
WHERE BlockType='categoryTile' AND ThuTu=4;

UPDATE HomepageBlock SET TieuDe='Freeship đơn 499K', MoTa='Miễn phí vận chuyển toàn quốc', Icon='truck'
WHERE BlockType='brandValue' AND ThuTu=1;
UPDATE HomepageBlock SET TieuDe='Đổi trả 7 ngày', MoTa='Dễ dàng đổi size và sản phẩm', Icon='refresh'
WHERE BlockType='brandValue' AND ThuTu=2;
UPDATE HomepageBlock SET TieuDe='Mua sắm an tâm', MoTa='Thông tin sản phẩm, tồn kho và đơn hàng rõ ràng', Icon='shield'
WHERE BlockType='brandValue' AND ThuTu=3;

-- Menu dữ liệu trở lại Nữ/Nam/Trẻ em theo D020.
UPDATE MenuDieuHuong SET TenMenu='Nữ', LienKet='/women'
WHERE ViTri='header' AND MenuChaId IS NULL AND ThuTu=1;
UPDATE MenuDieuHuong SET TenMenu='Nam', LienKet='/men'
WHERE ViTri='header' AND MenuChaId IS NULL AND ThuTu=2;
UPDATE MenuDieuHuong SET TenMenu='Trẻ em', LienKet='/kids'
WHERE ViTri='header' AND MenuChaId IS NULL AND ThuTu=3;

UPDATE MenuDieuHuong child
JOIN MenuDieuHuong parent ON child.MenuChaId=parent.Id
SET child.TenMenu = CASE child.ThuTu
      WHEN 1 THEN 'Áo nữ' WHEN 2 THEN 'Váy nữ' WHEN 3 THEN 'Đầm nữ' WHEN 4 THEN 'Phụ kiện nữ'
      ELSE child.TenMenu END,
    child.LienKet = CASE child.ThuTu
      WHEN 1 THEN '/women?category=Áo' WHEN 2 THEN '/women?category=Váy'
      WHEN 3 THEN '/women?category=Đầm' WHEN 4 THEN '/women?category=Phụ kiện'
      ELSE child.LienKet END
WHERE child.ViTri='header' AND parent.ViTri='header' AND parent.MenuChaId IS NULL AND parent.ThuTu=1;

UPDATE MenuDieuHuong child
JOIN MenuDieuHuong parent ON child.MenuChaId=parent.Id
SET child.TenMenu = CASE child.ThuTu
      WHEN 1 THEN 'Áo nam' WHEN 2 THEN 'Quần nam' WHEN 3 THEN 'Áo khoác nam' WHEN 4 THEN 'Phụ kiện nam'
      ELSE child.TenMenu END,
    child.LienKet = CASE child.ThuTu
      WHEN 1 THEN '/men?category=Áo' WHEN 2 THEN '/men?category=Quần'
      WHEN 3 THEN '/men?subcategory=Áo khoác' WHEN 4 THEN '/men?category=Phụ kiện'
      ELSE child.LienKet END
WHERE child.ViTri='header' AND parent.ViTri='header' AND parent.MenuChaId IS NULL AND parent.ThuTu=2;

UPDATE TrangTinh
SET NoiDung='<h2>Về KAITO KID</h2><p>KAITO KID Shop Fashion cung cấp thời trang và phụ kiện cho Nam, Nữ, Trẻ em và Unisex, tập trung vào thiết kế dễ mặc, dễ phối và trải nghiệm mua sắm rõ ràng.</p>'
WHERE Slug='gioi-thieu';

UPDATE TrangTinh
SET TieuDe='Hướng dẫn chọn size',
    NoiDung='<h2>Hướng dẫn chọn size</h2><p>Sản phẩm người lớn sử dụng size theo dữ liệu từng mẫu (S-XXL hoặc size số). Sản phẩm trẻ em ưu tiên theo chiều cao 90-150. Hãy luôn kiểm tra danh sách size thật trên trang sản phẩm trước khi đặt hàng.</p>'
WHERE Slug='huong-dan-chon-size';

COMMIT;

SELECT NhomTuoi, GioiTinh, COUNT(*) AS so_san_pham
FROM SanPham
WHERE TrangThai='active'
GROUP BY NhomTuoi, GioiTinh
ORDER BY NhomTuoi, GioiTinh;

SELECT MaSanPham, TenSanPham, NhomTuoi, GioiTinh, HinhAnh
FROM SanPham
WHERE TrangThai='active'
ORDER BY Id;

