# KaitoKid Brand Guide

## Định vị

**KaitoKid là thương hiệu thời trang trẻ em 0–12 tuổi.**

Không sử dụng KaitoKid như một shop thời trang nam/nữ người lớn trong dữ liệu, giao diện hoặc nội dung marketing.

## Khách hàng

Người mua chính:

- cha mẹ/người chăm sóc trẻ;
- người thân mua quà cho trẻ;
- trẻ em là người mặc và trải nghiệm sản phẩm.

## Lời hứa thương hiệu

**Mềm mại · Thoải mái · Dễ vận động**

Ưu tiên khi mô tả sản phẩm:

1. chất liệu dễ chịu;
2. khả năng vận động;
3. độ tuổi/chiều cao phù hợp;
4. cách sử dụng: đi học, đi chơi, sinh nhật, cuối tuần;
5. dễ giặt/chăm sóc khi thông tin có sẵn.

Không dùng mô tả mang tính người lớn như “quyến rũ”, “body”, “công sở nữ”, “dáng người châu Á” cho sản phẩm trẻ em.

## Cấu trúc danh mục hiện tại

- Áo bé
  - Áo thun bé
  - Áo sơ mi bé
  - Áo khoác bé
  - Áo polo bé
- Quần bé
  - Quần jean bé
  - Quần kaki bé
  - Quần short bé
- Váy bé gái
- Đầm bé gái
- Phụ kiện bé

Các slug là tiếng Việt không dấu, ví dụ `ao-be`, `quan-be`, `vay-be-gai`.

## Size

Dữ liệu mẫu sử dụng size theo chiều cao:

`90, 100, 110, 120, 130, 140, 150`

Phụ kiện có thể dùng `Freesize`.

UI về sau nên hiển thị rõ đây là size/chiều cao cho trẻ em và có link hướng dẫn chọn size.

## Giới tính và nhóm tuổi trong database

- `NhomTuoi = TreEm`
- `GioiTinh = Nam` → bé trai
- `GioiTinh = Nu` → bé gái
- `GioiTinh = Unisex` → dùng chung

Giữ các giá trị kỹ thuật này để tương thích backend hiện tại; UI phải hiển thị ngôn ngữ “Bé trai”, “Bé gái”, “Unisex”.

## Bộ sưu tập mẫu

- Ngày Đến Trường
- Chơi Cả Ngày
- Tiệc Nhỏ Của Bé
- Cuối Tuần Phiêu Lưu

## Quy tắc cho AI/GPT

Khi thêm dữ liệu hoặc UI mới:

- không quay lại dữ liệu thời trang người lớn;
- giữ tone thân thiện, rõ ràng với phụ huynh;
- ưu tiên thông tin thực dụng thay vì marketing quá mức;
- nếu thêm category/product mới, đảm bảo tên, slug, mô tả, size và `NhomTuoi` đồng nhất với định vị trên.


## Màu UI hiện tại

Home mobile dùng bảng màu tập trung tại `apps/mobile/src/constants/brand.ts`:

- Primary: `#7C3AED`
- Primary dark: `#5B21B6`
- Accent: `#F97316`
- Canvas: `#F8FAFC`
- Surface: `#FFFFFF`
- Ink: `#111827`

Khi thêm component Home/Product mới, ưu tiên dùng `BRAND_COLORS` thay vì hard-code lại màu thương hiệu.
