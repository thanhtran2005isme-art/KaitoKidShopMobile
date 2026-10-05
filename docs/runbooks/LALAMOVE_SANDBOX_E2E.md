# Runbook — Lalamove Sandbox E2E cho PR #75

> Merge gate: **không merge PR #75** cho tới khi cả Customer Web `:5173` và Mobile/Expo `:8081` chạy flow sandbox end-to-end, webhook public hoạt động và các assertion persistence/cancel bên dưới đều pass.

## 1. Điều kiện trước khi chạy

- checkout branch `feat/admin-lalamove-carrier`;
- MariaDB local hiện tại đã setup theo repo; không reset database;
- `apps/api/.env` có sandbox credentials thật nhưng **không commit**;
- Lalamove provider được bật trong Admin Shipping;
- Pickup Address/Name/Phone là dữ liệu hợp lệ;
- số điện thoại gửi Lalamove dùng chuẩn E.164, ví dụ `+84901234567`;
- có một địa chỉ drop-off nằm trong vùng Lalamove Sandbox hỗ trợ;
- webhook URL của Partner Portal trỏ tới HTTPS public endpoint của backend local/deploy:
  `POST /api/shipping/lalamove/webhook`.

Biến backend tối thiểu:

```env
LALAMOVE_BASE_URL=https://rest.sandbox.lalamove.com
LALAMOVE_MARKET=VN
LALAMOVE_SERVICE_TYPE=MOTORCYCLE
LALAMOVE_WEBHOOK_PATH=/api/shipping/lalamove/webhook
LALAMOVE_API_KEY=pk_test_...
LALAMOVE_API_SECRET=sk_test_...
LALAMOVE_PICKUP_ADDRESS=...
```

Không đưa `LALAMOVE_API_KEY` / `LALAMOVE_API_SECRET` vào Web, Mobile, screenshot, issue, PR comment hoặc Git history.

## 2. Gate tự động trước sandbox

Các gate này phải xanh trước khi chạy live sandbox:

```bat
npm --prefix apps/api run test:checkout-order
npm --prefix apps/web run lint
npm --prefix apps/web run build
npm --prefix apps/mobile run lint
npm --prefix apps/mobile run typecheck
```

GitHub Actions của PR #75 cũng phải xanh:

- `API checkout contracts`
- `Client checks`

## 3. Carrier smoke trực tiếp

Bổ sung vào `apps/api/.env` cho smoke test:

```env
LALAMOVE_PICKUP_NAME=KaitoKid Sandbox
LALAMOVE_PICKUP_PHONE=+84901234567
LALAMOVE_SANDBOX_DROPOFF_ADDRESS=...
LALAMOVE_SANDBOX_DROPOFF_NAME=KaitoKid Test Customer
LALAMOVE_SANDBOX_DROPOFF_PHONE=+84909876543
LALAMOVE_SANDBOX_CANCEL_AFTER=true
```

Phone phải theo E.164 (`+` + mã quốc gia + số thuê bao, không khoảng trắng). Smoke script fail-fast trước khi gọi carrier nếu phone sai format.

Lalamove có thể reverse-geocode từ địa chỉ. Nếu quotation trả `ERR_REVERSE_GEOCODE_FAILURE`, bổ sung **đủ cả cặp** tọa độ tương ứng:

```env
# Optional — chỉ cần khi address không reverse-geocode ổn định
LALAMOVE_PICKUP_LAT=21.0...
LALAMOVE_PICKUP_LNG=105.8...
LALAMOVE_SANDBOX_DROPOFF_LAT=21.0...
LALAMOVE_SANDBOX_DROPOFF_LNG=105.8...
```

Không khai báo riêng lẻ LAT hoặc LNG. Script sẽ từ chối một cặp thiếu và cũng kiểm tra latitude nằm trong `-90..90`, longitude trong `-180..180`.

Chạy:

```bat
npm --prefix apps/api run smoke:lalamove-sandbox
```

PASS khi output lần lượt xác nhận:

1. quotation có `quotationId` + `stopId` + fee;
2. Place Order trả `orderId` thật từ Sandbox;
3. Get Order trả status và `shareLink` nếu provider đã cấp;
4. Cancel trả HTTP `204` khi trạng thái cho phép.

Theo contract Lalamove v3 hiện tại, `POST /v3/quotations` trả trực tiếp `stops[].stopId`; các `stopId` đó được dùng cho sender/recipient khi `POST /v3/orders`. Cancel dùng `DELETE /v3/orders/{orderId}`; `204` là success, `409 ERR_CANCELLATION_FORBIDDEN` là nhánh carrier không cho hủy.

Script cố ý từ chối base URL production và key không có prefix `pk_test_` / `sk_test_`.

## 4. Chạy KaitoKid stack

Có thể dùng:

```bat
scripts\run-all.bat
```

Kỳ vọng:

- Node API: `http://localhost:5300`
- Customer/Admin Web: `http://localhost:5173`
- Mobile/Expo Web: `http://localhost:8081`

Nếu webhook cần đi vào máy local, expose **chỉ backend `:5300`** qua một HTTPS public tunnel/reverse proxy. Public pathname phải đúng với `LALAMOVE_WEBHOOK_PATH`; nếu proxy thêm prefix thì cập nhật env cho đúng pathname mà Lalamove ký.

## 5. Admin Shipping preflight

Trên Admin Web:

