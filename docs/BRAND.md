# KaitoKid Brand Guide

## Định vị hiện tại

**KaitoKid Shop Fashion là cửa hàng thời trang và phụ kiện cho nhiều lứa tuổi và giới tính.**

Phạm vi kinh doanh gồm nam, nữ, bé trai, bé gái, unisex, người lớn và trẻ em. Web hiện có các khu vực **NỮ / NAM / TRẺ EM** là chủ đích nghiệp vụ và không được tự động xóa hoặc đổi thành kids-only.

## Quy ước dữ liệu

Hai chiều dữ liệu phải được phân biệt:

- `GioiTinh = Nam | Nu | Unisex`: giới tính/phân nhóm mặc.
- `NhomTuoi = NguoiLon | TreEm`: nhóm tuổi.

Ví dụ `GioiTinh=Nam + NhomTuoi=TreEm` là bé trai; `GioiTinh=Nu + NhomTuoi=NguoiLon` là nữ người lớn. Không dùng `Tre em` như một giá trị `GioiTinh`.

## Size

- Trẻ em: `90, 100, 110, 120, 130, 140, 150`.
- Người lớn: `S, M, L, XL, XXL` khi sản phẩm hỗ trợ.
- Phụ kiện: có thể dùng `Freesize`.

UI phải đọc size thật từ dữ liệu sản phẩm/biến thể, không giả định toàn catalog dùng một hệ size.

## Mobile PHASE 1–9

PHASE 1 trước đây đã chuẩn hóa **bộ seed Mobile hiện có** thành catalog trẻ em 0–12 tuổi để hoàn thiện nhanh luồng mua hàng Mobile. Đây là trạng thái dữ liệu mẫu của các phase đã triển khai, **không phải định vị toàn bộ KaitoKid Shop Fashion**.

Vì vậy:

- không dùng PHASE 1 làm lý do xóa nội dung nam/nữ người lớn khỏi Web;
- không chạy migration kids-branding lên catalog đầy đủ nếu việc đó sẽ ghi đè dữ liệu người lớn mà chưa audit;
- khi mở rộng Mobile parity với Web, phải hỗ trợ Nam/Nữ/Trẻ em theo dữ liệu thật.

## Nội dung và merchandising

Copy, banner, collection, lookbook và recommendation phải theo đúng audience của sản phẩm đang hiển thị. Không áp copy dành cho trẻ em lên sản phẩm người lớn và ngược lại.

## Màu UI Mobile hiện tại

Mobile dùng `BRAND_COLORS` tại `apps/mobile/src/constants/brand.ts`:

- Primary: `#7C3AED`
- Primary dark: `#5B21B6`
- Accent: `#F97316`
- Canvas: `#F8FAFC`
- Surface: `#FFFFFF`
- Ink: `#111827`

## Quy tắc cho AI/GPT

- Web Nam/Nữ/Trẻ em là nghiệp vụ hợp lệ.
- Không suy từ tên “KaitoKid” rằng toàn bộ shop chỉ bán đồ trẻ em.
- Khi filter trẻ em, ưu tiên `NhomTuoi=TreEm`, không giả `GioiTinh=Tre em`.
- Giữ Git + docs + source hiện tại làm source of truth.
