# D027 — payOS payment lifecycle

- Status: Accepted for PR #75 implementation
- Date: 2026-10-05
- Scope: Customer Web, Mobile/Expo, Node payment module, checkout/order/shipping boundary

## Context

PR #75 trước đó dùng luồng ATM + VietQR tự ghép từ bank/account và Admin tự quản lý/verify tài khoản ngân hàng. Luồng đó tạo được QR nhưng không cung cấp một payment provider authoritative để KaitoKid tự biết ngân hàng đã ghi nhận tiền. Vì vậy customer vẫn phụ thuộc mô phỏng/manual confirmation hoặc một integration khác.

Yêu cầu hiện tại là khách quét QR, thanh toán qua ngân hàng và Web/Mobile KaitoKid tự nhận trạng thái thành công mà không đọc SMS, notification hoặc số dư ngân hàng trên thiết bị.

## Decision

### 1. payOS là online payment provider hiện hành

KaitoKid tích hợp SDK chính thức `@payos/node` trong `apps/api`.

Các secret chỉ tồn tại ở backend/deployment:

```text
PAYOS_CLIENT_ID
PAYOS_API_KEY
PAYOS_CHECKSUM_KEY
```

Web/Mobile không nhận ba giá trị này.

Trong giai đoạn PR #75, DB vẫn lưu `PhuongThucThanhToan='ATM'` cho online bank payment để tương thích dữ liệu/code hiện tại. Contract public bổ sung `paymentProvider='payos'`; UI customer hiển thị payOS. Việc đổi enum DB từ ATM sang PAYOS, nếu cần, là migration riêng sau này.

### 2. payOS `orderCode` được suy ra từ `MaDonHang`, không dùng `DonHang.Id`

payOS yêu cầu `orderCode` kiểu integer. KaitoKid giữ display code dạng:

```text
KK-YYYYMMDD-XXXXXX
```

trong đó `XXXXXX` là 6 ký tự hex. Không được dùng `DonHang.Id` làm payOS orderCode vì AUTO_INCREMENT của DB local/test có thể reset hoặc reuse, trong khi payOS vẫn giữ payment request cũ. Điều đó đã tạo collision `code 231 — Đơn thanh toán đã tồn tại` trong live acceptance của PR #75.

Mapping hiện hành deterministic + reversible:

```text
suffixBase = 16^6
payOS orderCode = YYYYMMDD * suffixBase + hex(XXXXXX)
```

Ví dụ `KK-20261005-DB6E9B` được ánh xạ thành một positive safe integer duy nhất cho chính display code đó. Webhook làm phép đảo để lấy lại `MaDonHang` rồi mới query `DonHang`.

Không thêm bảng/cột mapping mới.

Backend luôn GET payment request theo provider orderCode này trước. Chỉ khi provider trả not-found mới create. SDK create dùng `maxRetries=0` để tránh retry mù sau network timeout. Nếu GET vừa trả business `101` nhưng CREATE trả business `231`, backend bounded-retry GET cùng provider orderCode để recover request vừa được tạo, đồng thời bắt buộc amount phải khớp.

Các request `instructions` đồng thời của cùng một order còn được single-flight trong một Node process để React StrictMode/multi-request không tạo hai chuỗi GET->CREATE cạnh tranh.

### 3. Backend cấp QR/payment link

`GET /api/payment/instructions/:orderCode` vẫn owner-scoped bằng KaitoKid JWT.

Khi payOS active, response có thể gồm:

```text
provider = payos
paymentLinkId
paymentStatus
checkoutUrl
qrCode
qrMode
qrUrl
transferContent
```

`qrUrl` chỉ được render từ raw `qrCode` do payOS trả ở CREATE payment request. `checkoutUrl` là URL web Hosted Checkout, không phải payload VietQR/EMVCo và tuyệt đối không được encode thành QR rồi trình bày như QR ngân hàng.

Vì GET payment request hiện có thể không trả lại raw `qrCode`, backend giữ short-lived in-memory payment cache cho payment vừa CREATE để các request kế tiếp trong cùng vòng thanh toán vẫn dùng đúng QR ngân hàng. Nếu backend restart hoặc không còn raw QR, UI chỉ hiển thị nút mở `checkoutUrl`; không hiển thị QR giả.

Customer Web/Mobile không tự ghép `img.vietqr.io` làm payment authority nữa.

### 4. Webhook payOS là authority xác nhận paid

Public endpoint:

```text
POST /api/payment/payos/webhook
```

Endpoint không dùng KaitoKid JWT vì caller là payOS. Trước khi tin dữ liệu, backend bắt buộc gọi SDK `webhooks.verify()` bằng checksum key.

Sau verify, backend còn kiểm tra:

