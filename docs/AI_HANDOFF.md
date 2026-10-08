# AI Handoff — Current State

Last updated: 2026-10-08

## Repository

- GitHub: `thanhtran2005isme-art/KaitoKidShopMobile`
- Default branch: `main`
- Project: KaitoKidShop
- Brand: KaitoKid Shop Fashion — Nam/Nữ/Trẻ em/nhiều lứa tuổi theo D020
- Commit Node migration đã merge vào `main`: `2cad95ed5c9f959dffa206260b3325950a6e2dee`
- Runtime/source migration C# -> NestJS đã được project owner xác nhận PASS cho source/build, protected Auth/RBAC, commerce/admin race, payment terminal race, Socket.IO realtime, Web/Mobile/Admin smoke, soak và rollback trước khi merge PR #40.

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
- Socket.IO path: `/chatHub`
- MariaDB: `kaitokid`
- Expected current base-table contract: 52 tables
- Secrets: `apps/api/.env` (gitignored)
- Template: `apps/api/.env.example`
- Local CORS cho phép loopback `localhost`/`127.0.0.1` dùng port dev động khi cùng scheme đã được allow; không mở rộng sang origin/LAN tùy ý.
- JSON body limit hiện là 16 MB để admin có thể lưu cấu hình ngân hàng chứa QR base64 mà không bị HTTP 413.

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
- Lựa chọn thẻ tín dụng/thẻ ghi nợ hiện chỉ nối tới form UI/local validation. Backend payment contract thực tế vẫn chỉ nhận các method được `PaymentConfig` bật (hiện COD/ATM); chưa được coi là card gateway thật.

### Web/Admin

- React + Vite, thường `5173`
- Customer + Staff/Admin cùng gọi Node `:5300`
- Staff auth dùng chung `adminApiClient`; không fallback về legacy `localhost:5053`.
- Chat realtime gọi Socket.IO Node `/chatHub`
- Admin Khách hàng có `GET /api/admin/customers/summary` trả số liệu toàn tệp trực tiếp từ MariaDB theo `NguoiDungId`, độc lập với phân trang Web. Doanh thu chỉ tính đơn hoàn thành; lỗi API không còn bị ngụy trang thành tệp khách rỗng.

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

## Important business invariants

- Cart reserve product + variant; available = stock - reserved.
- Partial checkout theo selected `CartItemIds`.
- Checkout selection có thể persist qua reload, nhưng chỉ lưu ID; dữ liệu commerce authoritative vẫn lấy lại từ backend.
- Pricing/coupon/combo/shipping/payment authoritative ở backend.
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
4. Inspect current `main` + recent Git history.
5. Do not infer a C# fallback from old migration docs; `apps/api` is the current backend source of truth.
6. One task/fix/phase = one aggregate commit by default; AI commit descriptions in Vietnamese.
7. Khi một fix làm thay đổi architecture, operations hoặc durable behavior, cập nhật docs liên quan trong cùng task/PR; cosmetic-only fix không cần tạo quyết định mới.
