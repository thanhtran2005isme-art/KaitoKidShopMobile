# Admin Settings — Payment / payOS

## Mục tiêu hiện hành

Online payment của Customer Web/Mobile dùng **payOS làm provider** theo D027. Admin Settings không phải nơi nhập hoặc hiển thị secret payOS và không phải nơi tự tạo QR chuyển khoản.

Payment tab nên tập trung vào hai capability mà shop có thể bật/tắt:

- COD;
- Online payment qua payOS.

Backend/deployment là source of truth cho trạng thái credentials/provider.

## payOS status

Payment tab khi hoàn tất cutover nên hiển thị status card đơn giản:

```text
payOS
Provider status: Sẵn sàng / Thiếu cấu hình
Webhook: cần nghiệm thu public HTTPS ngoài UI
```

Không hiển thị:

- `PAYOS_CLIENT_ID`;
- `PAYOS_API_KEY`;
- `PAYOS_CHECKSUM_KEY`;
- raw secret/token provider.

Secret chỉ đặt trong `apps/api/.env` local hoặc deployment secrets.

## QR/customer payment

Admin không upload QR để làm payment authority.

Customer checkout lấy payment instructions owner-scoped từ Node backend. Backend tạo/recover payment request payOS và trả QR/payment link đúng order/amount. Web/Mobile chỉ render dữ liệu đó.

Browser callback không tự đánh dấu paid; signed payOS webhook + backend persisted state mới là authority.

## Legacy VietQR/bank-account UI

PR #75 từng có bank selector + VietQR lookup + account-holder verification + QR upload fallback. Phần này là **legacy work-in-progress trước D027**, không còn là target UX của online payment mới.

Trong migration window, source code/config cũ có thể còn tồn tại để tránh phá dữ liệu lịch sử, nhưng:

- Customer payment không được phụ thuộc vào catalog/lookup VietQR Admin;
- không mở rộng thêm bank slot/QR-upload flow;
- không mô tả VietQR lookup là payment provider hiện hành;
- cleanup tiếp theo phải thu gọn Payment tab về COD + payOS capability/status thay vì duy trì hai nguồn cấu hình cạnh tranh.

## Trạng thái UI mục tiêu

- COD enabled/disabled;
- payOS enabled/disabled theo store setting nếu cần;
- provider configured/unconfigured do backend trả;
- loading/error/retry khi đọc config;
- cảnh báo rõ nếu bật online payment nhưng backend thiếu payOS credentials;
- save không bao giờ gửi/ghi secret payOS.

## Customer success feedback

Admin UI không tham gia xác nhận giao dịch. Flow đúng là:

```text
Bank -> payOS -> signed webhook -> Node -> DonHang paid/confirmed
                                  -> Web/Mobile status refresh -> success
```

Do đó không thêm nút Admin/Customer kiểu “Tôi đã chuyển khoản” để thay thế webhook trong production.
