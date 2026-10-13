/**
 * Contract bảng MariaDB hiện hành của KaitoKid.
 *
 * 52 bảng nền từ database/KaitoKid_MariaDB.sql + 3 bảng Ví KaitoKid được
 * bổ sung bởi migration 20261006_wallet_refund_withdrawal.sql.
 * Đây là contract bảo toàn dữ liệu khi Node API khởi động/audit database.
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
  "ViDienTu", "GiaoDichVi", "YeuCauRutTien",
] as const;

export const LEGACY_TABLE_COUNT = LEGACY_TABLES.length;
