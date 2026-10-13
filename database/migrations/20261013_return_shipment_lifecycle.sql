-- Bắt buộc chạy thủ công trên database hiện có trước khi bật workflow hoàn qua hãng.
-- Create-only, không đụng dữ liệu DonHang/đơn hoàn lịch sử.
CREATE TABLE IF NOT EXISTS VanDonHoanHang (
  Id INT AUTO_INCREMENT PRIMARY KEY,
  DonHangId INT NOT NULL,
  NhaVanChuyen VARCHAR(30) NOT NULL,
  MaVanDon VARCHAR(120) NULL,
  MaBaoGia VARCHAR(120) NULL,
  TrangThai VARCHAR(30) NOT NULL DEFAULT 'placing',
  TenNguoiGui VARCHAR(100) NOT NULL,
  SDTNguoiGui VARCHAR(30) NOT NULL,
  DiaChiLay VARCHAR(500) NOT NULL,
  TenNguoiNhan VARCHAR(100) NOT NULL,
  SDTNguoiNhan VARCHAR(30) NOT NULL,
  DiaChiGiao VARCHAR(500) NOT NULL,
  PhiVanChuyen DECIMAL(18,0) NULL,
  LinkTheoDoi VARCHAR(500) NULL,
  GiaoThanhCongLuc DATETIME(6) NULL,
  LoiCuoi VARCHAR(300) NULL,
  NgayTao DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  NgayCapNhat DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT UQ_VanDonHoanHang_DonHang UNIQUE (DonHangId),
  CONSTRAINT UQ_VanDonHoanHang_Ma UNIQUE (NhaVanChuyen, MaVanDon),
  CONSTRAINT FK_VanDonHoanHang_DonHang FOREIGN KEY (DonHangId) REFERENCES DonHang(Id),
  INDEX IX_VanDonHoanHang_TrangThai (TrangThai, NgayCapNhat)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
