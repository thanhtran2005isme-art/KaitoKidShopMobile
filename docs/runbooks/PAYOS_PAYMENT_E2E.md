# payOS Payment E2E Runbook

Date: 2026-10-05

Dùng runbook này trước khi bỏ Draft/merge PR #75.

## 1. Cấu hình backend

Trong `apps/api/.env` local/deployment, không commit secret:

```env
PAYOS_CLIENT_ID=...
PAYOS_API_KEY=...
PAYOS_CHECKSUM_KEY=...
FRONTEND_BASE_URL=http://localhost:5173
```

Nếu dùng callback URL riêng:

```env
PAYOS_RETURN_URL=https://<public-web>/orders?payment=success
PAYOS_CANCEL_URL=https://<public-web>/orders?payment=cancel
```

Callback URL chỉ phục vụ UX; không phải authority paid.

`payosEnabled` là optional store setting. Nếu key này chưa tồn tại, backend tự bật online payment khi ba credentials payOS đã đủ. Nếu `payosEnabled=false`, ATM/online bị tắt dù credentials còn tồn tại.

Các key legacy `bankEnabled`, `enableBankTransfer`, `bankAccounts` **không còn được phép bật online payment mới**. VietQR verification cũ không còn là merge gate.

## 2. Public webhook

Backend phải có public HTTPS URL tới:

```text
POST https://<public-api>/api/payment/payos/webhook
```

Đăng ký URL này trong payment channel payOS hoặc dùng chức năng confirm webhook của payOS.

Acceptance:

- payOS confirm URL nhận HTTP 2xx;
- signed sample payload không tạo order giả;
- payload sai signature trả 4xx;
- không cần KaitoKid JWT ở webhook route.

Localhost không nhận webhook trực tiếp từ Internet. Có thể dùng HTTPS tunnel cho port `5300`. Production vẫn bắt buộc public webhook dù local có provider-reconcile fallback.

## 3. Khởi động local

```bat
scripts\run-all.bat
```

Kiểm tra:

```text
Node API: http://localhost:5300
Customer Web: http://localhost:5173
Expo/Mobile: :8081
```

## 4. Runtime cutover acceptance

### Không có payOS credentials

- tạm bỏ ba biến `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`;
- dù database còn `bankEnabled=true`, `enableBankTransfer=true` hoặc `bankAccounts`, `GET /api/payment/config` không được quảng bá `ATM` cho đơn mới;
- COD vẫn theo `codEnabled`/`enableCOD` hiện hành.

### Có payOS credentials

- cấu hình đủ ba credentials;
- nếu không có `payosEnabled`, `GET /api/payment/config` phải có `ATM`, `payOsConfigured=true`, `paymentProvider=payos`;
- đặt `payosEnabled=false` phải tắt `ATM` mà không cần xóa secret.

### Mapping orderCode

Không dùng `DonHang.Id` làm payOS orderCode.

Với mã KaitoKid dạng:

```text
KK-YYYYMMDD-XXXXXX
```

backend derive integer:

```text
payOS orderCode = YYYYMMDD * 16^6 + hex(XXXXXX)
```

Mapping phải round-trip được:

```text
MaDonHang -> payOS orderCode -> đúng MaDonHang ban đầu
```

Reset/reseed local DB hoặc reuse AUTO_INCREMENT không được làm collision payment cũ trên payOS.

### GET code 101 / CREATE code 231

SDK `@payos/node` có thể ném `APIError` khi response body có business code khác `00`, kể cả HTTP status `200`.

Case hợp lệ cần recover:

```text
GET payment
-> HTTP 200 + code 101 "Mã thanh toán không tồn tại"
-> CREATE payment
-> nếu HTTP 200 + code 231 "Đơn thanh toán đã tồn tại"
-> bounded GET lại cùng provider orderCode
-> amount phải khớp
-> trả payment hiện có
```

Không được trả `502` chỉ vì code `101`/`231` nếu payment hiện hữu có thể recover an toàn.

