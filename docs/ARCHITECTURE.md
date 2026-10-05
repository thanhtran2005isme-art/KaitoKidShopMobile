# Architecture

## Overview

KaitoKidShop là full-stack monorepo với **một backend NestJS Node** phục vụ Mobile, Web/Admin và MariaDB.

```text
 apps/mobile (Expo/RN) ─┐
                        ├── HTTP :5300 ── apps/api (NestJS)
 apps/web (React/Vite) ─┘                  ├─ REST/Auth/Admin/Customer
                                           ├─ Socket.IO /chatHub
                                           ├─ static/media
                                           └─ background workers
                                                      │
                                                      ▼
                                             MariaDB kaitokid
```

Legacy ASP.NET Core services đã retire. Không có gateway/service C# song song và không có fallback runtime về `5053`, `5265`, `5089`, `5155`.

## Top-level layout

```text
apps/api       NestJS + Prisma backend
apps/mobile    Expo + React Native
apps/web       React + TypeScript + Vite; customer + admin surfaces
database       MariaDB fresh schema + migrations
scripts        Windows launchers/runtime gates
docs           durable project context
```

## Backend

`apps/api` chạy mặc định ở port `5300` và chứa các module Auth, Staff/RBAC, catalog, cart/reservation, checkout/order, coupon, payment, shipping, account, addresses, wishlist, reviews, notifications, referral, search/recommendation, chat/realtime, admin/CMS/inventory/stock receipts và media/static.

Realtime dùng Socket.IO trên cùng origin với path:

```text
/chatHub
```

Node là owner duy nhất của background workers. Các worker quan trọng vẫn có feature flag riêng:

- `CART_SWEEPER_ENABLED`
- `PAYMENT_SWEEPER_ENABLED`
- `CHAT_IDLE_SWEEPER_ENABLED`
- `SHIPPING_SIMULATOR_ENABLED`
- `IMAGE_INDEXER_ENABLED`

## Persistence

Runtime database là MariaDB/MySQL-compatible, database `kaitokid`.

Fresh schema source:

```text
database/KaitoKid_MariaDB.sql
```

Migrations cho database tồn tại:

```text
database/migrations/
```

Prisma được dùng để kết nối/introspect nhưng migration retirement không dùng Prisma Migrate để rewrite database hiện hữu. Trên DB có dữ liệu, không chạy `prisma migrate reset`, `prisma migrate dev` hoặc `prisma db push`.

## Client backend resolution

### Web

Web dùng một backend origin duy nhất:

1. `VITE_NODE_API_URL`
2. `VITE_API_BASE_URL`
3. fallback `http://localhost:5300`

Customer/Auth/Admin đều đi qua origin này.

### Mobile

Mobile dùng một Node API origin cho cả Auth và Customer:

1. `EXPO_PUBLIC_NODE_API_URL`
2. `EXPO_PUBLIC_API_URL`
3. LAN auto-detect `http://<LAN-IP>:5300`
4. Android emulator `http://10.0.2.2:5300`
5. localhost fallback trên iOS/Web

USB launcher reverse `8081` và `5300` khi có đúng một thiết bị ADB authorized.

## Media

Node phục vụ upload/public assets và mount shared `apps/web/public`. Fallback `/products/*` và `/lookbook/*` vẫn giữ để dữ liệu legacy không tạo 404.

## Online payment architecture — payOS (PR #75)

D027 khóa payOS là payment provider online hiện hành của PR #75. Trong migration window, DB vẫn dùng `PhuongThucThanhToan='ATM'` làm compatibility code; UI/API public phân biệt provider bằng `paymentProvider='payos'`. Không thêm schema chỉ để đổi nhãn payment.

### Trust boundary

```text
Customer Web / Mobile
        │
        │ create order / get instructions / get status
        ▼
Node API :5300
        │
        │ official @payos/node SDK
        ▼
      payOS
        │
        │ customer scans QR / pays through bank
        ▼
      Bank
        │
        └──────────────► payOS
                           │
                           │ signed webhook
                           ▼
POST /api/payment/payos/webhook
                           │
                           ├─ verify checksum signature
                           ├─ map orderCode = DonHang.Id
                           ├─ verify VND + exact TongTien
                           └─ idempotent paid transition
                                      │
                                      ▼
                          DonHang.NgayThanhToan
                          DonHang.TrangThai=confirmed
                                      │
                                      ▼
                          create shipping order once
```

Web/Mobile không đọc SMS, notification ngân hàng hoặc biến động số dư. Client chỉ poll trạng thái KaitoKid backend trong lúc pending để làm UI freshness; signed payOS webhook/reconcile mới là authority cho paid.

