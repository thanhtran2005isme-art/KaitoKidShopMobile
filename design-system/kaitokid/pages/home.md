# Home — Mobile category media override

Scope: `apps/mobile` Home / Expo Web.

## Category strip

- Ưu tiên ảnh thật từ `Category.image` khi backend có media danh mục.
- Nếu category chưa có ảnh, dùng ảnh của một sản phẩm thật cùng danh mục/subcategory/name từ chính Home payload làm ảnh đại diện.
- Không hard-code URL ảnh demo bên ngoài và không dùng một icon móc áo giống nhau cho mọi danh mục.
- Nếu cả category và catalog hiện tại đều không có ảnh phù hợp, hiển thị placeholder media trung tính để lộ rõ dữ liệu đang thiếu thay vì giả một loại sản phẩm.
- Ảnh remote dùng `expo-image`, kích thước cố định, `contentFit="cover"`, cache `memory-disk` để tránh layout shift.
- Card danh mục tiếp tục có label text, accessibility label/role và touch feedback; không dùng ảnh như tín hiệu duy nhất.

## Matching fallback

Fallback sản phẩm được ghép theo text đã normalize từ `Category.name/slug` với `Product.category/subcategory/name`. Mục tiêu là chỉ lấy media có liên hệ thực với danh mục, không lấy ảnh ngẫu nhiên chỉ để lấp chỗ trống.