- `orderCode` đảo được về `DonHang.MaDonHang` theo mapping hiện hành;
- order dùng online payment hiện tại (`ATM` compatibility code);
- `currency == VND`;
- `amount == DonHang.TongTien`;
- webhook transaction code thành công (`00`).

Webhook có orderCode không map được về mã KaitoKid hiện hành được ACK/ignore; backend tuyệt đối không fallback đoán theo `DonHang.Id`, vì ID local có thể đã được reuse sau reset DB.

### 5. Paid transition idempotent

Webhook/reconcile dùng chung payment confirmation path:

1. `SELECT DonHang ... FOR UPDATE`;
2. validate expected amount/method;
3. nếu `NgayThanhToan` đã có thì coi là duplicate idempotent;
4. nếu order đã cancelled thì không revive order;
5. set `NgayThanhToan`, `TrangThai='confirmed'`;
6. append `payment_confirmed` history;
7. chỉ sau paid mới tạo shipping order cho online payment nếu chưa có tracking;
8. gửi payment confirmation email.

Do đó duplicate webhook hoặc webhook + polling reconcile cùng lúc không được double-create shipment hoặc double-run payment transition.

### 6. Mobile/Web không đọc biến động số dư; webhook primary + provider reconcile fallback

Mobile/Web không đọc SMS, notification ngân hàng hoặc balance.

Luồng primary:

```text
Ngân hàng
  -> payOS
  -> signed webhook
  -> Node backend
  -> DonHang.NgayThanhToan + confirmed
  -> Web/Mobile poll KaitoKid backend
  -> success UI
```

Payment screen Mobile/Web có thể poll `/api/payment/status/:orderCode` khoảng 3 giây/lần trong lúc pending, nhưng tần suất client không được ánh xạ 1:1 thành request tới payOS.

Backend giữ provider payment cache và chỉ GET payOS tối đa khoảng một lần mỗi 10 giây cho cùng order trong foreground polling. GET đồng thời của cùng provider orderCode được single-flight. CREATE/GET thành công cập nhật cache; raw QR và checkout metadata được merge vào cache để không mất QR hợp lệ sau GET.

Nếu payOS trả HTTP `429 Too Many Requests`, backend:

- không retry mù ngay lập tức;
- dùng cached provider state nếu có;
- bật exponential cooldown bắt đầu khoảng 15 giây, tăng tối đa khoảng 60 giây nếu tiếp tục bị 429;
- trong cooldown không phát thêm GET provider cho cùng flow;
- khi chưa có cache, trả `503 Service Unavailable` rõ nghĩa thay vì bọc thành `502 Bad Gateway`;
- Web/Mobile payment instructions retry hữu hạn với backoff `5s -> 10s -> 20s`, không yêu cầu người dùng F5 liên tục.

Để local/dev không bị kẹt khi payOS không thể gọi `localhost`, endpoint status còn có fallback reconciliation server-side:

```text
GET /api/payment/status/:orderCode
  -> order owner + pending + unpaid + payOS configured
  -> GET/cached payOS payment request theo throttle ở trên
  -> nếu PAID: validate currency VND + amount == DonHang.TongTien
  -> confirmPaid idempotent với source payos_reconcile
  -> trả paidAt/status confirmed cho client
```

Provider timeout/outage/rate-limit trong polling không biến status endpoint thành 502; backend giữ trạng thái local và tiếp tục ở tick sau. Nếu đã tới expiry thì flow provider-first ở mục 7 vẫn quyết định trước khi hoàn tồn kho/coupon/cart.

Fallback này không thay thế yêu cầu public signed webhook ở production; webhook vẫn là đường xác nhận chủ động và merge gate bắt buộc. Reconcile chỉ là safety net/recovery path.

Mobile có thể mở `checkoutUrl` bằng `expo-web-browser`; QR chỉ hiển thị khi có raw QR payOS hợp lệ.

### 7. Cancel/expiry là provider-first, commerce-second

Với payment payOS đang pending, KaitoKid không được local-cancel rồi hoàn stock/coupon trước khi biết provider chưa nhận tiền.

Customer cancel hoặc payment sweeper:

```text
GET payOS status
  PAID      -> validate VND + amount, confirm paid, không hoàn stock/coupon
  PENDING   -> cancel payOS trước
                 PAID race       -> validate + confirm paid
                 CANCELLED       -> mới cancel commerce
                 trạng thái khác -> fail closed
  CANCELLED -> có thể cancel commerce
  404/no payment link -> local cancel an toàn
```

Chỉ commerce cancel terminal mới restore stock + coupon.

Ngoài restore stock/coupon, pending order bị hủy/hết hạn phải **trả chính các order item về `GioHang` và reserve lại** trong cùng transaction. Lock order là `user -> product -> variant`, đồng nhất với `CartService`, để tránh deadlock/race với thao tác giỏ hàng. Nếu cart đã có cùng product/size/color, quantity được merge; `GiuDenLuc` được cấp lại theo reservation window hiện hành.

