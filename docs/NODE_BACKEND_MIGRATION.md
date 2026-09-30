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

- Customer auxiliary: Account profile/loyalty/voucher/avatar, Address, Wishlist, Reviews, Notifications, Referral đã được mirror ở mức source.
- Node xác thực trực tiếp JWT HS256 do C# Auth phát hành bằng `node:crypto`; `JWT_KEY/JWT_ISSUER/JWT_AUDIENCE` phải trùng C# trong giai đoạn coexistence.
- **DELETE /api/account chưa chuyển ở phase này** vì bắt buộc phải nhả Cart/Variant reservation qua cùng business rule với CartService. Endpoint này tiếp tục do C# phục vụ cho tới phase Cart.
- Các write flow reward/default-address/review/referral dùng transaction và ownership predicate.
- Chưa cutover Web/Mobile; phải chạy `npm run test:customer-aux` + runtime parity trên MariaDB thật.


## Phase 6 — Cart + Inventory + Reservation + Combo

- Mirror các route `/api/cart`: list, add, update, remove, clear, remove-many, move-to-wishlist, cross-sell, cross-sell-products, combo discount selected và reorder.
- Reservation 30 phút tiếp tục dùng chính `SanPham.SoLuongDaGiu`, `TonKhoBienThe.SoLuongDaGiu`, `GioHang.GiuDenLuc`; không tạo bảng/cột mới.
- Mutation Cart dùng transaction và row lock theo thứ tự user → product → variant → cart để giảm race/oversell khi request đồng thời.
- Release reservation luôn đồng bộ cả product và đúng size/màu variant, dùng `GREATEST(0,...)` để không tạo reserve âm.
- `DELETE /api/account` được mở ở Node trong phase này vì đã có CartService để clear cart/release reserve trước khi anonymize dữ liệu phụ.
- Combo giữ rule C#: ít nhất 2 ProductId khác nhau cùng `DanhMuc`, giảm 10% trên subtotal của category đủ điều kiện, round-to-even tương thích `decimal Math.Round`.
- Node sweeper được triển khai nhưng **tắt mặc định trong giai đoạn C#/Node coexistence** để tránh hai process cùng release một reservation. Chỉ bật `CART_SWEEPER_ENABLED=true` sau khi C# sweeper đã dừng ở cutover.
- Gate: `npm run build`, `npm run db:audit`, `npm run test:catalog`, `npm run test:customer-aux`, `npm run test:cart-reservation`.
- Không reset/seed/copy MariaDB; Web/Mobile chưa cutover sang Node ở phase này.


## Phase 7 — Checkout + Order + Coupon + Payment + Shipping

- Mirror `/api/orders`: partial checkout selected `CartItemIds`, legacy all-cart fallback, list/detail, server-authoritative `canCancel`, cancel + hoàn kho/coupon.
- Checkout luôn lock/revalidate cart + product + variant trước commit; trừ tồn thật và release reservation trong cùng transaction.
- Coupon giữ rule C#: hiệu lực thời gian, usage limit, min-order, percent/fixed, max discount; checkout tăng `DaSuDung`, cancel/expiry hoàn đúng 1 lượt.
- Combo được tính lại server-side trên chính selected cart rows; client không quyết định discount.
- Shipping quote luôn được backend tính lại từ địa chỉ cấu trúc + trọng lượng; client-supplied fee/ETA không được tin.
- Mock/GHN/GHTK fee providers được mirror; **create shipping order vẫn chỉ sinh mã DEV giả**, không gọi create-order thật của hãng vận chuyển.
- Tracking `/api/shipping/track/:orderCode` bắt buộc JWT + ownership.
- Payment giữ COD/ATM, bank config từ `CauHinhCuaHang`, ATM timeout 15 phút, instructions/status/cancel/simulate-paid/mark-paid.
- Node payment expiry sweeper được triển khai nhưng mặc định tắt trong coexistence: `PAYMENT_SWEEPER_ENABLED=false`; chỉ bật sau khi C# sweeper dừng.
- Order/payment email side-effect được Phase 8 tiếp quản bằng email provider Node; business transaction vẫn không phụ thuộc email và email failure không rollback order/payment.
- Không thêm bảng/cột, không reset/seed/copy MariaDB, chưa cutover Web/Mobile.
- Gate: `npm run build`, `npm run db:audit`, các gate cũ và `npm run test:checkout-order`.


