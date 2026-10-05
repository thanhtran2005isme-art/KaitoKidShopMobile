# VietQR Bank Verification — LEGACY PR #75

> **Trạng thái:** Superseded cho Customer payment bởi D027/payOS từ 2026-10-05.

Runbook này được giữ lại để giải thích phần code/config VietQR đã tồn tại trong giai đoạn trước của PR #75. Nó **không còn là acceptance path của online payment hiện hành**.

## Trước D027

PR #75 từng triển khai:

```text
Admin Settings → Payment
  → GET /api/admin/payment/banks
  → chọn ngân hàng từ catalog VietQR
  → nhập STK 6–19 chữ số
  → POST /api/admin/payment/lookup-account
  → backend gọi VietQR /v2/lookup
  → nhận accountName
  → lưu bank/account
  → Customer tự dựng VietQR theo order amount/content
```

Mục tiêu khi đó là giảm lỗi nhập tay bank/account, nhưng flow này không cung cấp payment webhook authoritative để KaitoKid tự biết giao dịch ngân hàng đã thành công.

## Trạng thái hiện hành

Online payment mới dùng payOS:

```text
Customer Web/Mobile
  → KaitoKid Node tạo/recover payOS payment request
  → backend trả QR/payment link payOS
  → khách thanh toán
  → payOS signed webhook
  → Node verify signature + amount + order
  → DonHang.NgayThanhToan / confirmed
  → Web/Mobile tự refresh success
```

Runbook phải dùng cho merge gate hiện tại:

```text
docs/runbooks/PAYOS_PAYMENT_E2E.md
```

Durable decision:

```text
docs/decisions/D027-payos-payment-lifecycle.md
```

## Legacy code/config còn trong migration window

Các surface sau có thể vẫn còn trên branch trong lúc cleanup để không phá dữ liệu/config cũ:

- `VIETQR_BASE_URL`;
- `VIETQR_CLIENT_ID` / `VIETQR_API_KEY`;
- `GET /api/admin/payment/banks`;
- `POST /api/admin/payment/lookup-account`;
- Admin bank selector/account-holder verification/QR upload;
- `bankAccounts` trong `CauHinhCuaHang`.

Khi payOS đã cấu hình, các phần trên **không được** dùng làm payment authority cho Customer checkout và không được mở rộng thêm như kiến trúc hiện hành.

## Không còn là merge gate

Các acceptance cũ sau đây không còn quyết định việc merge payment cutover:

- VietQR lookup STK thật;
- dynamic `img.vietqr.io` là QR chính;
- QR upload làm fallback customer payment;
- Customer Web/Mobile phụ thuộc Admin bank account.

Chúng được thay bằng payOS credential + public webhook + signed payment E2E trong `PAYOS_PAYMENT_E2E.md`.
