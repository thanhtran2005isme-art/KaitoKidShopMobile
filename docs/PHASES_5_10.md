# KaitoKid Mobile — Chi tiết PHASE 5 → PHASE 10

Last updated: 2026-09-22

Tài liệu này là **spec triển khai chi tiết cho phần roadmap còn lại** sau PHASE 4.

Nguồn sự thật khi tiếp tục:

1. `AGENTS.md`
2. `docs/AI_HANDOFF.md`
3. `docs/ROADMAP.md`
4. **file này**
5. `docs/BRAND.md`
6. source code hiện tại + Git history liên quan

Không triển khai theo trí nhớ của chat cũ nếu code/main đã thay đổi.

---

## Trạng thái đầu vào

Đã hoàn tất:

- PHASE 1 — Branding + dữ liệu trẻ em
- PHASE 2 — Home
- PHASE 3 — Product Detail
- PHASE 4 — Wishlist + Add to Cart
- PHASE 5 — Cart thật
- PHASE 6 — Checkout + Address + Shipping + Payment
- PHASE 7 — Orders + Tracking
- PHASE 8 — Reviews + Notifications + Account
- PHASE 9 — Collections + Lookbook + Recommendation

Tiếp theo phải làm:

**PHASE 10 — Polish UI + performance + testing**

Quy tắc Git:

- một PHASE = một commit tổng hợp mặc định;
- commit message bằng tiếng Việt;
- không commit từng file;
- ưu tiên squash merge để `main` chỉ nhận một commit cho mỗi PHASE.

Quy tắc UI/UX bắt buộc:

- mọi thay đổi giao diện phải đọc `docs/UI_UX.md` và `skill/.codex/skills/ui-ux-pro-max/SKILL.md`;
- generate/search design system trước khi code;
- Mobile phải đọc guideline `react-native`;
- giữ brand token KaitoKid hiện tại làm source of truth.

---

# PHASE 5 — Cart thật

## Mục tiêu

Biến tab `Giỏ hàng` từ màn trạng thái/count thành màn quản lý giỏ hàng hoàn chỉnh, sử dụng dữ liệu thật từ API.Customer và tôn trọng reservation tồn kho đã triển khai ở PHASE 4.

## Backend/API hiện có

`CartController` đã có:

- `GET /api/cart`
- `POST /api/cart`
- `PUT /api/cart/{id}`
- `DELETE /api/cart/{id}`
- `DELETE /api/cart`
- `POST /api/cart/remove-many`
- `POST /api/cart/move-to-wishlist`
- `GET /api/cart/cross-sell?limit=4`
- `GET /api/cart/combo-discount`
- `POST /api/cart/reorder/{orderId}`

Cart item đã có các dữ liệu quan trọng:

- productId
- name
- image
- price
- size
- color
- quantity
- availableStock
- reservedUntil
- isLowStock

Reservation invariant phải giữ nguyên:

- `SanPham.SoLuongDaGiu`
- `TonKhoBienThe.SoLuongDaGiu`
- `AvailableStock = Stock - Reserved`

Không ghi trực tiếp vào bảng `GioHang`; luôn đi qua CartService.

## Mobile cần làm

Màn chính:

`apps/mobile/src/app/(tabs)/cart.tsx`

Nên tách component:

- `components/cart/cart-item-card.tsx`
- `components/cart/cart-summary.tsx`
- `components/cart/cart-empty-state.tsx`
- `components/cart/cart-reservation-timer.tsx`
- `components/cart/cart-cross-sell.tsx`

Service/state:

- mở rộng `shopping.api.ts` cho update/delete/bulk/cross-sell/combo;
- mở rộng `ShoppingContext` để có `cartItems`, loading, refresh và mutation;
- `cartCount` phải được derive từ cartItems khi đã load để không có hai nguồn state lệch nhau.

## UX bắt buộc

Mỗi item hiển thị:

- checkbox chọn item;
- ảnh;
- tên sản phẩm;
- size;
- màu;
- giá;
- số lượng;
- nút + / -;
- nút xóa;
- cảnh báo sắp hết;
- reservation countdown nếu `reservedUntil` còn hiệu lực.

Toàn màn:

