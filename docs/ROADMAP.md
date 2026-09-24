# KaitoKid Mobile Roadmap

> **Brand scope update 2026-09-24:** D020 supersede D009. KaitoKid Shop Fashion phục vụ Nam/Nữ/Trẻ em và nhiều lứa tuổi. Các đoạn PHASE 1 kids-only bên dưới là lịch sử triển khai bộ seed Mobile, không được dùng để xóa nghiệp vụ Web Nam/Nữ/Trẻ em.

Roadmap này là thứ tự triển khai chính. Không nhảy phase khi phần phụ thuộc cốt lõi của phase trước chưa ổn định.

**Spec chi tiết cho toàn bộ phần còn lại PHASE 5 → PHASE 10:** `docs/PHASES_5_10.md`. File đó là checklist triển khai/acceptance chính cho các phase chưa hoàn thành.

## Trạng thái

- [x] PHASE 1 — Chốt branding + dữ liệu
- [x] PHASE 2 — Nâng cấp Home
- [x] PHASE 3 — Product Detail hoàn chỉnh
- [x] PHASE 4 — Wishlist + Add to Cart
- [x] PHASE 5 — Cart thật
- [x] PHASE 6 — Checkout + Address + Shipping + Payment
- [x] PHASE 7 — Orders + Tracking
- [x] PHASE 8 — Reviews + Notifications + Account
- [x] PHASE 9 — Collections + Lookbook + Recommendation
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

## PHASE 6 — Checkout + Address + Shipping + Payment

Đã triển khai:

- Cart chuyển selected `CartItemIds` sang `CheckoutContext`; không truyền toàn bộ checkout state qua query params;
- backend `CreateOrderDTO.CartItemIds` hỗ trợ partial checkout và validate ID thuộc đúng user;
- subtotal, coupon và combo discount đều tính trên đúng selected items;
- chỉ selected items bị trừ stock/release reserve/xóa khỏi Cart; item không chọn tiếp tục giữ nguyên Cart + reservation;
- `OrderService` luôn quote lại shipping server-side từ địa chỉ có cấu trúc và provider/service đã chọn; không tin `shippingFee` client;
- Web checkout cũng gửi province/district/ward/street để giữ tương thích với contract shipping mới;
- Mobile có `CheckoutProvider`, màn Checkout, quản lý Address CRUD/default, shipping options, coupon, payment method, review modal và Order Success;
- COD tạo đơn và vận đơn theo backend hiện có;
- ATM/bank transfer dùng `/api/payment/config` + `/api/payment/instructions/{orderCode}`, countdown/poll status/cancel; simulate-paid chỉ hiện khi backend cho phép dev;
- QR chỉ render khi backend/store setting thật sự cung cấp `qrImage`; Mobile không hard-code gateway VietQR;
- payment status/instructions yêu cầu auth và chỉ trả đơn thuộc user hiện tại;
- loading/error/retry và double-submit guard đã được thêm cho flow chính;
- không có migration database mới trong PHASE 6.

### UI workflow

Các màn PHASE 6 được thiết kế sau khi đọc `skill/.codex/skills/ui-ux-pro-max/SKILL.md` và chạy logic design-system + guideline `react-native`. Quy tắc này đã được đưa vào `AGENTS.md` để các phiên sau bắt buộc tiếp tục áp dụng.

### Validation

Đã static-review contract TypeScript/C#, reservation/partial-checkout, source-of-truth shipping/payment và compatibility với Web. Đã thêm regression tests cho selected partial checkout, invalid selected IDs và fallback all-cart của Web; môi trường connector không chạy được `dotnet test`/Expo runtime nên vẫn cần xác nhận trên máy development sau khi pull.

**Tiếp theo:** PHASE 7 — Orders + Tracking.

## PHASE 7 — Orders + Tracking

Đã triển khai:

- thêm Mobile routes `/orders`, `/orders/[id]`, `/orders/[id]/tracking`;
- Orders list dùng `FlatList`, filter Tất cả / Chờ xử lý / Đang giao / Hoàn tất / Đã hủy, pull-to-refresh và empty/error state;
- status mapping được tập trung tại `utils/order-status.ts`; `pending + confirmed` cùng thuộc filter Chờ xử lý để không làm mất đơn;
- Order Detail hiển thị items, recipient, payment, shipping, total, note và trạng thái review hiện có;
- backend trả `OrderDTO.CanCancel` từ đúng rule server-side; Mobile không tự suy quyền hủy;
- Cancel có confirmation + loading, backend vẫn là source of truth cuối cùng;
- Reorder dùng `POST /api/cart/reorder/{orderId}`, hiển thị added/skipped, refresh `ShoppingContext` và cho mở Cart để kiểm tra variant/tồn kho;
- Tracking timeline chỉ render history backend, có location/description/time + ETA tham khảo;
- `GET /api/shipping/track/{orderCode}` đã đổi thành owner-only: yêu cầu JWT và lọc theo `UserId`;
- Account tab có entry “Đơn hàng của tôi” cho user đã đăng nhập;
- Order Success có CTA mở đơn vừa đặt;
- không có migration database mới trong PHASE 7.

### UI workflow

Orders/Tracking dùng durable design system trong `docs/UI_UX.md` + skill `ui-ux-pro-max`: touch target ≥44 px, status text + semantic color, destructive confirmation, một primary CTA và không giả tracking event.

