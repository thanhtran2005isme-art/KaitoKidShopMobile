-- PHASE 1 - Chuẩn hóa KaitoKid thành thương hiệu thời trang trẻ em 0-12 tuổi
-- Chạy trên database hiện tại, KHÔNG DROP bảng và KHÔNG thay đổi khóa chính.
-- MariaDB 10.4+
SET NAMES utf8mb4;
START TRANSACTION;

UPDATE DanhMuc SET TenDanhMuc='Áo bé', Slug='ao-be', MoTa='Áo mặc hằng ngày dành cho trẻ em 0-12 tuổi', GioiTinh='treem' WHERE Id=1;
UPDATE DanhMuc SET TenDanhMuc='Quần bé', Slug='quan-be', MoTa='Quần dài, jean, kaki và short thoải mái cho bé', GioiTinh='treem' WHERE Id=2;
UPDATE DanhMuc SET TenDanhMuc='Váy bé gái', Slug='vay-be-gai', MoTa='Váy năng động, dễ vận động dành cho bé gái', GioiTinh='treem' WHERE Id=3;
UPDATE DanhMuc SET TenDanhMuc='Đầm bé gái', Slug='dam-be-gai', MoTa='Đầm đi chơi, sinh nhật và dịp đặc biệt dành cho bé gái', GioiTinh='treem' WHERE Id=4;
UPDATE DanhMuc SET TenDanhMuc='Phụ kiện bé', Slug='phu-kien-be', MoTa='Mũ, túi và phụ kiện dễ phối đồ cho trẻ em', GioiTinh='treem' WHERE Id=5;
UPDATE DanhMuc SET TenDanhMuc='Áo thun bé', Slug='ao-thun-be', MoTa='Áo thun mềm, thoáng và dễ vận động', GioiTinh='treem' WHERE Id=6;
UPDATE DanhMuc SET TenDanhMuc='Áo sơ mi bé', Slug='ao-so-mi-be', MoTa='Áo sơ mi đi học, đi chơi cho bé', GioiTinh='treem' WHERE Id=7;
UPDATE DanhMuc SET TenDanhMuc='Áo khoác bé', Slug='ao-khoac-be', MoTa='Hoodie, bomber và áo khoác nhẹ cho trẻ em', GioiTinh='treem' WHERE Id=8;
UPDATE DanhMuc SET TenDanhMuc='Áo polo bé', Slug='ao-polo-be', MoTa='Áo polo gọn gàng cho bé đi học và đi chơi', GioiTinh='treem' WHERE Id=9;
UPDATE DanhMuc SET TenDanhMuc='Quần jean bé', Slug='quan-jean-be', MoTa='Jean co giãn, ưu tiên sự thoải mái khi vận động', GioiTinh='treem' WHERE Id=10;
UPDATE DanhMuc SET TenDanhMuc='Quần kaki bé', Slug='quan-kaki-be', MoTa='Kaki mềm, phù hợp đi học và các dịp cần lịch sự', GioiTinh='treem' WHERE Id=11;
UPDATE DanhMuc SET TenDanhMuc='Quần short bé', Slug='quan-short-be', MoTa='Short nhẹ, thoáng dành cho hoạt động hằng ngày', GioiTinh='treem' WHERE Id=12;

UPDATE BoSuuTap SET TenBoSuuTap='Ngày Đến Trường', Slug='ngay-den-truong', MoTa='Trang phục gọn gàng, thoải mái cho bé đi học' WHERE Id=1;
UPDATE BoSuuTap SET TenBoSuuTap='Chơi Cả Ngày', Slug='choi-ca-ngay', MoTa='Các thiết kế mềm, co giãn cho bé vận động tự do' WHERE Id=2;
UPDATE BoSuuTap SET TenBoSuuTap='Tiệc Nhỏ Của Bé', Slug='tiec-nho-cua-be', MoTa='Váy, đầm và outfit xinh xắn cho sinh nhật, lễ và cuối tuần' WHERE Id=3;
UPDATE BoSuuTap SET TenBoSuuTap='Cuối Tuần Phiêu Lưu', Slug='cuoi-tuan-phieu-luu', MoTa='Phong cách năng động cho chuyến đi chơi cùng gia đình' WHERE Id=4;