- Chọn tất cả / bỏ chọn tất cả;
- xóa nhiều item;
- chuyển nhiều item sang Wishlist;
- subtotal của **các item đang chọn**;
- số sản phẩm/số lượng đã chọn;
- combo discount từ API;
- cross-sell ở cuối giỏ;
- CTA `Tiến hành thanh toán`.

## Quy tắc chọn item

Selection trong PHASE 5 dùng cho:

- bulk delete;
- move-to-wishlist;
- subtotal hiển thị;
- xác định item dự kiến checkout.

**Dependency bắt buộc cho PHASE 6:** backend `CreateOrderAsync` hiện lấy toàn bộ `CartItems` của user. Vì vậy PHASE 6 phải mở rộng order contract để nhận `CartItemIds` và chỉ checkout item đã chọn; item không chọn phải còn nguyên trong giỏ.

Trong PHASE 5 có thể lưu danh sách selected cart IDs vào Checkout state/route preparation, nhưng **không được giả rằng backend hiện đã hỗ trợ partial checkout**.

## Quantity/update

Khi bấm + / -:

- không cho < 1;
- không cho vượt available stock;
- gọi `PUT /api/cart/{id}`;
- tránh spam request: khóa nút trong mutation hoặc debounce ngắn;
- nếu API trả stock mới thì cập nhật item và badge ngay;
- nếu backend báo hết stock phải rollback UI hoặc refresh cart.

## Reservation countdown

- đọc `reservedUntil`;
- hiển thị thời gian còn lại khi hợp lệ;
- khi hết hạn: refresh cart;
- không tự giả lập việc release stock ở client;
- backend sweeper vẫn là source of truth.

## Cross-sell

Endpoint hiện trả dữ liệu từ backend. Trước khi render phải kiểm tra DTO thực tế.

Nếu cross-sell item không đủ variant data để quick-add:

- hiển thị ProductCard;
- bấm vào Product Detail để chọn màu/size;
- không tự chọn ngẫu nhiên variant.

## Ranh giới PHASE 5

Chưa làm:

- địa chỉ giao hàng;
- coupon nhập ở checkout;
- shipping quote;
- phương thức thanh toán;
- tạo order;
- order tracking.

Các phần trên thuộc PHASE 6–7.

## Checklist nghiệm thu PHASE 5

- [ ] Login → Cart load đúng item thật.
- [ ] Cart count khớp tổng quantity.
- [ ] + / - cập nhật backend và UI.
- [ ] Không thể tăng vượt tồn khả dụng.
- [ ] Xóa một item hoạt động.
- [ ] Xóa nhiều hoạt động.
- [ ] Move selected → Wishlist hoạt động.
- [ ] Select all hoạt động.
- [ ] Subtotal selected chính xác.
- [ ] Combo discount hiển thị đúng API.
- [ ] Reservation countdown không âm và refresh khi hết.
- [ ] Cross-sell không tạo variant giả.
- [ ] Empty/error/loading state đầy đủ.
- [ ] Sau logout, cart state protected được reset.
- [ ] Docs cập nhật.
- [ ] Toàn PHASE 5 chỉ tạo một commit tổng hợp.

---

# PHASE 6 — Checkout + Address + Shipping + Payment

## Trạng thái triển khai PHASE 6

**Code implementation hoàn tất ngày 2026-09-22; runtime local cần xác nhận sau khi pull.**

Đã thực hiện partial checkout selected IDs, Address CRUD/default, shipping server re-quote, selected coupon/combo, COD, ATM/bank transfer, payment polling/cancel, optional configured QR, review/create-order guard và Order Success. Không có migration database mới.

UI của PHASE 6 đã tuân workflow `.codex` và quy tắc này đã được lưu bền vững trong `AGENTS.md` + `docs/DECISIONS.md`.


## Mục tiêu

Tạo flow checkout hoàn chỉnh từ các item đã chọn trong Cart đến khi tạo đơn thành công hoặc chờ thanh toán.

Flow mong muốn:

```text
Cart selected items
→ Checkout
→ Chọn/tạo địa chỉ
→ Chọn shipping
→ Coupon
→ Payment method
→ Review order
→ Create order
→ COD: Order Success
→ ATM/VietQR: Payment Pending / Status
```

## Backend/API hiện có

### Address

