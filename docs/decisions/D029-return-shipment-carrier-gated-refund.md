# D029 — Vận đơn hoàn chiều khách → shop, hoàn tiền sau khi hãng xác nhận

Ngày: 2026-10-13. Trạng thái: triển khai source; **chưa nghiệm thu live sandbox hoặc áp dụng DB migration trên máy phát triển**.

## Ranh giới nghiệp vụ

- Khách yêu cầu hoàn hàng trong 15 ngày từ khi xác nhận nhận hàng.
- Admin duyệt/từ chối; duyệt **không** đổi tồn kho hoặc ví.
- Admin chọn đơn vị vận chuyển hoàn. Hiện chỉ **Lalamove** có API tạo vận đơn và xác minh trạng thái đầy đủ. GHN/GHTK chỉ được hiện disabled cho hoàn hàng, không được mạo danh đã tạo vận đơn.
- Vận đơn hoàn mới độc lập với vận đơn giao hàng gốc, lưu tại `VanDonHoanHang`.
- Điểm lấy hàng / sender: `DonHang.DiaChiGiao`, `TenNguoiNhan`, `SoDienThoai` của khách; điểm giao / recipient: địa chỉ kho và điện thoại cấu hình Admin Shipping.
- Tạo quotation và Place Order backend-side. Phí vận chuyển hoàn lưu riêng trong bảng này, **không sửa** `DonHang.TongTien` hoặc tự động trừ Ví KaitoKid.
- Chỉ backend có credentials Lalamove mới gọi GET `/v3/orders/{id}` và xác nhận `COMPLETED` đúng external orderId; trình duyệt không được tự báo delivered.
- Admin chỉ thấy nút nhận/kiểm hàng sau trạng thái đã xác minh `delivered`. Endpoint `POST /api/admin/order-after-sales/:id/receive` tự enforce điều kiện đó trong transaction, kể cả caller cố tình bỏ qua UI.
- Trong một transaction receive: kiểm hàng `restock` hoặc `quarantine`, đổi business order `returned`, ghi ledger hoàn tiền ví một lần. Quarantine **không** cộng tồn bán được.
- Một order có tối đa một return shipment; claim trước khi gọi provider. Nếu Place Order timeout hoặc không rõ kết quả, ghi `unknown` và **không auto-retry** vì có nguy cơ tạo hai vận đơn thực. Cần đối soát/khắc phục có kiểm soát ở task sau.
- Case legacy đã được Admin nhận/hoàn ví trước khi áp dụng D029 không được hoàn tiền lần nữa hay ngầm tạo vận đơn giả.

## MariaDB rollout

Trước khi bật code backend mới, backup và chạy create-only migration:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root -p kaitokid < database\migrations\20261013_return_shipment_lifecycle.sql
npm --prefix apps\api run db:audit
```

Contract mong đợi sau wallet + return-shipment migrations: **56 base tables**. Không Prisma reset/dev/db push trên database có dữ liệu.

## Admin flow và API

- `GET /api/admin/order-after-sales/return-providers`: danh sách lựa chọn, chỉ enabled nếu có tích hợp.
- `POST /api/admin/order-after-sales/:id/return-shipment`: admin đặt thật vận đơn hoàn `{provider:"lalamove"}`.
- `POST /api/admin/order-after-sales/:id/return-shipment/sync`: xác minh trạng thái từ API Lalamove.
- `POST /api/admin/order-after-sales/:id/receive`: chỉ cho sau sync `COMPLETED`, admin đã kiểm hàng thật.

Các endpoint mutation yêu cầu JWT + `orders.update_status`; receive tiếp tục cần `inventory.manage` và `wallet.manage`. Merchant phải bật Lalamove với credentials và cấu hình PickupAddress/PickupPhone ở Admin Shipping.

## Gate cần làm trước khi xem là hoàn tất

1. Áp dụng migration không phá dữ liệu trên DB hiện có; health 56/56.
2. API build và checkout/return-shipment contract tests; Web build/lint.
3. Lalamove Sandbox: khách → shop, quotation, Place Order, persist mã riêng, GET ban đầu chưa COMPLETED thì nút receive không xuất hiện.
4. Lalamove Sandbox COMPLETED hợp lệ mới xuất hiện nút, Admin chọn restock/quarantine, ví credit đúng một lần, stock audit đúng và đơn vẫn hiện returned.
5. Test đồng thời hai lần đặt, timeout/ambiguous response, hai lần receive, provider 5xx/unknown status và tài khoản thiếu quyền. Không dựa vào giả lập provider làm bằng chứng live.

Không auto-generate shipping label hay hoàn tiền nếu provider chưa xác minh giao thành công.


## Trạng thái Lalamove hoàn hàng đồng bộ tự động (2026-10-13)

- `GET /api/admin/order-after-sales/:id` chỉ đọc DB, không tự truy vấn Lalamove.
- Khi Admin mở chi tiết đơn, Web chủ động POST `/api/admin/order-after-sales/:id/return-shipment/sync` một lần và cứ **20 giây** khi panel đang mở, tab đang visible, vận đơn còn `placed/in_transit`. Quay về tab sẽ kiểm tra ngay. Có chống gửi song song và ngừng khi `delivered`/unmount.
- Web hiển thị thời điểm `NgayCapNhat` đã kiểm tra gần nhất và lỗi gọi hãng. Nút kiểm tra thủ công vẫn giữ để hỗ trợ đối soát. Reload Web sẽ khởi động quá trình kiểm tra, không coi snapshot DB cũ là trạng thái của hãng.
- Đối với event webhook **có HMAC hợp lệ**, sau khi backend outgoing bỏ qua mã vận đơn không thuộc giao hàng đi, controller tìm vận đơn hoàn có mã Lalamove trùng trong `VanDonHoanHang` rồi **GET API hãng** và đồng bộ trạng thái. Không dựa vào status tự nhập hay screenshot; việc gọi GET không tự credit ví/cộng tồn.
- Public webhook cần URL HTTPS có thể truy cập từ Lalamove. Nếu môi trường local không có inbound webhook, Admin polling vẫn tự cập nhật khi đang mở; không có worker nền toàn cục khi Admin đã đóng.
- Status chỉ thành `delivered` nếu hãng trả `data.orderId` đúng mã vận đơn và `data.status=COMPLETED`. Sau đó **vẫn chờ Admin nhận, kiểm và chọn restock/quarantine**. Không thay đổi guard receive/tiền ví.
- Nếu share link hiện Completed nhưng GET API chưa trả COMPLETED, hiển thị lần đồng bộ gần nhất và tiếp tục xác minh; tuyệt đối không tự chỉnh DB dựa vào share page.
