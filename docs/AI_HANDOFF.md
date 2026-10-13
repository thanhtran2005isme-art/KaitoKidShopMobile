# AI Handoff — Current State

Last updated: 2026-10-13 (wallet integration branch)

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
- Expected main schema contract: 56 base tables after applying wallet (3) and return-shipment (1) migrations
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
- Mobile Quantity: Product Detail và Cart cho chạm số lượng để nhập bàn phím số, commit khi blur/Done. Product lấy max từ tồn biến thể, Cart lấy max từ số đang giữ + số chưa giữ; backend xác thực cập nhật tồn kho.
- Mobile Search: Home bar là lối vào `/search`; `apps/mobile/src/services/product-search.api.ts` dùng `/api/search` + `/api/search/suggestions` (Node :5300) cho gợi ý, lọc category/giá, sort và phân trang thật. Không lọc catalog cục bộ hoặc dùng dữ liệu giả.
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

## PR #75 — Lalamove/payOS (đã merge main 2026-10-13)

- Branch `feat/admin-lalamove-carrier` chứa carrier lifecycle Lalamove quote/re-quote → Place Order → tracking/webhook/cancel, xác nhận khách thực nhận và hậu mãi theo D025/D026.
- Online payment của branch dùng SDK `@payos/node`; signed public webhook `POST /api/payment/payos/webhook`, provider reconciliation và race-safe paid/expiry/cancel theo D027.
- payOS numeric orderCode phải được ánh xạ có thể đảo ngược từ `DonHang.MaDonHang` dạng `KK-YYYYMMDD-XXXXXX`; không tái sử dụng `DonHang.Id` làm orderCode khi DB được reset/reseed.
- Secrets PAYOS_CLIENT_ID/PAYOS_API_KEY/PAYOS_CHECKSUM_KEY chỉ trong cấu hình backend/deployment, không commit.
- Browser return, client polling hoặc QR không có quyền đánh dấu paid. Chỉ webhook đã xác minh/reconcile từ provider được xác nhận thanh toán. Chỉ tạo vận đơn online sau paid.
- Mobile có Expo USB/ADB launcher hardening, địa chỉ cascade tỉnh/huyện/xã, và màn payment payOS; order detail dùng Modal để xác nhận nhận/chưa nhận hàng trên Expo Web.
- Merge gate còn yêu cầu E2E HTTPS webhook + Lalamove sandbox + paid/cancel/expiry race với DB thật: `docs/runbooks/PAYOS_PAYMENT_E2E.md`, `docs/runbooks/LALAMOVE_SANDBOX_E2E.md`.
- PR #75 đã merge vào `main`; các yêu cầu nghiệm thu được ghi là lịch sử gate trước merge.

## PR #78 — Ví KaitoKid / hoàn tiền / rút tiền (đã merge main 2026-10-13)

- PR #78 đã merge sau PR #75; wallet, return 15 ngày và payOS amountDue là source trên main.
- MariaDB: migration `database/migrations/20261006_wallet_refund_withdrawal.sql`; contract nhánh wallet 55 base tables so với 52 trên main.
- `ViDienTu` có available/held balance; `GiaoDichVi` là append-only idempotent ledger; `YeuCauRutTien` có workflow approve/reject/complete và RBAC.
- Checkout: client chỉ gửi `useWallet`, backend quyết định `walletUsed=min(available,TongTien)`, `amountDue=TongTien-walletUsed`, payOS chỉ thu `amountDue`.
- Cancel/expiry đảo phần ví đã debit đúng một lần sau khi provider xác nhận chưa paid; không hoàn tiền/stock nếu provider có thể đã paid.
- Customer confirm-received mới bắt đầu cửa sổ return 15 ngày; chỉ credit toàn bộ order total vào ví đúng một lần khi Admin thực nhận hàng hoàn và chọn restock/quarantine. Quarantine không cộng tồn bán được.
- Không xóa account khi còn số dư hoặc withdrawal pending/approved.
- PR #78 đã merge. Khi triển khai mới cần kiểm tra migration cùng runtime gate phù hợp.

- Online payment trên PR #75 dùng payOS SDK chính thức (`@payos/node`), tức official payOS SDK; browser return và client polling không có quyền đánh dấu paid.


## D029 — Vận đơn hoàn và chặn hoàn ví trước khi hãng giao thành công

- Màn Admin `AdminAfterSalesPanel` phải chọn hãng có lifecycle return thật (hiện chỉ Lalamove), đặt vận đơn khách → shop và kiểm tra trạng thái GET provider.
- Bảng mới `VanDonHoanHang` tách độc lập `DonHang.MaVanDon`; chạy migration `database/migrations/20261013_return_shipment_lifecycle.sql` trước khi restart Node API, DB contract 56/56.
- Chỉ khi hãng xác nhận `COMPLETED` thì `canReceiveReturn=true` và backend `/receive` mới cho nhập/quarantine + credit Ví KaitoKid đúng một lần.
- No auto-retry Place Order không rõ kết quả; manual carrier reconciliation bắt buộc.
- Live sandbox MariaDB/HTTPS return flow chưa được nghiệm thu trong môi trường này; xem `docs/decisions/D029-return-shipment-carrier-gated-refund.md`.


## Bổ sung form yêu cầu hoàn hàng có bằng chứng

- Mobile `apps/mobile/src/app/orders/[id].tsx` và Customer Web `apps/web/src/pages/OrderTracking.tsx` có dropdown lý do chuẩn, `Khác` bắt buộc mô tả, ảnh bằng chứng 0–3 JPEG/PNG/WebP mỗi ảnh ≤5MB.
- `POST /api/orders/:id/return-request` hỗ trợ multipart `reasonCode`, `detail`, `images`, backward-compatible JSON `reason`. Backend kiểm tra nội dung ảnh và quyền sở hữu trước khi commit marker; lưu ảnh `public/uploads/returns` UUID, marker `return_evidence` trong `LichSuTrangThaiVanChuyen` cùng order; không thêm bảng/migration.
- DTO customer trả `returnEvidence`, Admin snapshot trả `returnEvidence`, Admin `AdminAfterSalesPanel` xem ảnh; chỉ Admin mới quyết định duyệt/từ chối, request không hoàn tiền.
- Cần chạy CI Web/Mobile, API checkout contracts và test thật chọn ảnh trên Expo Web/Android; không kết luận đã nghiệm thu runtime chỉ từ contract tests.
