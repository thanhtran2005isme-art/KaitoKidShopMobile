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

### 2. `DonHang.Id` là `orderCode` gửi sang payOS

payOS yêu cầu `orderCode` kiểu integer. `MaDonHang` của KaitoKid là display code dạng chuỗi nên không dùng trực tiếp.

Mapping ổn định:

```text
payOS orderCode = DonHang.Id
KaitoKid display order code = DonHang.MaDonHang
```

Không thêm bảng/cột mapping mới.

Khi cần tạo payment, backend luôn GET payment request theo `DonHang.Id` trước. Chỉ khi provider trả not-found mới create. SDK create được cấu hình `maxRetries=0` để tránh retry mù sau network timeout; request sau sẽ recover bằng GET cùng fixed order code.

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

`qrUrl` là data URL PNG do Node render từ payload QR payOS. Khi payment request vừa create, nguồn QR là `qrCode` payOS. Khi reload và provider GET không trả raw `qrCode`, backend render QR dẫn tới payOS Hosted Checkout để customer vẫn có đường thanh toán ổn định.

Customer Web/Mobile không tự ghép `img.vietqr.io` làm payment authority nữa.

### 4. Webhook payOS là authority xác nhận paid

Public endpoint:

```text
POST /api/payment/payos/webhook
```

Endpoint không dùng KaitoKid JWT vì caller là payOS. Trước khi tin dữ liệu, backend bắt buộc gọi SDK `webhooks.verify()` bằng checksum key.

Sau verify, backend còn kiểm tra:

- `orderCode` map được về `DonHang.Id`;
- order dùng online payment hiện tại (`ATM` compatibility code);
- `currency == VND`;
- `amount == DonHang.TongTien`;
- webhook transaction code thành công (`00`).

Signed sample webhook dùng khi payOS xác minh URL có thể mang `orderCode` không tồn tại tại KaitoKid; backend ACK 2xx nhưng không tạo/cập nhật order giả.

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

Do đó duplicate webhook không được double-create shipment hoặc double-run payment transition.

### 6. Mobile/Web chỉ đồng bộ UI, không đọc biến động số dư

Mobile/Web không đọc SMS, notification ngân hàng hoặc balance.

Luồng authoritative:

```text
Ngân hàng
  -> payOS
  -> signed webhook
  -> Node backend
  -> DonHang.NgayThanhToan + confirmed
  -> Web/Mobile poll KaitoKid backend
  -> success UI
```

Payment screen Mobile/Web poll `/api/payment/status/:orderCode` mỗi khoảng 3 giây trong lúc pending. Polling chỉ là UI freshness fallback; nó không thay webhook verification.

Mobile có thể mở `checkoutUrl` bằng `expo-web-browser`; QR vẫn hiển thị để quét bằng app ngân hàng/thiết bị phù hợp.

### 7. Cancel/expiry là provider-first, commerce-second

Với payment payOS đang pending, KaitoKid không được local-cancel rồi hoàn stock/coupon trước khi biết provider chưa nhận tiền.

Customer cancel hoặc payment sweeper:

```text
GET payOS status
  PAID      -> confirm paid, không hoàn stock/coupon
  PENDING   -> cancel payOS trước
                 PAID race      -> confirm paid
                 CANCELLED      -> mới cancel commerce
                 trạng thái khác -> fail closed
  CANCELLED -> có thể cancel commerce
  404/no payment link -> local cancel an toàn
```

Chỉ commerce cancel terminal mới restore stock + coupon.

### 8. Shipping boundary

COD giữ behavior hiện tại: tạo shipping order sau khi order được tạo.

Online/payOS: shipping order chỉ được tạo sau payment confirmation. Với Lalamove trong PR #75, flow là:

```text
create KaitoKid order
-> payOS QR/payment link
-> payOS webhook paid
-> KaitoKid confirmed
-> Lalamove Place Order
```

Không Place Order Lalamove trước khi payOS xác nhận tiền.

## Legacy VietQR/Admin

Bank/VietQR settings hiện có được giữ tạm để đọc đơn/config legacy trong migration window. Chúng không còn là payment authority khi payOS credentials đã cấu hình.

`VIETQR_CLIENT_ID`/`VIETQR_API_KEY`, Admin bank verification UI và runbook VietQR cũ được xem là legacy work-in-progress của PR #75 và sẽ được retire/simplify dần; không dùng để kết luận rằng online payment mới cần customer tự chuyển khoản thủ công.

## Database impact

Không thêm bảng/cột/schema trong D027.

Các cột hiện có tiếp tục được dùng:

- `DonHang.Id` — payOS integer orderCode;
- `DonHang.MaDonHang` — display code;
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
4. thanh toán sandbox/live test và webhook chuyển order `pending -> confirmed`;
5. Mobile/Web tự sang success sau backend paid;
6. duplicate webhook không double side-effect;
7. amount/signature invalid bị reject;
8. cancel pending provider-first hoạt động;
9. paid-vs-expiry/cancel race không hoàn tồn/coupon sai;
10. paid online tạo shipment đúng một lần.
