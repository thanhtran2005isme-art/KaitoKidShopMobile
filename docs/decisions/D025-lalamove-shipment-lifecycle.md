# D025 — Lalamove là carrier thật, backend sở hữu toàn bộ lifecycle vận đơn

**Ngày:** 2026-10-04

## Quyết định

Lalamove được tích hợp như một carrier thật trong Node backend, không phải mock shipping. Checkout Web/Mobile chỉ chọn provider + service type; backend là source of truth cho quotation, phí, Place Order, tracking, cancel và webhook.

## Contract checkout và quotation

- Customer Web và Mobile có thể gọi `POST /api/shipping/quote` với `provider=lalamove` hoặc `all`.
- `serviceCode` public của Lalamove là service type ổn định, ví dụ `MOTORCYCLE`; không dùng `quotationId` do client giữ làm authority.
- Khi `POST /api/orders`, `OrdersService` vẫn re-quote server-side theo D015. Fee được lấy từ quotation mới của backend, không lấy `shippingFee` client.
- Sau khi order KaitoKid đã commit, `LalamoveShippingService` tạo một quotation mới từ địa chỉ đã persist trong `DonHang`, kiểm tra carrier fee không lệch fee server vừa chốt, rồi dùng quotation đó để `POST /v3/orders`.
- Nếu Place Order lỗi tạm thời sau khi commerce order đã commit, order KaitoKid vẫn tồn tại; owner tracking có thể retry Place Order idempotently khi chưa có `MaVanDon`.

## Persistence

Không thêm bảng mới và không đổi table count hiện tại.

Dùng các cột shipping đã có trong `DonHang`:

- `NhaVanChuyen = lalamove`
- `MaVanDon = Lalamove orderId`
- `LinkTracking = Lalamove shareLink`
- `MaDichVuVanChuyen = quotationId` sau khi Place Order thành công; trước đó có thể đang là service type được chọn.
- `TrangThaiVanChuyen` là trạng thái KaitoKid đã map từ Lalamove.

`LichSuTrangThaiVanChuyen` tiếp tục là audit history; webhook event id được ghi vào mô tả dưới marker `[LALAMOVE_EVENT:<eventId>]` để chống replay mà không cần tạo thêm bảng idempotency.

## Webhook

Endpoint public:

`POST /api/shipping/lalamove/webhook`

- Verify HMAC SHA-256 bằng backend `LALAMOVE_API_KEY` + `LALAMOVE_API_SECRET`.
- Signature body là `JSON.stringify(data)` theo Lalamove v3 webhook contract.
- Path dùng để verify mặc định `/api/shipping/lalamove/webhook`; deploy qua reverse proxy có path khác phải đặt `LALAMOVE_WEBHOOK_PATH` đúng public pathname mà Lalamove ký.
- Replay cùng `eventId` trả success nhưng không apply lại.
- Event cũ hơn event Lalamove đã ghi gần nhất vẫn được audit với `ignored=stale`, nhưng không được regress trạng thái hiện tại.

## Mapping trạng thái

- `ASSIGNING_DRIVER` → `ready_to_pick`
- `ON_GOING` → `lalamove_on_going`, order tối thiểu `confirmed`
- `PICKED_UP` → `delivering`, order `shipping`
- `COMPLETED` → `delivered`, order `completed`
- `CANCELED` → shipping `cancelled`, không tự hoàn tồn chỉ từ webhook
- `REJECTED` / `EXPIRED` → shipping `failed`, không tự hủy commerce order

`lalamove_on_going` cố ý không nằm trong rule `CanCancel`; khi Lalamove đã match driver thì frontend không được tự suy quyền hủy.

## Cancel và tồn kho

Customer cancel dùng nguyên tắc **carrier-first, commerce-second**:

1. nếu chưa có Lalamove `orderId`, chạy cancel KaitoKid bình thường;
2. nếu đã có `orderId`, backend gọi `DELETE /v3/orders/{id}` trước;
3. Lalamove `204` mới cho phép transaction KaitoKid tiếp tục restore stock/coupon và set order `cancelled`;
4. Lalamove `409` hoặc lỗi carrier không được giả vờ hủy thành công;
5. nếu webhook `CANCELED` đến trước transaction nội bộ, order `pending/confirmed` + shipping `cancelled` vẫn được phép hoàn tất commerce cancellation để không kẹt stock/coupon.

Carrier-side `CANCELED`, `REJECTED`, `EXPIRED` **không tự động hoàn tồn** vì webhook carrier không đủ để thay thế state machine hủy order của KaitoKid.

## Tracking

`GET /api/shipping/track/{orderCode}` vẫn owner-only theo D016. Với Lalamove, backend gọi `GET /v3/orders/{orderId}` để refresh status/share link trước khi trả tracking khi có thể.

## Simulator

`ShippingStatusSimulatorService` không được advance bất kỳ order nào có `NhaVanChuyen = lalamove`. Vận đơn thật chỉ đi theo Lalamove API/webhook/tracking sync.

## Secrets

`LALAMOVE_API_KEY` và `LALAMOVE_API_SECRET` chỉ ở backend environment. Admin Web chỉ được biết configured/not-configured, không nhận raw secret.

## Merge gate

PR tích hợp Lalamove **không được merge vào `main`** cho tới khi:

- backend build/contract tests pass;
- Sandbox quote + Place Order + persistence pass;
- webhook public nhận/verify event sandbox và duplicate/out-of-order không regress state;
- tracking trả orderId/shareLink/status đúng;
- cancel sandbox xử lý cả success và forbidden path;
- Customer Web `:5173` chạy flow checkout Lalamove end-to-end;
- Mobile/Expo `:8081` chạy cùng flow end-to-end;
- không có secret thật trong Git.
