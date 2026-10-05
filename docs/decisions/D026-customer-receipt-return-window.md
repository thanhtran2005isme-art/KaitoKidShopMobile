# D026 — Carrier giao thành công không đồng nghĩa khách đã nhận hàng

**Ngày:** 2026-10-05

## Quyết định

KaitoKid tách rõ các mốc nghiệp vụ hậu mãi:

1. đơn vị vận chuyển báo giao thành công (`TrangThaiVanChuyen = delivered`);
2. khách hàng xác nhận thực sự đã nhận hàng (`received_by_customer` + `NgayHoanThanh`);
3. khách gửi yêu cầu hoàn (`return_requested`);
4. Admin duyệt/từ chối yêu cầu;
5. hàng hoàn thực tế quay về, được kiểm tra và phân luồng `restock` hoặc `quarantine`;
6. hoàn tiền được đối soát riêng.

Carrier không được tự hoàn tất business order. `NgayHoanThanh` một mình cũng không đủ authority; bằng chứng khách nhận hàng phải có history marker `received_by_customer`.

## Quy tắc khách hàng

- Khi carrier đã báo giao nhưng khách chưa xác nhận, backend trả `canConfirmReceived=true` và `canReportNotReceived=true`.
- `Đã nhận hàng` ghi `NgayHoanThanh`, chuyển `TrangThai=completed`, `TrangThaiVanChuyen=received_by_customer` và bắt đầu cửa sổ hoàn hàng 7 ngày.
- `Chưa nhận được hàng` chuyển vận chuyển sang `delivery_disputed`, giữ business order ở `shipping`, ghi lịch sử để đối soát. Hành động này **không** tự hủy đơn, hoàn tiền, hoàn coupon hay nhập lại tồn kho.
- Polling/webhook carrier không được ghi đè `delivery_disputed`, `received_by_customer` hoặc business state `returned`.

## Review

Review chỉ được tạo khi đơn đúng owner, đúng order/product/variant, `DonHang.TrangThai=completed`, `NgayHoanThanh IS NOT NULL` và tồn tại marker `received_by_customer`.

## Cửa sổ hoàn hàng 7 ngày

- Mốc thời gian duy nhất: thời điểm khách xác nhận nhận hàng.
- Hạn gửi yêu cầu = `NgayHoanThanh + 7 ngày`.
- Customer chỉ được mở một case hoàn cho mỗi đơn. Sau khi case đã được duyệt, từ chối hoặc nhận hàng hoàn, client không tự tạo case mới.
- `return_requested` và các quyết định hậu mãi nằm trong `LichSuTrangThaiVanChuyen`; không thêm enum giả vào `DonHang.TrangThai`.
- Customer DTO trả `returnStatus` theo marker mới nhất thay vì chỉ kiểm tra “đã từng có request hay chưa”.

## Workflow Admin hậu mãi

### 1. Duyệt / từ chối

- Admin chỉ được quyết định khi marker mới nhất là `return_requested`.
- Duyệt ghi `return_approved`; từ chối ghi `return_rejected` cùng ghi chú.
- Bước này **không đụng tồn kho, không đổi `DonHang.TrangThai`, không refund**.

### 2. Nhận hàng hoàn thực tế

Chỉ thực hiện sau `return_approved`. Admin bắt buộc chọn một disposition:

- `restock` → marker `return_received_restock`:
  - cộng lại `SanPham.TonKho`;
  - cộng lại `TonKhoBienThe.SoLuong` đúng size/màu;
  - giảm `SoLuongDaBan` tương ứng;
  - ghi `TonKho_LichSu.LoaiThayDoi='return'`.
- `quarantine` → marker `return_received_quarantine`:
  - **không tăng tồn bán được** của sản phẩm/biến thể;
  - giảm `SoLuongDaBan` vì giao dịch bán đã đảo ngược;
  - ghi inventory audit với tồn trước = tồn sau và mô tả quarantine.

Cả hai nhánh chỉ sau khi nhận hàng thực tế mới chuyển:

- `DonHang.TrangThai = returned`;
- `TrangThaiVanChuyen = returned`;
- tạo marker `refund_pending`.

Transaction phải khóa đơn và các dòng tồn liên quan để chống double click/race làm cộng tồn hai lần.

## Hoàn tiền

Hiện flow hậu mãi này **không giả lập API refund gateway**.

- `refund_pending` chỉ có nghĩa nghiệp vụ cần hoàn tiền/đối soát.
- Admin chỉ bấm “Xác nhận đã hoàn tiền thủ công” sau khi tiền đã được xử lý thực tế bên ngoài hệ thống.
- Hành động đó ghi `refund_completed_manual` kèm mã tham chiếu/ghi chú.
- Marker audit không được mô tả như bằng chứng gateway tự refund.

## Coupon

Hoàn hàng sau giao thành công **không tự trả lượt coupon**. Việc hoàn coupon tự động có thể tạo vòng lặp lạm dụng mua → hoàn → tái dùng voucher. Nếu sau này business muốn trả coupon, phải có policy riêng và contract test riêng.

## Ranh giới quyền Admin

Endpoint cập nhật trạng thái legacy `/api/admin/orders/:id/status` không được phép tạo:

- `completed`: chỉ customer `confirm-received` mới có authority;
- `returned`: chỉ workflow hậu mãi sau khi nhận hàng hoàn mới có authority.

Admin vẫn được vận hành `pending → confirmed → shipping` và hủy theo rule hiện hành.

## Tương thích dữ liệu cũ

Nếu dữ liệu cũ có `TrangThai=completed`, carrier status `delivered/completed` nhưng thiếu marker `received_by_customer`, Customer API phải trình bày đơn như đang chờ khách xác nhận. Receipt-aware Lalamove wrapper phải xóa completion timestamp không có authority thay vì hợp thức hóa nó.

## Hệ quả kỹ thuật

- Không thêm bảng/cột DB mới trong thay đổi này.
- Dùng `DonHang`, `LichSuTrangThaiVanChuyen`, `SanPham`, `TonKhoBienThe`, `TonKho_LichSu` hiện có.
- UI Customer/Admin không tự suy quyền từ label; action được backend/state machine quyết định.
- `returned` là business state đã tồn tại trong schema và chỉ dùng khi hàng hoàn thực tế đã được nhận/kiểm tra.
