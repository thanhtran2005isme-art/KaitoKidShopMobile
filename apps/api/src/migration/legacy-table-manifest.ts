/**
 * 52 bảng hiện có trong backend/Database/KaitoKid_MariaDB.sql trên main
 * sau khi đã bao gồm migration xác nhận email đăng ký.
 *
 * Đây là contract bảo toàn dữ liệu khi chuyển C# -> Node.
 */
export const LEGACY_TABLES = [
  "NguoiDung", "DanhMuc", "SanPham", "ThuocTinhSanPham", "BoSuuTap",
  "GioHang", "DonHang", "ChiTietDonHang", "DanhSachYeuThich", "DanhGia",
  "DiaChi", "MaGiamGia", "KhuyenMai", "FlashSale", "ChiTietFlashSale",
  "Banner", "Lookbook", "TonKho_LichSu", "CanhBaoTonKho", "TrangTinh",
  "MenuDieuHuong", "CauHinhCuaHang", "CauHinhTrangChu", "LichSuThanhToan",
  "ThongBao", "NhatKyHoatDong", "NhaCungCap", "PhieuNhap", "ChiTietPhieuNhap",
  "TonKhoBienThe", "CuocHoiThoai", "TinNhan", "SanPhamEmbedding", "LoginActivity",
  "EmailVerificationToken", "PendingRegistration", "PasswordResetToken", "OtpCode",
  "HomepageBlock", "LookbookHotspot", "LichSuDiem", "DangKyNewsletter", "BangSize",
  "CauHoiSanPham", "PhienXemSanPham", "GioiThieu", "LichSuTrangThaiVanChuyen",
  "VaiTro", "QuyenHan", "VaiTro_QuyenHan", "NhanVien", "LichSuDangNhapNV",
] as const;

export const LEGACY_TABLE_COUNT = LEGACY_TABLES.length;