UPDATE SanPham SET TenSanPham='Áo Thun Bé Trai Cổ Tròn Basic', DanhMuc='Áo bé', DanhMucPhu='Áo thun bé', NhomTuoi='TreEm', GioiTinh='Nam', HinhAnh='/products/ao-thun-be-trai-1.jpg', MoTaNgan='Áo thun cotton mềm, thoáng mát cho bé vận động cả ngày', Slug='ao-thun-be-trai-co-tron-basic', DanhSachSize='["90","100","110","120","130","140","150"]' WHERE Id=1;
UPDATE SanPham SET TenSanPham='Áo Thun Bé Gái Oversize In Hình', DanhMuc='Áo bé', DanhMucPhu='Áo thun bé', NhomTuoi='TreEm', GioiTinh='Nu', HinhAnh='/products/ao-thun-be-gai-1.jpg', MoTaNgan='Áo thun oversize đáng yêu, mềm và dễ phối cho bé gái', Slug='ao-thun-be-gai-oversize-in-hinh', DanhSachSize='["90","100","110","120","130","140"]' WHERE Id=2;
UPDATE SanPham SET TenSanPham='Áo Thun Trẻ Em Tie-Dye Unisex', DanhMuc='Áo bé', DanhMucPhu='Áo thun bé', NhomTuoi='TreEm', GioiTinh='Unisex', HinhAnh='/products/ao-thun-tre-em-tiedye-1.jpg', MoTaNgan='Áo tie-dye nhiều màu cho bé thích phong cách năng động', Slug='ao-thun-tre-em-tie-dye', DanhSachSize='["100","110","120","130","140","150"]' WHERE Id=3;
UPDATE SanPham SET TenSanPham='Áo Sơ Mi Bé Trai Trắng Đi Học', DanhMuc='Áo bé', DanhMucPhu='Áo sơ mi bé', NhomTuoi='TreEm', GioiTinh='Nam', HinhAnh='/products/ao-so-mi-be-trai-1.jpg', MoTaNgan='Áo sơ mi trắng gọn gàng, ít nhăn cho bé đi học và dự lễ', Slug='ao-so-mi-be-trai-trang-di-hoc', DanhSachSize='["100","110","120","130","140","150"]' WHERE Id=4;
UPDATE SanPham SET TenSanPham='Áo Sơ Mi Bé Gái Cổ Sen', DanhMuc='Áo bé', DanhMucPhu='Áo sơ mi bé', NhomTuoi='TreEm', GioiTinh='Nu', HinhAnh='/products/ao-so-mi-be-gai-1.jpg', MoTaNgan='Áo sơ mi cổ sen nhẹ nhàng dành cho bé gái', Slug='ao-so-mi-be-gai-co-sen', DanhSachSize='["100","110","120","130","140"]' WHERE Id=5;
UPDATE SanPham SET TenSanPham='Áo Hoodie Trẻ Em Unisex', DanhMuc='Áo bé', DanhMucPhu='Áo khoác bé', NhomTuoi='TreEm', GioiTinh='Unisex', HinhAnh='/products/hoodie-tre-em-1.jpg', MoTaNgan='Hoodie nỉ mềm, ấm và dễ mặc cho cả bé trai lẫn bé gái', Slug='ao-hoodie-tre-em-unisex', DanhSachSize='["100","110","120","130","140","150"]' WHERE Id=6;
UPDATE SanPham SET TenSanPham='Áo Khoác Bomber Bé Trai', DanhMuc='Áo bé', DanhMucPhu='Áo khoác bé', NhomTuoi='TreEm', GioiTinh='Nam', HinhAnh='/products/bomber-be-trai-1.jpg', MoTaNgan='Bomber nhẹ, cản gió nhẹ cho bé đi chơi', Slug='ao-khoac-bomber-be-trai', DanhSachSize='["100","110","120","130","140","150"]' WHERE Id=7;
UPDATE SanPham SET TenSanPham='Áo Polo Bé Trai Cổ Bẻ', DanhMuc='Áo bé', DanhMucPhu='Áo polo bé', NhomTuoi='TreEm', GioiTinh='Nam', HinhAnh='/products/polo-be-trai-1.jpg', MoTaNgan='Áo polo thoáng mát, lịch sự nhưng vẫn dễ vận động', Slug='ao-polo-be-trai-co-be', DanhSachSize='["100","110","120","130","140","150"]' WHERE Id=8;
UPDATE SanPham SET TenSanPham='Quần Jean Bé Trai Slim Co Giãn', DanhMuc='Quần bé', DanhMucPhu='Quần jean bé', NhomTuoi='TreEm', GioiTinh='Nam', HinhAnh='/products/jean-be-trai-1.jpg', MoTaNgan='Jean mềm, co giãn nhẹ để bé vận động thoải mái', Slug='quan-jean-be-trai-slim-co-gian', DanhSachSize='["100","110","120","130","140","150"]' WHERE Id=9;
UPDATE SanPham SET TenSanPham='Quần Jean Bé Gái Ống Rộng', DanhMuc='Quần bé', DanhMucPhu='Quần jean bé', NhomTuoi='TreEm', GioiTinh='Nu', HinhAnh='/products/jean-be-gai-1.jpg', MoTaNgan='Jean ống rộng mềm, phong cách và dễ phối cho bé gái', Slug='quan-jean-be-gai-ong-rong', DanhSachSize='["100","110","120","130","140","150"]' WHERE Id=10;
UPDATE SanPham SET TenSanPham='Quần Kaki Bé Trai Đi Học', DanhMuc='Quần bé', DanhMucPhu='Quần kaki bé', NhomTuoi='TreEm', GioiTinh='Nam', HinhAnh='/products/kaki-be-trai-1.jpg', MoTaNgan='Kaki mềm, gọn gàng và ít nhăn cho bé đi học', Slug='quan-kaki-be-trai-di-hoc', DanhSachSize='["100","110","120","130","140","150"]' WHERE Id=11;
UPDATE SanPham SET TenSanPham='Quần Short Bé Trai Thể Thao', DanhMuc='Quần bé', DanhMucPhu='Quần short bé', NhomTuoi='TreEm', GioiTinh='Nam', HinhAnh='/products/short-be-trai-1.jpg', MoTaNgan='Short nhẹ, nhanh khô cho hoạt động ngoài trời', Slug='quan-short-be-trai-the-thao', DanhSachSize='["90","100","110","120","130","140"]' WHERE Id=12;
UPDATE SanPham SET TenSanPham='Váy Bé Gái Xếp Ly Dịu Dàng', DanhMuc='Váy bé gái', DanhMucPhu=NULL, NhomTuoi='TreEm', GioiTinh='Nu', HinhAnh='/products/vay-be-gai-xep-ly-1.jpg', MoTaNgan='Váy xếp ly nhẹ, dễ xoay và phù hợp nhiều dịp', Slug='vay-be-gai-xep-ly-diu-dang', DanhSachSize='["100","110","120","130","140"]' WHERE Id=13;
UPDATE SanPham SET TenSanPham='Váy Tennis Bé Gái Năng Động', DanhMuc='Váy bé gái', DanhMucPhu=NULL, NhomTuoi='TreEm', GioiTinh='Nu', HinhAnh='/products/vay-tennis-be-gai-1.jpg', MoTaNgan='Váy tennis có quần trong, tiện cho bé chạy nhảy', Slug='vay-tennis-be-gai-nang-dong', DanhSachSize='["100","110","120","130","140"]' WHERE Id=14;
UPDATE SanPham SET TenSanPham='Đầm Bé Gái Dự Tiệc Cổ Nơ', DanhMuc='Đầm bé gái', DanhMucPhu=NULL, NhomTuoi='TreEm', GioiTinh='Nu', HinhAnh='/products/dam-be-gai-du-tiec-1.jpg', MoTaNgan='Đầm dự tiệc xinh xắn cho sinh nhật và dịp đặc biệt', Slug='dam-be-gai-du-tiec-co-no', DanhSachSize='["100","110","120","130","140"]' WHERE Id=15;
UPDATE SanPham SET TenSanPham='Đầm Bé Gái Tay Lỡ Thanh Lịch', DanhMuc='Đầm bé gái', DanhMucPhu=NULL, NhomTuoi='TreEm', GioiTinh='Nu', HinhAnh='/products/dam-be-gai-tay-lo-1.jpg', MoTaNgan='Đầm tay lỡ nhẹ nhàng cho bé đi chơi và dự lễ', Slug='dam-be-gai-tay-lo-thanh-lich', DanhSachSize='["100","110","120","130","140"]' WHERE Id=16;
UPDATE SanPham SET TenSanPham='Túi Tote Mini KaitoKid Cho Bé', DanhMuc='Phụ kiện bé', DanhMucPhu=NULL, NhomTuoi='TreEm', GioiTinh='Unisex', HinhAnh='/products/tui-tote-mini-be-1.jpg', MoTaNgan='Túi tote mini nhẹ, phù hợp mang đồ cá nhân nhỏ của bé', Slug='tui-tote-mini-kaitokid-cho-be', DanhSachSize='["Freesize"]' WHERE Id=17;
UPDATE SanPham SET TenSanPham='Mũ Lưỡi Trai Trẻ Em Thêu Logo', DanhMuc='Phụ kiện bé', DanhMucPhu=NULL, NhomTuoi='TreEm', GioiTinh='Unisex', HinhAnh='/products/mu-luoi-trai-tre-em-1.jpg', MoTaNgan='Mũ nhẹ có khóa điều chỉnh phù hợp vòng đầu trẻ em', Slug='mu-luoi-trai-tre-em-theu-logo', DanhSachSize='["Freesize"]' WHERE Id=18;
UPDATE SanPham SET TenSanPham='Thắt Lưng Trẻ Em Khóa Tự Động', DanhMuc='Phụ kiện bé', DanhMucPhu=NULL, NhomTuoi='TreEm', GioiTinh='Unisex', HinhAnh='/products/that-lung-tre-em-1.jpg', MoTaNgan='Thắt lưng nhẹ, dễ điều chỉnh cho trang phục đi học và dự lễ', Slug='that-lung-tre-em-khoa-tu-dong', DanhSachSize='["Freesize"]' WHERE Id=19;

