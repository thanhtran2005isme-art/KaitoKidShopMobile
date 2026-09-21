-- ================================================================
-- KaitoKid - MariaDB 10.4 / XAMPP full schema
-- Converted from Database/KaitoKid_Database.sql
-- Target: MariaDB 10.4.32 (XAMPP)
--
-- WARNING: CLEAN REBUILD. This script DROPS database KaitoKid.
-- Use only when existing KaitoKid data does not need to be preserved.
-- ================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

DROP DATABASE IF EXISTS KaitoKid;
CREATE DATABASE KaitoKid
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE KaitoKid;


-- ================================================================
-- Tables converted from the SQL Server master schema
-- ================================================================
CREATE TABLE NguoiDung (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    HoTen           VARCHAR(100)       NOT NULL,               -- Họ tên: Nguyễn Văn A
    Email           VARCHAR(200)       NOT NULL,               -- Email đăng nhập
    MatKhauHash     VARCHAR(500)       NOT NULL,               -- Mật khẩu mã hóa BCrypt
    SoDienThoai     VARCHAR(20)        NULL,                   -- SĐT: 0901234567
    AnhDaiDien      VARCHAR(500)       NULL,                   -- URL ảnh avatar
    VaiTro          VARCHAR(20)        NOT NULL DEFAULT 'user', -- user / admin
    RefreshToken    VARCHAR(500)       NULL,                   -- Token làm mới phiên đăng nhập
    HanRefreshToken DATETIME(6)           NULL,                   -- Hạn sử dụng refresh token
    TrangThai       TINYINT(1)                 NOT NULL DEFAULT 1,     -- 1=Hoạt động, 0=Khóa
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    NgayCapNhat     DATETIME(6)           NULL,

    CONSTRAINT UQ_NguoiDung_Email UNIQUE (Email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE DanhMuc (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    TenDanhMuc      VARCHAR(100)       NOT NULL,               -- Áo, Quần, Váy, Đầm
    Slug            VARCHAR(150)       NULL,                   -- ao, quan, vay, dam
    MoTa            VARCHAR(500)       NULL,                   -- Mô tả ngắn
    HinhAnh         VARCHAR(500)       NULL,                   -- Ảnh đại diện
    DanhMucChaId    INT                 NULL,                   -- NULL = danh mục gốc
    ThuTu           INT                 NOT NULL DEFAULT 0,     -- Thứ tự sắp xếp
    TrangThai       TINYINT(1)                 NOT NULL DEFAULT 1,     -- 1=Hiện, 0=Ẩn
    GioiTinh        VARCHAR(20)        NOT NULL DEFAULT 'all', -- all, nu, nam, treem
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT FK_DanhMuc_Cha FOREIGN KEY (DanhMucChaId) REFERENCES DanhMuc(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE SanPham (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    TenSanPham      VARCHAR(200)       NOT NULL,               -- Áo Thun Nam Cổ Tròn Basic
    DanhMucId       INT                 NULL,                   -- FK đến DanhMuc
    DanhMuc         VARCHAR(100)       NOT NULL,               -- Tên danh mục: Ao, Quan, Vay
    DanhMucPhu      VARCHAR(100)       NULL,                   -- Danh mục phụ: Ao Thun, Ao So Mi
    PhongCach       VARCHAR(100)       NULL,                   -- Casual, Formal, Sport, Streetwear
    NhomTuoi        VARCHAR(50)        NULL,                   -- NguoiLon, TreEm
    GioiTinh        VARCHAR(20)        NOT NULL,               -- Nam, Nu, Unisex
    Gia             DECIMAL(18,0)       NOT NULL,               -- Giá bán (VNĐ): 299000
    GiaCu           DECIMAL(18,0)       NULL,                   -- Giá cũ trước giảm: 450000
    TonKho          INT                 NOT NULL DEFAULT 0,     -- Số lượng trong kho
    TrangThai       VARCHAR(20)        NOT NULL DEFAULT 'active',
        -- active: Đang bán
        -- out-of-stock: Hết hàng
        -- draft: Nháp (chưa công khai)
    HinhAnh         VARCHAR(500)       NOT NULL,               -- Ảnh chính sản phẩm
    DanhSachAnh     LONGTEXT       NULL,                   -- JSON mảng ảnh phụ
    MoTaNgan        VARCHAR(500)       NULL,                   -- Mô tả ngắn hiển thị trên card
    MoTaChiTiet     LONGTEXT       NOT NULL,               -- Mô tả chi tiết (có thể HTML)
    MaSanPham       VARCHAR(50)        NOT NULL,               -- SKU: KK-AT-001
    Slug            VARCHAR(200)       NULL,                   -- ao-thun-nam-co-tron-basic
    Menu            VARCHAR(100)       NULL,                   -- Thuộc menu nào trên header
    BoSuuTapId      INT                 NULL,                   -- FK đến BoSuuTap
    MetaTitle       VARCHAR(200)       NULL,                   -- SEO title
    MetaDescription VARCHAR(500)       NULL,                   -- SEO description
    LaSanPhamMoi    TINYINT(1)                 NOT NULL DEFAULT 0,     -- Gắn nhãn NEW
    DangGiamGia     TINYINT(1)                 NOT NULL DEFAULT 0,     -- Gắn nhãn SALE
    BanChayNhat     TINYINT(1)                 NOT NULL DEFAULT 0,     -- Gắn nhãn BEST SELLER
    DiemDanhGia     FLOAT               NOT NULL DEFAULT 0,     -- Rating trung bình 0-5
    SoLuongDaBan    INT                 NOT NULL DEFAULT 0,     -- Tổng số đã bán
    DanhSachMau     LONGTEXT       NULL,                   -- JSON: ["Đen","Trắng","Xanh navy"]
    DanhSachSize    LONGTEXT       NULL,                   -- JSON: ["S","M","L","XL","XXL"]
    BienThe         LONGTEXT       NULL,                   -- JSON: [{size,color,sku,stock}]
    ThongSoKyThuat  LONGTEXT       NULL,                   -- Chất liệu, xuất xứ, hướng dẫn giặt
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    NgayCapNhat     DATETIME(6)           NULL,

    CONSTRAINT UQ_SanPham_MaSP UNIQUE (MaSanPham),
    CONSTRAINT FK_SanPham_DanhMuc FOREIGN KEY (DanhMucId) REFERENCES DanhMuc(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ThuocTinhSanPham (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    TenThuocTinh    VARCHAR(100)       NOT NULL,               -- Chất liệu, Xuất xứ, Kiểu cổ
    GiaTri          VARCHAR(200)       NOT NULL,               -- Cotton 100%, Việt Nam, Cổ tròn
    NhomThuocTinh   VARCHAR(100)       NULL,                   -- Nhóm: Thông tin chung, Chất liệu
    ThuTu           INT                 NOT NULL DEFAULT 0,
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE BoSuuTap (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    TenBoSuuTap     VARCHAR(200)       NOT NULL,               -- Spring/Summer 2025
    Slug            VARCHAR(200)       NULL,                   -- spring-summer-2025
    MoTa            VARCHAR(1000)      NULL,                   -- Mô tả bộ sưu tập
    HinhAnh         VARCHAR(500)       NULL,                   -- Ảnh banner
    TrangThai       TINYINT(1)                 NOT NULL DEFAULT 1,     -- 1=Hiện, 0=Ẩn
    ThuTu           INT                 NOT NULL DEFAULT 0,
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE GioHang (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    NguoiDungId     INT                 NOT NULL,               -- Khách hàng
    SanPhamId       INT                 NOT NULL,               -- Sản phẩm
    KichCo          VARCHAR(20)        NOT NULL,               -- S, M, L, XL, XXL
    MauSac          VARCHAR(50)        NOT NULL,               -- Đen, Trắng, Xanh navy
    SoLuong         INT                 NOT NULL DEFAULT 1,
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT FK_GioHang_NguoiDung FOREIGN KEY (NguoiDungId) REFERENCES NguoiDung(Id),
    CONSTRAINT FK_GioHang_SanPham FOREIGN KEY (SanPhamId) REFERENCES SanPham(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE DonHang (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    MaDonHang       VARCHAR(30)        NOT NULL,               -- KK-20250326-A1B2C3
    NguoiDungId     INT                 NOT NULL,               -- Khách đặt hàng
    TenNguoiNhan    VARCHAR(100)       NOT NULL,               -- Tên người nhận hàng
    SoDienThoai     VARCHAR(20)        NOT NULL,               -- SĐT người nhận
    Email           VARCHAR(200)       NOT NULL,               -- Email người nhận
    DiaChiGiao      VARCHAR(500)       NOT NULL,               -- Địa chỉ giao hàng đầy đủ
    TinhThanh       VARCHAR(100)       NULL,                   -- Tỉnh/Thành phố
    QuanHuyen       VARCHAR(100)       NULL,                   -- Quận/Huyện
    PhuongXa        VARCHAR(100)       NULL,                   -- Phường/Xã
    TamTinh         DECIMAL(18,0)       NOT NULL,               -- Tổng tiền hàng trước giảm
    PhiVanChuyen    DECIMAL(18,0)       NOT NULL DEFAULT 0,     -- Phí ship
    PhiThanhToan    DECIMAL(18,0)       NOT NULL DEFAULT 0,     -- Phí thanh toán (nếu có)
    GiamGia         DECIMAL(18,0)       NOT NULL DEFAULT 0,     -- Số tiền được giảm
    TongTien        DECIMAL(18,0)       NOT NULL,               -- Tổng thanh toán cuối cùng
    MaGiamGia       VARCHAR(50)        NULL,                   -- Mã coupon đã áp dụng
    PhuongThucThanhToan VARCHAR(30)    NOT NULL DEFAULT 'COD',
        -- COD: Thanh toán khi nhận hàng
        -- VISA: Thẻ quốc tế
        -- ATM: Thẻ nội địa
        -- Momo: Ví Momo
        -- BankTransfer: Chuyển khoản
    TrangThai       VARCHAR(20)        NOT NULL DEFAULT 'pending',
        -- pending: Chờ xác nhận
        -- confirmed: Đã xác nhận
        -- shipping: Đang giao hàng
        -- completed: Hoàn thành
        -- cancelled: Đã hủy
        -- returned: Đã trả hàng
    GhiChu          VARCHAR(500)       NULL,                   -- Ghi chú của khách
    GhiChuAdmin     VARCHAR(500)       NULL,                   -- Ghi chú nội bộ của admin
    NgayXacNhan     DATETIME(6)           NULL,                   -- Ngày admin xác nhận
    NgayGiaoHang    DATETIME(6)           NULL,                   -- Ngày bắt đầu giao
    NgayHoanThanh   DATETIME(6)           NULL,                   -- Ngày hoàn thành
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    NgayCapNhat     DATETIME(6)           NULL,

    CONSTRAINT UQ_DonHang_MaDH UNIQUE (MaDonHang),
    CONSTRAINT FK_DonHang_NguoiDung FOREIGN KEY (NguoiDungId) REFERENCES NguoiDung(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ChiTietDonHang (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    DonHangId       INT                 NOT NULL,
    SanPhamId       INT                 NOT NULL,
    TenSanPham      VARCHAR(200)       NOT NULL,               -- Snapshot tên SP lúc đặt
    HinhAnhSP       VARCHAR(500)       NOT NULL,               -- Snapshot ảnh SP
    DonGia          DECIMAL(18,0)       NOT NULL,               -- Giá tại thời điểm mua
    KichCo          VARCHAR(20)        NOT NULL,
    MauSac          VARCHAR(50)        NOT NULL,
    SoLuong         INT                 NOT NULL,

    CONSTRAINT FK_CTDH_DonHang FOREIGN KEY (DonHangId) REFERENCES DonHang(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CTDH_SanPham FOREIGN KEY (SanPhamId) REFERENCES SanPham(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE DanhSachYeuThich (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    NguoiDungId     INT                 NOT NULL,
    SanPhamId       INT                 NOT NULL,
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT FK_YeuThich_NguoiDung FOREIGN KEY (NguoiDungId) REFERENCES NguoiDung(Id),
    CONSTRAINT FK_YeuThich_SanPham FOREIGN KEY (SanPhamId) REFERENCES SanPham(Id),
    CONSTRAINT UQ_YeuThich UNIQUE (NguoiDungId, SanPhamId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE DanhGia (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    SanPhamId       INT                 NOT NULL,               -- Đánh giá cho SP nào
    NguoiDungId     INT                 NOT NULL,               -- Ai đánh giá
    TenKhachHang    VARCHAR(100)       NOT NULL,               -- Tên hiển thị
    DonHangId       INT                 NOT NULL,               -- Đánh giá từ đơn hàng nào
    SoSao           INT                 NOT NULL,               -- 1-5 sao
    NoiDung         VARCHAR(1000)      NOT NULL,               -- Nội dung đánh giá
    TrangThai       VARCHAR(20)        NOT NULL DEFAULT 'pending',
        -- pending: Chờ duyệt
        -- approved: Đã duyệt (hiển thị)
        -- rejected: Từ chối
    PhanHoiAdmin    VARCHAR(500)       NULL,                   -- Admin phản hồi đánh giá
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT FK_DanhGia_SanPham FOREIGN KEY (SanPhamId) REFERENCES SanPham(Id),
    CONSTRAINT FK_DanhGia_NguoiDung FOREIGN KEY (NguoiDungId) REFERENCES NguoiDung(Id),
    CONSTRAINT FK_DanhGia_DonHang FOREIGN KEY (DonHangId) REFERENCES DonHang(Id),
    CONSTRAINT CK_DanhGia_SoSao CHECK (SoSao >= 1 AND SoSao <= 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE DiaChi (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    NguoiDungId     INT                 NOT NULL,
    HoTen           VARCHAR(100)       NOT NULL,               -- Tên người nhận
    SoDienThoai     VARCHAR(20)        NOT NULL,               -- SĐT người nhận
    TinhThanh       VARCHAR(100)       NOT NULL,               -- Tỉnh/Thành phố
    QuanHuyen       VARCHAR(100)       NOT NULL,               -- Quận/Huyện
    PhuongXa        VARCHAR(100)       NOT NULL,               -- Phường/Xã
    DiaChiCuThe     VARCHAR(300)       NOT NULL,               -- Số nhà, tên đường
    LaMacDinh       TINYINT(1)                 NOT NULL DEFAULT 0,     -- 1=Địa chỉ mặc định
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT FK_DiaChi_NguoiDung FOREIGN KEY (NguoiDungId) REFERENCES NguoiDung(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE MaGiamGia (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    MaCoupon        VARCHAR(50)        NOT NULL,               -- SALE10, FREESHIP, WELCOME20
    LoaiGiamGia     VARCHAR(20)        NOT NULL DEFAULT 'percent',
        -- percent: Giảm theo %
        -- fixed: Giảm số tiền cố định
    GiaTri          DECIMAL(18,0)       NOT NULL,               -- 10 (=10%) hoặc 50000 (=50K)
    DonToiThieu     DECIMAL(18,0)       NULL,                   -- Đơn tối thiểu để áp dụng
    GiamToiDa       DECIMAL(18,0)       NULL,                   -- Giảm tối đa (cho loại %)
    SoLuotDung      INT                 NOT NULL DEFAULT 0,     -- Tổng lượt cho phép
    DaSuDung        INT                 NOT NULL DEFAULT 0,     -- Đã dùng bao nhiêu lượt
    NgayBatDau      DATETIME(6)           NOT NULL,               -- Bắt đầu hiệu lực
    NgayKetThuc     DATETIME(6)           NOT NULL,               -- Hết hạn
    TrangThai       TINYINT(1)                 NOT NULL DEFAULT 1,     -- 1=Hoạt động, 0=Tắt
    MoTa            VARCHAR(300)       NULL,                   -- Mô tả: "Giảm 10% cho đơn từ 500K"
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT UQ_MaGiamGia_Ma UNIQUE (MaCoupon)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE KhuyenMai (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    TenKhuyenMai    VARCHAR(200)       NOT NULL,               -- "Giảm 20% toàn bộ áo thun"
    LoaiGiamGia     VARCHAR(20)        NOT NULL DEFAULT 'percent',
    GiaTri          DECIMAL(18,0)       NOT NULL,
    ApDungCho       VARCHAR(50)        NOT NULL DEFAULT 'all',
        -- all: Toàn bộ sản phẩm
        -- category: Theo danh mục
        -- product: Theo sản phẩm cụ thể
    DanhMucApDung   VARCHAR(200)       NULL,                   -- Tên danh mục (nếu ApDungCho=category)
    SanPhamApDung   LONGTEXT       NULL,                   -- JSON danh sách ID SP
    NgayBatDau      DATETIME(6)           NOT NULL,
    NgayKetThuc     DATETIME(6)           NOT NULL,
    TrangThai       TINYINT(1)                 NOT NULL DEFAULT 1,
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE FlashSale (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    TenFlashSale    VARCHAR(200)       NOT NULL,               -- "Flash Sale 24H"
    NgayBatDau      DATETIME(6)           NOT NULL,
    NgayKetThuc     DATETIME(6)           NOT NULL,
    TrangThai       TINYINT(1)                 NOT NULL DEFAULT 1,
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ChiTietFlashSale (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    FlashSaleId     INT                 NOT NULL,
    SanPhamId       INT                 NOT NULL,
    GiaFlashSale    DECIMAL(18,0)       NOT NULL,               -- Giá đặc biệt trong flash sale
    SoLuongGioiHan  INT                 NOT NULL DEFAULT 0,     -- 0 = không giới hạn
    DaBan           INT                 NOT NULL DEFAULT 0,     -- Đã bán trong flash sale

    CONSTRAINT FK_CTFS_FlashSale FOREIGN KEY (FlashSaleId) REFERENCES FlashSale(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CTFS_SanPham FOREIGN KEY (SanPhamId) REFERENCES SanPham(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE Banner (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    TieuDe          VARCHAR(200)       NOT NULL,               -- "Summer Sale 50%"
    TieuDePhu       VARCHAR(200)       NULL,                   -- Subtitle
    MoTa            VARCHAR(500)       NULL,
    HinhAnh         VARCHAR(500)       NOT NULL,               -- URL ảnh banner
    LienKet         VARCHAR(500)       NULL,                   -- Link khi click
    LoaiBanner      VARCHAR(30)        NOT NULL DEFAULT 'slider',
        -- slider: Slider trang chủ
        -- popup: Popup quảng cáo
        -- category: Banner danh mục
        -- promotion: Banner khuyến mãi
    ViTri           VARCHAR(50)        NOT NULL DEFAULT 'homepage',
        -- homepage: Trang chủ
        -- category: Trang danh mục
        -- product: Trang sản phẩm
    ThuTu           INT                 NOT NULL DEFAULT 0,
    TrangThai       VARCHAR(20)        NOT NULL DEFAULT 'active',
    NgayBatDau      DATETIME(6)           NULL,
    NgayKetThuc     DATETIME(6)           NULL,
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE Lookbook (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    TieuDe          VARCHAR(200)       NOT NULL,               -- "Street Style Mùa Hè"
    TieuDePhu       VARCHAR(200)       NULL,
    MoTa            VARCHAR(1000)      NULL,
    HinhAnh         VARCHAR(500)       NOT NULL,               -- Ảnh chính
    LienKet         VARCHAR(500)       NULL,                   -- Link đến bộ sưu tập
    TrangThai       VARCHAR(20)        NOT NULL DEFAULT 'active',
    ThuTu           INT                 NOT NULL DEFAULT 0,
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE TonKho_LichSu (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    SanPhamId       INT                 NOT NULL,
    LoaiThayDoi     VARCHAR(20)        NOT NULL,
        -- import: Nhập kho
        -- export: Xuất kho (bán)
        -- adjust: Điều chỉnh thủ công
        -- return: Trả hàng
    SoLuong         INT                 NOT NULL,               -- Số lượng thay đổi (+/-)
    TonKhoTruoc     INT                 NOT NULL,               -- Tồn kho trước khi thay đổi
    TonKhoSau       INT                 NOT NULL,               -- Tồn kho sau khi thay đổi
    GhiChu          VARCHAR(300)       NULL,                   -- Lý do: "Nhập hàng đợt 3"
    NguoiThucHien   VARCHAR(100)       NULL,                   -- Admin nào thực hiện
    DonHangId       INT                 NULL,                   -- Liên quan đến đơn hàng nào
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT FK_TonKho_SanPham FOREIGN KEY (SanPhamId) REFERENCES SanPham(Id),
    CONSTRAINT FK_TonKho_DonHang FOREIGN KEY (DonHangId) REFERENCES DonHang(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE CanhBaoTonKho (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    SanPhamId       INT                 NOT NULL,
    NguongCanhBao   INT                 NOT NULL DEFAULT 5,     -- Cảnh báo khi tồn kho <= 5
    TonKhoHienTai   INT                 NOT NULL,
    TrangThai       VARCHAR(20)        NOT NULL DEFAULT 'active',
        -- active: Đang cảnh báo
        -- resolved: Đã xử lý (nhập thêm hàng)
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    NgayXuLy        DATETIME(6)           NULL,

    CONSTRAINT FK_CanhBao_SanPham FOREIGN KEY (SanPhamId) REFERENCES SanPham(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE TrangTinh (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    TieuDe          VARCHAR(200)       NOT NULL,               -- "Chính sách đổi trả"
    Slug            VARCHAR(200)       NOT NULL,               -- chinh-sach-doi-tra
    NoiDung         LONGTEXT       NOT NULL,               -- Nội dung HTML
    TrangThai       VARCHAR(20)        NOT NULL DEFAULT 'published',
        -- published: Đã xuất bản
        -- draft: Nháp
    MetaTitle       VARCHAR(200)       NULL,
    MetaDescription VARCHAR(500)       NULL,
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    NgayCapNhat     DATETIME(6)           NULL,

    CONSTRAINT UQ_TrangTinh_Slug UNIQUE (Slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE MenuDieuHuong (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    TenMenu         VARCHAR(100)       NOT NULL,               -- "Nữ", "Nam", "Sale"
    LienKet         VARCHAR(300)       NOT NULL,               -- /women, /men, /sale
    ViTri           VARCHAR(30)        NOT NULL DEFAULT 'header',
        -- header: Menu chính trên header
        -- footer: Menu dưới footer
        -- mobile: Menu mobile
    MenuChaId       INT                 NULL,                   -- Menu cha (dropdown)
    ThuTu           INT                 NOT NULL DEFAULT 0,
    TrangThai       TINYINT(1)                 NOT NULL DEFAULT 1,
    BieuTuong       VARCHAR(100)       NULL,                   -- Icon class (fa fa-xxx)
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT FK_Menu_Cha FOREIGN KEY (MenuChaId) REFERENCES MenuDieuHuong(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE CauHinhCuaHang (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    MaCauHinh       VARCHAR(100)       NOT NULL,               -- Key cấu hình
    GiaTri          LONGTEXT       NOT NULL,               -- Value
    NhomCauHinh     VARCHAR(50)        NOT NULL DEFAULT 'general',
        -- general: Thông tin chung
        -- payment: Thanh toán
        -- shipping: Vận chuyển
        -- email: Email
        -- notification: Thông báo
        -- security: Bảo mật
    MoTa            VARCHAR(300)       NULL,
    NgayCapNhat     DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT UQ_CauHinh_Ma UNIQUE (MaCauHinh)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE CauHinhTrangChu (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    TenSection      VARCHAR(100)       NOT NULL,               -- newArrivals, bestSellers, saleProducts
    DanhSachSPId    LONGTEXT       NULL,                   -- JSON: [1,5,12,23]
    ThuTu           INT                 NOT NULL DEFAULT 0,
    TrangThai       TINYINT(1)                 NOT NULL DEFAULT 1,
    NgayCapNhat     DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE LichSuThanhToan (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    DonHangId       INT                 NOT NULL,
    PhuongThuc      VARCHAR(30)        NOT NULL,               -- COD, VISA, ATM, Momo
    SoTien          DECIMAL(18,0)       NOT NULL,
    TrangThai       VARCHAR(20)        NOT NULL DEFAULT 'pending',
        -- pending: Chờ thanh toán
        -- success: Thành công
        -- failed: Thất bại
        -- refunded: Đã hoàn tiền
    MaGiaoDich      VARCHAR(100)       NULL,                   -- Mã giao dịch từ cổng TT
    GhiChu          VARCHAR(300)       NULL,
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT FK_ThanhToan_DonHang FOREIGN KEY (DonHangId) REFERENCES DonHang(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ThongBao (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    NguoiDungId     INT                 NOT NULL,               -- Gửi cho ai
    TieuDe          VARCHAR(200)       NOT NULL,               -- "Đơn hàng KK-xxx đã được xác nhận"
    NoiDung         VARCHAR(500)       NOT NULL,
    LoaiThongBao    VARCHAR(30)        NOT NULL DEFAULT 'order',
        -- order: Liên quan đơn hàng
        -- promotion: Khuyến mãi
        -- system: Hệ thống
    DaDoc           TINYINT(1)                 NOT NULL DEFAULT 0,     -- 0=Chưa đọc, 1=Đã đọc
    LienKet         VARCHAR(300)       NULL,                   -- Link đến chi tiết
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT FK_ThongBao_NguoiDung FOREIGN KEY (NguoiDungId) REFERENCES NguoiDung(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE NhatKyHoatDong (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    NguoiDungId     INT                 NOT NULL,               -- Admin nào
    HanhDong        VARCHAR(50)        NOT NULL,               -- create, update, delete, login
    DoiTuong        VARCHAR(50)        NOT NULL,               -- product, order, customer, coupon
    DoiTuongId      INT                 NULL,                   -- ID của đối tượng
    ChiTiet         VARCHAR(500)       NULL,                   -- Mô tả chi tiết hành động
    DiaChiIP        VARCHAR(50)        NULL,                   -- IP address
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT FK_NhatKy_NguoiDung FOREIGN KEY (NguoiDungId) REFERENCES NguoiDung(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE NhaCungCap (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        TenNhaCungCap VARCHAR(255) NOT NULL DEFAULT '',
        MaNhaCungCap VARCHAR(50) NULL,
        NguoiLienHe VARCHAR(100) NULL,
        SoDienThoai VARCHAR(20) NULL,
        Email VARCHAR(100) NULL,
        DiaChi VARCHAR(500) NULL,
        MaSoThue VARCHAR(50) NULL,
        GhiChu VARCHAR(500) NULL,
        TrangThai TINYINT(1) NOT NULL DEFAULT 1,
        NgayTao DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        NgayCapNhat DATETIME(6) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE PhieuNhap (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        MaPhieu VARCHAR(50) NOT NULL DEFAULT '',
        NhaCungCapId INT NULL,
        TenNhaCungCap VARCHAR(255) NULL,
        NgayNhap DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        NguoiNhap VARCHAR(100) NULL,
        TongGiaTri DECIMAL(18,0) NOT NULL DEFAULT 0,
        GhiChu VARCHAR(1000) NULL,
        TrangThai VARCHAR(20) NOT NULL DEFAULT 'done',
        NgayTao DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        NgayCapNhat DATETIME(6) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ChiTietPhieuNhap (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        PhieuNhapId INT NOT NULL,
        SanPhamId INT NOT NULL,
        TenSanPham VARCHAR(255) NOT NULL DEFAULT '',
        KichCo VARCHAR(20) NULL,
        MauSac VARCHAR(50) NULL,
        SoLuong INT NOT NULL DEFAULT 0,
        DonGiaNhap DECIMAL(18,0) NOT NULL DEFAULT 0,
        ThanhTien DECIMAL(18,0) NOT NULL DEFAULT 0,
        GhiChu VARCHAR(500) NULL,
        CONSTRAINT FK_ChiTietPhieuNhap_PhieuNhap FOREIGN KEY (PhieuNhapId)
            REFERENCES PhieuNhap(Id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE TonKhoBienThe (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        SanPhamId INT NOT NULL,
        KichCo VARCHAR(20) NOT NULL DEFAULT '',
        MauSac VARCHAR(50) NOT NULL DEFAULT '',
        SoLuong INT NOT NULL DEFAULT 0,
        SoLuongDaBan INT NOT NULL DEFAULT 0,
        GiaVonTrungBinh DECIMAL(18,0) NULL,
        NgayTao DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        NgayCapNhat DATETIME(6) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE CuocHoiThoai (
    Id                  INT AUTO_INCREMENT   PRIMARY KEY,
    NguoiDungId         INT                 NULL,                   -- NULL nếu là khách vãng lai
    MaKhachVangLai      VARCHAR(64)        NULL,                   -- Định danh guest (localStorage)
    TenHienThi          VARCHAR(100)       NULL,                   -- Tên khách (nếu có)
    TrangThai           VARCHAR(20)        NOT NULL DEFAULT 'bot',
        -- bot: Chatbot đang xử lý
        -- waiting: Chờ nhân viên nhận (hàng đợi)
        -- agent: Nhân viên đang xử lý
        -- closed: Đã đóng
    NhanVienId          INT                 NULL,                   -- Nhân viên đang xử lý
    SanPhamNguCanhId    INT                 NULL,                   -- Sản phẩm khách đang xem khi mở chat
    TinNhanCuoi         VARCHAR(500)       NULL,                   -- Preview tin cuối cho inbox
    ThoiGianTinCuoi     DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6), -- Sắp xếp inbox
    SoTinChuaDocKhach   INT                 NOT NULL DEFAULT 0,     -- Số tin khách chưa đọc
    SoTinChuaDocNV      INT                 NOT NULL DEFAULT 0,     -- Số tin nhân viên chưa đọc
    NgayTao             DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    NgayCapNhat         DATETIME(6)           NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE TinNhan (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    CuocHoiThoaiId  INT                 NOT NULL,               -- Thuộc phiên nào
    LoaiNguoiGui    VARCHAR(20)        NOT NULL,
        -- customer: Khách hàng
        -- bot: Chatbot
        -- agent: Nhân viên
    NguoiGuiId      INT                 NULL,                   -- userId hoặc staffId; NULL cho bot/guest
    NoiDung         LONGTEXT       NOT NULL,               -- Văn bản (escape khi render)
    LoaiDinhKem     VARCHAR(20)        NULL,                   -- product / order / NULL
    DinhKemId       VARCHAR(50)        NULL,                   -- Id sản phẩm hoặc mã đơn
    DinhKemJson     LONGTEXT       NULL,                   -- Snapshot JSON để hiển thị card
    DaDoc           TINYINT(1)                 NOT NULL DEFAULT 0,     -- 0=Chưa đọc, 1=Đã đọc
    NgayTao         DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT FK_TinNhan_CuocHoiThoai FOREIGN KEY (CuocHoiThoaiId)
        REFERENCES CuocHoiThoai(Id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE SanPhamEmbedding (
    Id              INT AUTO_INCREMENT   PRIMARY KEY,
    SanPhamId       INT                 NOT NULL,               -- FK đến SanPham
    SoChieu         INT                 NOT NULL,               -- Số chiều vector (vd 512)
    Vector          LONGTEXT       NOT NULL,               -- JSON: [0.12,-0.03,...]
    Model           VARCHAR(200)       NOT NULL,               -- Tên/phiên bản model sinh embedding
    NguonHash       VARCHAR(100)       NOT NULL,               -- Hash URL ảnh nguồn (phát hiện đổi ảnh)
    NgayCapNhat     DATETIME(6)           NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT FK_SanPhamEmbedding_SanPham FOREIGN KEY (SanPhamId)
        REFERENCES SanPham(Id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE LoginActivity (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        UserId INT NULL,
        Email VARCHAR(255) NOT NULL,
        Provider VARCHAR(20) NOT NULL DEFAULT 'local',  -- local | google | facebook
        Ip VARCHAR(50) NULL,
        UserAgent VARCHAR(500) NULL,
        DeviceType VARCHAR(30) NULL,
        Browser VARCHAR(50) NULL,
        Os VARCHAR(50) NULL,
        Country VARCHAR(50) NULL,
        Success TINYINT(1) NOT NULL,
        FailReason VARCHAR(200) NULL,
        CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE EmailVerificationToken (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        UserId INT NOT NULL,
        Email VARCHAR(255) NOT NULL,
        Token VARCHAR(200) NOT NULL,
        ExpiresAt DATETIME(6) NOT NULL,
        VerifiedAt DATETIME(6) NULL,
        CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE PasswordResetToken (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        UserId INT NOT NULL,
        Email VARCHAR(255) NOT NULL,
        Token VARCHAR(200) NOT NULL,
        ExpiresAt DATETIME(6) NOT NULL,
        UsedAt DATETIME(6) NULL,
        CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        CONSTRAINT FK_PRT_NguoiDung FOREIGN KEY (UserId) REFERENCES NguoiDung(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE OtpCode (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        Identifier VARCHAR(255) NOT NULL,    -- email hoặc phone
        Channel VARCHAR(20) NOT NULL,        -- email | sms
        Purpose VARCHAR(30) NOT NULL,        -- register | reset_password | verify_phone
        Code VARCHAR(10) NOT NULL,
        ExpiresAt DATETIME(6) NOT NULL,
        VerifiedAt DATETIME(6) NULL,
        AttemptCount INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE HomepageBlock (
        Id          INT AUTO_INCREMENT PRIMARY KEY,
        BlockType   VARCHAR(40)  NOT NULL,    -- hero | categoryTile | brandValue | socialImage
        TieuDe      VARCHAR(200) NULL,
        TieuDePhu   VARCHAR(200) NULL,
        MoTa        VARCHAR(500) NULL,
        HinhAnh     VARCHAR(500) NULL,
        LienKet     VARCHAR(500) NULL,
        Icon        VARCHAR(80)  NULL,        -- icon key cho brandValue
        ThuTu       INT NOT NULL DEFAULT 0,
        TrangThai   TINYINT(1) NOT NULL DEFAULT 1,
        NgayTao     DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),
        NgayCapNhat DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE LookbookHotspot (
        Id          INT AUTO_INCREMENT PRIMARY KEY,
        LookbookId  INT NOT NULL,
        SanPhamId   INT NOT NULL,
        ToaDoX      DECIMAL(5,2) NOT NULL,  -- 0..100 (%)
        ToaDoY      DECIMAL(5,2) NOT NULL,  -- 0..100 (%)
        GhiChu      VARCHAR(255) NULL,
        ThuTu       INT NOT NULL DEFAULT 0,
        NgayTao     DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),
        CONSTRAINT FK_LookbookHotspot_Lookbook FOREIGN KEY (LookbookId)
            REFERENCES Lookbook(Id) ON DELETE CASCADE,
        CONSTRAINT FK_LookbookHotspot_SanPham FOREIGN KEY (SanPhamId)
            REFERENCES SanPham(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE LichSuDiem (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        NguoiDungId INT NOT NULL,
        LoaiGiaoDich VARCHAR(20) NOT NULL,  -- earn | redeem | expire | bonus
        SoDiem INT NOT NULL,                 -- dương = nhận, âm = dùng
        SoDuSauGiaoDich INT NOT NULL,
        DonHangId INT NULL,
        MoTa VARCHAR(500) NULL,
        NgayTao DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        CONSTRAINT FK_LichSuDiem_NguoiDung FOREIGN KEY (NguoiDungId) REFERENCES NguoiDung(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE DangKyNewsletter (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        Email VARCHAR(255) NOT NULL,
        Source VARCHAR(50) NULL,            -- homepage | popup | footer
        VoucherCode VARCHAR(100) NULL,      -- mã voucher đã cấp
        Ip VARCHAR(50) NULL,
        UserAgent VARCHAR(500) NULL,
        SubscribedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UnsubscribedAt DATETIME(6) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE BangSize (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        Loai VARCHAR(50) NOT NULL,         -- 'top' | 'bottom' | 'dress' | 'shoes' | 'kids'
        DanhMuc VARCHAR(100) NULL,         -- optional category name
        TenSize VARCHAR(20) NOT NULL,      -- S, M, L, XL, 38, 39...
        Vai INT NULL,                       -- vai (cm)
        Nguc INT NULL,                      -- ngực
        Eo INT NULL,                        -- eo
        Hong INT NULL,                      -- hông
        DaiAo INT NULL,                     -- dài áo
        DaiQuan INT NULL,                   -- dài quần
        ChieuCao VARCHAR(50) NULL,         -- vd "1m60 - 1m65"
        CanNang VARCHAR(50) NULL,          -- vd "50-55kg"
        ThuTu INT NOT NULL DEFAULT 0,
        TrangThai TINYINT(1) NOT NULL DEFAULT 1,
        NgayTao DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE CauHoiSanPham (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        SanPhamId INT NOT NULL,
        NguoiHoiId INT NULL,                -- null nếu guest
        TenNguoiHoi VARCHAR(100) NULL,
        CauHoi VARCHAR(1000) NOT NULL,
        TraLoi VARCHAR(2000) NULL,
        NguoiTraLoi VARCHAR(100) NULL,     -- "Shop KaitoKid"
        TrangThai VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | answered | hidden
        LuotHuuIch INT NOT NULL DEFAULT 0,
        NgayHoi DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        NgayTraLoi DATETIME(6) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE PhienXemSanPham (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        SanPhamId INT NOT NULL,
        SessionId VARCHAR(100) NOT NULL,
        Ip VARCHAR(50) NULL,
        LastSeenAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE GioiThieu (
        Id            INT AUTO_INCREMENT PRIMARY KEY,
        NguoiMoiId    INT NOT NULL,
        NguoiGioiThieuId INT NOT NULL,
        MaCouponMoi   VARCHAR(50) NULL,
        MaCouponGT    VARCHAR(50) NULL,
        TrangThai     VARCHAR(20) NOT NULL DEFAULT 'pending',
        NgayTao       DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP(6)),
        NgayThuong    DATETIME NULL,
        CONSTRAINT FK_GioiThieu_NguoiMoi FOREIGN KEY (NguoiMoiId) REFERENCES NguoiDung(Id),
        CONSTRAINT FK_GioiThieu_NguoiGT FOREIGN KEY (NguoiGioiThieuId) REFERENCES NguoiDung(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE LichSuTrangThaiVanChuyen (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        DonHangId INT NOT NULL,
        TrangThai VARCHAR(50) NOT NULL,
        MoTa VARCHAR(500) NULL,
        ViTri VARCHAR(200) NULL,
        ThoiGian DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        CONSTRAINT FK_LSTTVC_DonHang FOREIGN KEY (DonHangId) REFERENCES DonHang(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- Columns added by historical SQL Server migrations
-- ================================================================
ALTER TABLE NguoiDung ADD COLUMN TwoFactorEnabled TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE NguoiDung ADD COLUMN TwoFactorSecret VARCHAR(100) NULL;
ALTER TABLE NguoiDung ADD COLUMN SoLanDangNhapSai INT NOT NULL DEFAULT 0;
ALTER TABLE NguoiDung ADD COLUMN BiKhoaDenLuc DATETIME(6) NULL;
ALTER TABLE NguoiDung ADD COLUMN EmailDaXacThuc TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE NguoiDung ADD COLUMN SDTDaXacThuc TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE NguoiDung ADD COLUMN NhaCungCap VARCHAR(20) NULL;
ALTER TABLE NguoiDung ADD COLUMN MaNhaCungCap VARCHAR(255) NULL;
ALTER TABLE TonKhoBienThe ADD COLUMN SoLuongDaGiu INT NOT NULL DEFAULT 0;
ALTER TABLE SanPham ADD COLUMN SoLuongDaGiu INT NOT NULL DEFAULT 0;
ALTER TABLE GioHang ADD COLUMN GiuDenLuc DATETIME(6) NULL;
ALTER TABLE Lookbook ADD COLUMN VideoUrl VARCHAR(500) NULL;
ALTER TABLE Lookbook ADD COLUMN Season VARCHAR(50) NULL;
ALTER TABLE Lookbook ADD COLUMN Style VARCHAR(80) NULL;
ALTER TABLE NguoiDung ADD COLUMN DiemThuong INT NOT NULL DEFAULT 0;
ALTER TABLE NguoiDung ADD COLUMN CapBac VARCHAR(20) NOT NULL DEFAULT 'Member';
ALTER TABLE NguoiDung ADD COLUMN TongChiTieu DECIMAL(18,0) NOT NULL DEFAULT 0;
ALTER TABLE NguoiDung ADD COLUMN NgaySinh DATE NULL;
ALTER TABLE Banner ADD COLUMN NutChinh VARCHAR(100) NULL;
ALTER TABLE Banner ADD COLUMN NutPhu VARCHAR(100) NULL;
ALTER TABLE Banner ADD COLUMN LinkPhu VARCHAR(500) NULL;
ALTER TABLE SanPham ADD COLUMN VideoUrl VARCHAR(500) NULL;
ALTER TABLE NguoiDung ADD COLUMN MaGioiThieu VARCHAR(20) NULL;
ALTER TABLE DanhGia ADD COLUMN DanhSachAnh LONGTEXT NULL;
ALTER TABLE DanhGia ADD COLUMN Video VARCHAR(500) NULL;
ALTER TABLE DanhGia ADD COLUMN KichCo VARCHAR(20) NULL;
ALTER TABLE DanhGia ADD COLUMN MauSac VARCHAR(50) NULL;
ALTER TABLE DanhGia ADD COLUMN NgayPhanHoi DATETIME(6) NULL;
ALTER TABLE DanhGia ADD COLUMN LuotHuuIch INT NOT NULL DEFAULT 0;
ALTER TABLE DonHang ADD COLUMN MaVanDon VARCHAR(100) NULL;
ALTER TABLE DonHang ADD COLUMN LinkTracking VARCHAR(500) NULL;
ALTER TABLE DonHang ADD COLUMN TrangThaiVanChuyen VARCHAR(50) NULL;
ALTER TABLE DonHang ADD COLUMN NhaVanChuyen VARCHAR(50) NULL;
ALTER TABLE DonHang ADD COLUMN MaDichVuVanChuyen VARCHAR(50) NULL;
ALTER TABLE DonHang ADD COLUMN ThoiGianGiaoDuKien INT NULL;
ALTER TABLE DonHang ADD COLUMN NgayThanhToan DATETIME(6) NULL;
ALTER TABLE DonHang ADD COLUMN HetHanThanhToan DATETIME(6) NULL;

-- ================================================================
-- Foreign-key constraints added after base table creation
-- ================================================================
ALTER TABLE SanPham ADD CONSTRAINT FK_SanPham_BoSuuTap FOREIGN KEY (BoSuuTapId) REFERENCES BoSuuTap(Id);

-- ================================================================
-- Current API.Auth/RBAC tables not present in the legacy master SQL
-- ================================================================

CREATE TABLE VaiTro (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    TenVaiTro VARCHAR(100) NOT NULL,
    MaVaiTro VARCHAR(100) NOT NULL,
    MoTa VARCHAR(500) NULL,
    LaMacDinh TINYINT(1) NOT NULL DEFAULT 0,
    TrangThai TINYINT(1) NOT NULL DEFAULT 1,
    NgayTao DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    NgayCapNhat DATETIME(6) NULL,
    CONSTRAINT UQ_VaiTro_MaVaiTro UNIQUE (MaVaiTro)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE QuyenHan (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    MaQuyen VARCHAR(150) NOT NULL,
    TenQuyen VARCHAR(150) NOT NULL,
    Nhom VARCHAR(100) NOT NULL,
    MoTa VARCHAR(500) NULL,
    CONSTRAINT UQ_QuyenHan_MaQuyen UNIQUE (MaQuyen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE VaiTro_QuyenHan (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    VaiTroId INT NOT NULL,
    QuyenHanId INT NOT NULL,
    CONSTRAINT UQ_VaiTro_QuyenHan UNIQUE (VaiTroId, QuyenHanId),
    CONSTRAINT FK_VTQH_VaiTro FOREIGN KEY (VaiTroId) REFERENCES VaiTro(Id),
    CONSTRAINT FK_VTQH_QuyenHan FOREIGN KEY (QuyenHanId) REFERENCES QuyenHan(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE NhanVien (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Email VARCHAR(255) NOT NULL,
    MatKhauHash VARCHAR(500) NOT NULL,
    HoTen VARCHAR(150) NOT NULL,
    SoDienThoai VARCHAR(30) NULL,
    AnhDaiDien VARCHAR(500) NULL,
    VaiTroId INT NOT NULL,
    LaSuperAdmin TINYINT(1) NOT NULL DEFAULT 0,
    NgaySinh DATETIME(6) NULL,
    GioiTinh VARCHAR(30) NULL,
    DiaChi VARCHAR(500) NULL,
    NgayVaoLam DATETIME(6) NULL,
    TrangThai TINYINT(1) NOT NULL DEFAULT 1,
    LanDangNhapCuoi DATETIME(6) NULL,
    SoLanDangNhapSai INT NOT NULL DEFAULT 0,
    BiKhoa TINYINT(1) NOT NULL DEFAULT 0,
    GhiChu VARCHAR(1000) NULL,
    NgayTao DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    NgayCapNhat DATETIME(6) NULL,
    CONSTRAINT UQ_NhanVien_Email UNIQUE (Email),
    CONSTRAINT FK_NhanVien_VaiTro FOREIGN KEY (VaiTroId) REFERENCES VaiTro(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE LichSuDangNhapNV (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    NhanVienId INT NULL,
    Email VARCHAR(255) NOT NULL,
    DiaChiIP VARCHAR(64) NULL,
    UserAgent VARCHAR(1000) NULL,
    ThanhCong TINYINT(1) NOT NULL DEFAULT 0,
    LyDoThatBai VARCHAR(500) NULL,
    ThoiGian DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX IX_LichSuDangNhapNV_NhanVienId (NhanVienId),
    CONSTRAINT FK_LichSuDangNhapNV_NhanVien FOREIGN KEY (NhanVienId) REFERENCES NhanVien(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- Indexes converted from SQL Server
-- Filtered UNIQUE indexes become normal UNIQUE indexes because MariaDB
-- permits multiple NULL values in a UNIQUE index.
-- ================================================================
CREATE INDEX IX_NguoiDung_Email ON NguoiDung (Email);
CREATE INDEX IX_NguoiDung_VaiTro ON NguoiDung (VaiTro);
CREATE UNIQUE INDEX IX_DanhMuc_Slug ON DanhMuc (Slug);
CREATE INDEX IX_SanPham_TrangThai ON SanPham (TrangThai);
CREATE INDEX IX_SanPham_DanhMuc ON SanPham (DanhMuc);
CREATE INDEX IX_SanPham_GioiTinh ON SanPham (GioiTinh);
CREATE INDEX IX_SanPham_Gia ON SanPham (Gia);
CREATE INDEX IX_SanPham_SoLuongDaBan ON SanPham (SoLuongDaBan);
CREATE UNIQUE INDEX IX_SanPham_Slug ON SanPham (Slug);
CREATE UNIQUE INDEX IX_BoSuuTap_Slug ON BoSuuTap (Slug);
CREATE INDEX IX_GioHang_NguoiDung ON GioHang (NguoiDungId);
CREATE INDEX IX_DonHang_NguoiDung ON DonHang (NguoiDungId);
CREATE INDEX IX_DonHang_TrangThai ON DonHang (TrangThai);
CREATE INDEX IX_DonHang_NgayTao ON DonHang (NgayTao);
CREATE INDEX IX_DonHang_MaDH ON DonHang (MaDonHang);
CREATE INDEX IX_CTDH_DonHang ON ChiTietDonHang (DonHangId);
CREATE INDEX IX_DanhGia_SanPham ON DanhGia (SanPhamId);
CREATE INDEX IX_DanhGia_TrangThai ON DanhGia (TrangThai);
CREATE INDEX IX_DiaChi_NguoiDung ON DiaChi (NguoiDungId);
CREATE INDEX IX_TonKho_SanPham ON TonKho_LichSu (SanPhamId);
CREATE INDEX IX_TonKho_NgayTao ON TonKho_LichSu (NgayTao);
CREATE INDEX IX_ThongBao_NguoiDung ON ThongBao (NguoiDungId, DaDoc);
CREATE INDEX IX_NhatKy_NgayTao ON NhatKyHoatDong (NgayTao);
CREATE INDEX IX_NhatKy_DoiTuong ON NhatKyHoatDong (DoiTuong, DoiTuongId);
CREATE INDEX IX_PhieuNhap_NgayNhap ON PhieuNhap (NgayNhap);
CREATE UNIQUE INDEX IX_PhieuNhap_MaPhieu ON PhieuNhap (MaPhieu);
CREATE INDEX IX_ChiTietPhieuNhap_PhieuNhapId ON ChiTietPhieuNhap (PhieuNhapId);
CREATE INDEX IX_ChiTietPhieuNhap_SanPhamId ON ChiTietPhieuNhap (SanPhamId);
CREATE INDEX IX_TonKhoBienThe_SanPhamId ON TonKhoBienThe (SanPhamId);
CREATE UNIQUE INDEX IX_TonKhoBienThe_Variant ON TonKhoBienThe (SanPhamId, KichCo, MauSac);
CREATE INDEX IX_CuocHoiThoai_TrangThai_ThoiGianTinCuoi ON CuocHoiThoai (TrangThai, ThoiGianTinCuoi);
CREATE INDEX IX_CuocHoiThoai_NguoiDungId ON CuocHoiThoai (NguoiDungId);
CREATE INDEX IX_CuocHoiThoai_MaKhachVangLai ON CuocHoiThoai (MaKhachVangLai);
CREATE INDEX IX_TinNhan_CuocHoiThoaiId ON TinNhan (CuocHoiThoaiId, Id);
CREATE UNIQUE INDEX IX_SanPhamEmbedding_SanPhamId ON SanPhamEmbedding (SanPhamId);
CREATE INDEX IX_LoginActivity_UserId ON LoginActivity (UserId);
CREATE INDEX IX_LoginActivity_Email ON LoginActivity (Email);
CREATE UNIQUE INDEX IX_EVT_Token ON EmailVerificationToken (Token);
CREATE UNIQUE INDEX IX_PRT_Token ON PasswordResetToken (Token);
CREATE INDEX IX_PRT_UserId ON PasswordResetToken (UserId);
CREATE INDEX IX_OtpCode_Identifier ON OtpCode (Identifier, Purpose);
CREATE INDEX IX_HomepageBlock_Type ON HomepageBlock (BlockType, TrangThai, ThuTu);
CREATE INDEX IX_LookbookHotspot_Lookbook ON LookbookHotspot (LookbookId);
CREATE INDEX IX_LichSuDiem_NguoiDungId ON LichSuDiem (NguoiDungId);
CREATE UNIQUE INDEX IX_Newsletter_Email ON DangKyNewsletter (Email);
CREATE INDEX IX_BangSize_Loai ON BangSize (Loai);
CREATE INDEX IX_QA_SanPhamId ON CauHoiSanPham (SanPhamId);
CREATE UNIQUE INDEX IX_PhienXem_SP_Session ON PhienXemSanPham (SanPhamId, SessionId);
CREATE INDEX IX_PhienXem_LastSeen ON PhienXemSanPham (LastSeenAt);
CREATE UNIQUE INDEX UX_NguoiDung_MaGioiThieu ON NguoiDung (MaGioiThieu);
CREATE INDEX IX_GioiThieu_NguoiGT ON GioiThieu (NguoiGioiThieuId, TrangThai);
CREATE INDEX IX_LSTTVC_DonHangId ON LichSuTrangThaiVanChuyen (DonHangId);

-- ================================================================
-- Seed/sample data carried over from the SQL Server script
-- ================================================================
INSERT INTO NguoiDung (Id, HoTen, Email, MatKhauHash, SoDienThoai, VaiTro)
VALUES
    (2, 'Nguyễn Thị Thảo', 'thao@gmail.com', '$2a$11$K8GpahMYCWMKJxBzXjH1/.7JYOqFHvFMiYJJSlELOUB8.p4kK6Wm6', '0912345678', 'user'),
    (3, 'Trần Minh Hoàng', 'hoang@gmail.com', '$2a$11$K8GpahMYCWMKJxBzXjH1/.7JYOqFHvFMiYJJSlELOUB8.p4kK6Wm6', '0923456789', 'user'),
    (4, 'Lê Phương Linh', 'linh@gmail.com', '$2a$11$K8GpahMYCWMKJxBzXjH1/.7JYOqFHvFMiYJJSlELOUB8.p4kK6Wm6', '0934567890', 'user');

INSERT INTO DanhMuc (TenDanhMuc, Slug, MoTa, ThuTu) VALUES
    ('Áo',        'ao',       'Tất cả các loại áo',          1),
    ('Quần',      'quan',     'Tất cả các loại quần',        2),
    ('Váy',       'vay',      'Váy các kiểu',                3),
    ('Đầm',       'dam',      'Đầm dự tiệc, đầm công sở',   4),
    ('Phụ kiện',  'phu-kien', 'Túi, mũ, thắt lưng, kính',   5);

INSERT INTO DanhMuc (TenDanhMuc, Slug, MoTa, DanhMucChaId, ThuTu) VALUES
    ('Áo thun',       'ao-thun',      'Áo thun nam nữ',         1, 1),
    ('Áo sơ mi',      'ao-so-mi',     'Áo sơ mi công sở',       1, 2),
    ('Áo khoác',      'ao-khoac',     'Áo khoác, hoodie',       1, 3),
    ('Áo polo',       'ao-polo',      'Áo polo nam nữ',         1, 4),
    ('Quần jean',     'quan-jean',    'Quần jean các kiểu',     2, 1),
    ('Quần kaki',     'quan-kaki',    'Quần kaki, chinos',      2, 2),
    ('Quần short',    'quan-short',   'Quần short, quần đùi',   2, 3);

INSERT INTO BoSuuTap (TenBoSuuTap, Slug, MoTa, ThuTu) VALUES
    ('Spring/Summer 2025',     'spring-summer-2025',   'Bộ sưu tập Xuân Hè 2025 - Tươi mát, năng động',  1),
    ('Streetwear Collection',  'streetwear',           'Phong cách đường phố cá tính',                     2),
    ('Office Essentials',      'office-essentials',    'Trang phục công sở thanh lịch',                    3),
    ('Weekend Casual',         'weekend-casual',       'Thoải mái cho ngày cuối tuần',                     4);

INSERT INTO SanPham (TenSanPham, DanhMucId, DanhMuc, DanhMucPhu, GioiTinh, Gia, GiaCu, TonKho, TrangThai, HinhAnh, MoTaNgan, MoTaChiTiet, MaSanPham, Slug, LaSanPhamMoi, DangGiamGia, BanChayNhat, DiemDanhGia, SoLuongDaBan, DanhSachMau, DanhSachSize, BoSuuTapId) VALUES
-- Áo thun
('Áo Thun Nam Cổ Tròn Basic',         6, 'Ao', 'Áo thun',   'Nam',      299000, NULL,   150, 'active', '/products/ao-thun-nam-1.jpg',
 'Áo thun cotton 100%, form regular fit',
 '<p>Áo thun nam cổ tròn chất liệu cotton 100% mềm mại, thoáng mát. Form regular fit phù hợp mọi vóc dáng.</p><ul><li>Chất liệu: Cotton 100%</li><li>Form: Regular fit</li><li>Xuất xứ: Việt Nam</li></ul>',
 'KK-AT-001', 'ao-thun-nam-co-tron-basic', 1, 0, 1, 4.5, 234,
 '["Đen","Trắng","Xám","Xanh navy"]', '["S","M","L","XL","XXL"]', 1),

('Áo Thun Nữ Oversize In Hình',       6, 'Ao', 'Áo thun',   'Nu',       349000, 450000, 80,  'active', '/products/ao-thun-nu-1.jpg',
 'Áo thun oversize phong cách Hàn Quốc',
 '<p>Áo thun nữ oversize in hình trendy, chất cotton pha co giãn thoải mái.</p>',
 'KK-AT-002', 'ao-thun-nu-oversize-in-hinh', 1, 1, 0, 4.8, 156,
 '["Trắng","Đen","Be"]', '["Freesize"]', 1),

('Áo Thun Unisex Tie-Dye',            6, 'Ao', 'Áo thun',   'Unisex',   399000, NULL,   60,  'active', '/products/ao-thun-tiedye-1.jpg',
 'Áo thun tie-dye phong cách streetwear',
 '<p>Áo thun unisex tie-dye độc đáo, mỗi chiếc là duy nhất.</p>',
 'KK-AT-003', 'ao-thun-unisex-tie-dye', 1, 0, 0, 4.3, 89,
 '["Tím","Xanh","Cam"]', '["S","M","L","XL"]', 2),

-- Áo sơ mi
('Áo Sơ Mi Nam Trắng Công Sở',        7, 'Ao', 'Áo sơ mi',  'Nam',      499000, NULL,   100, 'active', '/products/ao-somi-nam-1.jpg',
 'Áo sơ mi trắng slim fit, chất liệu cao cấp',
 '<p>Áo sơ mi nam trắng form slim fit, chất liệu cotton pha polyester ít nhăn.</p>',
 'KK-SM-001', 'ao-so-mi-nam-trang-cong-so', 0, 0, 1, 4.7, 312,
 '["Trắng"]', '["S","M","L","XL"]', 3),

('Áo Sơ Mi Nữ Cổ V Thanh Lịch',      7, 'Ao', 'Áo sơ mi',  'Nu',       459000, 599000, 70,  'active', '/products/ao-somi-nu-1.jpg',
 'Áo sơ mi nữ cổ V, phù hợp đi làm và dạo phố',
 '<p>Áo sơ mi nữ cổ V chất lụa mềm mại, form regular phù hợp nhiều dáng người.</p>',
 'KK-SM-002', 'ao-so-mi-nu-co-v', 1, 1, 0, 4.6, 178,
 '["Trắng","Hồng nhạt","Xanh pastel"]', '["S","M","L"]', 3),

-- Áo khoác
('Áo Khoác Hoodie Unisex Basic',      8, 'Ao', 'Áo khoác',  'Unisex',   599000, NULL,   90,  'active', '/products/hoodie-1.jpg',
 'Hoodie unisex nỉ bông dày dặn, ấm áp',
 '<p>Áo hoodie unisex chất nỉ bông cotton, mũ trùm có dây rút, túi kangaroo phía trước.</p>',
 'KK-AK-001', 'ao-khoac-hoodie-unisex-basic', 1, 0, 1, 4.9, 445,
 '["Đen","Xám","Xanh rêu","Be"]', '["S","M","L","XL"]', 2),

('Áo Khoác Bomber Nam',               8, 'Ao', 'Áo khoác',  'Nam',      799000, 999000, 45,  'active', '/products/bomber-nam-1.jpg',
 'Áo bomber phong cách quân đội, chất dù nhẹ',
 '<p>Áo khoác bomber nam chất dù nhẹ, chống gió nhẹ, phù hợp thời tiết se lạnh.</p>',
 'KK-AK-002', 'ao-khoac-bomber-nam', 0, 1, 0, 4.4, 123,
 '["Đen","Xanh rêu","Nâu"]', '["M","L","XL"]', 2),

-- Áo polo
('Áo Polo Nam Cổ Bẻ Classic',         9, 'Ao', 'Áo polo',   'Nam',      399000, NULL,   120, 'active', '/products/polo-nam-1.jpg',
 'Áo polo nam cổ bẻ, chất pique cotton',
 '<p>Áo polo nam cổ bẻ classic, chất pique cotton thoáng mát, phù hợp đi làm và đi chơi.</p>',
 'KK-PL-001', 'ao-polo-nam-co-be-classic', 0, 0, 1, 4.6, 267,
 '["Đen","Trắng","Xanh navy","Đỏ đô"]', '["S","M","L","XL"]', 4);

INSERT INTO SanPham (TenSanPham, DanhMucId, DanhMuc, DanhMucPhu, GioiTinh, Gia, GiaCu, TonKho, TrangThai, HinhAnh, MoTaNgan, MoTaChiTiet, MaSanPham, Slug, LaSanPhamMoi, DangGiamGia, BanChayNhat, DiemDanhGia, SoLuongDaBan, DanhSachMau, DanhSachSize, BoSuuTapId) VALUES
-- Quần jean
('Quần Jean Nam Slim Fit Xanh Đậm',   10, 'Quan', 'Quần jean', 'Nam',    599000, NULL,   85,  'active', '/products/jean-nam-1.jpg',
 'Quần jean nam slim fit, co giãn thoải mái',
 '<p>Quần jean nam slim fit chất denim co giãn, thoải mái vận động. Wash xanh đậm classic.</p>',
 'KK-QJ-001', 'quan-jean-nam-slim-fit-xanh-dam', 1, 0, 1, 4.7, 389,
 '["Xanh đậm","Xanh nhạt","Đen"]', '["29","30","31","32","33","34"]', NULL),

('Quần Jean Nữ Ống Rộng',             10, 'Quan', 'Quần jean', 'Nu',     549000, 699000, 65,  'active', '/products/jean-nu-1.jpg',
 'Quần jean nữ ống rộng phong cách Y2K',
 '<p>Quần jean nữ ống rộng cạp cao, phong cách retro Y2K đang hot.</p>',
 'KK-QJ-002', 'quan-jean-nu-ong-rong', 1, 1, 0, 4.5, 201,
 '["Xanh nhạt","Trắng"]', '["26","27","28","29","30"]', NULL),

-- Quần kaki
('Quần Kaki Nam Ống Đứng',            11, 'Quan', 'Quần kaki', 'Nam',    499000, NULL,   95,  'active', '/products/kaki-nam-1.jpg',
 'Quần kaki nam ống đứng, phù hợp công sở',
 '<p>Quần kaki nam ống đứng chất cotton pha spandex, ít nhăn, phù hợp đi làm.</p>',
 'KK-QK-001', 'quan-kaki-nam-ong-dung', 0, 0, 1, 4.4, 198,
 '["Be","Đen","Xám","Xanh navy"]', '["29","30","31","32","33","34"]', 3),

-- Quần short
('Quần Short Nam Thể Thao',           12, 'Quan', 'Quần short', 'Nam',   299000, NULL,   110, 'active', '/products/short-nam-1.jpg',
 'Quần short nam thể thao, chất gió nhẹ',
 '<p>Quần short nam chất gió nhẹ, nhanh khô, có túi khóa kéo hai bên.</p>',
 'KK-QS-001', 'quan-short-nam-the-thao', 1, 0, 0, 4.3, 156,
 '["Đen","Xám","Xanh navy"]', '["S","M","L","XL"]', 4),

-- Váy
('Váy Midi Xếp Ly Thanh Lịch',        3, 'Vay', NULL,         'Nu',      599000, 799000, 50,  'active', '/products/vay-midi-1.jpg',
 'Váy midi xếp ly chất voan, bay bổng nữ tính',
 '<p>Váy midi xếp ly chất voan mềm mại, cạp chun co giãn, phù hợp đi làm và dự tiệc.</p>',
 'KK-VY-001', 'vay-midi-xep-ly-thanh-lich', 1, 1, 1, 4.8, 234,
 '["Đen","Be","Xanh pastel"]', '["S","M","L"]', 3),

('Váy Tennis Ngắn Năng Động',          3, 'Vay', NULL,         'Nu',      349000, NULL,   75,  'active', '/products/vay-tennis-1.jpg',
 'Váy tennis ngắn phong cách sporty',
 '<p>Váy tennis ngắn có quần lót bên trong, chất thun co giãn 4 chiều.</p>',
 'KK-VY-002', 'vay-tennis-ngan-nang-dong', 1, 0, 0, 4.5, 145,
 '["Trắng","Đen","Hồng"]', '["S","M","L"]', 1),

-- Đầm
('Đầm Dự Tiệc Cổ V Sang Trọng',       4, 'Dam', NULL,         'Nu',      899000, 1200000, 30, 'active', '/products/dam-du-tiec-1.jpg',
 'Đầm dự tiệc cổ V chất lụa cao cấp',
 '<p>Đầm dự tiệc cổ V sâu, chất lụa satin bóng mượt, dáng ôm body quyến rũ.</p>',
 'KK-DM-001', 'dam-du-tiec-co-v-sang-trong', 0, 1, 0, 4.9, 87,
 '["Đen","Đỏ đô","Xanh emerald"]', '["S","M","L"]', NULL),

('Đầm Suông Công Sở Tay Lỡ',          4, 'Dam', NULL,         'Nu',      699000, NULL,   55,  'active', '/products/dam-cong-so-1.jpg',
 'Đầm suông công sở thanh lịch, tay lỡ',
 '<p>Đầm suông công sở chất đũi mềm, tay lỡ che khuyết điểm bắp tay.</p>',
 'KK-DM-002', 'dam-suong-cong-so-tay-lo', 1, 0, 1, 4.6, 167,
 '["Đen","Xám","Be"]', '["S","M","L","XL"]', 3),

-- Phụ kiện
('Túi Tote Vải Canvas KaitoKid',       5, 'PhuKien', NULL,     'Unisex',  199000, NULL,   200, 'active', '/products/tui-tote-1.jpg',
 'Túi tote vải canvas in logo KaitoKid',
 '<p>Túi tote vải canvas dày dặn, in logo KaitoKid, đựng được laptop 14 inch.</p>',
 'KK-PK-001', 'tui-tote-vai-canvas-kaitokid', 1, 0, 0, 4.2, 312,
 '["Trắng","Đen"]', '["Freesize"]', NULL),

('Mũ Lưỡi Trai Thêu Logo',            5, 'PhuKien', NULL,     'Unisex',  149000, 199000, 180, 'active', '/products/mu-luoi-trai-1.jpg',
 'Mũ lưỡi trai thêu logo KaitoKid',
 '<p>Mũ lưỡi trai unisex, thêu logo KaitoKid, khóa điều chỉnh phía sau.</p>',
 'KK-PK-002', 'mu-luoi-trai-theu-logo', 0, 1, 0, 4.1, 234,
 '["Đen","Trắng","Be","Xanh navy"]', '["Freesize"]', NULL),

('Thắt Lưng Da Nam Khóa Tự Động',     5, 'PhuKien', NULL,     'Nam',     299000, NULL,   90,  'active', '/products/that-lung-1.jpg',
 'Thắt lưng da bò thật, khóa tự động',
 '<p>Thắt lưng da bò thật 100%, khóa tự động tiện lợi, bề mặt vân saffiano.</p>',
 'KK-PK-003', 'that-lung-da-nam-khoa-tu-dong', 0, 0, 1, 4.7, 178,
 '["Đen","Nâu"]', '["Freesize"]', NULL);

INSERT INTO MaGiamGia (MaCoupon, LoaiGiamGia, GiaTri, DonToiThieu, GiamToiDa, SoLuotDung, NgayBatDau, NgayKetThuc, MoTa) VALUES
    ('WELCOME10',   'percent',  10, 200000,  100000, 1000, '2025-01-01', '2025-12-31', 'Giảm 10% cho khách mới, đơn từ 200K'),
    ('SALE20',      'percent',  20, 500000,  200000, 500,  '2025-03-01', '2025-06-30', 'Giảm 20% cho đơn từ 500K'),
    ('FREESHIP',    'fixed',    30000, 300000, NULL,  2000, '2025-01-01', '2025-12-31', 'Miễn phí ship cho đơn từ 300K'),
    ('SUMMER50',    'fixed',    50000, 400000, NULL,  300,  '2025-06-01', '2025-08-31', 'Giảm 50K cho đơn từ 400K mùa hè'),
    ('VIP30',       'percent',  30, 1000000, 500000, 100,  '2025-01-01', '2025-12-31', 'Giảm 30% cho khách VIP, đơn từ 1 triệu');

INSERT INTO Banner (TieuDe, TieuDePhu, HinhAnh, LienKet, LoaiBanner, ViTri, ThuTu) VALUES
    ('Spring/Summer 2025',     'Everyday Essentials',         '/slide_1.jpg', '/collections',  'slider', 'homepage', 1),
    ('New Arrivals',           'Fresh & Trendy',              '/slide_2.jpg', '/new-in',       'slider', 'homepage', 2),
    ('Summer Sale 50%',        'Giảm giá lên đến 50%',       '/slide_3.jpg', '/sale',         'slider', 'homepage', 3);

INSERT INTO Lookbook (TieuDe, TieuDePhu, MoTa, HinhAnh, LienKet, ThuTu) VALUES
    ('Street Style Mùa Hè',       'Summer 2025',     'Phong cách đường phố năng động cho mùa hè',   '/lookbook/street-1.jpg',   '/collections', 1),
    ('Office Chic',                'Công sở thanh lịch', 'Gợi ý trang phục công sở hiện đại',        '/lookbook/office-1.jpg',   '/collections', 2);

INSERT INTO MenuDieuHuong (TenMenu, LienKet, ViTri, ThuTu) VALUES
    ('Nữ',            '/women',       'header', 1),
    ('Nam',            '/men',         'header', 2),
    ('Trẻ em',         '/kids',        'header', 3),
    ('Bộ sưu tập',    '/collections', 'header', 4),
    ('Sale',           '/sale',        'header', 5),
    ('New In',         '/new-in',      'header', 6);

INSERT INTO MenuDieuHuong (TenMenu, LienKet, ViTri, MenuChaId, ThuTu) VALUES
    ('Áo thun nữ',    '/women?category=ao-thun',  'header', 1, 1),
    ('Áo sơ mi nữ',   '/women?category=ao-so-mi', 'header', 1, 2),
    ('Váy',            '/women?category=vay',      'header', 1, 3),
    ('Đầm',            '/women?category=dam',      'header', 1, 4);

INSERT INTO MenuDieuHuong (TenMenu, LienKet, ViTri, MenuChaId, ThuTu) VALUES
    ('Áo thun nam',    '/men?category=ao-thun',    'header', 2, 1),
    ('Áo sơ mi nam',   '/men?category=ao-so-mi',   'header', 2, 2),
    ('Quần jean',      '/men?category=quan-jean',  'header', 2, 3),
    ('Quần kaki',      '/men?category=quan-kaki',  'header', 2, 4);

INSERT INTO CauHinhCuaHang (MaCauHinh, GiaTri, NhomCauHinh, MoTa) VALUES
    ('storeName',       'KAITO KID',                       'general',  'Tên cửa hàng'),
    ('storePhone',      '0901234567',                       'general',  'Số điện thoại'),
    ('storeEmail',      'contact@kaitokid.vn',              'general',  'Email liên hệ'),
    ('storeAddress',    '123 Nguyễn Huệ, Q.1, TP.HCM',    'general',  'Địa chỉ cửa hàng'),
    ('storeLogo',       '/images/logokaitokid.png',         'general',  'Logo cửa hàng'),
    ('freeShipMin',     '499000',                           'shipping', 'Đơn tối thiểu để freeship'),
    ('shippingFee',     '30000',                            'shipping', 'Phí ship mặc định'),
    ('estimatedDelivery', '2-3 ngày làm việc',             'shipping', 'Thời gian giao hàng dự kiến'),
    ('enableCOD',       'true',                             'payment',  'Cho phép thanh toán COD'),
    ('enableMomo',      'true',                             'payment',  'Cho phép thanh toán Momo'),
    ('enableBankTransfer', 'true',                          'payment',  'Cho phép chuyển khoản'),
    ('bankName',        'Vietcombank',                     'payment',  'Tên ngân hàng'),
    ('bankAccount',     '1234567890',                       'payment',  'Số tài khoản'),
    ('bankOwner',       'KAITO KID FASHION CO.,LTD',       'payment',  'Chủ tài khoản'),
    ('enableTracking',  'true',                             'general',  'Cho phép theo dõi đơn hàng'),
    ('maintenanceMode', 'false',                            'general',  'Chế độ bảo trì');

INSERT INTO TrangTinh (TieuDe, Slug, NoiDung) VALUES
    ('Giới thiệu',            'gioi-thieu',           '<h2>Về KAITO KID</h2><p>KAITO KID là thương hiệu thời trang Việt Nam, hướng tới phong cách trẻ trung, hiện đại với giá cả hợp lý. Chúng tôi cam kết mang đến những sản phẩm chất lượng, thiết kế phù hợp dáng người châu Á.</p>'),
    ('Chính sách đổi trả',    'chinh-sach-doi-tra',   '<h2>Chính sách đổi trả</h2><p>Đổi trả miễn phí trong 7 ngày kể từ ngày nhận hàng nếu sản phẩm bị lỗi hoặc không đúng mô tả. Sản phẩm đổi trả phải còn nguyên tem mác, chưa qua sử dụng.</p>'),
    ('Chính sách vận chuyển',  'chinh-sach-van-chuyen', '<h2>Chính sách vận chuyển</h2><p>Miễn phí vận chuyển cho đơn hàng từ 499.000đ. Thời gian giao hàng: Nội thành 1-2 ngày, ngoại thành 2-4 ngày.</p>'),
    ('Hướng dẫn chọn size',   'huong-dan-chon-size',  '<h2>Hướng dẫn chọn size</h2><p>Bảng size chuẩn KAITO KID được thiết kế phù hợp với dáng người Việt Nam. Nếu bạn phân vân giữa 2 size, hãy chọn size lớn hơn.</p>'),
    ('Chính sách bảo mật',    'chinh-sach-bao-mat',   '<h2>Chính sách bảo mật</h2><p>Chúng tôi cam kết bảo mật thông tin cá nhân của khách hàng. Thông tin của bạn chỉ được sử dụng cho mục đích xử lý đơn hàng và chăm sóc khách hàng.</p>');

INSERT INTO DonHang (MaDonHang, NguoiDungId, TenNguoiNhan, SoDienThoai, Email, DiaChiGiao, TinhThanh, QuanHuyen, PhuongXa, TamTinh, PhiVanChuyen, GiamGia, TongTien, PhuongThucThanhToan, TrangThai) VALUES
    ('KK-20250320-ABC123', 2, 'Nguyễn Thị Thảo', '0912345678', 'thao@gmail.com', '45 Lê Lợi, P.Bến Nghé, Q.1, TP.HCM', 'TP.HCM', 'Quận 1', 'Bến Nghé', 898000, 0, 0, 898000, 'COD', 'completed'),
    ('KK-20250322-DEF456', 3, 'Trần Minh Hoàng', '0923456789', 'hoang@gmail.com', '12 Trần Hưng Đạo, P.5, Q.5, TP.HCM', 'TP.HCM', 'Quận 5', 'Phường 5', 1198000, 30000, 100000, 1128000, 'shipping', 'VISA'),
    ('KK-20250325-GHI789', 4, 'Lê Phương Linh', '0934567890', 'linh@gmail.com', '78 Nguyễn Trãi, Thanh Xuân, Hà Nội', 'Hà Nội', 'Thanh Xuân', 'Nhân Chính', 599000, 30000, 0, 629000, 'Momo', 'confirmed');

INSERT INTO ChiTietDonHang (DonHangId, SanPhamId, TenSanPham, HinhAnhSP, DonGia, KichCo, MauSac, SoLuong) VALUES
    (1, 1, 'Áo Thun Nam Cổ Tròn Basic',       '/products/ao-thun-nam-1.jpg',  299000, 'L',  'Đen',         2),
    (1, 8, 'Áo Polo Nam Cổ Bẻ Classic',        '/products/polo-nam-1.jpg',     299000, 'M',  'Xanh navy',   1),
    (2, 9, 'Quần Jean Nam Slim Fit Xanh Đậm',  '/products/jean-nam-1.jpg',     599000, '32', 'Xanh đậm',    1),
    (2, 6, 'Áo Khoác Hoodie Unisex Basic',     '/products/hoodie-1.jpg',       599000, 'L',  'Đen',         1),
    (3, 6, 'Áo Khoác Hoodie Unisex Basic',     '/products/hoodie-1.jpg',       599000, 'M',  'Xám',         1);

INSERT INTO DanhGia (SanPhamId, NguoiDungId, TenKhachHang, DonHangId, SoSao, NoiDung, TrangThai) VALUES
    (1, 2, 'Nguyễn Thị Thảo', 1, 5, 'Vải rất mát, form chuẩn, giao hàng nhanh. Sẽ ủng hộ thêm!', 'approved'),
    (1, 3, 'Trần Minh Hoàng', 2, 4, 'Chất lượng tốt, giá hợp lý. Đóng gói cẩn thận!', 'approved'),
    (4, 2, 'Nguyễn Thị Thảo', 1, 5, 'Áo sơ mi đẹp lắm, mặc đi làm rất sang', 'approved'),
    (6, 4, 'Lê Phương Linh',  3, 5, 'Hoodie ấm lắm, chất nỉ dày dặn, mặc mùa đông rất ổn', 'approved'),
    (9, 3, 'Trần Minh Hoàng', 2, 4, 'Jean co giãn thoải mái, wash đẹp', 'approved');

INSERT INTO CauHinhTrangChu (TenSection, DanhSachSPId, ThuTu) VALUES
    ('newArrivals',     '[1,2,3,5,6,9,10,12]',  1),
    ('bestSellers',     '[1,4,6,8,9,11,13,17]',  2),
    ('saleProducts',    '[2,5,7,10,13,15,19]',   3);

INSERT INTO HomepageBlock (BlockType, TieuDe, TieuDePhu, HinhAnh, LienKet, ThuTu) VALUES
        ('categoryTile', 'Thời trang nữ',  'Bộ sưu tập mới',     '/images/slide_1.jpg', '/women', 1),
        ('categoryTile', 'Thời trang nam', 'Phong cách hiện đại', '/images/slide_2.jpg', '/men',   2),
        ('categoryTile', 'Trẻ em',         'Đáng yêu, thoải mái', '/images/slide_3.jpg', '/kids',  3),
        ('categoryTile', 'Khuyến mãi',     'Săn deal hot',         '/images/slide_4.jpg', '/sale',  4);

INSERT INTO HomepageBlock (BlockType, TieuDe, MoTa, Icon, ThuTu) VALUES
        ('brandValue', 'Freeship đơn 499K', 'Miễn phí vận chuyển toàn quốc',         'truck',     1),
        ('brandValue', 'Đổi trả 7 ngày',    'Đổi trả miễn phí trong 7 ngày',         'refresh',   2),
        ('brandValue', 'Hàng chính hãng',   'Cam kết chất lượng, bảo hành dài hạn',  'shield',    3);


SET FOREIGN_KEY_CHECKS = 1;

-- Quick verification
SELECT COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema = 'KaitoKid' AND table_type = 'BASE TABLE';

SELECT 'KaitoKid MariaDB schema import completed' AS status;
