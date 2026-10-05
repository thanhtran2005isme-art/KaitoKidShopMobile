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
- quyết định chi tiết: `docs/decisions/D025-lalamove-shipment-lifecycle.md`.

## 2026-10-05 — Tách carrier delivered khỏi customer received

Sau live UI test, phát hiện `Lalamove COMPLETED` đang đẩy `DonHang.TrangThai=completed` ngay cả khi khách chưa xác nhận thực nhận hàng. Điều này làm đơn nhảy thẳng sang Hoàn thành, mở review sai thời điểm và không có nhánh khiếu nại “chưa nhận được hàng”.

Đã bổ sung ranh giới hậu mãi:

- carrier `COMPLETED` chỉ được coi là `delivered`; Customer API trình bày đơn là đang chờ xác nhận nếu thiếu customer receipt marker;
- `POST /api/orders/:id/confirm-received` là action duy nhất ghi customer receipt + `NgayHoanThanh` và bắt đầu cửa sổ hoàn hàng 7 ngày;
- `POST /api/orders/:id/report-not-received` ghi `delivery_disputed`, giữ order ở `shipping`, không tự hủy/hoàn tồn/coupon/refund;
- `POST /api/orders/:id/return-request` ghi `return_requested` vào history, không đổi enum `DonHang.TrangThai`;
- receipt-aware Lalamove wrapper không coi timestamp legacy/Admin là customer receipt nếu thiếu marker `received_by_customer`;
- review yêu cầu customer receipt marker + `NgayHoanThanh` + `completed`;
- Customer Web + Mobile có action `Đã nhận hàng`, `Chưa nhận được hàng`, `Đánh giá`, `Yêu cầu hoàn hàng` theo quyền backend;
- simulator non-Lalamove tới `delivered` vẫn giữ order ở `shipping`;
- không thêm bảng/cột/enum mới; quyết định durable ở `docs/decisions/D026-customer-receipt-return-window.md`.

## 2026-10-05 — Khép kín Admin after-sales: duyệt → nhận hàng → quarantine/restock → refund audit

Rà Admin thật phát hiện endpoint status legacy và UI vẫn cho `shipping → completed`, tức có thể bypass D026. Đồng thời customer `returnRequested` trước đó chỉ kiểm tra marker đã từng tồn tại nên case bị từ chối vẫn có thể hiển thị như đang chờ.

Đã thiết kế/triển khai trên branch:

- chặn Admin tự đặt `completed` hoặc `returned` qua endpoint status legacy bằng interceptor chạy sau auth/guards;
- thêm Admin after-sales API riêng:
  - xem case/timeline;
  - duyệt `return_approved`;
  - từ chối `return_rejected`;
  - nhận hàng thực tế với `return_received_restock` hoặc `return_received_quarantine`;
  - ghi `refund_pending` và `refund_completed_manual`;
- quyết định duyệt/từ chối không đụng tồn kho;
- chỉ sau khi hàng hoàn thực tế quay về mới đổi business order sang `returned`;
- `restock` cộng lại tồn sản phẩm + biến thể và giảm số đã bán;
- `quarantine` không cộng tồn bán được, vẫn giảm số đã bán và ghi audit `TonKho_LichSu.LoaiThayDoi='return'`;
- hoàn hàng không tự trả lượt coupon;
- hệ thống không giả refund gateway: `refund_completed_manual` chỉ là audit sau khi Admin có mã tham chiếu/biên nhận thực tế;
- Admin Orders dùng workspace hậu mãi riêng và không còn nút chuyển nhanh `shipping → completed`;
- Customer projection dùng marker hoàn hàng mới nhất, không dùng boolean “đã từng request” vĩnh viễn;
- Mobile nhận nhãn `returned` và không tiếp tục thanh toán ATM cho đơn đã trả.

## 2026-10-05 — Đồng bộ trạng thái return/refund về Customer Web + Mobile

Sau khi Admin workflow đã khép kín, rà UI khách hàng cho thấy Web/Mobile vẫn có thể chỉ hiện “Đã yêu cầu hoàn hàng” dù case đã được duyệt, từ chối, nhận hàng hoàn hoặc chuyển sang chờ hoàn tiền.

Đã đồng bộ projection và UI:

- Customer backend trả `returnStatus` theo marker return mới nhất: `none/requested/approved/rejected/received_restock/received_quarantine`;
- Customer backend trả `refundStatus` theo marker refund mới nhất: `none/pending/completed`;
- `refundStatus` có độ ưu tiên hiển thị cao hơn `returnStatus`, vì phản ánh bước hậu mãi mới hơn;
- Customer Web card + modal chi tiết hiển thị đúng trạng thái đang chờ duyệt, đã duyệt, bị từ chối, đã nhận hàng hoàn, quarantine/restock, chờ hoàn tiền và đã ghi nhận hoàn tiền;
- Mobile card + màn chi tiết dùng chung `afterSalesStatusMeta`, tránh mỗi màn tự map trạng thái khác nhau;
- copy quarantine nhấn mạnh hàng lỗi **không được cộng vào tồn bán được**;
- copy refund completed nói rõ đây là **Admin xác nhận hoàn tiền thủ công**, không phải bằng chứng gateway tự refund;
- contract checkout/order khóa `latestReturnById`, `latestRefundById`, `returnStatus` và `refundStatus` để tránh regression projection;
- không thay schema/table count.

Automated validation trên code head `7f8755d0ebc3080c385ad27b02400341a43ac6af`:

- API checkout/Lalamove/after-sales contracts run `37252559011`: **PASS**;
- Client checks run `37252559002`: Customer Web lint/build **PASS**, Mobile lint/typecheck **PASS**.

## Gate còn mở

Không merge PR #75 cho tới khi chạy thật sandbox với credentials `pk_test/sk_test`, webhook public và xác nhận flow cả Customer Web `:5173` lẫn Mobile/Expo `:8081`. Static review/contract source không thay thế sandbox E2E.
