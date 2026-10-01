# Node migration Phase 11 — Final cutover + runtime parity

## Mục tiêu

Phase 11 là phase cuối của chuỗi migration backend C# → NestJS sau khi Phase 10 đã PASS source/build/DB-audit/contract gate. Phase này không mở thêm domain nghiệp vụ mới; mục tiêu là đóng các blocker cutover còn lại và tạo đường chuyển traffic/rollback an toàn.

**Không xóa `backend/` trong commit Phase 11 này.** C# tiếp tục là rollback reference cho tới khi toàn bộ runtime parity, concurrency, soak và rollback drill PASS. Việc xóa C# phải là một commit/PR retirement riêng sau nghiệm thu.

## Phạm vi source Phase 11

### 1. Shared media/static parity

Node phục vụ đồng thời:

- `PUBLIC_ROOT` của `apps/api` cho upload Node;
- `apps/web/public` làm shared static media, có thể override bằng `SHARED_WEB_PUBLIC_ROOT`;
- fallback SVG cho `/products/*` và `/lookbook/*` chỉ khi static middleware không tìm thấy file thật.

Điều này giữ parity với API.Customer C# và bảo toàn các URL DB legacy như `/slide_1.jpg`, `/products/...`, `/lookbook/...`.

### 2. ShippingStatusSimulator parity

Node thêm worker tương đương C#:

```text
ready_to_pick -> picking -> picked -> delivering -> delivered
```

Đồng bộ `DonHang.TrangThai`:

- `picking` / `picked` -> `confirmed`
- `delivering` -> `shipping`
- `delivered` -> `completed`

Mỗi bước ghi `LichSuTrangThaiVanChuyen`. Node dùng transaction + `FOR UPDATE` theo order để tránh hai tick cùng đẩy một trạng thái.

### 3. Worker ownership chống dual-write

Master flag:

```env
BACKGROUND_WORKER_OWNER=csharp
```

Mặc định Node không sở hữu worker. Một worker Node chỉ chạy khi:

1. `BACKGROUND_WORKER_OWNER=node`; và
2. flag riêng của worker là `true`.

Các flag:

```env
CART_SWEEPER_ENABLED=false
PAYMENT_SWEEPER_ENABLED=false
CHAT_IDLE_SWEEPER_ENABLED=false
SHIPPING_SIMULATOR_ENABLED=false
IMAGE_INDEXER_ENABLED=false
```

Trong coexistence giữ owner là `csharp`. Chỉ chuyển `node` sau khi process C# tương ứng đã dừng. `scripts/run-node-cutover.bat` chặn khởi động nếu các port legacy `5053/5265/5089/5155` còn LISTENING.

### 4. Realtime security hardening

Socket.IO guest identity được chốt tại handshake. `SendMessage` và `EndConversation` không còn được phép đổi `guestId` qua payload. Payload `guestId` cũ chỉ được chấp nhận khi khớp identity handshake.

`Typing` phải kiểm tra:

- customer là owner của conversation;
- staff có `chat.view` hoặc `chat.reply`/super-admin.

Logical event names và public API `ChatHubClient` vẫn giữ để Web không phải rewrite UI.

### 5. Client cutover + rollback

Web hỗ trợ một URL Node chung:

```env
VITE_NODE_API_URL=http://127.0.0.1:5300
VITE_CHAT_HUB_URL=http://127.0.0.1:5300
VITE_CHAT_HUB_PATH=/chatHub
```

Các biến legacy vẫn có ưu tiên cao hơn để rollback granular khi cần:

- `VITE_API_AUTH_URL`
- `VITE_API_BASE_URL`
- `VITE_API_ADMIN_URL`

Mobile hỗ trợ:

```env
EXPO_PUBLIC_BACKEND_MODE=node
EXPO_PUBLIC_NODE_API_URL=http://<host>:5300
```

Nếu không set Node mode/URL, Mobile tiếp tục fallback API.Auth `5053` + API.Customer `5265` như trước. USB launcher reverse thêm port `5300`.

## Gate source Phase 11

Từ repo root:

```bat
scripts\node-final-cutover-check.bat
```

Gate chạy lại toàn bộ Phase 1–10, sau đó chạy `test:final-cutover` để kiểm tra:

- master worker ownership mặc định C#;
- ShippingStatusSimulator flow;
- shared media root + legacy placeholder;
- realtime guest identity bất biến + typing auth;
- Web/Mobile Node URL cutover nhưng vẫn giữ C# fallback;
- launcher Phase 11 có guard dual backend và ADB reverse 5300.

PASS gate này là **source/build readiness**, chưa phải C# retirement.

## Chạy local cutover Node

Trước tiên bảo đảm `apps/api/.env` có DATABASE_URL/JWT local đúng và không chứa secret commit.

