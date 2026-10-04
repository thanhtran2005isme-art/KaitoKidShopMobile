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
- owner tracking sync `GET /v3/orders/{id}` và có retry idempotent Place Order khi carrier call lỗi tạm sau commerce commit;
- customer cancel gọi Lalamove trước, chỉ hủy KaitoKid/restore stock-coupon khi carrier cho phép;
- shipping simulator loại trừ `NhaVanChuyen=lalamove`;
- thêm contract test cho HMAC, quotation, Place Order, persistence, tracking, cancel, webhook và simulator guard;
- quyết định chi tiết: `docs/decisions/D025-lalamove-shipment-lifecycle.md`.

## Gate còn mở

Không merge PR #75 cho tới khi chạy thật sandbox với credentials `pk_test/sk_test`, webhook public và xác nhận flow cả Customer Web `:5173` lẫn Mobile/Expo `:8081`. Việc static review/contract source không được ghi nhận thay cho sandbox E2E.