UPDATE Banner SET TieuDe='Bé Vui Đến Trường', TieuDePhu='Gọn gàng · Mềm mại · Dễ vận động', LienKet='/categories/ao-be' WHERE ThuTu=1 AND ViTri='homepage';
UPDATE Banner SET TieuDe='Mặc Xinh Chơi Cả Ngày', TieuDePhu='Outfit mới cho mọi cuộc phiêu lưu', LienKet='/categories/quan-be' WHERE ThuTu=2 AND ViTri='homepage';
UPDATE Banner SET TieuDe='Ưu Đãi Cho Bé', TieuDePhu='Deal nổi bật cho tủ đồ mới', LienKet='/categories/vay-be-gai' WHERE ThuTu=3 AND ViTri='homepage';

UPDATE Lookbook SET TieuDe='Ngày Đến Trường', TieuDePhu='Back to School', MoTa='Gợi ý outfit gọn gàng, thoải mái cho bé đi học', LienKet='/categories/ao-be' WHERE Id=1;
UPDATE Lookbook SET TieuDe='Cuối Tuần Phiêu Lưu', TieuDePhu='Weekend Fun', MoTa='Phối đồ năng động để bé tự do vui chơi cùng gia đình', LienKet='/categories/quan-be' WHERE Id=2;

UPDATE TrangTinh SET NoiDung='<h2>Về KAITO KID</h2><p>KAITO KID là thương hiệu thời trang trẻ em 0-12 tuổi, ưu tiên sự mềm mại, thoải mái, dễ vận động và phong cách tươi vui phù hợp trẻ nhỏ.</p>' WHERE Slug='gioi-thieu';
UPDATE TrangTinh SET TieuDe='Hướng dẫn chọn size cho bé', NoiDung='<h2>Hướng dẫn chọn size cho bé</h2><p>Size KAITO KID ưu tiên theo chiều cao của bé (90-150). Hãy đo chiều cao và cân nặng thực tế; nếu bé nằm giữa hai size hoặc thích mặc rộng, ưu tiên size lớn hơn.</p>' WHERE Slug='huong-dan-chon-size';

