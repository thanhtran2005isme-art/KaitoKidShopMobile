# 2026-10 — Lalamove lifecycle hardening

## 2026-10-04 — PR #75 mở rộng từ Admin Shipping thành carrier lifecycle

PR #75 ban đầu chỉ mô tả cấu hình/test kết nối Lalamove. Trong quá trình rà code thật, branch đã có quotation ở checkout nhưng chưa có Place Order và mô tả PR đã lệch source.

Thay đổi durable trên branch `feat/admin-lalamove-carrier`:

- giữ credentials Lalamove ở backend env;
- quotation Lalamove tham gia `provider=all` cho Customer Web và Mobile;
- checkout tiếp tục revalidate fee server-side theo D015;
- service code public giữ ổn định theo service type; Place Order re-quote backend từ `DonHang`, không tin quotation/fee client;
- `POST /v3/orders` dùng quotation + stopId thật, bật POD và metadata KaitoKid;
- persist `orderId`, `shareLink`, `quotationId`, provider/status vào các cột shipping hiện có của `DonHang`; không đổi schema/table count;
- thêm `POST /api/shipping/lalamove/webhook`, verify HMAC, dedupe bằng `eventId` trong shipping history và chống out-of-order state regression;
- owner tracking sync `GET /v3/orders/{id}` khi đã có `MaVanDon`;
- hardening Place Order bằng atomic claim `lalamove_placing`; nếu outcome của request không xác định thì chuyển `lalamove_place_unknown` và khóa auto-retry để tránh tạo hai vận đơn thật;
- tracking không còn tự phát lại Place Order khi `MaVanDon` rỗng;
- webhook cùng Lalamove order được serialize trong Node process trước duplicate/stale guard; nếu runtime scale nhiều writer thì phải nâng lên DB/distributed idempotency trước;
- customer cancel gọi Lalamove trước, chỉ hủy KaitoKid/restore stock-coupon khi carrier cho phép;
- shipping simulator loại trừ `NhaVanChuyen=lalamove`;
- thêm contract test cho HMAC, quotation, Place Order, persistence, tracking, cancel, webhook, duplicate-order guard và simulator guard;
- quyết định chi tiết: `docs/decisions/D025-lalamove-shipment-lifecycle.md`.

## 2026-10-05 — Tách carrier delivered khỏi customer received

Sau live UI test, phát hiện `Lalamove COMPLETED` đang đẩy `DonHang.TrangThai=completed` ngay cả khi khách chưa xác nhận thực nhận hàng. Điều này làm đơn nhảy thẳng sang Hoàn thành, mở review sai thời điểm và không có nhánh khiếu nại “chưa nhận được hàng”.

Đã bổ sung ranh giới hậu mãi:

- carrier `COMPLETED` chỉ được coi là `delivered`; Customer API trình bày đơn là đang chờ xác nhận nếu `NgayHoanThanh IS NULL`;
- thêm `POST /api/orders/:id/confirm-received`; chỉ hành động này mới ghi `NgayHoanThanh`, chuyển `received_by_customer` và bắt đầu cửa sổ hoàn hàng 7 ngày;
- thêm `POST /api/orders/:id/report-not-received`; ghi `delivery_disputed`, giữ order ở `shipping`, không tự hủy/hoàn tồn/coupon/refund;
- thêm `POST /api/orders/:id/return-request`; chỉ cho phép trong 7 ngày từ `NgayHoanThanh`, ghi `return_requested` và lý do vào lịch sử;
- wrapper receipt-aware giữ `delivery_disputed`, `received_by_customer`, `return_requested`, `returned` khỏi bị polling/webhook carrier ghi đè;
- review yêu cầu `NgayHoanThanh IS NOT NULL`; vẫn cho review khi return request đang xử lý;
- Customer Web có action trực tiếp `Đã nhận hàng`, `Chưa nhận được hàng`, `Đánh giá`, `Hoàn hàng`; tracking reload danh sách ngay sau sync;
- dữ liệu cũ `completed + delivered + NgayHoanThanh NULL` được tương thích bằng effective state, không reset DB;
- không thêm bảng/cột mới; quyết định durable ở `docs/decisions/D026-customer-receipt-return-window.md`.

## Gate còn mở

Không merge PR #75 cho tới khi chạy thật sandbox với credentials `pk_test/sk_test`, webhook public và xác nhận flow cả Customer Web `:5173` lẫn Mobile/Expo `:8081`. Việc static review/contract source không được ghi nhận thay cho sandbox E2E.