Chạy:

```bat
scripts\run-node-cutover.bat
```

Launcher:

- từ chối chạy nếu port C# legacy còn LISTENING;
- đặt `BACKGROUND_WORKER_OWNER=node`;
- bật Cart/Payment/Chat/Shipping worker;
- giữ Image indexer tắt trừ khi model ONNX đã được cấu hình;
- khởi động Node API, Web và Mobile ở Node mode.

Sau khi Node API đã listening:

```bat
scripts\node-final-runtime-smoke.bat
```

Live smoke không phá dữ liệu kiểm tra:

- `/health` + đúng 52 tables;
- catalog public;
- image-search status fail-soft;
- `/slide_1.jpg` từ `apps/web/public`;
- `/products/*` fallback;
- `/lookbook/*` fallback.

## Runtime parity bắt buộc trước retirement

### Auth

- register -> PendingRegistration -> verify-email -> NguoiDung;
- login + lockout;
- refresh rotation;
- change/forgot/reset password;
- OTP + TOTP 2FA;
- Google Web/native nếu local OAuth có cấu hình;
- staff login/me + permission allow/deny.

### Customer/commerce

- catalog/search/suggestion/recommendation;
- wishlist/address/review/notification/account;
- add/update/remove cart + reservation;
- partial checkout;
- COD + ATM;
- payment cancel/expiry/paid;
- shipping quote + track;
- order cancel/expiry hoàn product + đúng variant + coupon đúng một lần.

### Admin

- product/category/banner/collection/coupon/flash-sale/CMS CRUD;
- customer list/detail/toggle status;
- order status + cancel restore inventory/variant/coupon;
- inventory import/export/set + history;
- variant stock + aggregate stock;
- supplier hard-delete/soft-disable;
- stock receipt create/detail/cancel + weighted-average cost/history;
- reports/dashboard;
- review moderation;
- settings/homepage;
- public active flash sale.

Destructive parity chỉ chạy trên DB có backup/snapshot an toàn.

## Race/concurrency matrix

Bắt buộc test thực trên cùng MariaDB:

1. hai request AddToCart đồng thời vào cùng product/variant;
2. hai checkout đồng thời trên cùng cart/reservation;
3. payment callback/expiry/cancel chạy gần nhau;
4. order cancel không hoàn stock/coupon hai lần;
5. hai staff claim cùng conversation;
6. Socket.IO connect -> join -> send -> reconnect -> send;
7. inventory/variant adjustment đồng thời không tạo tồn âm;
8. stock receipt create/cancel không lệch aggregate stock.

Mọi mutation phải kiểm tra DB sau test, không chỉ HTTP status.

## Realtime runtime matrix

- guest handshake có guestId A không được gửi/end conversation bằng guestId B;
- logged-in user không đọc/gõ typing conversation user khác;
- staff thiếu `chat.view/chat.reply` bị reject;
- queue/claim/reply/close đúng permission;
- reconnect giữ cùng guest identity phía client;
- REST fallback vẫn hoạt động nếu Socket.IO lỗi.

## Reverse proxy / Gateway

Đích production sau cutover là một Node origin/reverse proxy:

- `/api/*` -> Node `apps/api`;
- `/chatHub` -> Node Socket.IO, hỗ trợ WebSocket upgrade;
- static/upload/media -> cùng Node origin hoặc storage/CDN tương thích URL hiện tại.

`API.Gateway` C# chỉ được tắt khi Web/Mobile/Admin không còn cần routing legacy và rollback đã được thử thành công.

## Rollback drill

Nếu Node có blocker:

1. dừng Node process/workers;
2. đặt worker owner trở lại C#;
3. trỏ Web/Mobile/reverse proxy về C# URLs;
4. khởi động API.Auth/API.Customer/API.Admin/API.Gateway C#;
5. xác nhận login/catalog/cart/order/admin cơ bản;
6. không restore DB mù vì Node và C# dùng cùng MariaDB;
7. kiểm tra transaction đang dang dở trước khi phát lại mutation.

## Điều kiện cho commit retirement riêng

Chỉ tạo commit xóa C# khi tất cả mục sau có bằng chứng PASS:

- `scripts\node-final-cutover-check.bat`;
- `scripts\node-final-runtime-smoke.bat`;
- Auth/Customer/Admin protected runtime parity;
- race/concurrency matrix;
- realtime runtime matrix;
- worker ownership Node-only;
- Web + Mobile + Admin smoke;
- soak không phát hiện blocker dữ liệu/nghiệp vụ;
- rollback drill PASS.

Sau đó mới tạo **một task/commit/PR riêng** để xóa `backend/` C# và launcher/Gateway/config obsolete. Không gộp việc xóa C# vào Phase 11 readiness commit.