## Phase 8 — Auth + Email Verify + Social + OTP/2FA + Staff/RBAC

- Mirror toàn bộ customer Auth contract `/api/Auth`: register pending, login, login-2fa, refresh rotation, change-password, me, forgot/reset password, send/verify email, OTP, Google/Facebook, 2FA và login activity.
- Đăng ký local giữ invariant mới nhất: `POST /register` chỉ upsert `PendingRegistration` với BCrypt hash + SHA-256 verification-token hash; chỉ verify-email hợp lệ mới tạo `NguoiDung`.
- Password dùng `bcryptjs` cost 11, đọc được BCrypt C# hiện có. Plain-text legacy chỉ được chấp nhận khi khớp chính xác rồi rehash ngay; chỉ placeholder admin lịch sử được phép dùng mật khẩu bootstrap tương thích, không có fallback Admin@123 rộng cho hash lỗi.
- JWT Node phát HS256 cùng `JWT_KEY/JWT_ISSUER/JWT_AUDIENCE`; customer claims giữ `nameid/unique_name/email/role`. Refresh token 64-byte random được rotate và lưu ở `NguoiDung`.
- Google native ID token + Expo Web OAuth access token đều verify backend và bắt buộc đúng audience/client ID; Facebook vẫn mirror Graph profile contract hiện tại.
- OTP: 6 số, 5 phút, cooldown 60 giây, tối đa 5 lần thử. TOTP: SHA1/6 số/30 giây, drift ±1 step, issuer `KaitoKidShop`.
- Email dùng Brevo khi có local secret; nếu không có thì mock log console để dev lấy verification/reset link. Cùng provider xử lý email xác nhận order và payment received; email failure không rollback nghiệp vụ. Không commit API key/token.
- Mirror staff auth `/api/auth/staff` và management `/api/auth/staff-management`: lock sau 5 lần sai, JWT staff với `user_type`, `is_super_admin`, permission claims; CRUD staff/role và permission read-only.
- RBAC không bypass theo role string `admin`; chỉ super admin claim hoặc đúng granular permission được phép.
- Staff refresh token giữ parity C# hiện tại: được phát cho client nhưng chưa persistence/revoke endpoint riêng.
- Không thêm/drop/rename bảng; dùng trực tiếp MariaDB 52 bảng hiện tại, bao gồm auth/RBAC + `PendingRegistration`.
- Chưa cutover Mobile/Web Auth base URL; C# API.Auth vẫn là backend reference cho tới runtime parity.
- Gate thêm: `npm install`, `npm run build`, `npm run db:audit`, các gate cũ và `npm run test:auth-rbac`.


## Phase 9 — Chat/realtime + search/image + workers + cutover readiness

- Mirror chat REST customer + admin bằng chính `CuocHoiThoai/TinNhan`; ownership guest/user và granular `chat.view/chat.reply/chat.manage`.
- Realtime chuyển transport từ SignalR C# sang Socket.IO NestJS, giữ logical event names; Web `ChatHubClient` được đổi adapter nhưng giữ public API để không rewrite UI.
- Rule bot giữ order ownership, stock khả dụng, coupon thật và FAQ; LLM optional dùng OpenAI-compatible endpoint + DB grounding và fail mềm.
- Node chat idle sweeper có nhưng mặc định `CHAT_IDLE_SWEEPER_ENABLED=false` trong coexistence.
- Mirror text search/suggestions, recommendations, image-search status/upload, CLIP ONNX embedding store/indexer.
- Repo không chứa model ONNX; thiếu model => image search soft-disabled, không làm app startup fail. Image indexer mặc định tắt.
- Đóng nốt API.Customer routes còn thiếu: Attributes, Newsletter, Product Extras (variants/size/Q&A/viewers), Sitemap/robots và Admin Shipping.
- Không thêm/drop/rename bảng; tiếp tục dùng 52-table MariaDB hiện tại.
- Cutover Auth + Customer chỉ sau toàn bộ gate + runtime parity. Worker ownership phải chuyển C# → Node theo từng worker, không chạy dual-owner.
- **Full C# retirement chưa đạt** vì `API.Admin` còn 23 controller C# ngoài scope 9 phase hiện hành. Xem `docs/NODE_CUTOVER_RUNBOOK.md`.
- Gate mới: `npm run test:realtime-cutover`; helper tổng: `scripts\node-cutover-check.bat`.
