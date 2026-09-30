# KaitoKidShop — chuyển backend C# sang Node.js

## Mục tiêu

Chuyển ASP.NET Core sang NestJS + TypeScript + Prisma nhưng **giữ nguyên toàn bộ dữ liệu MariaDB hiện tại** và giữ API contract để Web/Mobile không phải rewrite theo backend.

## Kiến trúc đích

- Node.js 20.19+; ưu tiên Node 22 LTS
- TypeScript 5.9
- NestJS 11
- Prisma ORM 7 + `@prisma/adapter-mariadb`
- MariaDB `kaitokid` hiện tại
- Modular Monolith trước

## Data-preservation invariants

1. DB `kaitokid` hiện tại là source of truth.
2. Không reset/drop/recreate DB trong migration.
3. Không đổi tên bảng/cột cũ chỉ để hợp convention TypeScript.
4. Prisma dùng `db pull` để map schema hiện có.
5. Cấm `prisma migrate reset`, `prisma migrate dev`, `prisma db push` trên DB đang dùng.
6. Trước mỗi cutover: backup DB + audit đủ 52 bảng.
7. C# giữ làm reference đến khi module Node parity pass.
8. Không seed lại hoặc làm mất user, order, cart, stock, points, reviews, staff/RBAC, auth tables.

## 9 phase

1. Freeze API/business baseline.
2. NestJS foundation + database audit.
3. Prisma introspection trên MariaDB hiện tại.
4. Catalog/content read-only.
5. Account/Address/Wishlist/Reviews/Notifications/Referral.
6. Cart + Variant Inventory + Reservation + Combo.
7. Checkout + Order + Coupon + Payment + Shipping.
8. Auth + Email Verify + Social + OTP/2FA + Staff/RBAC.
9. Chat/realtime + chatbot + image search + background workers + final cutover.

## Điều kiện cutover từng module

- route/method tương đương C#;
- request/response DTO tương đương;
- JWT/ownership/permission tương đương;
- business invariant pass;
- test Node pass;
- cùng MariaDB cho kết quả tương đương;
- rollback về C# vẫn khả dụng.

Không xóa backend C# trong các phase đầu.

## Build/output contract

- Build Node dùng `tsc -p tsconfig.build.json`.
- `rootDir=src`, `outDir=dist` để output luôn là `dist/main.js`, `dist/scripts/*`, `dist/modules/*`.
- `db:audit` build trước rồi chạy `dist/scripts/audit-legacy-db.js`.
- Không đổi test sang `dist/src/*`; layout đó là lỗi cấu hình build cũ.

- Audit schema tôn trọng `@@lower_case_table_names`: Windows/MariaDB case-insensitive được đối chiếu không phân biệt hoa/thường; Linux case-sensitive vẫn kiểm tra đúng casing. Audit không đổi tên bảng hay dữ liệu.

## Tiến độ code trên nhánh stacked

- Phase nền NestJS/Prisma: implemented, còn chờ runtime DB audit local.
- Catalog read-only: Products, Categories, Banners, HomepageBlocks, Collections, Lookbooks đã được mirror ở mức source.
- Chưa cutover Web/Mobile; C# vẫn là backend đang phục vụ.
- Catalog Node phải chạy `npm run test:catalog` và parity test với MariaDB thật trước khi merge/cutover.
