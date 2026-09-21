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
    TenSanPham      VARCHAR(200)       NOT NULL,               -- Áo Thun Bé Trai Cổ Tròn Basic
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

INSERT INTO DanhMuc (TenDanhMuc, Slug, MoTa, ThuTu, GioiTinh) VALUES
    ('Áo bé',          'ao-be',          'Áo mặc hằng ngày dành cho trẻ em 0-12 tuổi',                 1, 'treem'),
    ('Quần bé',        'quan-be',        'Quần dài, jean, kaki và short thoải mái cho bé',             2, 'treem'),
    ('Váy bé gái',     'vay-be-gai',     'Váy năng động, dễ vận động dành cho bé gái',                 3, 'treem'),
    ('Đầm bé gái',     'dam-be-gai',     'Đầm đi chơi, sinh nhật và dịp đặc biệt dành cho bé gái',     4, 'treem'),
    ('Phụ kiện bé',    'phu-kien-be',    'Mũ, túi và phụ kiện an toàn, dễ phối đồ cho trẻ em',         5, 'treem');

INSERT INTO DanhMuc (TenDanhMuc, Slug, MoTa, DanhMucChaId, ThuTu, GioiTinh) VALUES
    ('Áo thun bé',     'ao-thun-be',     'Áo thun mềm, thoáng và dễ vận động',                         1, 1, 'treem'),
    ('Áo sơ mi bé',    'ao-so-mi-be',    'Áo sơ mi đi học, đi chơi cho bé',                            1, 2, 'treem'),
    ('Áo khoác bé',    'ao-khoac-be',    'Hoodie, bomber và áo khoác nhẹ cho trẻ em',                  1, 3, 'treem'),
    ('Áo polo bé',     'ao-polo-be',     'Áo polo gọn gàng cho bé đi học và đi chơi',                  1, 4, 'treem'),
    ('Quần jean bé',   'quan-jean-be',   'Jean co giãn, ưu tiên sự thoải mái khi vận động',            2, 1, 'treem'),
    ('Quần kaki bé',   'quan-kaki-be',   'Kaki mềm, phù hợp đi học và các dịp cần lịch sự',             2, 2, 'treem'),
    ('Quần short bé',  'quan-short-be',  'Short nhẹ, thoáng dành cho hoạt động hằng ngày',              2, 3, 'treem');

INSERT INTO BoSuuTap (TenBoSuuTap, Slug, MoTa, ThuTu) VALUES
    ('Ngày Đến Trường',       'ngay-den-truong',      'Trang phục gọn gàng, thoải mái cho bé đi học',                    1),
    ('Chơi Cả Ngày',          'choi-ca-ngay',         'Các thiết kế mềm, co giãn cho bé vận động tự do',                 2),
    ('Tiệc Nhỏ Của Bé',       'tiec-nho-cua-be',      'Váy, đầm và outfit xinh xắn cho sinh nhật, lễ và cuối tuần',      3),
    ('Cuối Tuần Phiêu Lưu',   'cuoi-tuan-phieu-luu', 'Phong cách năng động cho chuyến đi chơi cùng gia đình',            4);

INSERT INTO SanPham (TenSanPham, DanhMucId, DanhMuc, DanhMucPhu, NhomTuoi, GioiTinh, Gia, GiaCu, TonKho, TrangThai, HinhAnh, MoTaNgan, MoTaChiTiet, MaSanPham, Slug, LaSanPhamMoi, DangGiamGia, BanChayNhat, DiemDanhGia, SoLuongDaBan, DanhSachMau, DanhSachSize, BoSuuTapId) VALUES
('Áo Thun Bé Trai Cổ Tròn Basic', 6, 'Áo bé', 'Áo thun bé', 'TreEm', 'Nam', 299000, NULL, 150, 'active', '/products/ao-thun-be-trai-1.jpg',
 'Áo thun cotton mềm, thoáng mát cho bé vận động cả ngày',
 '<p>Áo thun bé trai cổ tròn từ cotton mềm, thấm hút tốt và dễ phối đồ. Form thoải mái giúp bé chạy nhảy tự nhiên.</p><ul><li>Độ tuổi: 2-12 tuổi</li><li>Chất liệu: Cotton mềm</li><li>Ưu tiên: Thoáng, dễ vận động</li></ul>',
 'KK-AT-001', 'ao-thun-be-trai-co-tron-basic', 1, 0, 1, 4.5, 234,
 '["Xanh navy","Trắng","Xám","Xanh da trời"]', '["90","100","110","120","130","140","150"]', 2),