### payOS identifiers and secrets

payOS cần integer `orderCode`, nên mapping cố định là:

```text
payOS orderCode        = DonHang.Id
customer display code  = DonHang.MaDonHang
```

Secrets chỉ tồn tại ở backend/deployment:

```text
PAYOS_CLIENT_ID
PAYOS_API_KEY
PAYOS_CHECKSUM_KEY
```

Không expose secret sang Vite/Expo/Admin settings.

### Payment request recovery

Khi client xin payment instructions, Node luôn thử đọc payment request payOS theo `DonHang.Id` trước. Chỉ create khi provider báo chưa tồn tại. Create không retry mù; request tiếp theo recover cùng fixed order code. Cơ chế này tránh tạo payment identity thứ hai sau timeout mạng mơ hồ.

Backend trả QR/payment link cho client. Nếu create response có raw `qrCode`, Node render QR đó. Khi reload và provider lookup không trả raw QR, backend có thể render QR dẫn tới payOS Hosted Checkout để customer vẫn có đường tiếp tục thanh toán.

### Paid transition

Paid confirmation dùng row lock và chung một transition path:

1. `SELECT DonHang ... FOR UPDATE`;
2. verify expected amount/payment method;
3. nếu `NgayThanhToan` đã tồn tại thì duplicate event là idempotent;
4. không revive order đã cancelled;
5. set `NgayThanhToan` và `TrangThai='confirmed'`;
6. append `payment_confirmed` history;
7. online payment mới tạo shipment nếu chưa có tracking;
8. gửi payment-confirmation email.

Vì vậy browser `returnUrl`/`cancelUrl` không được tự set paid.

### Cancel and expiry boundary

Online payment dùng **provider-first → commerce-second**:

```text
GET payOS
  PAID      -> confirm paid; không restore stock/coupon
  PENDING   -> cancel payOS trước
                CANCELLED -> mới cancel commerce + restore
                PAID race -> confirm paid
                khác      -> fail closed
  CANCELLED -> cancel commerce nếu còn pending local
  no link   -> local cancel/expiry an toàn
```

Payment sweeper phải tuân cùng rule; không được chỉ nhìn `HetHanThanhToan` rồi hoàn tồn kho ngay.

### Shipping boundary

COD tiếp tục tạo shipment sau khi tạo order theo contract hiện hành.

Online/payOS:

```text
KaitoKid order pending
-> payOS payment
-> signed paid webhook
-> order confirmed
-> createShippingOrder
-> Lalamove/GHN/GHTK theo provider đã chọn
```

Với Lalamove trong PR #75, không Place Order thật trước khi payOS xác nhận paid.

## Source-of-truth business boundaries

- Pricing, coupon, combo, shipping fee, payment method và order totals: backend authoritative.
- Cart reservation: product + exact variant khi có.
- Partial checkout: chỉ selected `CartItemIds`; unselected cart items giữ reservation.
- Order tracking/cancel/reorder: owner-only và server-authoritative.
- Review: exact completed order + purchased variant.
- Delete account: release cart reservation trước khi xóa/anonymize dữ liệu.
- Registration: `PendingRegistration` -> verify email -> `NguoiDung`.
- Google/social: backend validates provider credential before issuing KaitoKid JWT.
- Admin/RBAC: JWT + staff permission guards.
- Payment/order/inventory terminal transitions phải giữ idempotency/concurrency invariants đã được runtime race gate kiểm tra.
- payOS webhook phải verify signature + order mapping + currency + exact amount trước khi mutate commerce state.
- Web/Mobile payment success luôn lấy từ backend persisted state, không từ browser callback query string hoặc device bank signal.

## Development launch flow

`run.bat`:

```text
Node API :5300
Expo Mobile :8081
```

`scripts/run-all.bat`:

```text
Node API :5300
Web/Vite :5173 (typical)
Expo Mobile :8081
```

`scripts/run-backend.bat` là compatibility alias cho Node API launcher.

## Source-of-truth rules

- Current merged code/configuration: Git `main`
- Current PR #75 implementation while Draft/Open: `feat/admin-lalamove-carrier`
- Current operational state: `docs/AI_HANDOFF.md`
- Stable architecture: this file
- Durable decisions: `docs/DECISIONS.md` + `docs/decisions/`
- Repeatable fixes: `docs/TROUBLESHOOTING.md`
- Older chronology/migration docs: `docs/history/` và các `NODE_*` migration runbook lịch sử