- `GET /api/addresses`
- `POST /api/addresses`
- `PUT /api/addresses/{id}`
- `DELETE /api/addresses/{id}`
- `PUT /api/addresses/{id}/default`

Address DTO:

- fullName
- phone
- province
- district
- ward
- street
- isDefault

### Shipping

- `GET /api/shipping/providers`
- `POST /api/shipping/quote`
- `GET /api/shipping/ghn/locations`
- tracking endpoint để PHASE 7 dùng: `GET /api/shipping/track/{orderCode}`

Shipping quote có:

- provider
- serviceCode
- serviceName
- fee
- insuranceFee
- leadTimeHours
- deliveryType

### Coupon

- `POST /api/coupons/validate`

### Order

- `POST /api/orders`

`CreateOrderDTO` hiện có:

- customerName
- customerPhone
- customerEmail
- customerAddress
- paymentMethod
- couponCode
- note
- shippingProvider
- shippingServiceCode
- shippingFee
- leadTimeHours

### Payment

- `GET /api/payment/config`
- `GET /api/payment/status/{orderCode}`
- `POST /api/payment/cancel/{orderCode}`
- `POST /api/payment/simulate-paid/{orderCode}` — chỉ dùng dev/test nếu backend cho phép

OrderService hiện xử lý ít nhất:

- COD;
- ATM/online có thời hạn thanh toán khoảng 15 phút.

Không hard-code gateway ngoài những gì `/api/payment/config` thực tế trả về.

## Backend change bắt buộc cho partial checkout

Hiện `OrderService.CreateOrderAsync` load **toàn bộ cart của user**.

PHASE 6 phải mở rộng:

- `CreateOrderDTO.CartItemIds: List<int>?`;
- nếu có CartItemIds → chỉ load item thuộc user và nằm trong danh sách;
- validate tất cả ID đều thuộc user;
- tính subtotal/coupon/combo trên đúng selected items;
- trừ stock/reserve đúng selected items;
- chỉ xóa selected items khỏi Cart;
- item không chọn phải giữ nguyên reservation/cart;
- nếu không truyền CartItemIds, chỉ giữ fallback all-cart khi thực sự muốn backward compatibility.

Đây là dependency bắt buộc để Cart selection của PHASE 5 có ý nghĩa khi checkout.

## Mobile cần làm

Nên tạo:

- `app/checkout/index.tsx`
- `app/checkout/address.tsx` hoặc modal quản lý address
- `app/checkout/payment.tsx` nếu flow nhiều bước
- `app/order-success/[orderCode].tsx` hoặc route tương đương

State:

Tạo `CheckoutContext` hoặc reducer scoped cho checkout, chứa:

- selectedCartItemIds;
- selected items snapshot;
- selectedAddress;
- selectedShippingOption;
- coupon + validated discount;
- paymentMethod;
- note;
- subtotal;
- shipping fee;
- discount;
- final total.

Không truyền toàn bộ checkout state nhạy cảm qua query params.

## Address UX

- tự chọn address mặc định nếu có;
- thêm/sửa/xóa;
- set default;
- validate tên, phone, province/district/ward/street;
- form keyboard-aware;
- không cho checkout khi thiếu address hợp lệ.

## Shipping UX

Sau khi chọn address:

1. gọi providers;
2. gọi quote;
3. hiển thị service name + fee + ETA;
4. user chọn một option;
5. khi address hoặc cart total thay đổi phải quote lại.

GHN location lookup chỉ dùng khi provider cần district/ward ID/code.

## Coupon

- nhập code;
- gọi validate với order amount;
- hiển thị discount thật từ backend;
- khi cart/subtotal đổi phải validate lại;
- không tính discount riêng ở client như source of truth.

## Payment

UI phải dựa trên config backend.

Tối thiểu:

- COD;
- ATM/VietQR nếu backend config hỗ trợ.

ATM/VietQR:

- sau create order, hiển thị thông tin/QR theo config response;
- có countdown payment expiry;
- poll `/api/payment/status/{orderCode}` với interval hợp lý;
- dừng poll khi paid/cancelled/expired/unmount;
- nút cancel gọi endpoint customer cancel;
- không dùng `simulate-paid` trong production UI.

## Checklist nghiệm thu PHASE 6

