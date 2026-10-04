# D026 — Carrier giao thành công không đồng nghĩa khách đã nhận hàng

**Ngày:** 2026-10-05

## Quyết định

KaitoKid tách hai mốc nghiệp vụ:

1. đơn vị vận chuyển báo giao thành công (`TrangThaiVanChuyen = delivered`);
2. khách hàng xác nhận thực sự đã nhận hàng (`TrangThaiVanChuyen = received_by_customer`).

Carrier không được tự hoàn tất business order. Khi carrier báo `COMPLETED`, đơn vẫn thuộc nhóm `shipping` cho tới khi khách xác nhận nhận hàng hoặc nhân viên xử lý thủ công theo nghiệp vụ hỗ trợ.

## Quy tắc khách hàng

- Khi carrier đã báo giao nhưng khách chưa xác nhận, backend trả `canConfirmReceived=true` và `canReportNotReceived=true`.
- `Đã nhận hàng` ghi `NgayHoanThanh`, chuyển `TrangThai=completed`, `TrangThaiVanChuyen=received_by_customer` và bắt đầu cửa sổ hoàn hàng.
- `Chưa nhận được hàng` chuyển vận chuyển sang `delivery_disputed`, giữ business order ở `shipping`, ghi lịch sử để đối soát. Hành động này **không** tự hủy đơn, hoàn tiền, hoàn coupon hay nhập lại tồn kho.
- Polling/webhook carrier sau đó không được ghi đè `delivery_disputed`, `received_by_customer`, `return_requested` hoặc `returned`.

## Review

Review chỉ được tạo khi đơn có `NgayHoanThanh IS NOT NULL`, đúng owner, đúng order/product/variant theo D017. Quyền review vẫn giữ khi yêu cầu hoàn đang ở `return_requested`; chưa nhận hàng, cancelled hoặc returned không mở review mới.

## Hoàn hàng 7 ngày

- Mốc thời gian duy nhất: `NgayHoanThanh`, tức thời điểm khách xác nhận đã nhận hàng.
- Hạn gửi yêu cầu = `NgayHoanThanh + 7 ngày`.
- Trong hạn, backend trả `canRequestReturn=true`.
- Gửi yêu cầu chuyển business state sang `return_requested` và ghi lý do vào `LichSuTrangThaiVanChuyen`.
- `return_requested` chỉ là yêu cầu hậu mãi. Không tự động hoàn tiền hay nhập lại tồn kho vì hàng lỗi có thể phải kiểm tra/quarantine trước khi quyết định.

## Tương thích dữ liệu cũ

Nếu dữ liệu cũ có `TrangThai=completed`, carrier status `delivered` nhưng `NgayHoanThanh IS NULL`, API Customer phải trình bày đơn như đang chờ khách xác nhận nhận hàng. Không cần reset hoặc sửa tay database.

## Hệ quả kỹ thuật

- Customer Order DTO phải nhận các quyền từ backend: `canConfirmReceived`, `canReportNotReceived`, `canReview`, `canRequestReturn` và các mốc `receivedAt`, `returnDeadline`.
- UI không tự suy quyền hậu mãi chỉ từ label trạng thái.
- `NgayHoanThanh` là mốc hậu mãi quan trọng; code carrier không được tự ghi trường này.
- Không thêm bảng/cột mới cho thay đổi này; dùng các cột `DonHang` và lịch sử vận chuyển hiện có.