('Áo Thun Bé Gái Oversize In Hình', 6, 'Áo bé', 'Áo thun bé', 'TreEm', 'Nu', 349000, 450000, 80, 'active', '/products/ao-thun-be-gai-1.jpg',
 'Áo thun oversize đáng yêu, mềm và dễ phối cho bé gái',
 '<p>Áo thun bé gái form rộng vừa phải, chất liệu co giãn nhẹ, phù hợp đi học, đi chơi và hoạt động cuối tuần.</p>',
 'KK-AT-002', 'ao-thun-be-gai-oversize-in-hinh', 1, 1, 0, 4.8, 156,
 '["Trắng","Hồng pastel","Be"]', '["90","100","110","120","130","140"]', 2),

('Áo Thun Trẻ Em Tie-Dye Unisex', 6, 'Áo bé', 'Áo thun bé', 'TreEm', 'Unisex', 399000, NULL, 60, 'active', '/products/ao-thun-tre-em-tiedye-1.jpg',
 'Áo tie-dye nhiều màu cho bé thích phong cách năng động',
 '<p>Thiết kế tie-dye vui mắt, form unisex và chất vải mềm giúp bé thoải mái khi vui chơi.</p>',
 'KK-AT-003', 'ao-thun-tre-em-tie-dye', 1, 0, 0, 4.3, 89,
 '["Tím","Xanh","Cam"]', '["100","110","120","130","140","150"]', 4),

('Áo Sơ Mi Bé Trai Trắng Đi Học', 7, 'Áo bé', 'Áo sơ mi bé', 'TreEm', 'Nam', 499000, NULL, 100, 'active', '/products/ao-so-mi-be-trai-1.jpg',
 'Áo sơ mi trắng gọn gàng, ít nhăn cho bé đi học và dự lễ',
 '<p>Áo sơ mi bé trai chất cotton pha mềm, dễ giặt, form vừa người và không gây bí khi mặc lâu.</p>',
 'KK-SM-001', 'ao-so-mi-be-trai-trang-di-hoc', 0, 0, 1, 4.7, 312,
 '["Trắng"]', '["100","110","120","130","140","150"]', 1),

('Áo Sơ Mi Bé Gái Cổ Sen', 7, 'Áo bé', 'Áo sơ mi bé', 'TreEm', 'Nu', 459000, 599000, 70, 'active', '/products/ao-so-mi-be-gai-1.jpg',
 'Áo sơ mi cổ sen nhẹ nhàng dành cho bé gái',
 '<p>Thiết kế cổ sen mềm mại, form thoải mái, phù hợp đi học, đi chơi hoặc phối cùng chân váy.</p>',
 'KK-SM-002', 'ao-so-mi-be-gai-co-sen', 1, 1, 0, 4.6, 178,
 '["Trắng","Hồng nhạt","Xanh pastel"]', '["100","110","120","130","140"]', 1),

('Áo Hoodie Trẻ Em Unisex', 8, 'Áo bé', 'Áo khoác bé', 'TreEm', 'Unisex', 599000, NULL, 90, 'active', '/products/hoodie-tre-em-1.jpg',
 'Hoodie nỉ mềm, ấm và dễ mặc cho cả bé trai lẫn bé gái',
 '<p>Hoodie trẻ em có mũ, túi trước và bề mặt nỉ mềm. Form rộng vừa giúp bé mặc thêm áo bên trong.</p>',
 'KK-AK-001', 'ao-hoodie-tre-em-unisex', 1, 0, 1, 4.9, 445,
 '["Xám","Xanh navy","Be","Tím nhạt"]', '["100","110","120","130","140","150"]', 4),