### 8. Cart authority khi tạo pending order

Backend là authority của cart. Customer Web không được gọi `clearCart()` sau khi `POST /api/orders` thành công, vì hành vi đó có thể xóa các item không thuộc checkout/partial checkout.

Selected order items có thể được backend consume khỏi `GioHang` khi order transaction thành công; đó là chuyển ownership từ cart sang pending order, không phải mất dữ liệu. Nếu payment bị customer-cancel hoặc expiry thì backend restore chúng về cart như mục 7.

Các item không thuộc checkout phải giữ nguyên. Client chỉ `refreshCart()` sau create order, không tự clear toàn bộ giỏ.

### 9. Shipping boundary

COD giữ behavior hiện tại: tạo shipping order sau khi order được tạo.

Online/payOS: shipping order chỉ được tạo sau payment confirmation. Với Lalamove trong PR #75, flow là:

```text
create KaitoKid order
-> payOS QR/payment link
-> payOS webhook hoặc verified reconcile paid
-> KaitoKid confirmed
-> Lalamove Place Order
```

Không Place Order Lalamove trước khi payOS xác nhận tiền.

### 10. Runtime cutover không phụ thuộc VietQR/Admin bank settings

Từ cutover này, online payment mới chỉ được bật khi backend có đủ `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` và `payosEnabled` không bị đặt thành `false`.

Các key legacy như `bankEnabled`, `enableBankTransfer` hoặc việc tồn tại `bankAccounts` không còn quyền kích hoạt ATM cho đơn mới. Nếu `payosEnabled` chưa tồn tại, backend mặc định bật payOS khi credentials đã được cấu hình.

Điều này tách rõ hai khái niệm:

- **provider availability**: do payOS credentials + `payosEnabled` quyết định;
- **legacy bank data**: chỉ còn để đọc/config migration hoặc xử lý đơn cũ, không phải payment provider hiện hành.

## Legacy VietQR/Admin

Bank/VietQR settings hiện có được giữ tạm để đọc đơn/config legacy trong migration window. Chúng không còn là payment authority và cũng không còn quyền kích hoạt online payment mới.

`VIETQR_CLIENT_ID`/`VIETQR_API_KEY`, Admin bank verification UI và runbook VietQR cũ được xem là legacy migration surface của PR #75. Không mở rộng thêm luồng customer dựa vào VietQR tự ghép hoặc xác nhận thủ công.

## Database impact

Không thêm bảng/cột/schema trong D027.

Các cột hiện có tiếp tục được dùng:

- `DonHang.Id` — internal relational primary key; **không** gửi sang payOS;
- `DonHang.MaDonHang` — display code và source để derive reversible payOS orderCode;
- `DonHang.PhuongThucThanhToan` — hiện giữ `ATM` compatibility code;
- `DonHang.TongTien` — amount authoritative;
- `DonHang.HetHanThanhToan` — local payment expiry;
- `DonHang.NgayThanhToan` — paid authority persisted after verified webhook/reconcile;
- `DonHang.TrangThai` — commerce order state.

## Merge gates

Không merge payment cutover chỉ vì static/build PASS. Live acceptance cần ít nhất:

1. cấu hình credentials payOS local/deploy mà không commit secret;
2. public HTTPS webhook `/api/payment/payos/webhook` được payOS confirm thành công;
3. tạo đơn Web và Mobile, QR/payment link đúng amount;
4. QR hiển thị trên KaitoKid phải là raw QR payOS/VietQR hợp lệ; checkoutUrl không được giả làm QR ngân hàng;
5. reset/reseed local DB không được làm payOS collision do reuse `DonHang.Id`;
6. case GET `101` -> CREATE `231` phải recover idempotent thay vì trả 502;
7. repeated instructions/status polling không được gây burst provider; HTTP 429 phải dùng cache/backoff và không trở thành 502;
8. thanh toán sandbox/live test và webhook chuyển order `pending -> confirmed`;
9. khi webhook local chưa tới, status polling phải recover payment PAID an toàn bằng provider reconcile;
10. Mobile/Web tự sang success sau backend paid;
11. duplicate webhook/reconcile không double side-effect;
12. amount/signature invalid bị reject;
13. cancel pending provider-first hoạt động và item được trả lại giỏ;
14. expiry cũng restore cart reservation đúng một lần;
15. paid-vs-expiry/cancel race không hoàn tồn/coupon/cart sai;
16. paid online tạo shipment đúng một lần;
17. khi thiếu payOS credentials, cấu hình VietQR/bank legacy không làm ATM xuất hiện cho đơn mới;
18. Customer Web không tự `clearCart()` toàn bộ sau create order.
