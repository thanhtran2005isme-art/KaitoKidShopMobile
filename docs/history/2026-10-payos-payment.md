# 2026-10 — payOS payment cutover trong PR #75

## Bối cảnh

PR #75 ban đầu mở rộng payment `ATM` bằng VietQR động và Admin bank-account verification. Cách đó tạo QR chuyển khoản đúng bank/account/amount/content nhưng không cung cấp payment provider authoritative để KaitoKid tự biết giao dịch ngân hàng đã hoàn tất.

Ngày 2026-10-05, nhánh `feat/admin-lalamove-carrier` được tiếp tục theo hướng **payOS là online payment provider hiện hành**. Phần VietQR cũ được giữ tạm như legacy migration surface cho config/đơn cũ, nhưng không còn là payment authority của Customer Web/Mobile khi payOS đã cấu hình.

## Backend

- thêm SDK chính thức `@payos/node` trong `apps/api`;
- credentials `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` chỉ nằm ở backend/deployment;
- `DonHang.Id` được dùng làm integer `orderCode` của payOS, còn `MaDonHang` vẫn là mã hiển thị cho khách;
- `GET /api/payment/instructions/:orderCode` tạo hoặc recover payment request theo fixed `DonHang.Id` và trả QR/payment link cho chính chủ đơn;
- Node render QR data URL từ payOS payload để Web/Mobile không tự dựng QR bằng bank/account;
- thêm public `POST /api/payment/payos/webhook`, không dùng KaitoKid JWT nhưng bắt buộc SDK verify checksum signature;
- webhook kiểm tra mapping order, VND và exact `TongTien` trước khi chuyển paid;
- paid transition vẫn dùng `FOR UPDATE`, `NgayThanhToan` làm persisted idempotency marker và không double-run shipment/email trên duplicate webhook;
- cancel và payment expiry chuyển sang provider-first: đối soát/cancel payOS trước, chỉ restore stock/coupon sau khi provider xác nhận chưa paid/đã cancelled;
- online payment chỉ tạo shipping order sau paid, phù hợp Lalamove lifecycle đã harden trong cùng PR.

## Customer Web

- PaymentStep không còn tự ghép `img.vietqr.io` làm QR chính;
- dùng `qrUrl`, `checkoutUrl`, `paymentLinkId` do backend authoritative trả;
- hiển thị payOS rõ ràng;
- poll KaitoKid payment status khoảng 3 giây trong lúc pending;
- browser return URL không tự đánh dấu paid;
- customer cancel vẫn đi qua backend provider-first.

## Mobile/Expo

- màn `checkout/payment` hiển thị QR payOS do backend trả;
- có nút mở payOS Hosted Checkout bằng `expo-web-browser`;
- poll KaitoKid backend khoảng 3 giây trong lúc pending;
- khi signed webhook đã làm `paidAt` xuất hiện, Mobile tự điều hướng sang `order-success/[orderCode]`;
- không đọc SMS, notification ngân hàng hay biến động số dư trên thiết bị;
- DEV simulate chỉ giữ cho local/test khi backend cho phép.

## Compatibility

Trong PR #75 chưa migrate enum/cột payment DB sang `PAYOS`; `PhuongThucThanhToan='ATM'` vẫn là compatibility code cho online bank payment. Public API/UI phân biệt provider bằng `paymentProvider='payos'`/`provider='payos'`.

Không thêm bảng/cột/schema cho cutover này.

## Validation

Contract mới được khóa bằng `apps/api/test/payos-payment-contract.test.mjs` và ghép vào `npm --prefix apps/api run test:checkout-order`.

GitHub Actions đã xác nhận API checkout/Lalamove/payment/payOS contract build PASS trong vòng triển khai đầu. Mobile lint + typecheck cũng PASS; Web build phát hiện một lỗi barrel export type `PaymentInstructions` và đã được sửa ngay trên nhánh, sau đó CI được chạy lại.

## Live gate còn bắt buộc

Static/CI xanh không chứng minh tiền thật đã đi qua provider. PR #75 tiếp tục Draft/Open cho tới khi có:

- payOS credentials đúng Payment Channel ngoài Git;
- public HTTPS webhook được payOS confirm;
- Web + Mobile tạo QR/payment link đúng amount;
- giao dịch sandbox/live test phát webhook verified và tự chuyển UI thành công;
- duplicate webhook, invalid signature/amount, cancel-vs-paid, expiry-vs-paid race PASS;
- paid online tạo Lalamove shipment đúng một lần.

Durable decision: `docs/decisions/D027-payos-payment-lifecycle.md`.
Runbook: `docs/runbooks/PAYOS_PAYMENT_E2E.md`.