('Áo Khoác Bomber Bé Trai', 8, 'Áo bé', 'Áo khoác bé', 'TreEm', 'Nam', 799000, 999000, 45, 'active', '/products/bomber-be-trai-1.jpg',
 'Bomber nhẹ, cản gió nhẹ cho bé đi chơi',
 '<p>Áo bomber bé trai chất nhẹ, bo tay mềm và khóa kéo dễ sử dụng. Phù hợp thời tiết se lạnh.</p>',
 'KK-AK-002', 'ao-khoac-bomber-be-trai', 0, 1, 0, 4.4, 123,
 '["Xanh navy","Xanh rêu","Nâu"]', '["100","110","120","130","140","150"]', 4),

('Áo Polo Bé Trai Cổ Bẻ', 9, 'Áo bé', 'Áo polo bé', 'TreEm', 'Nam', 399000, NULL, 120, 'active', '/products/polo-be-trai-1.jpg',
 'Áo polo thoáng mát, lịch sự nhưng vẫn dễ vận động',
 '<p>Áo polo bé trai chất pique cotton mềm, phù hợp đi học, đi chơi và các dịp gia đình.</p>',
 'KK-PL-001', 'ao-polo-be-trai-co-be', 0, 0, 1, 4.6, 267,
 '["Xanh navy","Trắng","Đỏ đô"]', '["100","110","120","130","140","150"]', 1),

('Quần Jean Bé Trai Slim Co Giãn', 10, 'Quần bé', 'Quần jean bé', 'TreEm', 'Nam', 599000, NULL, 85, 'active', '/products/jean-be-trai-1.jpg',
 'Jean mềm, co giãn nhẹ để bé vận động thoải mái',
 '<p>Quần jean bé trai sử dụng denim co giãn, cạp dễ mặc và đường may êm, phù hợp đi học và đi chơi.</p>',
 'KK-QJ-001', 'quan-jean-be-trai-slim-co-gian', 1, 0, 1, 4.7, 389,
 '["Xanh đậm","Xanh nhạt","Đen"]', '["100","110","120","130","140","150"]', 1),

('Quần Jean Bé Gái Ống Rộng', 10, 'Quần bé', 'Quần jean bé', 'TreEm', 'Nu', 549000, 699000, 65, 'active', '/products/jean-be-gai-1.jpg',
 'Jean ống rộng mềm, phong cách và dễ phối cho bé gái',
 '<p>Quần jean bé gái ống rộng có cạp thoải mái, denim mềm và kiểu dáng hiện đại nhưng vẫn phù hợp trẻ em.</p>',
 'KK-QJ-002', 'quan-jean-be-gai-ong-rong', 1, 1, 0, 4.5, 201,
 '["Xanh nhạt","Trắng"]', '["100","110","120","130","140","150"]', 4),

('Quần Kaki Bé Trai Đi Học', 11, 'Quần bé', 'Quần kaki bé', 'TreEm', 'Nam', 499000, NULL, 95, 'active', '/products/kaki-be-trai-1.jpg',
 'Kaki mềm, gọn gàng và ít nhăn cho bé đi học',
 '<p>Quần kaki bé trai chất cotton pha co giãn, thiết kế dễ vận động và phù hợp đồng phục tự do.</p>',
 'KK-QK-001', 'quan-kaki-be-trai-di-hoc', 0, 0, 1, 4.4, 198,
 '["Be","Xám","Xanh navy"]', '["100","110","120","130","140","150"]', 1),

