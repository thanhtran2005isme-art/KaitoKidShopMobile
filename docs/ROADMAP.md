# KaitoKid Mobile Roadmap

Roadmap này là thứ tự triển khai chính. Không nhảy phase khi phần phụ thuộc cốt lõi của phase trước chưa ổn định.

## Trạng thái

- [x] PHASE 1 — Chốt branding + dữ liệu
- [x] PHASE 2 — Nâng cấp Home
- [x] PHASE 3 — Product Detail hoàn chỉnh
- [ ] PHASE 4 — Wishlist + Add to Cart
- [ ] PHASE 5 — Cart thật
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

Mục tiêu tiếp theo:

- wishlist thật trên ProductCard/Product Detail;
- Add to Cart dùng đúng màu, size và số lượng đã chọn;
- yêu cầu đăng nhập khi API cần token;
- xử lý hết hàng/biến thể hết hàng;
- cập nhật cart badge sau khi thêm;
- feedback thành công/thất bại rõ ràng;
- không làm Cart screen đầy đủ trước PHASE 5.

## Nguyên tắc triển khai

- commit bằng tiếng Việt;
- mỗi phase dùng branch riêng;
- cập nhật `AI_HANDOFF.md`, `ROADMAP.md`, `DECISIONS.md` hoặc `TROUBLESHOOTING.md` khi trạng thái bền vững thay đổi;
- không commit secret;
- không sửa dữ liệu thành thời trang người lớn trở lại.
