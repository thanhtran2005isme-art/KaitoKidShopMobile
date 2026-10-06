# AI Handoff — Current State

Last updated: 2026-10-06

## Repository

- GitHub: `thanhtran2005isme-art/KaitoKidShopMobile`
- Default branch: `main`
- Project: KaitoKidShop
- Brand: KaitoKid Shop Fashion — Nam/Nữ/Trẻ em/nhiều lứa tuổi theo D020
- Commit Node migration đã merge vào `main`: `2cad95ed5c9f959dffa206260b3325950a6e2dee`
- Runtime/source migration C# -> NestJS đã được project owner xác nhận PASS cho source/build, protected Auth/RBAC, commerce/admin race, payment terminal race, Socket.IO realtime, Web/Mobile/Admin smoke, soak và rollback trước khi merge PR #40.
- Work-in-progress lớn: PR #75 `feat/admin-lalamove-carrier`, vẫn Draft/Open. Nhánh này chứa Lalamove lifecycle, customer receipt/after-sales, Mobile address parity và payment cutover sang payOS theo D025–D027.
- Wallet/refund/withdrawal đang được phát triển trên nhánh stacked `feat/wallet-refund-withdrawal`, dựa trên PR #75. Không coi behavior này là `main` cho tới khi nhánh/PR liên quan được merge.

## Current structure

```text
KaitoKidShop/
├─ apps/
│  ├─ api/          NestJS 11 + Prisma 7
│  ├─ mobile/       Expo + React Native
│  └─ web/          React + TypeScript + Vite
├─ database/        MariaDB schema + migrations
├─ scripts/
├─ docs/
├─ run.bat
├─ AGENTS.md
└─ README.md
```

Legacy ASP.NET Core `backend/` đã retire. SQL/schema assets hiện nằm trong `database/`.

## Runtime

### Node backend

- Origin mặc định: `http://localhost:5300`
- REST/Auth/Admin/Customer/media: same origin
- Socket.IO path: `/chatHub`
- MariaDB: `kaitokid`
- Expected current table contract sau wallet migration: **55 tables**
- Secrets: `apps/api/.env` (gitignored)
- Template: `apps/api/.env.example`
- Local CORS cho phép loopback `localhost`/`127.0.0.1` dùng port dev động khi cùng scheme đã được allow; không mở rộng tùy ý sang LAN/origin khác.
- JSON body limit: 16 MB.
- Node là background-worker owner duy nhất; critical workers vẫn điều khiển bằng feature flags.

### payOS trên PR #75

- Dùng official payOS SDK trong Node.
- Secrets `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` chỉ ở backend/deployment.
- Webhook public: `POST /api/payment/payos/webhook`; không dùng KaitoKid JWT nhưng bắt buộc verify signature, currency, amount và order mapping.
- Provider order code được suy ra reversible từ `MaDonHang`; không dùng `DonHang.Id` làm provider authority.
- Payment DB compatibility code vẫn là `ATM`; client có `paymentProvider='payos'` khi payOS active.
- `bankEnabled`, VietQR/manual bank config legacy không được trở lại làm authority cho online payment mới.

### Ví KaitoKid — D028

Ba bảng mới:

- `ViDienTu`: snapshot số dư khả dụng/tạm giữ;
- `GiaoDichVi`: append-only money ledger;
- `YeuCauRutTien`: withdrawal state machine.

Money invariants:

- client Web/Mobile chỉ gửi `useWallet=true|false`;
- backend tính `walletUsed = min(available, TongTien)`;
- `DonHang.TongTien` luôn là full order total;
- `amountDue = TongTien - walletUsed` là phần external payment/COD còn lại;
- payOS create/reconcile/webhook chỉ dùng `amountDue`;
- ví trả đủ thì order được paid/confirmed mà không tạo payOS payment;
- cancel/expiry ghi `order_payment_reversal` và trả đúng phần ví đã dùng;
- projection `walletUsed` phải tính **net ledger** (`order_payment - order_payment_reversal`), không chỉ đọc debit ban đầu;
- refund sau return credit `DonHang.TongTien` vào ví bằng `refund_credit` đúng một lần;
- không có UI sửa số dư thủ công.

Withdrawal:

- customer request: `available -= amount`, `held += amount`;
- Admin approve: chỉ chuyển state;
- Admin reject: release hold về available;
- Admin complete sau khi chuyển khoản thực tế: `held -= amount` và lưu bank reference;
- quyền riêng: `wallet.view`, `wallet.manage`.

### Mobile

- Expo/Metro: `8081`
- API/Auth: Node `:5300`
- Android emulator fallback: `10.0.2.2:5300`
- Physical device: LAN auto-detect hoặc ADB reverse `5300`
- Google native login cần development/native build; Expo Go không chứa native Google module.
- `ShoppingContext` phải chờ `AuthContext` restore session.
- Partial checkout chỉ persist selected `CartItemIds`: Expo Web `localStorage`, native `expo-secure-store`; sau restore phải tải cart thật và giữ ID còn hợp lệ.
- Không persist snapshot giá/tồn/coupon/shipping làm authority.
- payOS screen chỉ render data backend, mở hosted checkout bằng `expo-web-browser` và poll KaitoKid backend; webhook/reconcile mới là payment authority.
- Mobile không đọc SMS/notification ngân hàng/số dư để xác nhận paid.
- Ví có route `account/wallet`; checkout hỗ trợ `useWallet` và bỏ qua QR khi backend trả `amountDue=0`.
- Lựa chọn card cũ vẫn chỉ là UI/local validation; chưa có card gateway thật.

