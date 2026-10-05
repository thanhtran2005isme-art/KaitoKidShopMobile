# Admin Settings — Payment bank verification

Page: `/admin/settings` → tab Thanh toán.

## Durable rules

- Không dùng text input tự do cho tên ngân hàng; phải chọn từ catalog VietQR do backend trả.
- Chỉ hiện bank hỗ trợ cả chuyển khoản VietQR và account lookup.
- Số tài khoản dùng numeric input, 6–19 chữ số.
- Đổi bank hoặc STK phải xóa trạng thái verified/account holder cũ.
- Account holder là read-only và chỉ được điền từ kết quả lookup backend.
- Có state rõ ràng: chưa xác minh / đang xác minh / đã xác minh / lỗi.
- Khi bật chuyển khoản, nút Save phải xác minh lại mọi bank slot; bất kỳ slot nào fail thì không lưu Payment.
- Chi nhánh là metadata tùy chọn, không được dùng để chứng minh tài khoản hợp lệ.
- VietQR động theo đơn là QR chính; ảnh QR Admin chỉ là fallback.
- Credential VietQR không bao giờ xuất hiện ở Web bundle hoặc response Admin.

## Interaction

1. Mở tab Payment → tải bank catalog.
2. Chọn bank → reset holder + verified state.
3. Nhập STK → chỉ giữ chữ số; onBlur tự lookup khi đủ điều kiện.
4. Có nút `Xác minh tài khoản` để retry rõ ràng.
5. Thành công → show account holder + success state.
6. Save → re-verify all active bank slots trước khi persist.

Giữ form responsive, persistent labels, field-local feedback và control cao tối thiểu 44px theo `MASTER.md`/`docs/UI_UX.md`.
