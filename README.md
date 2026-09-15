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

Không cần tạo `.env` nếu backend chạy trên cùng máy. Ứng dụng tự dùng:

```text
http://10.0.2.2:5265
```

### iOS Simulator / Web

Mặc định ứng dụng dùng:

```text
http://localhost:5265
```

### Điện thoại thật

1. Đảm bảo điện thoại và máy chạy backend cùng mạng LAN/Wi-Fi.
2. Sao chép `.env.example` thành `.env`.
3. Đổi IP mẫu thành IPv4 LAN của máy chạy backend, ví dụ:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:5265
```

4. Khởi động lại Expo sau khi đổi biến môi trường.
5. Nếu điện thoại không kết nối được, kiểm tra firewall có cho phép TCP `5265` hay không.

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
