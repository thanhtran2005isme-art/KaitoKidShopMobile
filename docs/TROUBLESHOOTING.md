# Troubleshooting

## Node API không khởi động vì thiếu `.env`

Tạo local config:

```bat
cd apps\api
copy .env.example .env
```

Điền `DATABASE_URL` và `JWT_KEY`. Không commit `.env`.

## Prisma `P1000` / MariaDB access denied

`DATABASE_URL` trong `apps/api/.env` phải khớp user/password MariaDB local.

Kiểm tra MariaDB bằng XAMPP client nếu có:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root -e "SELECT VERSION(); SHOW DATABASES;"
```

Kiểm tra table count:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root -e "SELECT COUNT(*) AS table_count FROM information_schema.tables WHERE table_schema='kaitokid' AND table_type='BASE TABLE';"
```

Contract hiện tại kỳ vọng 52 bảng sau registration-email-verification migration.

## Fresh database / migration path

Fresh schema:

```text
database/KaitoKid_MariaDB.sql
```

Existing DB migrations:

```text
database/migrations/
```

Ví dụ registration verification:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root kaitokid < database\migrations\20260930_registration_email_verification.sql
```

Không chạy `prisma migrate reset`, `prisma migrate dev` hoặc `prisma db push` trên database đang có dữ liệu.

## `/health` không báo 52/52

Chạy:

```bat
npm --prefix apps\api run db:audit
```

Nếu tên bảng bị lệch casing trên Windows, audit phải tôn trọng `@@lower_case_table_names`; không tự rename bảng chỉ để làm audit xanh.

## Mobile báo không kết nối được backend

Backend runtime hiện tại là Node `:5300`.

Kiểm tra theo thứ tự:

1. Node API đang listening trên `5300`.
2. `GET http://127.0.0.1:5300/health` trả thành công.
3. Android emulator dùng `10.0.2.2:5300`.
4. Physical device cùng LAN hoặc dùng USB ADB reverse.
5. Windows Firewall cho phép TCP `5300` nếu đi LAN.
6. Không cấu hình lại các port C# cũ 5053/5265/5089/5155.

USB launcher hiện reverse:

- `8081`
- `5300`

## Expo Web vs Vite Web

- `127.0.0.1:8081` -> Expo Web của `apps/mobile`
- `localhost:5173` (thường) -> `apps/web`

## Expo local executable thiếu

`scripts/run-mobile.bat` kiểm tra `apps/mobile/node_modules/.bin/expo.cmd`. Nếu thiếu, script chạy `npm install`.

## Product/Lookbook media lỗi

Node mount shared `apps/web/public` và giữ branded fallback cho `/products/*` và `/lookbook/*`. Nếu media mới vẫn 404:

1. restart Node API;
2. kiểm tra `SHARED_WEB_PUBLIC_ROOT`/`PUBLIC_ROOT` nếu override;
3. kiểm tra path lưu trong DB;
4. chạy `scripts\node-final-runtime-smoke.bat`.

## Cart báo thiếu cột reservation

Chạy migration:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root kaitokid < database\migrations\20260922_phase4_cart_reservation.sql
```

Sau đó restart Node API.

## Lookbook/discovery sample thiếu metadata

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root kaitokid < database\migrations\20260924_phase9_discovery_seed.sql
```

## PHASE 10 sample/media chưa đúng

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root kaitokid < database\migrations\20260929_phase10_multiaudience_media.sql
```

Migration này là trạng thái sample đa audience hiện hành; không chạy lại kids-only migration cũ sau đó.

## Email verification không gửi mail thật

Nếu `EMAIL_BREVO_API_KEY` trống, Node dùng local mock/console behavior theo cấu hình hiện tại. Muốn gửi thật, cấu hình Brevo trong `apps/api/.env`/deployment secrets:

```text
EMAIL_BREVO_API_KEY=...
EMAIL_BREVO_SENDER_EMAIL=...
EMAIL_BREVO_SENDER_NAME=KaitoKid Shop
```

`AUTH_EMAIL_VERIFY_URL` phải là URL người nhận mở được.

## Google Sign-In

- Android native dùng `@react-native-google-signin/google-signin` và cần development/native build.
- Expo Go không hỗ trợ native Google module.
- Backend Node xác minh Google credential trước khi phát JWT KaitoKid.
- `GOOGLE_CLIENT_ID` cấu hình ở `apps/api/.env`/deploy secret.
- Android OAuth client phải đúng package `com.kaitokid.shopmobile` + SHA-1.

## Race/realtime gate lỗi

Chạy các gate riêng:

```bat
scripts\node-protected-runtime-parity.bat
scripts\node-concurrency-race-gate.bat
scripts\node-realtime-runtime-gate.bat
```

Concurrency/realtime scripts có thể tạo backup trong `.runtime-backups/`. Khi gate FAIL, không merge thay đổi liên quan đến inventory/payment/order/realtime cho tới khi hiểu và sửa nguyên nhân.

## `dist/modules` không tồn tại

Chạy:

```bat
npm --prefix apps\api run build
```

Build hợp lệ tạo `apps/api/dist/main.js`, `dist/modules/*`, `dist/scripts/*`.