- [ ] Partial checkout chỉ tạo order từ selected cart IDs.
- [ ] Unselected cart items còn nguyên.
- [ ] CRUD Address hoạt động.
- [ ] Default address hoạt động.
- [ ] Shipping quote đổi theo địa chỉ.
- [ ] Coupon hợp lệ/không hợp lệ hiển thị đúng.
- [ ] Total = subtotal - discount + shipping theo backend.
- [ ] COD tạo order thành công.
- [ ] ATM/VietQR có payment state/countdown nếu backend bật.
- [ ] Không tạo duplicate order khi double tap.
- [ ] Error/retry state cho network failure.
- [ ] Order success có order code rõ ràng.
- [ ] Cart/ShoppingContext refresh sau order.
- [ ] Toàn PHASE 6 = một commit.

---

# PHASE 7 — Orders + Tracking

## Trạng thái triển khai PHASE 7

**Code implementation hoàn tất ngày 2026-09-22; runtime local cần xác nhận sau khi pull.**

Đã có Orders list/filter, Order Detail, owner-only Tracking timeline, server-authoritative `CanCancel`, Cancel confirmation, Reorder + cart refresh, Account entry và Order Success link. Không có migration database mới.

Regression tests bao phủ `CanCancel`, tracking ownership và reorder ownership.

## Mục tiêu

Người dùng xem lịch sử mua hàng, chi tiết đơn, trạng thái thanh toán/vận chuyển, hủy đơn hợp lệ và mua lại.

## Backend/API hiện có

Orders:

- `GET /api/orders`
- `GET /api/orders/{id}`
- `PUT /api/orders/{id}/cancel`

Tracking:

- `GET /api/shipping/track/{orderCode}`

Reorder:

- `POST /api/cart/reorder/{orderId}`

Order DTO đã có:

- orderCode
- customer info
- subtotal
- shippingFee
- discount
- total
- couponCode
- paymentMethod
- status
- createdAt
- items
- trackingCode
- trackingUrl
- shippingStatus
- shippingProvider
- shippingServiceCode
- leadTimeHours

Order item có `HasReviewed` để PHASE 8 biết item nào đã đánh giá.

## Mobile cần làm

Nên tạo:

- `app/orders/index.tsx`
- `app/orders/[id].tsx`
- `app/orders/[id]/tracking.tsx`

Account tab phải có entry `Đơn hàng của tôi`.

## Orders list

- filter/tab: Tất cả / Chờ xử lý / Đang giao / Hoàn tất / Đã hủy;
- card có order code, ngày, item preview, total, status;
- pull-to-refresh;
- empty state;
- bấm vào order detail.

Không tự suy status; tạo mapper tập trung từ backend status → label/màu tiếng Việt.

## Order detail

Hiển thị:

- order code;
- items, size, color, quantity;
- subtotal, shipping, discount, total;
- address/recipient;
- payment method/status;
- shipping provider/service;
- tracking code;
- note;
- timeline summary.

Actions tùy status:

- cancel order khi backend cho phép;
- track shipment;
- reorder;
- review item sau khi đủ điều kiện ở PHASE 8.

## Tracking

- gọi `/api/shipping/track/{orderCode}`;
- timeline theo history;
- location + description + time;
- ETA từ leadTimeHours khi có;
- pull-to-refresh;
- không giả tracking event nếu API chưa có.

## Reorder

- gọi `POST /api/cart/reorder/{orderId}`;
- backend phải quyết định item nào còn bán/còn stock;
- hiển thị kết quả item thêm được/không thêm được nếu DTO có;
- refresh ShoppingContext/cart badge;
- đưa người dùng sang Cart để kiểm tra size/màu/tồn kho trước checkout.

## Checklist nghiệm thu PHASE 7

- [x] List order đúng user.
- [x] Filter status không làm mất dữ liệu.
- [x] Order detail đúng tổng tiền/item.
- [x] Cancel chỉ hiện khi hợp lệ.
- [x] Tracking timeline đúng API.
- [x] Reorder cập nhật Cart/badge.
- [x] Không expose order của user khác.
- [x] Loading/error/empty đầy đủ.
- [x] Toàn PHASE 7 = một commit.

---

# PHASE 8 — Reviews + Notifications + Account

## Trạng thái triển khai PHASE 8

**Core implementation hoàn tất ngày 2026-09-22; runtime local cần xác nhận sau khi pull.**

