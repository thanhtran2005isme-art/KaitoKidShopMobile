# KaitoKid Mobile Roadmap

Roadmap này là thứ tự triển khai chính. Không nhảy phase khi phần phụ thuộc cốt lõi của phase trước chưa ổn định.

**Spec chi tiết cho toàn bộ phần còn lại PHASE 5 → PHASE 10:** `docs/PHASES_5_10.md`. File đó là checklist triển khai/acceptance chính cho các phase chưa hoàn thành.

## Trạng thái

- [x] PHASE 1 — Chốt branding + dữ liệu
- [x] PHASE 2 — Nâng cấp Home
- [x] PHASE 3 — Product Detail hoàn chỉnh
- [x] PHASE 4 — Wishlist + Add to Cart
- [x] PHASE 5 — Cart thật
- [ ] PHASE 6 — Checkout + Address + Shipping + Payment
- [ ] PHASE 7 — Orders + Tracking
- [ ] PHASE 8 — Reviews + Notifications + Account
- [ ] PHASE 9 — Collections + Lookbook + Recommendation
- [ ] PHASE 10 — Polish UI + performance + testing

## PHASE 1 — Chốt branding + dữ liệu

Định vị đã chốt:

**KaitoKid = thời trang trẻ em 0–12 tuổi.**

Đã thực hiện:

- chuẩn hóa category, product, collection, banner, lookbook và nội dung thương hiệu sang trẻ em;
- giữ nguyên ID/SKU/quan hệ để không phá review/order/backend hiện tại;
- chuẩn hóa size mẫu theo chiều cao 90–150;
- thêm `NhomTuoi = TreEm` cho dữ liệu sản phẩm;
- thêm `apps/mobile/src/constants/brand.ts`;
- đổi tên hiển thị Expo app thành `KaitoKid`;
- thêm `docs/BRAND.md`;
- thêm migration không phá bảng cho database local hiện tại:
  `backend/Database/migrations/20260922_phase1_kids_branding.sql`.

### Việc vận hành cần làm sau khi pull PHASE 1

Chạy migration trên database local hiện tại:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root kaitokid < backend\Database\migrations\20260922_phase1_kids_branding.sql
```

Sau đó restart `run.bat`.

## PHASE 2 — Nâng cấp Home

Đã triển khai:

- header mới theo brand KaitoKid, có lời hứa thương hiệu và entry point tài khoản/giỏ hàng;
- cart badge đọc số lượng thật từ `/api/cart` khi có access token; không hiển thị số giả khi chưa có session;
- login mobile đi qua `AuthContext` để session/token được lưu đúng;
- hero banner tự chuyển sau 4.5 giây, có counter và pagination dots;
- promo/value strip cho freeship, đổi trả và cam kết mua sắm;
- Home chỉ hiển thị category gốc để tránh lẫn subcategory;
- thêm discovery/category tiles từ `HomepageBlock.categoryTile`;
- ProductCard được polish với badge MỚI/HOT/SALE, tồn kho, màu, rating và số đã bán;
- product section có nhãn ngữ cảnh cho Hàng mới/Bán chạy/Sale;
- thêm skeleton loading riêng cho Home;
- giữ social block và thêm brand footer.

Ranh giới phase:

- wishlist và Add to Cart thật vẫn thuộc PHASE 4;
- Cart screen đầy đủ vẫn thuộc PHASE 5;
- Collections/Lookbook/Recommendation đầy đủ vẫn thuộc PHASE 9.

### Validation

Đã static-review TypeScript và sửa các lỗi tìm thấy trên branch. Môi trường công cụ hiện tại không thể clone GitHub để chạy `npm/tsc` vì DNS/network bị chặn; cần xác nhận runtime cuối trên máy development sau khi pull.

## PHASE 3 — Product Detail hoàn chỉnh

Đã triển khai:

- gallery ảnh có swipe, thumbnail, counter và fallback ảnh chính;
- chọn màu có swatch và trạng thái unavailable;
- chọn size có trạng thái unavailable;
- size guide trẻ em 90–150 theo chiều cao;
- chọn số lượng và tự giới hạn theo tồn kho;
- API Product Detail trả thêm tồn kho thật từ `TonKhoBienThe` khi có;
- selector tự suy ra màu/size từ `DanhSachMau/DanhSachSize`, `BienThe` hoặc `TonKhoBienThe`;
- sản phẩm `out-of-stock` vẫn mở được Product Detail thay vì 404;
- mô tả HTML được chuyển thành text dễ đọc trên mobile;
- thông tin SKU/danh mục/giới tính/độ tuổi/specs;
- hiển thị review đã duyệt ở chế độ read-only;
- sản phẩm liên quan qua `/api/products/{id}/related`;
- Share sản phẩm;
- skeleton loading và error/retry state;
- state màu/size/số lượng đã sẵn sàng để PHASE 4 nối Wishlist/Add to Cart.

### Dữ liệu hiện tại

Seed hiện chưa có album ảnh phụ hoặc bản ghi `TonKhoBienThe` mẫu. Vì vậy với dữ liệu hiện tại:

- gallery dùng ảnh chính;
- tồn kho dùng `SanPham.TonKho`;
- khi sau này có dữ liệu biến thể thật, UI tự chuyển sang tồn kho size + màu mà không cần đổi màn hình.

PHASE 3 không cần migration database mới.

### Validation

Đã static-review TypeScript/C# và sửa các lỗi cú pháp/logic tìm thấy trên branch. Môi trường công cụ hiện tại vẫn không thể chạy build local của người dùng; cần runtime validation sau khi pull.

## PHASE 4 — Wishlist + Add to Cart

Đã triển khai:

- `ShoppingContext` là nguồn state chung cho wishlist và cart badge trên toàn mobile;
- ProductCard có nút tim độc lập, đồng bộ thật với `/api/wishlist`;
- Product Detail có wishlist CTA và trạng thái đã lưu;
- thêm màn `/wishlist` để xem/xóa sản phẩm yêu thích;
- Login hỗ trợ `redirect` để quay lại Product/Wishlist/Cart sau xác thực;
- Add to Cart dùng đúng `productId + size + color + quantity` đã chọn ở PHASE 3;
- CTA Product Detail phân biệt thiếu lựa chọn, sản phẩm hết hàng và biến thể hết hàng;
- feedback thành công/thất bại hiển thị ngay trên màn chi tiết;
- cart badge cập nhật ngay sau khi thêm và hiển thị cả ở Home header + tab Giỏ hàng;
- tab Cart hiện phản ánh số lượng thật, nhưng màn quản lý item chi tiết vẫn để PHASE 5;
- backend validate quantity, product status, size/màu và variant trước khi reserve;
- reserve tồn kho được đồng bộ hai cấp:
  `SanPham.SoLuongDaGiu` + `TonKhoBienThe.SoLuongDaGiu`;
- remove/update/expire/checkout đều giải phóng reserve tương ứng;
- Product API trả `AvailableStock` để mobile hiển thị tồn khả dụng thay vì chỉ tồn vật lý.

### Migration PHASE 4

Database local nên chạy:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root kaitokid < backend\Database\migrations\20260922_phase4_cart_reservation.sql
```

