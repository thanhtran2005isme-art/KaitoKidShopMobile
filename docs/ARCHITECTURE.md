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
database       MariaDB fresh schema nền + migrations
scripts        Windows launchers/runtime gates
docs           durable project context
```

## Backend

`apps/api` chạy mặc định ở port `5300` và chứa các module Auth, Staff/RBAC, catalog, cart/reservation, checkout/order, coupon, payment, shipping, wallet/withdrawal, account, addresses, wishlist, reviews, notifications, referral, search/recommendation, chat/realtime, admin/CMS/inventory/stock receipts và media/static.

Realtime chat dùng Socket.IO trên cùng origin với path:

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

Fresh schema nền:

```text
database/KaitoKid_MariaDB.sql
```

Contract hiện hành cần chạy thêm wallet migration cả với fresh import và DB đã tồn tại:

```text
database/migrations/20261006_wallet_refund_withdrawal.sql
```

Sau bước này database có **55 base tables**. Ba bảng tài chính mới:

- `ViDienTu`
- `GiaoDichVi`
- `YeuCauRutTien`

Các migration khác nằm trong:

```text
database/migrations/
```

Prisma được dùng để kết nối/introspect nhưng không dùng Prisma Migrate để rewrite database hiện hữu. Trên DB có dữ liệu, không chạy `prisma migrate reset`, `prisma migrate dev` hoặc `prisma db push`.

## Wallet / money ledger boundary

D028 đặt wallet dưới backend authority:

```text
Refund return ───────┐
                     ▼
                 GiaoDichVi  <── append-only audit/idempotency
                     │
                     ▼
                  ViDienTu
               available / held
                     │
           ┌─────────┴─────────┐
           ▼                   ▼
      Order payment       Withdrawal hold
           │                   │
           ▼                   ▼
     cancel reversal      approve/reject/complete
```

Quy tắc:

- `ViDienTu` là balance snapshot để khóa/đọc nhanh; `GiaoDichVi` là audit ledger của mọi biến động.
- Mọi mutation tiền chạy trong transaction và khóa wallet row.
- Idempotency ledger dùng `(NguoiDungId, Loai, ThamChieuLoai, ThamChieuId)`.
- Client không gửi số tiền muốn dùng từ ví; chỉ gửi `useWallet`.
- `DonHang.TongTien` luôn giữ full order total.
- `walletUsed = min(available, TongTien)`.
- `amountDue = TongTien - walletUsed` là phần tiền external payment/COD còn lại.
- Projection `walletUsed` đọc **net ledger**: `order_payment - order_payment_reversal`.
- Cancel/expiry phải ghi reversal đúng một lần trong cùng local transaction restore commerce state.
- Return refund chỉ credit ví sau khi Admin đã nhận/kiểm hàng thật và chọn restock/quarantine.
- Withdrawal tách `available` và `held` để số tiền đang xử lý không bị chi/rút lần hai.
- Không có endpoint/UI sửa balance tùy ý.

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

## Payment boundary

Online payment hiện hành trên PR #75 là payOS:

- secrets chỉ ở Node: `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`;
- provider order code được suy ra reversible từ `MaDonHang`, không dùng `DonHang.Id` làm provider authority;
- QR/payment link được backend tạo/khôi phục và trả qua owner-scoped payment instructions;
- `POST /api/payment/payos/webhook` là public provider callback nhưng bắt buộc verify checksum + amount + currency + order mapping;
- khi đơn dùng ví một phần, payOS create/get/reconcile/webhook chỉ được đối soát đúng `amountDue`, không phải `TongTien`;
- khi ví trả đủ (`amountDue=0`), backend xác nhận paid/confirmed và không tạo payOS payment;
- `NgayThanhToan`/`confirmed` chỉ được set qua wallet-full transaction, verified provider/reconcile path hoặc admin/dev compatibility path hiện có;
- Web/Mobile poll payment status khi pending để refresh UI; polling không phải payment authority;
- cancel/expiry của online payment phải provider-first rồi mới commerce-second; local cancel/expiry đồng thời restore phần wallet debit nếu có;
- online shipment chỉ được tạo sau khi paid;
- runtime online payment chỉ bật khi đủ payOS credentials và `payosEnabled` không bị đặt `false`;
- `bankEnabled`, `enableBankTransfer`, `bankAccounts`/VietQR legacy không còn quyền kích hoạt ATM cho đơn mới; chỉ giữ compatibility dữ liệu/config.

DB compatibility code vẫn dùng `PhuongThucThanhToan='ATM'` cho online payment trong PR #75. Đổi enum/schema, nếu cần, là migration riêng.

## Return / refund boundary

- Carrier `delivered` chỉ là trạng thái vận chuyển; không tự tạo customer receipt authority.
- Customer `confirm-received` ghi marker `received_by_customer`, `NgayHoanThanh` và bắt đầu return window **15 ngày**.
- Admin approve/reject return là audit/state decision, chưa đụng inventory hoặc tiền.
- Khi hàng hoàn thực tế quay về, Admin chọn `restock` hoặc `quarantine`.
- Trong cùng transaction nhận hàng hoàn: update inventory/sold counters, chuyển order `returned`, ghi return marker và `refund_credit` toàn bộ `TongTien` vào wallet đúng một lần.
- `refund_pending/refund_completed_manual` chỉ còn compatibility cho case legacy.

## Source-of-truth business boundaries

- Pricing, coupon, combo, shipping fee, payment method, wallet usage và order totals: backend authoritative.
- Cart reservation: product + exact variant khi có.
- Partial checkout: chỉ selected `CartItemIds`; unselected cart items giữ reservation.
- Order tracking/cancel/reorder: owner-only và server-authoritative.
- Review: exact completed order + purchased variant + `received_by_customer` authority.
- Delete account: release cart reservation trước khi anonymize; cấm đóng account nếu wallet còn available/held hoặc withdrawal pending/approved.
- Registration: `PendingRegistration` -> verify email -> `NguoiDung`.
- Google/social: backend validates provider credential before issuing KaitoKid JWT.
- Admin/RBAC: JWT + staff permission guards; money operations dùng `wallet.view`/`wallet.manage`.
- Payment/order/inventory/wallet terminal transitions phải giữ idempotency/concurrency invariants.

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
- Stacked WIP behavior: explicit feature branch/PR only; không tự nâng thành `main` truth
- Current operational state: `docs/AI_HANDOFF.md`
- Stable architecture: this file
- Durable decisions: `docs/DECISIONS.md` + `docs/decisions/`
- Repeatable fixes: `docs/TROUBLESHOOTING.md`
- Older chronology/migration docs: `docs/history/` và các `NODE_*` migration runbook lịch sử
