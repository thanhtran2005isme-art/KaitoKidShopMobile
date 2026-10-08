# AI Handoff — Current State

Last updated: 2026-10-05

## Repository

- GitHub: `thanhtran2005isme-art/KaitoKidShopMobile`
- Default branch: `main`
- Project: KaitoKidShop
- Brand: KaitoKid Shop Fashion — Nam/Nữ/Trẻ em/nhiều lứa tuổi theo D020
- Commit Node migration đã merge vào `main`: `2cad95ed5c9f959dffa206260b3325950a6e2dee`
- Runtime/source migration C# -> NestJS đã được project owner xác nhận PASS cho source/build, protected Auth/RBAC, commerce/admin race, payment terminal race, Socket.IO realtime, Web/Mobile/Admin smoke, soak và rollback trước khi merge PR #40.
- Work-in-progress lớn hiện tại: PR #75 `feat/admin-lalamove-carrier`, vẫn Draft/Open. Nhánh này chứa Lalamove lifecycle, receipt/after-sales, Mobile address parity và payment cutover từ VietQR thủ công sang payOS theo D027.

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

Legacy ASP.NET Core `backend/` đã retire trong retirement change. SQL/schema assets được giữ nguyên và chuyển sang `database/`.

## Runtime

### Node backend

- Origin mặc định: `http://localhost:5300`
- REST/Auth/Admin/Customer/media: same origin
- Socket.IO path: `/chatHub` cho chat realtime hiện có
- MariaDB: `kaitokid`
- Expected current base-table contract: 52 tables
- Secrets: `apps/api/.env` (gitignored)
- Template: `apps/api/.env.example`
- Local CORS cho phép loopback `localhost`/`127.0.0.1` dùng port dev động khi cùng scheme đã được allow; không mở rộng sang origin/LAN tùy ý.
- JSON body limit hiện là 16 MB để tương thích Admin settings/media hiện có.
- Online payment trên PR #75 dùng payOS SDK chính thức trong Node. Secrets `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` chỉ ở backend/deployment.
- payOS webhook public: `POST /api/payment/payos/webhook`; endpoint không dùng KaitoKid JWT nhưng bắt buộc verify checksum signature, currency, amount và order mapping trước khi xác nhận paid.
- `DonHang.Id` là integer `orderCode` gửi sang payOS; `MaDonHang` tiếp tục là display code cho customer.
- Payment DB compatibility code hiện vẫn là `ATM`; client nhận thêm `paymentProvider='payos'`. Không tự hiểu `ATM` là manual VietQR khi payOS đã cấu hình.
- **Runtime cutover:** đơn online mới chỉ bật khi đủ `PAYOS_CLIENT_ID` + `PAYOS_API_KEY` + `PAYOS_CHECKSUM_KEY` và `payosEnabled` không bị đặt `false`. `bankEnabled`, `enableBankTransfer` và `bankAccounts` legacy không còn quyền kích hoạt ATM mới.
- Bank/VietQR settings cũ vẫn có thể tồn tại để đọc config/đơn legacy trong migration window; không dùng chúng làm payment authority hiện hành.

Node là background worker owner duy nhất; critical workers vẫn điều khiển bằng feature flags.

### Mobile

- Expo/Metro: `8081`
- API/Auth cùng dùng Node `:5300`
- Android emulator fallback: `10.0.2.2:5300`
- Physical device: LAN auto-detect hoặc ADB reverse `5300`
- Google native login cần development/native build; Expo Go không chứa native Google module.
- `ShoppingContext` phải chờ `AuthContext` restore session xong trước khi xử lý trạng thái no-token/logout.
- Partial checkout giữ continuity qua reload bằng cách chỉ persist `CartItemIds` đã chọn: Expo Web dùng `localStorage`, native dùng `expo-secure-store`. Sau restore, Mobile tải cart thật từ backend rồi giữ các ID còn hợp lệ; logout xóa selection đã persist.
- Không persist snapshot sản phẩm/giá/tồn kho/coupon/shipping làm source of truth ở checkout; backend vẫn authoritative theo D015 và D024.
- Online payment screen trên PR #75 hiển thị QR/payment link payOS do backend cấp, có thể mở hosted checkout bằng `expo-web-browser`, và poll KaitoKid backend khoảng 3 giây khi pending. Polling chỉ refresh UI; verified payOS webhook/reconcile mới là payment authority. Sau `paidAt`, Mobile tự chuyển sang Order Success.
- Mobile không đọc SMS, notification ngân hàng hoặc biến động số dư để xác định paid.
- Lựa chọn thẻ tín dụng/thẻ ghi nợ cũ vẫn chỉ là UI/local validation; chưa phải card gateway riêng.