### Web/Admin

- React + Vite, thường `5173`
- Customer + Staff/Admin gọi Node `:5300`
- Staff auth dùng `adminApiClient`; không fallback legacy `:5053`.
- Chat realtime gọi Socket.IO `/chatHub`.
- Customer Web payment dùng owner-scoped payment instructions; polling chỉ refresh UI.
- Customer Web có `/wallet`; Admin có `/admin/wallet` để xử lý withdrawal theo RBAC.
- Admin bank/VietQR verification code cũ chỉ là migration surface; không được làm payment authority.

## Database

Fresh schema nền:

```text
database/KaitoKid_MariaDB.sql
```

Sau fresh import hoặc trên DB hiện hữu, chạy migration Ví KaitoKid:

```text
database/migrations/20261006_wallet_refund_withdrawal.sql
```

Sau migration, `/health` phải audit **55/55** tables.

Migration wallet đồng thời đồng bộ customer-facing return policy từ 7 ngày cũ sang **15 ngày từ lúc customer xác nhận nhận hàng**.

Không chạy `prisma migrate reset`, `prisma migrate dev` hoặc `prisma db push` trên DB có dữ liệu.

## Return / refund — D026 + D028

- Carrier `delivered` không tự hoàn tất business order.
- Customer `confirm-received` tạo authority `received_by_customer` và mốc `NgayHoanThanh`.
- Cửa sổ gửi return request: **15 ngày** từ mốc đó.
- Admin duyệt/từ chối request không chạm tồn kho hay tiền.
- Chỉ khi hàng vật lý quay về và Admin chọn `restock`/`quarantine` mới chuyển order `returned`.
- Trong cùng transaction nhận hàng hoàn, hệ thống xử lý inventory và credit toàn bộ `TongTien` vào Ví KaitoKid đúng một lần.
- `refund_pending/refund_completed_manual` chỉ còn compatibility cho case legacy.

## Main launchers

Node API + Mobile:

```bat
run.bat
```

All Node API + Web + Mobile:

```bat
scripts\run-all.bat
```

Backend only:

```bat
scripts\run-backend.bat
```

## Required validation

```bat
scripts\node-final-cutover-check.bat
scripts\run-all.bat
scripts\node-final-runtime-smoke.bat
scripts\node-protected-runtime-parity.bat
scripts\node-concurrency-race-gate.bat
scripts\node-realtime-runtime-gate.bat
```

Runtime race gates hiện phải nhận `/health` **55/55** sau wallet migration.

Payment payOS acceptance riêng:

```text
docs/runbooks/PAYOS_PAYMENT_E2E.md
```

Wallet/return acceptance cần kiểm tra thêm:

1. refund return → wallet credit đúng một lần;
2. wallet full/partial checkout với COD và payOS;
3. cancel/expiry → reversal đúng một lần;
4. withdrawal hold/approve/reject/complete dưới double-click/race;
5. account deletion bị chặn khi còn available/held hoặc active withdrawal.

## Important business invariants

- Cart reserve product + exact variant; available = stock - reserved.
- Partial checkout theo selected `CartItemIds`.
- Pricing/coupon/combo/shipping/payment authoritative ở backend.
- payOS signed webhook/reconcile là authority để set `NgayThanhToan`; browser return URL/polling UI không tự đánh dấu paid.
- Online payment cancel/expiry provider-first trước local restore.
- Online paid mới tạo shipment; duplicate callback không double-create shipment.
- Payment/order cancellation/restock/wallet ledger idempotent dưới race.
- Tracking/cancel/reorder owner-only.
- Review exact completed order + purchased variant + customer receipt authority.
- Delete account releases reservations và không được anonymize khi ví còn tiền/withdrawal active.
- Pending registration + email verification trước local account.
- Staff RBAC permissions enforced, bao gồm `wallet.view/manage`.
- Socket.IO guest identity handshake-bound; staff chat permissions enforced.

## Resume rules for future AI/chat

1. Read `AGENTS.md`.
2. Read this file.
3. Read `docs/ARCHITECTURE.md`, `docs/BRAND.md`, relevant decisions/troubleshooting.
4. Nếu tiếp tục PR #75 + wallet, đọc D025, D026, D027, **D028** và runbook Lalamove/payOS trước khi sửa.
5. Inspect current `main`, current head của PR #75 và Git history; stacked branch không phải `main` source of truth.
6. Do not infer C# fallback from historical docs; `apps/api` là backend source of truth.
7. One task/fix/phase = one aggregate commit by default; AI commit descriptions in Vietnamese.
8. Thay đổi architecture/operations/business behavior phải cập nhật durable docs trong cùng task/PR.
