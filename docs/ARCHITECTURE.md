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

- Current code/configuration: Git `main`
- Current operational state: `docs/AI_HANDOFF.md`
- Stable architecture: this file
- Durable decisions: `docs/DECISIONS.md` + `docs/decisions/`
- Repeatable fixes: `docs/TROUBLESHOOTING.md`
- Older chronology/migration docs: `docs/history/` và các `NODE_*` migration runbook lịch sử