('Quần Short Bé Trai Thể Thao', 12, 'Quần bé', 'Quần short bé', 'TreEm', 'Nam', 299000, NULL, 110, 'active', '/products/short-be-trai-1.jpg',
 'Short nhẹ, nhanh khô cho hoạt động ngoài trời',
 '<p>Quần short bé trai chất nhẹ, cạp co giãn và túi hai bên, phù hợp chạy nhảy, dã ngoại và thể thao.</p>',
 'KK-QS-001', 'quan-short-be-trai-the-thao', 1, 0, 0, 4.3, 156,
 '["Đen","Xám","Xanh navy"]', '["90","100","110","120","130","140"]', 2),

('Váy Bé Gái Xếp Ly Dịu Dàng', 3, 'Váy bé gái', NULL, 'TreEm', 'Nu', 599000, 799000, 50, 'active', '/products/vay-be-gai-xep-ly-1.jpg',
 'Váy xếp ly nhẹ, dễ xoay và phù hợp nhiều dịp',
 '<p>Váy bé gái xếp ly với cạp mềm, lớp vải nhẹ và chiều dài phù hợp để bé vận động thoải mái.</p>',
 'KK-VY-001', 'vay-be-gai-xep-ly-diu-dang', 1, 1, 1, 4.8, 234,
 '["Hồng pastel","Be","Xanh pastel"]', '["100","110","120","130","140"]', 3),

('Váy Tennis Bé Gái Năng Động', 3, 'Váy bé gái', NULL, 'TreEm', 'Nu', 349000, NULL, 75, 'active', '/products/vay-tennis-be-gai-1.jpg',
 'Váy tennis có quần trong, tiện cho bé chạy nhảy',
 '<p>Váy tennis bé gái có quần bảo hộ bên trong, chất thun co giãn và cạp mềm.</p>',
 'KK-VY-002', 'vay-tennis-be-gai-nang-dong', 1, 0, 0, 4.5, 145,
 '["Trắng","Hồng","Xanh navy"]', '["100","110","120","130","140"]', 2),

('Đầm Bé Gái Dự Tiệc Cổ Nơ', 4, 'Đầm bé gái', NULL, 'TreEm', 'Nu', 899000, 1200000, 30, 'active', '/products/dam-be-gai-du-tiec-1.jpg',
 'Đầm dự tiệc xinh xắn cho sinh nhật và dịp đặc biệt',
 '<p>Đầm bé gái dáng xòe với chi tiết nơ nhẹ nhàng, lớp lót mềm và thiết kế ưu tiên sự thoải mái.</p>',
 'KK-DM-001', 'dam-be-gai-du-tiec-co-no', 0, 1, 0, 4.9, 87,
 '["Hồng","Đỏ đô","Xanh pastel"]', '["100","110","120","130","140"]', 3),

('Đầm Bé Gái Tay Lỡ Thanh Lịch', 4, 'Đầm bé gái', NULL, 'TreEm', 'Nu', 699000, NULL, 55, 'active', '/products/dam-be-gai-tay-lo-1.jpg',
 'Đầm tay lỡ nhẹ nhàng cho bé đi chơi và dự lễ',
 '<p>Đầm bé gái form suông nhẹ, tay lỡ và chất vải mềm, phù hợp cho các dịp gia đình.</p>',
 'KK-DM-002', 'dam-be-gai-tay-lo-thanh-lich', 1, 0, 1, 4.6, 167,
 '["Hồng nhạt","Be","Xanh pastel"]', '["100","110","120","130","140"]', 3),

('Túi Tote Mini KaitoKid Cho Bé', 5, 'Phụ kiện bé', NULL, 'TreEm', 'Unisex', 199000, NULL, 200, 'active', '/products/tui-tote-mini-be-1.jpg',
 'Túi tote mini nhẹ, phù hợp mang đồ cá nhân nhỏ của bé',
 '<p>Túi tote mini KaitoKid làm từ canvas nhẹ, quai vừa tay và kích thước phù hợp trẻ em.</p>',
 'KK-PK-001', 'tui-tote-mini-kaitokid-cho-be', 1, 0, 0, 4.2, 312,
 '["Trắng","Be","Xanh navy"]', '["Freesize"]', 4),