Đã có Review theo completed order/item + image upload, Product Detail review full/helpful/verified/admin reply, Notification Center + unread badge, Account dashboard/Profile/Avatar, Points/Redeem, Vouchers/Birthday và Delete Account an toàn reservation.

Video review và Product Q&A không triển khai vì là optional sau core. Review mới ở trạng thái pending được phản ánh qua `HasReviewed` ở Order Detail; chỉ review approved mới xuất hiện công khai trên Product Detail sau moderation/refresh.

Không có migration database mới. PHASE 8 thêm dependency Expo `expo-image-picker ~57.0.19`; launcher sẽ tự chạy `npm install` khi dependency này còn thiếu.

## Mục tiêu

Hoàn thiện hậu mua hàng và khu vực tài khoản: đánh giá sản phẩm, notification center, hồ sơ, avatar, điểm thành viên và voucher.

## Backend/API hiện có

### Reviews

- `GET /api/reviews/product/{productId}`
- `GET /api/reviews/featured`
- `POST /api/reviews` — auth
- `POST /api/reviews/{id}/helpful`
- `POST /api/reviews/upload` — auth

Review create hỗ trợ:

- productId
- orderId
- rating
- comment
- images
- videoUrl
- size
- color

Review DTO có:

- adminReply
- helpfulCount
- isVerifiedPurchase

### Notifications

- `GET /api/notifications?page=&pageSize=`
- `GET /api/notifications/unread-count`
- `PUT /api/notifications/{id}/read`
- `PUT /api/notifications/read-all`
- `DELETE /api/notifications/{id}`

### Account

- `GET /api/account`
- `PUT /api/account`
- `POST /api/account/avatar`
- `GET /api/account/points-history`
- `POST /api/account/redeem`
- `GET /api/account/vouchers`
- `POST /api/account/birthday-voucher`
- `DELETE /api/account`

Account DTO có:

- name/email/phone/avatar;
- birthday;
- loyaltyPoints;
- memberTier;
- totalSpent;
- nextTierAt / amountToNextTier / nextTier;
- totalOrders.

## Mobile cần làm

Nên tạo:

- `app/review/create.tsx` hoặc route theo order/product;
- `app/notifications.tsx`;
- `app/account/profile.tsx`;
- `app/account/points.tsx`;
- `app/account/vouchers.tsx`;
- address entry có thể link lại module PHASE 6.

Nâng cấp `(tabs)/account.tsx` thành dashboard thật.

## Review flow

Entry chính:

Order Detail → item có `HasReviewed = false` → Viết đánh giá.

Form:

- 1–5 sao;
- comment;
- show purchased size/color;
- upload ảnh;
- video chỉ nếu backend/mobile upload flow hỗ trợ ổn định;
- submit một lần;
- sau thành công refresh order + product reviews.

Product Detail:

- load review list đầy đủ hoặc pagination;
- helpful;
- verified badge;
- admin reply;
- ảnh review.

Không cho user đánh giá sản phẩm/order không thuộc họ; backend phải tiếp tục validate.

## Notifications

- thêm bell icon/badge unread ở Home hoặc Account;
- unread count dùng endpoint riêng;
- list pagination;
- mark read khi mở;
- mark all;
- delete;
- action/deep-link theo type nếu payload backend hỗ trợ;
- không hard-code deep link nếu notification DTO chưa có target.

## Account

Dashboard:

- avatar;
- name/email/phone;
- member tier;
- loyalty points;
- total orders/spent;
- entry orders, addresses, wishlist, vouchers, notifications.

Profile edit:

- name;
- phone;
- birthday;
- avatar upload.

Loyalty:

- points history;
- redeem points;
- voucher result;
- birthday voucher;
- voucher list.

Delete account:

- màn xác nhận riêng;
- backend yêu cầu confirm đúng contract;
- logout/clear AuthContext + ShoppingContext sau thành công.

## Optional sau core PHASE 8

Backend còn Product Q&A:

- `GET /api/products/{id}/qa`
- `POST /api/products/qa/ask`

Chỉ làm sau khi Reviews/Notifications/Account core đã đạt acceptance; không để Q&A kéo dài PHASE 8 nếu core chưa xong.

## Checklist nghiệm thu PHASE 8

