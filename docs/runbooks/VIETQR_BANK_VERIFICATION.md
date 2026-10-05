# VietQR Bank Verification — Admin Payment

## Mục tiêu

Admin không được gõ tự do tên ngân hàng hoặc tên chủ tài khoản nhận tiền.

Luồng chuẩn:

```text
Admin Settings → Payment
  → GET /api/admin/payment/banks
  → chọn ngân hàng từ catalog VietQR
  → nhập STK 6–19 chữ số
  → POST /api/admin/payment/lookup-account
  → backend gọi VietQR /v2/lookup
  → nhận accountName thật
  → khóa trường Chủ tài khoản
  → xác minh lại toàn bộ bank slot khi bấm Lưu
```

Nếu lookup thất bại hoặc STK sai, UI không lưu cấu hình Payment.

## Backend secrets

Thêm vào `apps/api/.env` (không commit giá trị thật):

```env
VIETQR_BASE_URL=https://api.vietqr.io/v2
VIETQR_CLIENT_ID=...
VIETQR_API_KEY=...
```

Client ID / API Key lấy từ My VietQR theo tài liệu VietQR. Hai giá trị này chỉ được dùng ở Node backend.

## Endpoint nội bộ KaitoKid

- `GET /api/admin/payment/banks`
  - yêu cầu staff JWT + `settings.view`;
  - backend proxy catalog VietQR;
  - cache in-process 24 giờ;
  - Web chỉ cho chọn bank có `transferSupported=true` và `lookupSupported=true`.

- `POST /api/admin/payment/lookup-account`
  - yêu cầu staff JWT + `settings.manage`;
  - body `{ bankBin, accountNumber }`;
  - STK chỉ nhận 6–19 chữ số;
  - backend giữ secret và gọi VietQR `/v2/lookup`;
  - thành công trả canonical bank + `accountName`.

## QR checkout

Xác minh tài khoản và sinh QR là hai việc tách biệt:

1. Admin xác minh bank + STK + account holder trước khi lưu.
2. Customer Web/Mobile vẫn ưu tiên VietQR động theo số tiền + nội dung từng đơn.
3. Ảnh QR Admin upload/dán URL chỉ là fallback khi VietQR động không tải được.

Không dùng ảnh QR tĩnh để suy ra hoặc xác minh tên chủ tài khoản.

## Troubleshooting

### Danh sách ngân hàng không tải

- kiểm tra Node API có internet;
- kiểm tra `VIETQR_BASE_URL`;
- thử lại `GET /api/admin/payment/banks` khi đang đăng nhập Admin.

### Báo thiếu VIETQR_CLIENT_ID / VIETQR_API_KEY

Điền credential thật vào `apps/api/.env`, restart Node API rồi bấm `Xác minh tài khoản` lại.

### STK đúng nhưng lookup thất bại

- xác nhận bank được chọn đúng;
- chỉ nhập chữ số, không khoảng trắng/dấu chấm;
- một số bank không hỗ trợ lookup; UI KaitoKid đã loại các bank đó khỏi danh sách selectable;
- nếu VietQR rate-limit, đợi rồi thử lại; không bỏ qua bước xác minh bằng cách nhập tay account holder.

## Acceptance local bắt buộc trước merge

- chọn ngân hàng thật từ dropdown, không nhập chuỗi tự do;
- nhập STK thật → lookup phải trả đúng chủ tài khoản;
- đổi STK hoặc đổi ngân hàng → trạng thái verified cũ bị xóa ngay;
- nhập sai STK → báo lỗi và không cho lưu Payment;
- reload Admin sau khi lưu phải giữ đúng bank BIN/code/STK/chủ tài khoản;
- tạo đơn ATM trên Web + Mobile và xác nhận VietQR động dùng đúng bank/STK/số tiền/nội dung;
- QR upload/URL chỉ được dùng khi ảnh VietQR động tải lỗi.

CI PR #75 đã khóa `admin-vietqr-contract.test.mjs`; build/API/Web/Mobile pass không thay thế acceptance lookup thật vì credential thật không được đưa vào CI.