('Mũ Lưỡi Trai Trẻ Em Thêu Logo', 5, 'Phụ kiện bé', NULL, 'TreEm', 'Unisex', 149000, 199000, 180, 'active', '/products/mu-luoi-trai-tre-em-1.jpg',
 'Mũ nhẹ có khóa điều chỉnh phù hợp vòng đầu trẻ em',
 '<p>Mũ lưỡi trai KaitoKid thêu logo, chất liệu nhẹ và có khóa điều chỉnh phía sau.</p>',
 'KK-PK-002', 'mu-luoi-trai-tre-em-theu-logo', 0, 1, 0, 4.1, 234,
 '["Xanh navy","Trắng","Be","Hồng"]', '["Freesize"]', 2),

('Thắt Lưng Trẻ Em Khóa Tự Động', 5, 'Phụ kiện bé', NULL, 'TreEm', 'Unisex', 299000, NULL, 90, 'active', '/products/that-lung-tre-em-1.jpg',
 'Thắt lưng nhẹ, dễ điều chỉnh cho trang phục đi học và dự lễ',
 '<p>Thắt lưng trẻ em bản nhỏ, khóa dễ sử dụng và chiều dài có thể điều chỉnh.</p>',
 'KK-PK-003', 'that-lung-tre-em-khoa-tu-dong', 0, 0, 1, 4.7, 178,
 '["Đen","Nâu"]', '["Freesize"]', 1);

INSERT INTO MaGiamGia (MaCoupon, LoaiGiamGia, GiaTri, DonToiThieu, GiamToiDa, SoLuotDung, NgayBatDau, NgayKetThuc, MoTa) VALUES
    ('WELCOME10',   'percent',  10, 200000,  100000, 1000, '2025-01-01', '2025-12-31', 'Giảm 10% cho khách mới, đơn từ 200K'),
    ('SALE20',      'percent',  20, 500000,  200000, 500,  '2025-03-01', '2025-06-30', 'Giảm 20% cho đơn từ 500K'),
    ('FREESHIP',    'fixed',    30000, 300000, NULL,  2000, '2025-01-01', '2025-12-31', 'Miễn phí ship cho đơn từ 300K'),
    ('SUMMER50',    'fixed',    50000, 400000, NULL,  300,  '2025-06-01', '2025-08-31', 'Giảm 50K cho đơn từ 400K mùa hè'),
    ('VIP30',       'percent',  30, 1000000, 500000, 100,  '2025-01-01', '2025-12-31', 'Giảm 30% cho khách VIP, đơn từ 1 triệu');

INSERT INTO Banner (TieuDe, TieuDePhu, HinhAnh, LienKet, LoaiBanner, ViTri, ThuTu) VALUES
    ('Bé Vui Đến Trường',      'Gọn gàng · Mềm mại · Dễ vận động', '/slide_1.jpg', '/categories/ao-be',          'slider', 'homepage', 1),
    ('Mặc Xinh Chơi Cả Ngày',  'Outfit mới cho mọi cuộc phiêu lưu', '/slide_2.jpg', '/categories/quan-be',        'slider', 'homepage', 2),
    ('Ưu Đãi Cho Bé',          'Deal nổi bật cho tủ đồ mới',        '/slide_3.jpg', '/categories/vay-be-gai',     'slider', 'homepage', 3);

INSERT INTO Lookbook (TieuDe, TieuDePhu, MoTa, HinhAnh, LienKet, ThuTu) VALUES
    ('Ngày Đến Trường',     'Back to School', 'Gợi ý outfit gọn gàng, thoải mái cho bé đi học',             '/lookbook/school-1.jpg', '/categories/ao-be', 1),
    ('Cuối Tuần Phiêu Lưu', 'Weekend Fun',    'Phối đồ năng động để bé tự do vui chơi cùng gia đình',       '/lookbook/weekend-1.jpg', '/categories/quan-be', 2);