- [x] Review chỉ từ order/item hợp lệ.
- [x] Upload ảnh review hoạt động.
- [x] Review mới xuất hiện sau refresh.
- [x] Helpful hoạt động.
- [x] Notification unread badge đúng.
- [x] Mark read/read-all/delete đúng.
- [x] Account profile đọc/sửa đúng.
- [x] Avatar update đúng.
- [x] Loyalty points/history đúng.
- [x] Redeem points/voucher đúng API.
- [x] Logout/delete account clear protected state.
- [x] Toàn PHASE 8 = một commit.

---

# PHASE 9 — Collections + Lookbook + Recommendation

## Trạng thái triển khai PHASE 9

**Core implementation hoàn tất ở mức code ngày 2026-09-24; runtime local cần xác nhận sau khi pull.**

Đã có Collection list/detail + server-side product filter/sort, Lookbook list/filter/detail + responsive percentage hotspot, rule-based Recommendation có guest fallback và Home discovery integration. Không thêm bảng database mới; migration idempotent `20260924_phase9_discovery_seed.sql` bổ sung metadata/hotspot seed Lookbook.

Regression tests bao phủ CollectionId filter, recommendation có Wishlist/Order signal và guest fallback.

## Mục tiêu

Thêm lớp discovery/merchandising cho fashion app: bộ sưu tập, shop-the-look và gợi ý sản phẩm cá nhân hóa ở mức MVP đáng tin cậy.

## Backend/API hiện có

Collections:

- `GET /api/collections`
- `GET /api/collections/{id}`

Collection DTO hiện chủ yếu là metadata:

- id
- name
- slug
- description
- image
- sortOrder

Lookbooks:

- `GET /api/lookbooks`
- `GET /api/lookbooks/{id}`
- `GET /api/lookbooks/filters`

Lookbook detail có hotspot:

- productId
- productName
- productImage
- productPrice
- productOldPrice
- X
- Y
- note

Products hiện có:

- new arrivals;
- best sellers;
- sale;
- related.

**Chưa có recommendation endpoint cá nhân hóa riêng.**

## Collections

Mobile nên có:

- `app/collections/index.tsx`
- `app/collections/[id-or-slug].tsx`

Backend gap cần xử lý:

Collection detail hiện chưa có danh sách sản phẩm rõ ràng qua API public.

Ưu tiên một trong hai cách, chọn một và ghi decision:

1. thêm `CollectionId` vào `ProductFilterDTO` và filter ở `GET /api/products`; hoặc
2. thêm `GET /api/collections/{id}/products`.

Không fetch toàn bộ products về mobile rồi filter client.

Collection detail:

- hero/image;
- description;
- product grid;
- sorting;
- empty state;
- ProductCard dùng wishlist state hiện có.

## Lookbook

Mobile nên có:

- `app/lookbooks/index.tsx`
- `app/lookbooks/[id].tsx`

List:

- season/style filters;
- image card;
- title/subtitle.

Detail:

- ảnh chính;
- hotspot đặt theo X/Y tỷ lệ;
- tap hotspot mở mini product card;
- tap product → Product Detail;
- hỗ trợ video chỉ khi URL/format thực tế ổn định.

Cần test hotspot trên nhiều kích thước màn hình; tọa độ phải scale theo rendered image, không dùng pixel cố định.

## Recommendation MVP

Không cần ML phức tạp ở giai đoạn đầu.

Đề xuất backend endpoint mới:

`GET /api/recommendations/for-me?limit=12`

Rule-based khi đã login:

1. category từ Wishlist;
2. category từ Order history;
3. sản phẩm cùng category/best seller;
4. loại item user đã mua khỏi danh sách nếu cần;
5. fallback new arrivals/best sellers.

Khi chưa login:

- best sellers + new arrivals;
- không gọi là “cá nhân hóa” nếu không có user signal.

Nếu chưa muốn tạo endpoint riêng, có thể dựng section Home từ existing related/new/best APIs, nhưng phải ghi rõ đó là **recommendation fallback**, không tuyên bố AI/personalized.

## Home integration

Sau core Collection/Lookbook hoạt động:

- section `Bộ sưu tập nổi bật`;
- `Shop the look`;
- `Gợi ý cho bạn`.

Không làm Home quá dài; section nào không có data thì ẩn.

