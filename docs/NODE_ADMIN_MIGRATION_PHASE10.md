# Node migration Phase 10 — API.Admin

## Mục tiêu

Phase 10 chuyển toàn bộ surface của `backend/API.Admin` sang `apps/api` NestJS/TypeScript trên **cùng MariaDB `kaitokid`**, không reset/seed/copy/đổi schema. Phase này nối tiếp Phase 9 trên nhánh `feat/node-realtime-search-cutover`.

Phase 10 **không đồng nghĩa đã được xóa C#**. Chỉ retire `API.Admin` sau khi source gate, DB audit và runtime parity với Web Admin/MariaDB thật đều PASS; final C# retirement/Gateway/worker/media được chốt ở phase cutover cuối.

## Phạm vi 23 controller/surface

Node `AdminModule` mirror đủ các surface C# sau:

1. `/api/admin/attributes`
2. `/api/admin/banners`
3. `/api/admin/categories`
4. `/api/admin/collections`
5. `/api/admin/coupons`
6. `/api/admin/customers`
7. `/api/admin/flash-sales`
8. `/api/admin/homepage-blocks`
9. `/api/admin/homepage`
10. `/api/admin/inventory`
11. `/api/admin/lookbook`
12. `/api/admin/menus`
13. `/api/admin/orders`
14. `/api/admin/pages`
15. `/api/admin/products`
16. `/api/admin/promotions`
17. `/api/admin/reports`
18. `/api/admin/reviews`
19. `/api/admin/settings`
20. `/api/admin/stock-receipts`
21. `/api/admin/suppliers`
22. `/api/admin/variant-stock`
23. `/api/flash-sales` (public active flash sale)

`/api/admin/shipping` đã được mirror từ Phase 9 trong `AdminShippingModule`; không tính lại vào 23 controller của `API.Admin`.

## Auth/RBAC

- Tái sử dụng `JwtAuthGuard` và JWT staff do Phase 8 phát hành.
- Permission đang active ở C# được giữ cùng tên (`orders.view`, `inventory.manage`, `reports.view`, ...).
- Super admin vẫn bypass granular permission qua claim `is_super_admin=true` như Phase 8.
- Bốn controller C# cũ đang comment `HasPermission` để test (`categories`, `products`, `homepage`, `stock-receipts`) **không được port nguyên lỗ hổng đó**. Node bắt buộc `user_type=staff` tối thiểu để customer JWT không truy cập API quản trị.

## Invariant nghiệp vụ bắt buộc

### Order status / cancel

- Update trạng thái khóa order trong transaction.
- Chuyển lần đầu sang `cancelled` phải hoàn `SanPham.TonKho`.
- Hoàn đúng `TonKhoBienThe` theo `SanPhamId + KichCo + MauSac`.
- Giảm `SoLuongDaBan` ở product/variant nhưng không âm.
- Nếu tồn > 0 thì mở lại product `out-of-stock` thành `active`.
- Nếu order có coupon, giảm `MaGiamGia.DaSuDung` đúng một lần và không âm.

### Inventory

- `import`, `export`, `set` giữ semantics C#.
- Không cho quantity âm; `export` vượt tồn phải reject, không clamp âm thầm.
- Mọi điều chỉnh ghi `TonKho_LichSu` với tồn trước/sau và staff thực hiện.

### Variant stock

- Đặt lại tồn biến thể phải cập nhật tồn tổng product bằng đúng phần chênh lệch.
- Product status và `TonKho_LichSu` cập nhật trong cùng transaction.

### Stock receipts

- Tạo phiếu nhập là một transaction: header + detail + product stock + variant stock + history.
- Item phải có số lượng > 0 và giá nhập > 0.
- Supplier ID nếu có phải tồn tại.
- Mã phiếu giữ dạng `NHAP-yyyyMMdd-XXX`.
- Giá vốn biến thể dùng weighted average như C#.
- Hủy phiếu nhập rollback product + variant stock, ghi history và idempotently chặn hủy lần hai.

### Suppliers

- Nhà cung cấp đã được dùng trong `PhieuNhap` không hard-delete; chuyển `TrangThai=false`.
- Nhà cung cấp chưa được dùng được xóa và trả HTTP 204 như C#.

## Data preservation

- Không thêm/drop/rename bảng hoặc cột.
- Không dùng `prisma migrate reset`, `prisma migrate dev`, `prisma db push`.
- Prisma/SQL truy cập trực tiếp schema MariaDB hiện tại.
- `db:audit` phải tiếp tục PASS với manifest legacy.

## Gate Phase 10

Từ repo root:

```bat
scripts\node-admin-migration-check.bat
```

Gate thực hiện:

1. `npm install` trong `apps/api`;
2. Node API build;
3. `db:audit` trên MariaDB hiện tại;
4. toàn bộ regression contract gate Phase 1–9 (`catalog`, `customer-aux`, `cart-reservation`, `checkout-order`, `auth-rbac`, `realtime-cutover`);
5. `test:admin-migration`;
6. Web build để bắt lỗi contract/import ở phía Admin UI.

Contract test Phase 10 kiểm tra:

- đủ 23 controller/surface;
- route prefixes;
- staff-only hardening và granular permission;
- order cancellation restore product + variant + coupon;
- stock receipt transaction/weighted-average/rollback/history;
- inventory math và response camelCase tương thích ASP.NET Core.

## Runtime parity bắt buộc trước khi retire API.Admin C#

Dùng cùng DB/test data, chạy Web Admin lần lượt:

- staff login + permission denied/allowed;
- product/category/banner/collection/coupon/flash-sale/CMS CRUD;
- customer list/detail/toggle-status;
- order list/detail/status, đặc biệt cancel và kiểm chứng DB tồn/coupon;
- inventory import/export/set + history;
- variant stock adjustment + aggregate stock;
- supplier CRUD/soft-disable;
- stock receipt create/detail/cancel và kiểm chứng product/variant/history;
- reports/dashboard;
- reviews moderate;
- settings/homepage;
- public active flash sale.

Không dùng dữ liệu production cho destructive parity nếu chưa có backup/snapshot an toàn.

## Sau Phase 10

Khi gate + runtime parity Admin PASS, có thể chuyển **traffic API.Admin** sang Node nhưng vẫn giữ C# làm rollback trong soak period.

Bước tiếp theo là **final cutover/retirement phase** để chốt các blocker còn lại ngoài API.Admin: Customer media/static fallback, ShippingStatusSimulator/worker ownership, realtime/client routing, Gateway retirement và full runtime smoke. Chỉ sau phase đó mới được xóa `backend/` C#.