### Web/Admin

- React + Vite, thường `5173`
- Customer + Staff/Admin cùng gọi Node `:5300`
- Staff auth dùng chung `adminApiClient`; không fallback về legacy `localhost:5053`.
- Chat realtime gọi Socket.IO Node `/chatHub`.
- Customer Web payment trên PR #75 dùng owner-scoped `GET /api/payment/instructions/:orderCode`; QR/payment link payOS đến từ backend và Web poll KaitoKid backend khoảng 3 giây để refresh UI sau webhook. Polling không tự xác nhận paid.
- Admin bank/VietQR verification code của giai đoạn trước PR #75 là **legacy migration surface**. Nó không còn được phép bật online payment mới và không còn là payment authority cho customer checkout. Không mở rộng thêm luồng này.

## Database

Fresh schema:

```text
database/KaitoKid_MariaDB.sql
```

Migrations:

```text
database/migrations/
```

Các migration quan trọng hiện có gồm cart reservation, discovery seed, multi-audience/media và registration email verification.

D027/payOS không thêm bảng/cột mới; dùng `DonHang.Id`, `TongTien`, `HetHanThanhToan`, `NgayThanhToan`, `TrangThai` hiện có.

Không chạy Prisma reset/dev/db push trên DB có dữ liệu.

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

## Required validation after retirement checkout

Retirement PR phải được nghiệm thu lại trên máy dev trước khi merge:

```bat
scripts\node-final-cutover-check.bat
scripts\run-all.bat
scripts\node-final-runtime-smoke.bat
scripts\node-protected-runtime-parity.bat
scripts\node-concurrency-race-gate.bat
scripts\node-realtime-runtime-gate.bat
```

Sau đó smoke Web customer + Admin + Mobile bằng **Node-only**. Không khởi động/khôi phục C# vì source runtime đã retire.

Payment payOS acceptance riêng xem:

```text
docs/runbooks/PAYOS_PAYMENT_E2E.md
```

## Important business invariants

- Cart reserve product + variant; available = stock - reserved.
- Partial checkout theo selected `CartItemIds`.
- Checkout selection có thể persist qua reload, nhưng chỉ lưu ID; dữ liệu commerce authoritative vẫn lấy lại từ backend.
- Pricing/coupon/combo/shipping/payment authoritative ở backend.
- payOS signed webhook/reconcile là authority để set `NgayThanhToan`; return/cancel URL từ browser và polling UI không được tự đánh dấu paid.
- `bankEnabled`/VietQR legacy không được kích hoạt online payment mới khi payOS chưa cấu hình.
- Với online payment, cancel/expiry phải provider-first; chỉ restore stock/coupon sau khi payOS xác nhận chưa paid/cancelled.
- Online paid mới được tạo shipment; duplicate webhook không được double-create shipment.
- Payment/order cancellation/restock idempotent dưới race.
- Tracking/cancel/reorder owner-only.
- Review exact completed order + purchased variant.
- Delete account releases reservations first.
- Pending registration + email verification before creating local account.
- Staff RBAC permissions remain enforced.
- Socket.IO guest identity is handshake-bound; staff chat permissions enforced.

## Resume rules for future AI/chat

1. Read `AGENTS.md`.
2. Read this file.
3. Read `docs/ARCHITECTURE.md`, `docs/BRAND.md`, relevant decisions/troubleshooting.
4. Nếu tiếp tục PR #75, đọc D025, D026, **D027** và các runbook Lalamove/payOS trước khi sửa code.
5. Inspect current `main` + recent Git history; PR #75 chưa merge thì không coi behavior nhánh là `main` source of truth.
6. Do not infer a C# fallback from old migration docs; `apps/api` là backend source of truth hiện hành.
7. One task/fix/phase = one aggregate commit by default; AI commit descriptions in Vietnamese.
8. Khi một fix làm thay đổi architecture, operations hoặc durable behavior, cập nhật docs liên quan trong cùng task/PR; cosmetic-only fix không cần tạo quyết định mới.
