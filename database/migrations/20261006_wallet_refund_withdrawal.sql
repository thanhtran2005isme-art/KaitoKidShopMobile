-- KaitoKid - Ví hoàn tiền + yêu cầu rút tiền
-- Idempotent migration cho MariaDB hiện hữu và bước bổ sung bắt buộc sau fresh schema.
-- Không xóa/rebuild dữ liệu.

START TRANSACTION;

CREATE TABLE IF NOT EXISTS ViDienTu (
    Id              INT AUTO_INCREMENT PRIMARY KEY,
    NguoiDungId     INT NOT NULL,
    SoDuKhaDung     DECIMAL(18,0) NOT NULL DEFAULT 0,
    SoDuTamGiu      DECIMAL(18,0) NOT NULL DEFAULT 0,
    NgayTao         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    NgayCapNhat     DATETIME(6) NULL,

    CONSTRAINT UQ_ViDienTu_NguoiDung UNIQUE (NguoiDungId),
    CONSTRAINT FK_ViDienTu_NguoiDung FOREIGN KEY (NguoiDungId) REFERENCES NguoiDung(Id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS GiaoDichVi (
    Id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    ViId                INT NOT NULL,
    NguoiDungId         INT NOT NULL,
    Loai                VARCHAR(40) NOT NULL,
    Huong               VARCHAR(10) NOT NULL,
    SoTien              DECIMAL(18,0) NOT NULL,
    SoDuKhaDungSau      DECIMAL(18,0) NOT NULL,
    SoDuTamGiuSau       DECIMAL(18,0) NOT NULL,
    ThamChieuLoai       VARCHAR(40) NOT NULL,
    ThamChieuId         VARCHAR(100) NOT NULL,
    MoTa                VARCHAR(500) NULL,
    NgayTao             DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT UQ_GiaoDichVi_Idempotency
        UNIQUE (NguoiDungId, Loai, ThamChieuLoai, ThamChieuId),
    CONSTRAINT FK_GiaoDichVi_Vi FOREIGN KEY (ViId) REFERENCES ViDienTu(Id),
    CONSTRAINT FK_GiaoDichVi_NguoiDung FOREIGN KEY (NguoiDungId) REFERENCES NguoiDung(Id),
    INDEX IX_GiaoDichVi_NguoiDung_NgayTao (NguoiDungId, NgayTao),
    INDEX IX_GiaoDichVi_ThamChieu (ThamChieuLoai, ThamChieuId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS YeuCauRutTien (
    Id                      BIGINT AUTO_INCREMENT PRIMARY KEY,
    NguoiDungId             INT NOT NULL,
    ViId                    INT NOT NULL,
    SoTien                  DECIMAL(18,0) NOT NULL,
    TenNganHang             VARCHAR(100) NOT NULL,
    SoTaiKhoan              VARCHAR(64) NOT NULL,
    ChuTaiKhoan             VARCHAR(150) NOT NULL,
    TrangThai               VARCHAR(20) NOT NULL DEFAULT 'pending',
    GhiChuKhach             VARCHAR(300) NULL,
    GhiChuAdmin             VARCHAR(500) NULL,
    MaThamChieuNganHang     VARCHAR(100) NULL,
    NguoiDuyet              VARCHAR(200) NULL,
    ThoiGianDuyet           DATETIME(6) NULL,
    ThoiGianHoanTat         DATETIME(6) NULL,
    NgayTao                 DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    NgayCapNhat             DATETIME(6) NULL,

    CONSTRAINT FK_YeuCauRutTien_NguoiDung FOREIGN KEY (NguoiDungId) REFERENCES NguoiDung(Id),
    CONSTRAINT FK_YeuCauRutTien_Vi FOREIGN KEY (ViId) REFERENCES ViDienTu(Id),
    INDEX IX_YeuCauRutTien_NguoiDung_TrangThai (NguoiDungId, TrangThai),
    INDEX IX_YeuCauRutTien_TrangThai_NgayTao (TrangThai, NgayTao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO QuyenHan (MaQuyen, TenQuyen, Nhom, MoTa)
VALUES
    ('wallet.view', 'Xem ví và rút tiền', 'wallet', 'Xem số dư ví và yêu cầu rút tiền của khách'),
    ('wallet.manage', 'Xử lý rút tiền', 'wallet', 'Duyệt, từ chối và xác nhận chuyển khoản yêu cầu rút tiền')
ON DUPLICATE KEY UPDATE
    TenQuyen = VALUES(TenQuyen),
    Nhom = VALUES(Nhom),
    MoTa = VALUES(MoTa);

-- Quyền tài chính mặc định chỉ cấp cho role admin. Các role khác phải được
-- Super Admin cấp rõ ràng qua RBAC; không dùng orders.update_status thay thế.
INSERT IGNORE INTO VaiTro_QuyenHan (VaiTroId, QuyenHanId)
SELECT r.Id, q.Id
FROM VaiTro r
JOIN QuyenHan q ON q.MaQuyen IN ('wallet.view', 'wallet.manage')
WHERE r.MaVaiTro = 'admin';

-- D026 hiện dùng cửa sổ hoàn hàng 15 ngày. Đồng bộ nội dung seed/cấu hình cũ
-- để fresh DB và DB nâng cấp không tiếp tục hiển thị chính sách 7 ngày.
UPDATE TrangTinh
SET NoiDung = '<h2>Chính sách đổi trả</h2><p>Khách hàng có thể gửi yêu cầu hoàn hàng trong 15 ngày kể từ lúc xác nhận đã nhận hàng. Hàng hoàn chỉ được xử lý sau khi KaitoKid duyệt yêu cầu và kiểm tra hàng thực tế.</p>'
WHERE Slug = 'chinh-sach-doi-tra';

UPDATE HomepageBlock
SET TieuDe = 'Đổi trả 15 ngày',
    MoTa = 'Gửi yêu cầu hoàn trong 15 ngày từ lúc xác nhận nhận hàng'
WHERE BlockType = 'brandValue' AND ThuTu = 2;

COMMIT;