### Validation

Đã static-review TypeScript/C# và thêm regression tests cho server-authoritative `canCancel`, tracking ownership và reorder ownership. Môi trường connector không chạy được `dotnet test`/Expo runtime nên cần xác nhận trên máy development sau khi pull.

**Tiếp theo:** PHASE 8 — Reviews + Notifications + Account.

## PHASE 8 — Reviews + Notifications + Account

Đã triển khai:

- Order Detail cho phép viết review trên từng completed item chưa review;
- backend review validate exact owner + completed order + product + purchased variant; size/color lấy từ OrderItem server-side;
- `HasReviewed` được làm variant-aware để không đánh dấu nhầm cùng product khác size/color;
- Review form 1–5 sao, comment, purchased variant, tối đa 4 ảnh; dùng Expo Image Picker SDK 57 gallery-only và multipart upload;
- Product Detail hiển thị toàn bộ review approved theo expand, verified purchase, ảnh review, admin reply và Helpful;
- thêm Notification Center có unread badge ở Account tab, pagination, pull-to-refresh, mark read/read-all/delete và deep-link chỉ từ backend link;
- nâng Account tab thành dashboard profile/tier/points/orders/spent với entry Orders/Notifications/Points/Vouchers/Addresses/Wishlist;
- thêm Profile edit name/phone/birthday + avatar upload;
- thêm Loyalty points history + redeem theo contract bội số 100;
- thêm voucher list + birthday voucher;
- thêm Delete Account route riêng, confirm `DELETE`, logout sau thành công;
- backend delete-account gọi CartService để release reservation trước khi xóa Cart, đồng thời xóa notifications/wishlist/addresses và anonymize review display name;
- birthday voucher được đưa vào `GET /api/account/vouchers`;
- upload review/avatar dùng timeout 45s; normal API giữ 15s;
- `scripts/run-mobile.bat` tự `npm install` nếu `expo-image-picker` còn thiếu sau pull;
- không triển khai video review hoặc Product Q&A vì đây là optional sau core;
- không có migration database mới trong PHASE 8.

### UI workflow

PHASE 8 dùng design system trong `docs/UI_UX.md` + Codex `ui-ux-pro-max`: account hub + task screens, FlatList cho list dài, visible form labels, field-local validation, 44px touch target, destructive confirmation và loading/disabled feedback.

### Validation

Đã static-review contract TypeScript/C#, Expo SDK 57 Image Picker types/config, ownership boundaries và reservation invariant. Đã thêm regression tests cho review owner/order/variant, variant-specific HasReviewed, notification ownership và delete-account release reservation. Connector chưa chạy được `dotnet test`/Expo runtime nên cần xác nhận trên máy development sau khi pull.

**Tiếp theo:** PHASE 9 — Collections + Lookbook + Recommendation.


## PHASE 9 — Collections + Lookbook + Recommendation

Đã triển khai ở mức code ngày 2026-09-24:

- thêm Mobile routes `/collections`, `/collections/[id]`, `/lookbooks`, `/lookbooks/[id]`;
- Collection list/detail dùng metadata backend, ProductCard hiện có và sorting;
- thêm `ProductFilterDTO.CollectionId` để `GET /api/products` lọc sản phẩm Collection ngay trên server; Mobile không tải toàn bộ catalog rồi filter client;
- Lookbook list dùng `GET /api/lookbooks/filters` + season/style filter thật;
- Lookbook Detail đặt hotspot từ `ToaDoX/ToaDoY` theo phần trăm 0–100 và tính lại theo kích thước ảnh render, giữ touch target 44px trên Android/Expo Web;
- hotspot mở mini product card và điều hướng đúng Product Detail;
- thêm `GET /api/recommendations/for-me?limit=` với optional authenticated signal;
- user có Wishlist/completed Order được gợi ý rule-based theo category, ưu tiên best seller/sold/rating/new và loại sản phẩm đã mua khỏi candidate;
- guest hoặc user chưa có signal nhận fallback Best Sellers + New Arrivals/general active; Mobile hiển thị “Khám phá thêm”, không gọi là personalized;
- Home thêm `Bộ sưu tập nổi bật`, `Shop the look` và recommendation; section tự ẩn nếu không có data;
- thêm migration idempotent `backend/Database/migrations/20260924_phase9_discovery_seed.sql` để bổ sung Season/Style và hotspot mẫu cho 2 Lookbook seed hiện có; fresh schema được cập nhật tương ứng;
- thêm regression tests cho Collection filter server-side và recommendation personalized/fallback;
- không thêm bảng database mới.

### UI workflow

PHASE 9 dùng `docs/UI_UX.md` + Codex `ui-ux-pro-max`: discovery card rõ hierarchy, `expo-image`, `Pressable`, touch target ≥44px, responsive max-width cho Expo Web, FlatList cho list/grid, loading/error/empty và hotspot tính theo layout thực tế.

### Validation

Đã static-review contract C#/TypeScript, percent hotspot, auth/fallback semantics và seed migration. Connector không có runtime local để chạy `dotnet test`/Expo; cần chạy migration + xác nhận Android/Expo Web trên máy development sau khi pull.

**Tiếp theo:** PHASE 10 — Polish UI + performance + testing.

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
