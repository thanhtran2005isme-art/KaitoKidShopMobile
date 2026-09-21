# KaitoKidShop Mobile

Ứng dụng Expo + React Native nằm độc lập trong `apps/mobile`.

## Cài đặt

Từ root repository:

```bash
cd apps/mobile
npm install
```

## Chạy

```bash
npm start
npm run android
npm run ios
```

Customer API development dùng cổng `5265`, Auth API dùng cổng `5053`.
Backend nằm tại `../../backend`.

Launcher Windows từ root:

```bat
scripts\run-mobile.bat
```

Cấu trúc source chính:

```text
src/
├─ app/
├─ components/
├─ constants/
├─ context/
├─ hooks/
├─ services/
└─ types/
```

README cũ trước khi refactor được giữ tại `README.legacy.md`.