Request instructions đồng thời cho cùng order phải single-flight để không create cạnh tranh do React StrictMode.

## 5. QR acceptance

CREATE payment request có thể trả raw `qrCode` dùng cho QR thanh toán ngân hàng.

Bắt buộc:

- KaitoKid chỉ render `qrUrl` từ raw `qrCode` do payOS trả;
- app ngân hàng quét QR KaitoKid phải nhận đúng amount + nội dung;
- `checkoutUrl` là URL web Hosted Checkout, **không được** encode thành QR rồi trình bày như QR ngân hàng;
- nếu backend restart/không còn raw QR từ CREATE, UI chỉ hiện nút **Mở trang thanh toán payOS**, không hiện QR giả;
- QR cache trong Node chỉ là short-lived UX cache, không phải payment authority.

## 6. Customer Web acceptance

1. Login customer.
2. Thêm hàng và checkout.
3. Chọn online bank payment hiện hành (DB compatibility code vẫn là `ATM`).
4. Tạo order.
5. Web **không được gọi `clearCart()` toàn bộ** sau create order; backend là cart authority.
6. Item không thuộc checkout phải còn nguyên trong giỏ.
7. Màn payment phải hiển thị payOS, amount đúng `DonHang.TongTien`, QR/payment link có thể mở.
8. Không được gọi/read `/api/admin/settings` từ Customer payment để xác nhận paid.
9. Thanh toán bằng QR/payment link.
10. Primary: payOS webhook cập nhật order `pending -> confirmed`.
11. Fallback: Web poll `/api/payment/status/:orderCode`; nếu DB còn pending nhưng payOS GET trả `PAID`, backend phải validate `VND` + `amount == DonHang.TongTien`, confirm idempotent và trả `paidAt`.
12. Web tự chuyển success, không có nút “Tôi đã thanh toán”.

### Hủy/hết hạn trước khi thanh toán

- Customer bấm **Hủy giao dịch** -> backend đối soát/cancel payOS trước;
- sau khi provider xác nhận `CANCELLED`, backend cancel order;
- stock + coupon được restore;
- chính order items được trả lại `GioHang`, merge theo product/size/color nếu cần;
- cart reservation được cấp lại `GiuDenLuc` theo reservation window hiện hành;
- quay về `/cart` phải thấy lại sản phẩm, không phải add tay lại.

## 7. Mobile acceptance

1. Login Mobile.
2. Cart -> Checkout -> chọn online payment -> Create Order.
3. `checkout/payment` chỉ hiển thị QR khi backend có raw payOS QR hợp lệ.
4. Nút `Mở trang thanh toán payOS` mở hosted checkout bằng `expo-web-browser`.
5. Thanh toán từ app ngân hàng/thiết bị phù hợp.
6. Mobile poll `/api/payment/status/:orderCode` khoảng 3 giây/lần trong lúc pending.
7. Nếu webhook chưa tới được localhost, polling server-side phải tự reconcile provider `PAID` và cập nhật DB.
8. Sau backend paid, Mobile tự điều hướng tới `order-success/[orderCode]`.
9. Mobile không xin quyền đọc SMS/notification/balance ngân hàng.
10. Cancel/expiry phải có cùng cart-restore semantics như Web.

## 8. Provider reconcile fallback acceptance

Case local/dev bắt buộc test:

```text
payOS dashboard/payment request = PAID
KaitoKid DonHang = pending, NgayThanhToan = NULL
```

Gọi owner-scoped:

```text
GET /api/payment/status/:orderCode
```

Kỳ vọng:

```text
backend GET payOS status
-> PAID
-> currency phải VND nếu provider trả currency
-> amount phải == DonHang.TongTien
-> SELECT DonHang ... FOR UPDATE
-> set NgayThanhToan + confirmed đúng một lần
-> append payment_confirmed source payos_reconcile
-> tạo shipment online đúng một lần
-> response có paidAt
```

