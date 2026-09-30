# KaitoKid — Node cutover runbook

## Phạm vi

Runbook này chốt migration **API.Auth + API.Customer** sang `apps/api` NestJS trên cùng MariaDB `kaitokid`.

**Không được hiểu là có thể xóa toàn bộ C# ngay.** `API.Admin` hiện vẫn có 23 controller C# chưa nằm trong 9-phase Node migration. Vì vậy:

- có thể nghiệm thu/cutover traffic Auth + Customer sang Node sau khi gate/runtime parity PASS;
- `API.Admin` phải tiếp tục chạy cho tới một migration riêng;
- `API.Gateway` chỉ có thể tắt nếu tất cả client đã trỏ trực tiếp sang Node và luồng Admin đã có đường thay thế.

## 1. Invariants dữ liệu

- dùng nguyên MariaDB hiện tại;
- schema audit phải vẫn là 52 bảng;
- không `migrate reset`, `migrate dev`, `db push`, drop/reseed/copy DB;
- backup DB trước cutover thật;
- C# giữ nguyên để rollback cho tới khi soak test hoàn tất.

## 2. Gate source/static

Từ repo root:

```bat
scripts\node-cutover-check.bat
```

Gate chạy build, DB audit và toàn bộ contract tests từ catalog đến Phase 9.

## 3. Runtime parity bắt buộc

### Auth

- register → `PendingRegistration` → verify-email → tạo `NguoiDung`;
- login, lockout, refresh rotation, change/reset password;
- OTP + TOTP 2FA;
- Google native/Web nếu local OAuth được cấu hình;
- staff login/me + granular permission.

### Commerce

- catalog/search/suggestions/recommendation;
- wishlist/address/review/notification/account;
- cart reservation + partial checkout;
- COD + ATM, payment cancel/expiry/paid;
- shipping quote/tracking;
- cancel/expiry hoàn product + đúng variant + coupon usage.

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

## 5. Client cutover

Không đổi URL production trước runtime parity.

Web/Auth/Customer phải trỏ HTTP API sang Node `PORT=5300` (hoặc reverse proxy production tương ứng).

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

1. tắt các sweeper Node để tránh dual-owner;
2. trỏ Auth/Customer client URL về C# cũ;
3. bật lại C# workers;
4. không restore DB trừ khi có sự cố dữ liệu thực sự — cả hai backend dùng cùng schema/data;
5. lưu log/request gây lỗi để sửa parity.

## 7. Blocker cho full C# retirement

`backend/API.Admin` còn 23 controller C#. Đây là blocker riêng ngoài scope Phase 9 hiện hành. Không xóa thư mục `backend/`, không tắt API.Admin và không tuyên bố “100% C# removed” cho tới khi Admin được migrate và runtime parity PASS.
