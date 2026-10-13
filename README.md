# KaitoKidShop

Full-stack monorepo của **KaitoKid Shop Fashion** gồm Mobile, Web và backend NestJS Node dùng chung MariaDB.

## Cấu trúc hiện tại

```text
KaitoKidShop/
├─ apps/
│  ├─ api/                 # NestJS 11 + Prisma 7, port 5300
│  ├─ mobile/              # Expo + React Native
│  └─ web/                 # React + TypeScript + Vite
├─ database/               # MariaDB schema + migrations
├─ scripts/                # Windows launchers + runtime gates
├─ docs/
├─ run.bat                 # Node API + Expo Mobile
├─ package.json
├─ AGENTS.md
└─ README.md
```

Backend ASP.NET Core C# cũ đã được retire sau khi migration Node và các gate runtime/race/realtime/smoke/rollback được xác nhận PASS. Không còn fallback runtime về các cổng C# 5053/5265/5089/5155.

## Chuẩn bị

Yêu cầu chính:

- Node.js `>=20.19.0`
- npm
- MariaDB/MySQL-compatible server

Tạo cấu hình backend local:

```bat
cd apps\api
copy .env.example .env
```

Điền tối thiểu `DATABASE_URL` và `JWT_KEY` trong `apps/api/.env`. Không commit secret thật.

Cài dependencies:

```bat
npm --prefix apps\api install
npm --prefix apps\web install
npm --prefix apps\mobile install
```

## Database

Fresh schema nền:

```text
database/KaitoKid_MariaDB.sql
```

Sau khi import fresh schema nền, chạy migration Ví KaitoKid để đạt contract DB hiện hành:

```text
database/migrations/20261006_wallet_refund_withdrawal.sql
```

Database đã tồn tại cũng chạy migration trên theo cách in-place; không rebuild dữ liệu. Các migration khác nằm trong:

```text
database/migrations/
```

Database development hiện dùng tên `kaitokid`; health/audit hiện kỳ vọng **55 bảng**. Ba bảng bổ sung của Ví KaitoKid là `ViDienTu`, `GiaoDichVi`, `YeuCauRutTien`.

Không dùng `prisma migrate reset`, `prisma migrate dev` hoặc `prisma db push` trên database đang có dữ liệu. Khi cần đồng bộ Prisma với schema hiện hữu, dùng:

```bat
npm --prefix apps\api run db:introspect
```

## Ví KaitoKid và hậu mãi

- Khách có thể nhận tiền hoàn vào Ví KaitoKid sau khi hàng hoàn thực tế được Admin nhận/kiểm.
- Cửa sổ gửi yêu cầu hoàn hàng là **15 ngày kể từ lúc khách xác nhận đã nhận hàng**.
- Checkout Web/Mobile chỉ gửi `useWallet`; backend tự quyết định `walletUsed` và `amountDue`.
- payOS chỉ xử lý phần `amountDue` còn lại sau ví. Ví trả đủ thì không tạo payment link payOS.
- Khách có thể yêu cầu rút số dư; tiền được chuyển từ khả dụng sang tạm giữ cho tới khi Admin hoàn tất hoặc từ chối.
- Mọi biến động tiền đi qua ledger `GiaoDichVi`; không có UI sửa số dư thủ công.

Chi tiết durable contract: `docs/decisions/D028-wallet-refund-withdrawal.md`.

## Chạy development trên Windows

Node API + Mobile:

```bat
run.bat
```

Toàn bộ Node API + Web + Mobile:

```bat
scripts\run-all.bat
```

Chạy riêng backend Node:

```bat
scripts\run-backend.bat
```

Dừng các process Node development:

```bat
scripts\stop-all.bat
```

## Ports

- NestJS API + REST + Socket.IO: `5300`
- Socket.IO path: `/chatHub`
- Expo/Metro: `8081`
- Vite Web: thường `5173`

Web và Mobile mặc định gọi backend Node `:5300`.

## Final gates

```bat
scripts\node-final-cutover-check.bat
scripts\node-final-runtime-smoke.bat
scripts\node-protected-runtime-parity.bat
scripts\node-concurrency-race-gate.bat
scripts\node-realtime-runtime-gate.bat
```

Các race gate có thể tạo backup dưới `.runtime-backups/`; thư mục này bị gitignore.

## Tài liệu source of truth

Đọc theo thứ tự:

1. `AGENTS.md`
2. `docs/AI_HANDOFF.md`
3. `docs/BRAND.md`
4. `docs/UI_UX.md`
5. `docs/ROADMAP.md`
6. `docs/ARCHITECTURE.md`
7. `docs/DECISIONS.md` và `docs/decisions/`
8. `docs/TROUBLESHOOTING.md`
9. Git history + source liên quan