1. mở `/admin/shipping`;
2. bật Lalamove;
3. xác nhận Base URL = Sandbox, Market = `VN`, Service Type phù hợp;
4. nhập Pickup Address/Name/Phone đầy đủ;
5. bấm test Lalamove;
6. PASS khi backend HMAC gọi được `GET /v3/cities` và UI không bao giờ hiển thị raw API secret.

## 6. Customer Web E2E (`:5173`)

Dùng một user/customer test thật trong DB:

1. đăng nhập;
2. thêm sản phẩm còn tồn vào cart;
3. vào checkout;
4. chọn địa chỉ nằm trong vùng Sandbox;
5. chọn option Lalamove từ quote backend;
6. chọn COD để Place Order xảy ra ngay sau commerce commit;
7. tạo đơn;
8. mở “Đơn hàng của tôi” → tracking;
9. xác nhận mã vận đơn là Lalamove `orderId`, provider = Lalamove, status hiển thị nhãn người dùng;
10. refresh tracking để backend sync `GET /v3/orders/{id}`;
11. nếu `canCancel=true`, thử hủy và xác nhận carrier-first + commerce-second.

PASS khi Web không tự suy quyền hủy; nút Hủy chỉ xuất hiện khi backend trả `canCancel=true`.

## 7. Mobile/Expo E2E (`:8081` và Android nếu có)

Lặp lại cùng user/cart/address hoặc tạo đơn test mới:

1. login;
2. cart → checkout;
3. Mobile quote với `provider=all` phải nhận Lalamove từ backend;
4. chọn Lalamove;
5. COD → tạo order;
6. Order Detail hiển thị provider/status/tracking code;
7. mở Tracking;
8. pull-to-refresh để sync carrier state;
9. nút Hủy chỉ theo `order.canCancel` backend;
10. nếu hủy được, xác nhận order chuyển `cancelled` và inventory/coupon chỉ restore sau carrier cancel thành công.

Không chấp nhận PASS chỉ vì Expo Web chạy; nếu mục tiêu release Android thì chạy thêm thiết bị/emulator Android.

## 8. Persistence assertions trong MariaDB

Dùng read-only SELECT sau khi tạo đơn. Thay `KK-...` bằng order code vừa test:

```sql
SELECT
  Id,
  MaDonHang,
  TrangThai,
  NhaVanChuyen,
  MaDichVuVanChuyen,
  MaVanDon,
  LinkTracking,
  TrangThaiVanChuyen,
  PhiVanChuyen,
  NgayCapNhat
FROM DonHang
WHERE MaDonHang = 'KK-...';
```

Kỳ vọng sau Place Order thành công:

- `NhaVanChuyen = 'lalamove'`;
- `MaVanDon` = carrier `orderId`, không phải mã fake;
- `LinkTracking` = `shareLink` khi Lalamove trả;
- `TrangThaiVanChuyen` = trạng thái KaitoKid đã map;
- `PhiVanChuyen` là fee backend đã re-quote và chốt;
- `MaDichVuVanChuyen` theo contract D025 hiện tại.

Audit history:

```sql
SELECT Id, TrangThai, MoTa, ViTri, ThoiGian
FROM LichSuTrangThaiVanChuyen
WHERE DonHangId = <ORDER_ID>
ORDER BY ThoiGian, Id;
```

Phải thấy entry tạo order/vận đơn và webhook/tracking updates tương ứng.

## 9. Webhook thật

Sau khi Place Order:

1. Lalamove gửi event vào HTTPS public webhook URL;
2. backend trả 2xx cho payload hợp lệ;
3. signature sai phải bị reject;
4. cùng `eventId` gửi lại không được apply state lần hai;
5. event cũ hơn event đã nhận không được làm regress state;
6. `CANCELED`, `REJECTED`, `EXPIRED` từ carrier không tự ý restore inventory/coupon nếu commerce cancellation chưa chạy.

Kiểm tra marker trong history:

```text
[LALAMOVE_EVENT:<eventId>]
```

Duplicate phải được coi là replay và không tạo state transition mới.

## 10. Cancel success và forbidden

### Success path

- khi backend `canCancel=true`, customer cancel;
- backend gọi Lalamove DELETE trước;
- Lalamove `204`;
- sau đó KaitoKid mới set order `cancelled`, restore stock/coupon và ghi history.

### Forbidden path

Cần một Sandbox order ở trạng thái Lalamove không cho cancel:

- DELETE trả `409 ERR_CANCELLATION_FORBIDDEN`;
- KaitoKid phải trả lỗi cho client;
- `DonHang.TrangThai` không được giả thành `cancelled`;
- inventory/coupon không được restore nhầm.

Không giả lập PASS cho nhánh `409`; chỉ tick gate khi Sandbox thật trả forbidden hoặc có một provider-approved cách tái tạo tương đương.

## 11. Merge gate cuối

Chỉ chuyển PR #75 từ Draft → Ready và merge khi tất cả đều có bằng chứng:

- backend build + checkout contracts;
- Web lint/build;
- Mobile lint/typecheck;
- sandbox quotation;
- sandbox Place Order + persistence;
- webhook public signed + replay/out-of-order;
- owner tracking sync;
- cancel 204;
- cancel forbidden 409 không làm sai tồn/coupon;
- Customer Web E2E;
- Mobile/Expo E2E;
- secret audit sạch.

Nếu một mục chưa chạy được, PR tiếp tục để **Draft / Open / Unmerged**.