## Checklist nghiệm thu PHASE 9

- [x] Collection list/detail hoạt động.
- [x] Collection product query chạy server-side.
- [x] Lookbook filters hoạt động.
- [x] Hotspot scale đúng trên mobile/web.
- [x] Hotspot mở đúng Product Detail.
- [x] Recommendation có fallback.
- [x] Không gọi recommendation là personalized nếu guest không có signal.
- [x] Home chỉ render section có data.
- [x] Toàn PHASE 9 = một commit.

---

# PHASE 10 — Polish UI + Performance + Testing

## Mục tiêu

Biến app từ “đủ chức năng” thành bản ổn định, nhất quán và sẵn sàng demo/release. Không thêm feature lớn mới ở phase này trừ bug blocking.

**Brand guard:** Web Nam/Nữ/Trẻ em là đúng nghiệp vụ KaitoKid Shop Fashion. D020 supersede D009 kids-only; PHASE 10 không được xóa/đổi các khu vực Web này.

## 1. Design/UI consistency

Rà toàn app:

- Home;
- Category/Search;
- Product Detail;
- Wishlist;
- Cart;
- Checkout;
- Orders;
- Reviews;
- Notifications;
- Account;
- Collections;
- Lookbook.

Chuẩn hóa:

- `BRAND_COLORS`;
- spacing;
- radius;
- typography;
- button height;
- input style;
- skeleton;
- empty/error states;
- icon style;
- status badge;
- currency format;
- Vietnamese copy.

Không để màn dùng tím, màn khác tự hard-code cam nếu không phải accent có chủ đích.

Nếu cần, nâng `constants/brand.ts` thành theme tokens đầy đủ.

## 2. Accessibility

- accessibilityLabel cho icon button;
- touch target khoảng 44x44;
- text không quá nhỏ ở action quan trọng;
- contrast;
- disabled state rõ;
- screen reader labels cho quantity, wishlist, cart;
- keyboard navigation cơ bản trên Expo Web.

## 3. Performance

Rà:

- nested ScrollView/FlatList;
- ProductCard re-render;
- ShoppingContext re-render toàn app;
- image caching với `expo-image`;
- search debounce;
- request trùng;
- API N+1;
- large list pagination;
- timers/payment polling cleanup;
- tracking polling cleanup;
- reservation countdown cleanup.

Ưu tiên:

- FlatList cho list dài;
- memo hóa component có lợi;
- derive state thay vì duplicate;
- không premature optimize section nhỏ.

## 4. Network/error resilience

Mọi flow quan trọng phải có:

- loading;
- error;
- retry;
- empty;
- auth expired handling;
- no-network behavior rõ.

Đặc biệt test:

- API.Customer tắt;
- token hết hạn;
- product vừa hết stock;
- cart reservation hết hạn;
- payment pending → expired;
- shipping quote fail;
- upload review/avatar fail.

## 5. Auth/security hardening

Rà token storage.

Nếu đang dùng AsyncStorage cho access token, đánh giá chuyển token nhạy cảm sang giải pháp secure storage phù hợp Expo SDK 57 trước release.

Không commit:

- password;
- API key;
- shipping key;
- payment secret;
- connection string thật.

Server phải là source of truth cho:

- giá;
- coupon;
- discount;
- shipping fee validation nếu cần;
- stock;
- order ownership;
- review ownership.

## 6. Media/data readiness

Hiện repo vẫn có product image placeholder.

Trước release/demo chính thức:

- bổ sung ảnh sản phẩm thật hoặc pipeline upload từ Admin;
- gallery ảnh phụ;
- variant inventory mẫu/thật;
- category/collection/lookbook media;
- image fallback vẫn phải hoạt động.

Không coi placeholder là media production.

## 7. Test matrix bắt buộc

### Mobile/Expo

- Android device thật;
- Android emulator nếu có;
- Expo Web;
- màn nhỏ khoảng 360px;
- màn phổ biến 390–430px.

### Backend

Chạy:

- `dotnet build` cho project/solution liên quan;
- API.Auth;
- API.Customer;
- database connection.

### Frontend static

Chạy script hiện có tương ứng:

- TypeScript check nếu có;
- lint;
- Expo start/build phù hợp.

