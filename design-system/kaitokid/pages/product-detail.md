# Product Detail — Web + Mobile override

Áp dụng cho:

- `apps/mobile` route `/product/[slug]` trên Android/iOS/Expo Web;
- `apps/web` Customer Product Detail route `/product/:id` trên Vite Web.

## Inventory visibility

Product Detail phải hiển thị số lượng tồn kho **khả dụng**, không chỉ nhãn chung `Còn hàng`.

- Nếu sản phẩm có `variantInventory`, tồn kho dùng `available = stock - reserved` theo D010/D012.
- Khi chưa chọn đủ màu + size, hiển thị tổng số lượng khả dụng của các biến thể và nhắc người dùng chọn đủ biến thể để xem tồn kho chính xác.
- Khi đã chọn đủ màu + size, hiển thị số lượng khả dụng của đúng biến thể đang chọn.
- Nếu không có inventory biến thể, dùng `availableStock` của sản phẩm; chỉ fallback `stock` khi API chưa có `availableStock`.
- Không hiển thị `reserved` cho khách và không dùng raw `stock` làm số có thể mua khi đã có dữ liệu availability.
- Không tự chia đều tồn kho cấp sản phẩm cho từng size khi backend không có inventory biến thể; các size đó dùng chung giới hạn `availableStock` cấp sản phẩm.
- Quantity stepper/input không được vượt quá số lượng khả dụng hiện tại; nút tăng phải disabled ở giới hạn tối đa.
- Add to Cart/Mua ngay phải chặn ở client nếu quantity vượt availability, đồng thời backend vẫn là source of truth cuối cùng để chống stale stock/race.
- Khi backend từ chối Add to Cart do tồn kho thay đổi, UI không được báo thành công hoặc tự chuyển sang Cart như thể đã thêm thành công.
- Sau Add to Cart thành công, UI phải phản ánh availability mới; backend vẫn là source of truth.

## Web parity

Customer Web phải giữ `availableStock` và `variantInventory` từ `GET /api/products/:id` thay vì làm rơi hai field ở mapper hoặc gọi raw variant stock không trừ reservation.

- trạng thái `Hết hàng`, `Biến thể hết hàng`, `Còn N sản phẩm` và giới hạn quantity đều dựa trên availability;
- color/size không còn hàng phải disabled;
- `Mua ngay`, `Thêm vào giỏ` và sticky cart không được hoạt động khi selection chưa hợp lệ hoặc availability bằng 0;
- tab Thông số hiển thị tồn khả dụng, không hiển thị raw physical stock như số khách có thể mua.

## Mobile parity

Mobile hiện đã dùng `variantInventory.available`, hiển thị tổng tồn/trạng thái tồn và khóa nút `+` khi `quantity >= availableStock`. Khi sửa tiếp phải giữ nguyên invariant này và không quay lại raw `stock`.

## Copy

Ưu tiên copy rõ phạm vi số lượng:

- chưa chọn đủ biến thể: `Tổng còn N sản phẩm`;
- đã chọn đủ biến thể: `Còn N sản phẩm`;
- helper: `Tồn kho khả dụng: N sản phẩm ở lựa chọn này` hoặc `Bạn có thể mua tối đa N sản phẩm ở lựa chọn hiện tại.`;
- hết hàng: `Hết hàng` / `Lựa chọn này đang hết hàng` / `Biến thể hết hàng`.

Không tạo urgency giả như “sắp hết” nếu dữ liệu không hỗ trợ. Low-stock semantic chỉ áp dụng dựa trên số lượng khả dụng thực tế.
