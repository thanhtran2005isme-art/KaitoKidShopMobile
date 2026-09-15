# KaitoKidShop Mobile

Ứng dụng mua sắm thời trang trẻ em KaitoKid, xây dựng bằng Expo + React Native và dùng chung backend ASP.NET Core trong thư mục `BACKEND`.

## Yêu cầu

- Node.js và npm
- Expo SDK 57
- .NET SDK phù hợp với backend
- SQL Server theo cấu hình của backend

## Chạy mobile

Cài dependencies:

```bash
npm install
```

Khởi động Expo:

```bash
npm start
```

Hoặc chạy trực tiếp theo nền tảng:

```bash
npm run android
npm run ios
npm run web
```

## Kết nối backend

Customer API chạy development HTTP tại cổng `5265`.

### Android Emulator

Không cần tạo `.env` nếu backend chạy trên cùng máy. Ứng dụng dùng:

```text
http://10.0.2.2:5265
```

### iOS Simulator / Web

Ứng dụng có thể dùng backend local hoặc địa chỉ LAN được Expo phát hiện tự động.

### Điện thoại thật

Không cần tạo `.env` trong development thông thường.

`app.config.js` tự phát hiện IPv4 LAN của máy đang chạy Expo và truyền địa chỉ `http://<IP-LAN>:5265` cho ứng dụng. Cơ chế này vẫn hoạt động khi chạy Metro bằng `--tunnel`; tunnel chỉ dùng để tải bundle Expo, còn API.Customer vẫn được gọi trực tiếp qua LAN.

Điều kiện:

1. `API.Customer` phải listen tại `0.0.0.0:5265`.
2. Điện thoại phải truy cập được IPv4 LAN của máy tính.
3. Windows Firewall phải cho phép TCP `5265` nếu firewall đang chặn kết nối vào.
4. Khi Expo khởi động, terminal sẽ in dòng dạng:

```text
[KaitoKid] API.Customer: http://192.168.x.x:5265
```

Nếu muốn ép app dùng backend khác, tạo `.env` và khai báo:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:5265
```

Sau khi thay đổi `.env`, khởi động lại Expo với cache sạch.

Backend Customer đã bind development HTTP vào `0.0.0.0:5265`, vì vậy có thể nhận kết nối từ thiết bị khác trong LAN khi firewall cho phép.

## Cấu trúc mobile chính

```text
src/
  app/
    _layout.tsx
    (tabs)/
      index.tsx
      categories.tsx
      cart.tsx
      account.tsx
    product/[slug].tsx
    search.tsx
  components/
    home/
    product/
  hooks/
  services/
  types/
```

Trang chủ hiện lấy dữ liệu trực tiếp từ backend qua các API banner, danh mục, hàng mới, bán chạy, giảm giá và homepage blocks.

## Kiểm tra code

```bash
npm run lint
npx tsc --noEmit
```

> Lưu ý: trước khi thay đổi API của Expo, đọc đúng tài liệu Expo SDK 57 theo `AGENTS.md` của repository.