INSERT INTO MenuDieuHuong (TenMenu, LienKet, ViTri, ThuTu) VALUES
    ('Bé gái',       '/categories/vay-be-gai',  'header', 1),
    ('Bé trai',      '/categories/ao-be',        'header', 2),
    ('Phụ kiện bé',  '/categories/phu-kien-be', 'header', 3),
    ('Bộ sưu tập',   '/collections',             'header', 4),
    ('Sale',          '/sale',                    'header', 5),
    ('Hàng mới',      '/new-in',                  'header', 6);

INSERT INTO MenuDieuHuong (TenMenu, LienKet, ViTri, MenuChaId, ThuTu) VALUES
    ('Áo bé gái',      '/categories/ao-be',       'header', 1, 1),
    ('Váy bé gái',     '/categories/vay-be-gai',  'header', 1, 2),
    ('Đầm bé gái',     '/categories/dam-be-gai',  'header', 1, 3),
    ('Phụ kiện bé gái','/categories/phu-kien-be', 'header', 1, 4);

INSERT INTO MenuDieuHuong (TenMenu, LienKet, ViTri, MenuChaId, ThuTu) VALUES
    ('Áo bé trai',     '/categories/ao-be',       'header', 2, 1),
    ('Quần bé trai',   '/categories/quan-be',     'header', 2, 2),
    ('Áo khoác bé',    '/categories/ao-khoac-be', 'header', 2, 3),
    ('Phụ kiện bé trai','/categories/phu-kien-be','header', 2, 4);

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
    ('Giới thiệu',            'gioi-thieu',           '<h2>Về KAITO KID</h2><p>KAITO KID là thương hiệu thời trang trẻ em 0-12 tuổi, ưu tiên sự mềm mại, thoải mái, dễ vận động và phong cách tươi vui phù hợp trẻ nhỏ.</p>'),
    ('Chính sách đổi trả',    'chinh-sach-doi-tra',   '<h2>Chính sách đổi trả</h2><p>Đổi trả miễn phí trong 7 ngày kể từ ngày nhận hàng nếu sản phẩm bị lỗi hoặc không đúng mô tả. Sản phẩm đổi trả phải còn nguyên tem mác, chưa qua sử dụng.</p>'),
    ('Chính sách vận chuyển',  'chinh-sach-van-chuyen', '<h2>Chính sách vận chuyển</h2><p>Miễn phí vận chuyển cho đơn hàng từ 499.000đ. Thời gian giao hàng: Nội thành 1-2 ngày, ngoại thành 2-4 ngày.</p>'),
    ('Hướng dẫn chọn size',   'huong-dan-chon-size',  '<h2>Hướng dẫn chọn size cho bé</h2><p>Size KAITO KID ưu tiên theo chiều cao của bé (90-150). Hãy đo chiều cao và cân nặng thực tế; nếu bé nằm giữa hai size hoặc thích mặc rộng, ưu tiên size lớn hơn.</p>'),
    ('Chính sách bảo mật',    'chinh-sach-bao-mat',   '<h2>Chính sách bảo mật</h2><p>Chúng tôi cam kết bảo mật thông tin cá nhân của khách hàng. Thông tin của bạn chỉ được sử dụng cho mục đích xử lý đơn hàng và chăm sóc khách hàng.</p>');

