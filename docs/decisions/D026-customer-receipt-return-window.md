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
- Polling/webhook carrier sau đó không được ghi đè `delivery_disputed`, `received_by_customer` hoặc business state `returned`.

## Review

Review chỉ được tạo khi đơn có `NgayHoanThanh IS NOT NULL`, đúng owner, đúng order/product/variant theo D017 và `DonHang.TrangThai=completed`. Việc khách đã gửi yêu cầu hoàn hàng không làm mất quyền review vì yêu cầu hoàn chỉ là marker hậu mãi trong lịch sử, không đổi business state của `DonHang`.

## Hoàn hàng 7 ngày

- Mốc thời gian duy nhất: `NgayHoanThanh`, tức thời điểm khách xác nhận đã nhận hàng.
- Hạn gửi yêu cầu = `NgayHoanThanh + 7 ngày`.
- Trong hạn, backend trả `canRequestReturn=true` nếu chưa có yêu cầu hoàn trước đó.
- Gửi yêu cầu **không đổi `DonHang.TrangThai`**. Backend ghi nguyên tử một marker `TrangThai='return_requested'` cùng lý do vào `LichSuTrangThaiVanChuyen` trong transaction đang khóa đơn.
- Trong khi marker này còn hiệu lực, Customer API trả `returnRequested=true` và `canRequestReturn=false` để không tạo yêu cầu trùng.
- `DonHang.TrangThai` tiếp tục là `completed` trong thời gian chờ xử lý; chỉ khi quy trình hậu mãi thực sự hoàn tất mới dùng business state hiện có `returned`.
- Yêu cầu hoàn không tự động hoàn tiền hay nhập lại tồn kho vì hàng lỗi có thể phải kiểm tra/quarantine trước khi quyết định.

## Tương thích dữ liệu cũ

Nếu dữ liệu cũ có `TrangThai=completed`, carrier status `delivered` nhưng `NgayHoanThanh IS NULL`, API Customer phải trình bày đơn như đang chờ khách xác nhận nhận hàng. Không cần reset hoặc sửa tay database.

## Hệ quả kỹ thuật

- Customer Order DTO phải nhận các quyền từ backend: `canConfirmReceived`, `canReportNotReceived`, `canReview`, `canRequestReturn`, `returnRequested` và các mốc `receivedAt`, `returnDeadline`.
- UI không tự suy quyền hậu mãi chỉ từ label trạng thái.
- `NgayHoanThanh` là mốc hậu mãi quan trọng; code carrier không được tự ghi trường này.
- Không thêm bảng/cột/enum mới cho thay đổi này; dùng `DonHang` và `LichSuTrangThaiVanChuyen` hiện có.