Nếu repo chưa có script test/typecheck chuẩn, PHASE 10 được phép bổ sung.

## 8. E2E/manual critical flows

Bắt buộc test end-to-end:

### Flow A — mua hàng COD

```text
Register/Login
→ Home
→ Product
→ chọn màu/size
→ Add to Cart
→ Cart update quantity
→ Checkout selected items
→ Address
→ Shipping
→ Coupon
→ COD
→ Order success
→ Orders
→ Tracking
→ Review
```

### Flow B — Wishlist

```text
ProductCard ♥
→ Wishlist
→ Product Detail
→ bỏ ♥
→ state đồng bộ mọi màn
```

### Flow C — reservation

```text
Add to Cart
→ reserve tăng
→ remove → reserve giảm
→ add lại
→ reservation expire → cart refresh + stock trả lại
```

### Flow D — partial checkout

```text
Cart có A+B+C
→ chọn A+B
→ checkout
→ order chỉ có A+B
→ C vẫn còn trong cart
```

### Flow E — payment online nếu bật

```text
Checkout ATM/VietQR
→ order pending payment
→ countdown/status polling
→ paid hoặc cancel/expire
→ trạng thái order đúng
```

## 9. Regression checklist

- [ ] Home load.
- [ ] Search/category.
- [ ] Product Detail.
- [ ] Wishlist.
- [ ] Add to Cart.
- [ ] Cart.
- [ ] Checkout.
- [ ] Orders.
- [ ] Tracking.
- [ ] Reviews.
- [ ] Notifications.
- [ ] Account.
- [ ] Collections.
- [ ] Lookbook.
- [ ] Recommendation fallback.
- [ ] Auth/logout.
- [ ] Physical Android LAN.
- [ ] Expo Web.
- [ ] Không có console error blocking.
- [ ] Không còn 404 media bất ngờ ngoài fallback có chủ đích.
- [ ] Không có secret trong Git.

## 10. Definition of Done PHASE 10

PHASE 10 chỉ hoàn tất khi:

- critical purchase flow chạy end-to-end;
- không còn placeholder screen cho feature core;
- error/loading/empty state đầy đủ;
- build/lint/typecheck liên quan pass hoặc blocker được ghi rõ;
- docs phản ánh trạng thái thật;
- issue còn lại được phân loại blocking/non-blocking;
- toàn PHASE 10 = một commit tổng hợp.

---

# Thứ tự bắt buộc khi tiếp tục

Không nhảy tùy ý:

```text
PHASE 5 Cart
    ↓
PHASE 6 Checkout
    ↓
PHASE 7 Orders
    ↓
PHASE 8 Reviews / Notifications / Account
    ↓
PHASE 9 Collections / Lookbook / Recommendation
    ↓
PHASE 10 Polish / Performance / Testing
```

Nếu phát hiện bug từ phase trước đang chặn phase hiện tại:

1. sửa bug trong phạm vi phase hiện tại nếu nó là dependency trực tiếp;
2. ghi rõ trong commit/PR;
3. không mở một chuỗi commit nhỏ riêng lẻ;
4. vẫn giữ một commit tổng hợp cho task/phase, trừ khi người dùng yêu cầu tách.

# Việc đầu tiên của phiên làm việc tiếp theo

Khi mở chat mới:

1. đọc `AGENTS.md`;
2. đọc `docs/AI_HANDOFF.md`;
3. đọc `docs/ROADMAP.md`;
4. đọc file này;
5. xác nhận `main` hiện tại;
6. nếu task có UI/UX, **bắt buộc** đọc `docs/UI_UX.md` + `skill/.codex/skills/ui-ux-pro-max/SKILL.md` và generate design system trước;
7. xác nhận runtime PHASE 9 trên máy development: chạy migration discovery, test Collection list/detail + sorting, Lookbook filters/hotspot trên Android và Expo Web, recommendation guest/login và Home sections;
8. bắt đầu **PHASE 10 — Polish UI + performance + testing** theo test matrix trong file này;
9. giữ nguyên invariant partial checkout/reservation/payment/orders/review/account/discovery của PHASE 5–9;
10. phân loại blocker runtime trước khi polish, không che lỗi bằng placeholder hoặc client-side fake data;
11. tạo **một commit tiếng Việt duy nhất** cho PHASE 10.