INSERT INTO DonHang (MaDonHang, NguoiDungId, TenNguoiNhan, SoDienThoai, Email, DiaChiGiao, TinhThanh, QuanHuyen, PhuongXa, TamTinh, PhiVanChuyen, GiamGia, TongTien, PhuongThucThanhToan, TrangThai) VALUES
    ('KK-20250320-ABC123', 2, 'Nguyễn Thị Thảo', '0912345678', 'thao@gmail.com', '45 Lê Lợi, P.Bến Nghé, Q.1, TP.HCM', 'TP.HCM', 'Quận 1', 'Bến Nghé', 997000, 0, 0, 997000, 'COD', 'completed'),
    ('KK-20250322-DEF456', 3, 'Trần Minh Hoàng', '0923456789', 'hoang@gmail.com', '12 Trần Hưng Đạo, P.5, Q.5, TP.HCM', 'TP.HCM', 'Quận 5', 'Phường 5', 1198000, 30000, 100000, 1128000, 'shipping', 'VISA'),
    ('KK-20250325-GHI789', 4, 'Lê Phương Linh', '0934567890', 'linh@gmail.com', '78 Nguyễn Trãi, Thanh Xuân, Hà Nội', 'Hà Nội', 'Thanh Xuân', 'Nhân Chính', 599000, 30000, 0, 629000, 'Momo', 'confirmed');

INSERT INTO ChiTietDonHang (DonHangId, SanPhamId, TenSanPham, HinhAnhSP, DonGia, KichCo, MauSac, SoLuong) VALUES
    (1, 1, 'Áo Thun Bé Trai Cổ Tròn Basic',      '/products/ao-thun-be-trai-1.jpg', 299000, '120', 'Xanh navy',  2),
    (1, 8, 'Áo Polo Bé Trai Cổ Bẻ',              '/products/polo-be-trai-1.jpg',    399000, '120', 'Trắng',      1),
    (2, 9, 'Quần Jean Bé Trai Slim Co Giãn',     '/products/jean-be-trai-1.jpg',    599000, '130', 'Xanh đậm',   1),
    (2, 6, 'Áo Hoodie Trẻ Em Unisex',            '/products/hoodie-tre-em-1.jpg',   599000, '130', 'Xám',        1),
    (3, 6, 'Áo Hoodie Trẻ Em Unisex',            '/products/hoodie-tre-em-1.jpg',   599000, '120', 'Be',         1);

INSERT INTO DanhGia (SanPhamId, NguoiDungId, TenKhachHang, DonHangId, SoSao, NoiDung, TrangThai) VALUES
    (1, 2, 'Nguyễn Thị Thảo', 1, 5, 'Vải mềm, bé mặc mát và vận động thoải mái. Giao hàng nhanh!', 'approved'),
    (1, 3, 'Trần Minh Hoàng', 2, 4, 'Form áo cho bé gọn gàng, chất vải dễ chịu và đóng gói cẩn thận.', 'approved'),
    (4, 2, 'Nguyễn Thị Thảo', 1, 5, 'Áo sơ mi bé mặc đi học rất xinh, vải mềm và ít nhăn.', 'approved'),
    (6, 4, 'Lê Phương Linh', 3, 5, 'Hoodie ấm, lớp nỉ mềm và bé mặc rất thoải mái.', 'approved'),
    (9, 3, 'Trần Minh Hoàng', 2, 4, 'Jean co giãn tốt, bé chạy nhảy không bị cứng.', 'approved');

INSERT INTO CauHinhTrangChu (TenSection, DanhSachSPId, ThuTu) VALUES
    ('newArrivals',     '[1,2,3,5,6,9,10,12]',  1),
    ('bestSellers',     '[1,4,6,8,9,11,13,17]',  2),
    ('saleProducts',    '[2,5,7,10,13,15,19]',   3);

INSERT INTO HomepageBlock (BlockType, TieuDe, TieuDePhu, HinhAnh, LienKet, ThuTu) VALUES
        ('categoryTile', 'Bé gái',       'Xinh xắn mỗi ngày',      '/slide_1.jpg', '/categories/vay-be-gai', 1),
        ('categoryTile', 'Bé trai',       'Năng động, thoải mái',   '/slide_2.jpg', '/categories/ao-be',       2),
        ('categoryTile', 'Đi học',        'Gọn gàng đến trường',    '/slide_3.jpg', '/categories/quan-be',     3),
        ('categoryTile', 'Phụ kiện bé',   'Hoàn thiện outfit',       '/slide_1.jpg', '/categories/phu-kien-be', 4);

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