Migration này idempotent và chỉ bảo đảm các cột reservation cần thiết tồn tại; không xóa dữ liệu.

### Validation

Đã static-review TypeScript/C# và kiểm tra lại contract API, reservation flow và route login redirect. Runtime cuối vẫn cần xác nhận trên máy development sau khi pull.

## PHASE 5 — Cart thật

Đã triển khai:

- Cart Mobile load danh sách item thật từ `/api/cart`;
- `ShoppingContext` giữ `cartItems` làm nguồn state chung và derive cart badge từ dữ liệu giỏ;
- tăng/giảm số lượng qua `PUT /api/cart/{id}`, khóa thao tác trong mutation và refresh khi backend báo lỗi stock;
- xóa một item, xóa nhiều item, chọn tất cả/bỏ chọn tất cả;
- chuyển item đã chọn sang Wishlist;
- subtotal chỉ tính trên item đang chọn;
- reservation countdown từ `reservedUntil`, hết hạn thì refresh từ backend thay vì tự release ở client;
- combo discount hiển thị từ API backend;
- cross-sell Mobile dùng endpoint tương thích riêng `/api/cart/cross-sell-products` trả `ProductDTO` đầy đủ để dùng `ProductCard`; endpoint `/api/cart/cross-sell` cũ được giữ cho Web;
- CTA checkout lưu danh sách selected cart IDs để PHASE 6 dùng; chưa giả định backend hỗ trợ partial checkout;
- loading/error/empty/pull-to-refresh và reset protected cart state khi logout.

### Validation

Đã static-review contract TypeScript/C# và luồng reservation. Runtime cuối cần xác nhận trên máy development sau khi pull.

**Tiếp theo:** PHASE 6 — Checkout + Address + Shipping + Payment.

## PHASE 6 → PHASE 10

Chi tiết đầy đủ về mục tiêu, API backend, mobile UI/state, dependency, ranh giới và checklist nghiệm thu của PHASE 6–10 nằm trong:

`docs/PHASES_5_10.md`

Thứ tự bắt buộc:

```text
PHASE 5 Cart
→ PHASE 6 Checkout
→ PHASE 7 Orders
→ PHASE 8 Reviews / Notifications / Account
→ PHASE 9 Collections / Lookbook / Recommendation
→ PHASE 10 Polish / Performance / Testing
```

## Nguyên tắc triển khai

- commit bằng tiếng Việt;
- mỗi phase dùng branch riêng;
- cập nhật `AI_HANDOFF.md`, `ROADMAP.md`, `DECISIONS.md` hoặc `TROUBLESHOOTING.md` khi trạng thái bền vững thay đổi;
- không commit secret;
- không sửa dữ liệu thành thời trang người lớn trở lại.
