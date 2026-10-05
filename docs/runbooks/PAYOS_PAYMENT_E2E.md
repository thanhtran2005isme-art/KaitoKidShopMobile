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

## 4. Customer Web acceptance

1. Login customer.
2. Thêm hàng và checkout.
3. Chọn online bank payment hiện hành (DB compatibility code vẫn là `ATM`).
4. Tạo order.
5. Màn payment phải hiển thị payOS, amount đúng `DonHang.TongTien`, QR/payment link có thể mở.
6. Không được gọi/read `/api/admin/settings` từ Customer payment.
7. Thanh toán bằng QR/payment link.
8. payOS webhook phải cập nhật order `pending -> confirmed`.
9. Web poll KaitoKid backend và chuyển success mà không cần nút “Tôi đã thanh toán”.

## 5. Mobile acceptance

1. Login Mobile.
2. Cart -> Checkout -> chọn online payment -> Create Order.
3. `checkout/payment` hiển thị QR payOS.
4. Nút `Mở trang thanh toán payOS` mở hosted checkout bằng `expo-web-browser`.
5. Thanh toán từ app ngân hàng/thiết bị phù hợp.
6. Mobile poll `/api/payment/status/:orderCode` khoảng 3 giây/lần trong lúc pending.
7. Sau webhook verified + DB paid, Mobile tự điều hướng tới `order-success/[orderCode]`.
8. Mobile không xin quyền đọc SMS/notification/balance ngân hàng.

## 6. Security/idempotency acceptance

Phải chứng minh:

- signature invalid -> reject;
- signed webhook unknown order -> ACK/ignore, không mutate DB;
- amount mismatch -> reject;
- currency khác VND -> reject;
- duplicate paid webhook -> `NgayThanhToan` không bị side-effect lặp;
- shipment không được tạo hai lần do duplicate webhook;
- order cancelled không bị revive bởi manual forged request.

## 7. Cancel/expiry race

### Pending chưa trả tiền

- Customer cancel -> backend GET payOS -> cancel provider -> chỉ sau `CANCELLED` mới restore stock/coupon.

### Tiền vào đúng lúc cancel

- Provider trả `PAID` hoặc cancel response cho thấy `PAID` -> KaitoKid confirm paid; không restore stock/coupon.

### Payment hết hạn

- Sweeper phải đối soát payOS trước.
- Nếu `PAID` -> confirm.
- Nếu `PENDING` -> cancel provider trước.
- Nếu provider chưa terminal -> fail closed, không hoàn tồn/coupon.

## 8. Shipping/Lalamove acceptance

Online order chưa paid:

```text
trackingCode phải chưa được tạo bởi payment flow
```

Sau verified paid:

```text
payment_confirmed
-> createShippingOrder
-> Lalamove Place Order nếu provider đã chọn là Lalamove
```

Chứng minh shipment chỉ được tạo một lần.

## 9. Automated gates

```bat
npm --prefix apps\api run test:checkout-order
npm --prefix apps\web run lint
npm --prefix apps\web run build
npm --prefix apps\mobile run lint
npm --prefix apps\mobile run typecheck
```

Giữ thêm các race gate hiện có khi test DB sẵn sàng:

```bat
scripts\node-concurrency-race-gate.bat
scripts\node-realtime-runtime-gate.bat
```

## 10. Merge gate

PR #75 tiếp tục Draft/Open cho đến khi:

- automated gates PASS;
- payOS credentials thật/test channel đã được cấu hình ngoài Git;
- public webhook được confirm;
- Web + Mobile payment E2E PASS;
- cancel/expiry race PASS;
- payOS paid -> Lalamove shipment PASS.