UPDATE ChiTietDonHang SET TenSanPham='Áo Thun Bé Trai Cổ Tròn Basic', HinhAnhSP='/products/ao-thun-be-trai-1.jpg', KichCo='120' WHERE SanPhamId=1;
UPDATE ChiTietDonHang SET TenSanPham='Áo Polo Bé Trai Cổ Bẻ', HinhAnhSP='/products/polo-be-trai-1.jpg', KichCo='120' WHERE SanPhamId=8;
UPDATE ChiTietDonHang SET TenSanPham='Quần Jean Bé Trai Slim Co Giãn', HinhAnhSP='/products/jean-be-trai-1.jpg', KichCo='130' WHERE SanPhamId=9;
UPDATE ChiTietDonHang SET TenSanPham='Áo Hoodie Trẻ Em Unisex', HinhAnhSP='/products/hoodie-tre-em-1.jpg', KichCo='130' WHERE SanPhamId=6;

UPDATE DanhGia SET NoiDung='Vải mềm, bé mặc mát và vận động thoải mái. Giao hàng nhanh!' WHERE SanPhamId=1 AND Id=1;
UPDATE DanhGia SET NoiDung='Form áo cho bé gọn gàng, chất vải dễ chịu và đóng gói cẩn thận.' WHERE SanPhamId=1 AND Id=2;
UPDATE DanhGia SET NoiDung='Áo sơ mi bé mặc đi học rất xinh, vải mềm và ít nhăn.' WHERE SanPhamId=4;
UPDATE DanhGia SET NoiDung='Hoodie ấm, lớp nỉ mềm và bé mặc rất thoải mái.' WHERE SanPhamId=6;
UPDATE DanhGia SET NoiDung='Jean co giãn tốt, bé chạy nhảy không bị cứng.' WHERE SanPhamId=9;

COMMIT;

SELECT COUNT(*) AS san_pham_tre_em
FROM SanPham
WHERE NhomTuoi='TreEm' AND TrangThai='active';

SELECT Id, TenSanPham, DanhMuc, GioiTinh, NhomTuoi, DanhSachSize
FROM SanPham
ORDER BY Id;
