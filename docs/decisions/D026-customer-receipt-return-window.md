# D026 — Carrier giao thành công không đồng nghĩa khách đã nhận hàng

**Ngày:** 2026-10-05

## Quyết định

KaitoKid tách hai mốc nghiệp vụ:

1. đơn vị vận chuyển báo giao thành công (`TrangThaiVanChuyen = delivered` hoặc dữ liệu legacy `completed`);
2. khách hàng xác nhận thực sự đã nhận hàng bằng endpoint customer, tạo lịch sử `received_by_customer` và ghi `NgayHoanThanh`.

Carrier không được tự hoàn tất business order. Khi carrier báo `COMPLETED`, đơn vẫn thuộc nhóm `shipping` cho tới khi khách xác nhận nhận hàng.

**Source of truth xác nhận nhận hàng là cặp bằng chứng:**

- `LichSuTrangThaiVanChuyen.TrangThai = received_by_customer` của chính đơn đó; và
- `DonHang.NgayHoanThanh IS NOT NULL`.

Chỉ có timestamp `NgayHoanThanh` mà không có marker `received_by_customer` **không** được coi là khách đã nhận. Quy tắc này ngăn dữ liệu legacy hoặc thao tác Admin vô tình mở review/cửa sổ hoàn hàng thay cho khách.

## Quy tắc khách hàng

- Khi carrier đã báo giao nhưng khách chưa xác nhận, backend trả `canConfirmReceived=true` và `canReportNotReceived=true`.
- `Đã nhận hàng` ghi nguyên tử `NgayHoanThanh`, chuyển `TrangThai=completed`, `TrangThaiVanChuyen=received_by_customer` và insert marker `received_by_customer` trong cùng transaction.
- `Chưa nhận được hàng` chuyển vận chuyển sang `delivery_disputed`, giữ business order ở `shipping`, xóa timestamp hoàn thành legacy nếu có và ghi lịch sử để đối soát. Hành động này **không** tự hủy đơn, hoàn tiền, hoàn coupon hay nhập lại tồn kho.
- Polling/webhook carrier sau đó không được ghi đè `delivery_disputed`, `received_by_customer` hoặc business state `returned`.

## Review

Review chỉ được tạo khi đơn có đủ `DonHang.TrangThai=completed`, `NgayHoanThanh IS NOT NULL` **và** tồn tại marker `received_by_customer`, đồng thời đúng owner, đúng order/product/variant theo D017. Việc khách đã gửi yêu cầu hoàn hàng không làm mất quyền review vì yêu cầu hoàn chỉ là marker hậu mãi trong lịch sử, không đổi business state của `DonHang`.

## Hoàn hàng 7 ngày

- Mốc thời gian duy nhất: `NgayHoanThanh` được ghi cùng lúc với marker `received_by_customer`, tức thời điểm khách thực sự xác nhận đã nhận hàng.
- Hạn gửi yêu cầu = `NgayHoanThanh + 7 ngày`.
- Trong hạn, backend trả `canRequestReturn=true` nếu đã có bằng chứng nhận hàng và chưa có yêu cầu hoàn trước đó.
- Gửi yêu cầu **không đổi `DonHang.TrangThai`**. Backend ghi nguyên tử một marker `TrangThai='return_requested'` cùng lý do vào `LichSuTrangThaiVanChuyen` trong transaction đang khóa đơn.
- Trong khi marker này còn hiệu lực, Customer API trả `returnRequested=true` và `canRequestReturn=false` để không tạo yêu cầu trùng.
- `DonHang.TrangThai` tiếp tục là `completed` trong thời gian chờ xử lý; chỉ khi quy trình hậu mãi thực sự hoàn tất mới dùng business state hiện có `returned`.
- Yêu cầu hoàn không tự động hoàn tiền hay nhập lại tồn kho vì hàng lỗi có thể phải kiểm tra/quarantine trước khi quyết định.

## Tương thích dữ liệu cũ

Nếu dữ liệu cũ có `TrangThai=completed`, carrier status `delivered`/`completed` nhưng chưa có marker `received_by_customer`, Customer API phải trình bày đơn như đang chờ khách xác nhận nhận hàng. Nếu dữ liệu cũ còn có `NgayHoanThanh` do Admin/legacy ghi nhưng không có marker thì timestamp đó cũng không mở review/return; khi khách xác nhận thật, backend ghi lại `NgayHoanThanh` theo thời điểm xác nhận thật.

## Hệ quả kỹ thuật

- Customer Order DTO phải nhận các quyền từ backend: `canConfirmReceived`, `canReportNotReceived`, `canReview`, `canRequestReturn`, `returnRequested` và các mốc `receivedAt`, `returnDeadline`.
- Web/Mobile không tự suy quyền hậu mãi chỉ từ label trạng thái.
- Admin/carrier không được coi việc set `TrangThai=completed` hay ghi timestamp đơn lẻ là bằng chứng khách đã nhận.
- Không thêm bảng/cột/enum mới cho thay đổi này; dùng `DonHang` và `LichSuTrangThaiVanChuyen` hiện có.
