# D024 — Persist checkout selection trên Mobile, không persist commerce snapshot

**Ngày:** 2026-10-04

## Quyết định

Mobile partial checkout được phép giữ continuity qua reload/restart bằng cách persist **chỉ danh sách `CartItemIds` đã chọn**.

- Expo Web lưu key `kaitokid_checkout_item_ids` trong `localStorage`.
- Android/iOS dùng `expo-secure-store`.
- `ShoppingContext` phải chờ `AuthContext` hoàn tất restore session trước khi coi `token = null` là trạng thái logout thật.
- Sau khi session được restore, Mobile tải cart hiện tại từ backend và chỉ giữ các ID vẫn còn tồn tại trong cart của user.
- Logout phải xóa checkout selection đã persist.

## Không được persist làm source of truth

Không dùng client persistence cho snapshot authoritative của:

- product/cart detail;
- giá/subtotal;
- tồn kho/reservation;
- coupon/combo discount;
- shipping quote/fee;
- payment availability/status.

Các dữ liệu này vẫn phải tải/validate lại từ backend theo D010, D012 và D015.

## Lý do

Partial checkout trước đây chỉ giữ `preparedCheckoutItemIds` trong React state. Hard reload trên Expo Web hoặc khởi tạo lại provider làm state về `[]`, khiến `/checkout` báo không có sản phẩm dù cart thật vẫn còn ở backend.

Persist toàn bộ cart/price snapshot sẽ giải quyết triệu chứng nhưng tạo nguy cơ stale price, stale stock, stale promotion và lệch reservation/payment contract. Persist ID chọn checkout giữ được UX continuity mà không đổi trust boundary.

## Hệ quả

- Reload `/checkout` không được tự làm mất selection hợp lệ.
- Network error tạm thời khi tải cart không được coi như cart rỗng để xóa selection đã lưu.
- ID đã bị remove/checkout ở nơi khác sẽ bị loại sau khi đối chiếu cart server thành công.
- `CartItemIds` chỉ là client intent; backend vẫn quyết định item ownership, giá, tồn kho, discount, shipping và payment khi tạo order.
