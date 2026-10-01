# KaitoKid — Node cutover runbook

## Phạm vi

Runbook này chốt migration **API.Auth + API.Customer + API.Admin** sang `apps/api` NestJS trên cùng MariaDB `kaitokid`.

Phase 10 đã mirror source của 23 controller/surface `API.Admin`, nhưng **không được hiểu là có thể xóa toàn bộ C# ngay**. Trước full retirement vẫn phải hoàn tất runtime parity, worker/media/realtime ownership, Gateway routing và soak/rollback gate.

Vì vậy:

- có thể nghiệm thu từng nhóm Auth/Customer/Admin sau khi gate + runtime parity tương ứng PASS;
- C# tiếp tục là rollback reference cho tới final cutover;
- `API.Gateway` chỉ tắt khi toàn bộ client/routing đã chuyển sang Node và đường rollback đã được xác nhận;
- không xóa thư mục `backend/` chỉ vì source contract test PASS.

## 1. Invariants dữ liệu

- dùng nguyên MariaDB hiện tại;
- schema audit phải vẫn là 52 bảng theo manifest legacy;
- không `migrate reset`, `migrate dev`, `db push`, drop/reseed/copy DB;
- backup DB trước cutover thật;
- C# giữ nguyên để rollback cho tới khi soak test hoàn tất.

## 2. Gate source/static

Auth + Customer Phase 1–9:

```bat
scripts\node-cutover-check.bat
```

Toàn bộ Phase 1–10, bao gồm API.Admin:

```bat
scripts\node-admin-migration-check.bat
```

Gate Phase 10 chạy build, DB audit, toàn bộ regression contract tests Phase 1–9, `test:admin-migration` và Web build.

## 3. Runtime parity bắt buộc

### Auth

- register → `PendingRegistration` → verify-email → tạo `NguoiDung`;
- login, lockout, refresh rotation, change/reset password;
- OTP + TOTP 2FA;
- Google native/Web nếu local OAuth được cấu hình;
- staff login/me + granular permission.

### Commerce / Customer

- catalog/search/suggestions/recommendation;
- wishlist/address/review/notification/account;
- cart reservation + partial checkout;
- COD + ATM, payment cancel/expiry/paid;
- shipping quote/tracking;
- cancel/expiry hoàn product + đúng variant + coupon usage.

### Admin

- staff login và permission denied/allowed theo đúng claim;
- product/category/banner/collection/coupon/flash-sale/CMS CRUD;
- customer list/detail/toggle-status;
- order list/detail/status; đặc biệt cancel phải hoàn product + đúng variant + coupon đúng một lần;
- inventory import/export/set + history;
- variant stock adjustment + aggregate stock;
- supplier CRUD/soft-disable khi đã được dùng;
- stock receipt create/detail/cancel; kiểm chứng product/variant/history/weighted-average cost;
- reports/dashboard;
- review moderation;
- settings/homepage;
- public active flash sale.

Không chạy destructive Admin parity trên dữ liệu production nếu chưa có backup/snapshot an toàn.

### Chat/realtime

- guest + logged-in customer tạo/mở phiên;
- REST fallback gửi/nhận;
- Socket.IO `/chatHub`: join/send/typing/read/handoff/end;
- staff queue/claim/reply/close với `chat.view/chat.reply/chat.manage`;
- bot order lookup không lộ đơn user khác;
- rule bot stock/coupon/FAQ;
- LLM chỉ bật khi endpoint/key thật được cấu hình, lỗi phải fallback;
- idle chat close chỉ có **một worker owner**.

### Image search

Repo không commit model ONNX. Khi chưa có model, `GET /api/search/by-image/status` phải trả `ready=false` và API vẫn sống.

Khi muốn bật thật:

1. đặt model CLIP image encoder tại `IMAGE_SEARCH_MODEL_PATH`;
2. test một ảnh thủ công;
3. bật `IMAGE_INDEXER_ENABLED=true` chỉ trên Node owner;
4. xác nhận `SanPhamEmbedding` được update, không tăng table count.

## 4. Worker ownership lúc coexistence

Trong lúc C# + Node chạy song song, giữ:

```env
CART_SWEEPER_ENABLED=false
PAYMENT_SWEEPER_ENABLED=false
CHAT_IDLE_SWEEPER_ENABLED=false
IMAGE_INDEXER_ENABLED=false
```

Chỉ sau khi dừng worker C# tương ứng mới bật owner Node:

```env
CART_SWEEPER_ENABLED=true
PAYMENT_SWEEPER_ENABLED=true
CHAT_IDLE_SWEEPER_ENABLED=true
```

Image indexer là optional và chỉ bật khi model ONNX đã sẵn sàng.

Ngoài bốn cờ trên, final cutover còn phải đối chiếu `ShippingStatusSimulator`/worker vận chuyển để tránh C# và Node cùng cập nhật trạng thái đơn.

## 5. Client cutover

Không đổi URL production trước runtime parity.

Web/Auth/Customer/Admin phải trỏ HTTP API sang Node `PORT=5300` (hoặc reverse proxy production tương ứng).

Realtime Web Phase 9 dùng Socket.IO:

```env
VITE_CHAT_HUB_URL=http://localhost:5300
VITE_CHAT_HUB_PATH=/chatHub
```

Mobile hiện dùng:

- `EXPO_PUBLIC_API_URL`;
- `EXPO_PUBLIC_AUTH_API_URL`.

Khi nghiệm thu cutover, cả hai phải trỏ tới Node/reverse proxy Node.

## 6. Rollback

Nếu Node có blocker sau cutover:

1. tắt các sweeper/worker Node để tránh dual-owner;
2. trỏ client/reverse proxy về API C# tương ứng;
3. bật lại C# workers;
4. không restore DB trừ khi có sự cố dữ liệu thực sự — cả hai backend dùng cùng schema/data;
5. lưu log/request gây lỗi để sửa parity.

Riêng Admin, rollback phải kiểm tra các transaction vừa chạy (order cancel, inventory, stock receipt) đã commit hay rollback trước khi đổi traffic; không phát lại mutation mù vì cả Node và C# dùng cùng DB.

## 7. Blocker còn lại cho full C# retirement

Sau Phase 10, **API.Admin không còn là blocker ở mức source coverage**, nhưng full C# retirement vẫn chưa được tuyên bố PASS cho tới khi các mục sau hoàn tất:

- chạy `scripts\node-admin-migration-check.bat` trên máy có MariaDB thật và toàn bộ gate PASS;
- runtime parity Web Admin PASS;
- xử lý/đối chiếu shared media + static fallback của API.Customer;
- chốt `ShippingStatusSimulator` và toàn bộ background worker ownership;
- chốt realtime transport/client rollback path;
- chốt API.Gateway/reverse-proxy routing;
- chạy full smoke Auth + Customer + Admin + Mobile/Web;
- soak test và xác nhận rollback;
- chỉ sau đó mới cân nhắc xóa `backend/` C#.

Chi tiết Phase 10: `docs/NODE_ADMIN_MIGRATION_PHASE10.md`.
