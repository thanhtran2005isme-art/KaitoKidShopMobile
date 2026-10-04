# Product Detail — Mobile override

Áp dụng cho `apps/mobile` route `/product/[slug]` trên Android/iOS/Expo Web.

## Inventory visibility

Product Detail phải hiển thị số lượng tồn kho **khả dụng**, không chỉ nhãn chung `Còn hàng`.

- Nếu sản phẩm có `variantInventory`, tồn kho dùng `available = stock - reserved` theo D010/D012.
- Khi chưa chọn đủ màu + size, hiển thị tổng số lượng khả dụng của các biến thể và nhắc người dùng chọn đủ biến thể để xem tồn kho chính xác.
- Khi đã chọn đủ màu + size, hiển thị số lượng khả dụng của đúng biến thể đang chọn.
- Nếu không có inventory biến thể, dùng `availableStock` của sản phẩm; chỉ fallback `stock` khi API chưa có `availableStock`.
- Không hiển thị `reserved` cho khách và không dùng raw `stock` làm số có thể mua khi đã có dữ liệu availability.
- Quantity stepper không được vượt quá số lượng khả dụng hiện tại.
- Sau Add to Cart, UI phải phản ánh availability mới mà backend trả về; backend vẫn là source of truth.

## Copy

Ưu tiên copy rõ phạm vi số lượng:

- chưa chọn đủ biến thể: `Tổng còn N sản phẩm`;
- đã chọn đủ biến thể: `Còn N sản phẩm`;
- helper: `Tồn kho khả dụng: N sản phẩm ở lựa chọn này`;
- hết hàng: `Hết hàng` / `Lựa chọn này đang hết hàng`.

Không tạo urgency giả như “sắp hết” nếu dữ liệu không hỗ trợ. Low-stock semantic chỉ áp dụng dựa trên số lượng khả dụng thực tế.