Provider timeout/outage khi order chưa hết hạn không được biến status polling thành `502`; client tiếp tục dùng trạng thái local và poll lại. Khi tới expiry, provider-first cancel/reconcile vẫn giữ fail-closed semantics.

## 9. Security/idempotency acceptance

Phải chứng minh:

- signature invalid -> reject;
- signed webhook unknown/unmappable order -> ACK/ignore, không mutate DB;
- webhook không được fallback đoán theo `DonHang.Id`;
- amount mismatch -> reject;
- currency khác VND -> reject;
- provider reconcile amount/currency mismatch -> reject;
- duplicate paid webhook -> `NgayThanhToan` không bị side-effect lặp;
- webhook và status reconcile chạy cạnh nhau vẫn chỉ có một paid transition;
- shipment không được tạo hai lần;
- order cancelled không bị revive bởi manual forged request.

## 10. Cancel/expiry race

### Pending chưa trả tiền

- Customer cancel -> backend GET payOS -> cancel provider -> chỉ sau `CANCELLED` mới restore stock/coupon/cart.

### Tiền vào đúng lúc cancel

- Provider trả `PAID` hoặc cancel response cho thấy `PAID` -> validate amount/currency -> KaitoKid confirm paid; không restore stock/coupon/cart.

### Payment hết hạn

- Sweeper phải đối soát payOS trước.
- Nếu `PAID` -> validate + confirm.
- Nếu `PENDING` -> cancel provider trước.
- Nếu `CANCELLED`/no payment -> local cancel + restore stock/coupon/cart.
- Nếu provider chưa terminal -> fail closed, không hoàn tồn/coupon/cart.

### Cart restore idempotency

- local cancel/expiry chỉ chạy khi order còn `pending` + unpaid;
- transaction giữ user lock trước inventory lock để cùng lock order với CartService;
- gọi lại cancel/status sau terminal không được cộng cart/reservation lần hai.

## 11. Shipping/Lalamove acceptance

Online order chưa paid:

```text
trackingCode phải chưa được tạo bởi payment flow
```

Sau verified paid/reconcile paid:

```text
payment_confirmed
-> createShippingOrder
-> Lalamove Place Order nếu provider đã chọn là Lalamove
```

Chứng minh shipment chỉ được tạo một lần.

## 12. Automated gates

```bat
npm --prefix apps\api run test:checkout-order
npm --prefix apps\web run lint
npm --prefix apps\web run build
npm --prefix apps\mobile run lint
npm --prefix apps\mobile run typecheck
```

`test:checkout-order` phải gồm ít nhất:

- `payos-payment-contract.test.mjs`;
- `payos-status-reconcile-contract.test.mjs`;
- `payment-runtime-cutover-contract.test.mjs`.

Các contract phải khóa:

- mapping `MaDonHang <-> payOS orderCode` reversible;
- code `101` create path;
- code `231` recovery path;
- concurrent create single-flight;
- checkoutUrl không bị dùng làm QR ngân hàng;
- status polling reconcile provider PAID trước expiry;
- cart restore sau cancel/expiry;
- legacy bank/VietQR không thể kích hoạt ATM mới.

Giữ thêm các race gate hiện có khi test DB sẵn sàng:

```bat
scripts\node-concurrency-race-gate.bat
scripts\node-realtime-runtime-gate.bat
```

## 13. Merge gate

PR #75 tiếp tục Draft/Open cho đến khi:

- automated gates PASS;
- runtime cutover test PASS: không credentials thì legacy bank settings không bật ATM;
- payOS credentials thật/test channel đã được cấu hình ngoài Git;
- public webhook được confirm;
- QR ngân hàng thật quét được trên Web/Mobile;
- Web + Mobile payment E2E PASS;
- status polling recover được transaction PAID khi webhook local chưa tới;
- reset DB không tái hiện collision `231` từ `DonHang.Id`;
- cancel/expiry race PASS;
- cancel/expiry trả item lại cart đúng một lần;
- payOS paid -> Lalamove shipment PASS.
