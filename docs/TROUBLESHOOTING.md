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
3. Android emulator dùng `10.0.2.2:5300` khi không có ADB reverse.
4. Physical device cùng LAN hoặc dùng USB ADB reverse.
5. Windows Firewall cho phép TCP `5300` nếu đi LAN.
6. Không cấu hình lại các port C# cũ 5053/5265/5089/5155.

USB launcher reverse:

- `8081` cho Expo/Metro;
- `5300` cho Node API.

Từ launcher hiện tại, `scripts/run-mobile.bat` thử reverse **mọi thiết bị ADB đang ở trạng thái `device`**. Nếu có ít nhất một thiết bị reverse đủ cả `8081` + `5300`, Expo chạy `--localhost`, Mobile dùng `http://127.0.0.1:5300` và Expo Go có thể dùng `exp://127.0.0.1:8081` trên chính thiết bị đã reverse. Nếu không có reverse hoàn chỉnh, launcher chạy `--lan`; lúc đó `127.0.0.1` trên điện thoại là chính điện thoại, không phải máy Windows.

## Expo Go thấy project khác hoặc QR / `exp://127.0.0.1:8081` không vào

`apps/mobile/app.json` của repo này có app name `KaitoKid`. Nếu Expo Go chỉ liệt kê project khác như một dev server cũ ở `8081/8082/8083`, đó không phải bằng chứng KaitoKid đang chạy đúng.

Launcher hiện bảo vệ flow này như sau:

1. trước khi start Metro, `scripts/prepare-expo-port.ps1` kiểm tra `8081`;
2. nếu `8081` đang do một Node process Expo/Metro cũ giữ, launcher dừng đúng listener cũ đó;
3. nếu `8081` do process không phải Expo/Metro giữ, launcher **FAIL rõ ràng** thay vì để Expo tự nhảy sang `8082/8083`;
4. với ADB authorized, launcher reverse `8081` + `5300` theo từng serial và chuyển Expo sang `--localhost`;
5. không có ADB reverse thì launcher bỏ `EXPO_PACKAGER_PROXY_URL` localhost và dùng `--lan` thật.

Kiểm tra USB:

```bat
adb devices
```

Mỗi điện thoại muốn dùng USB phải hiện trạng thái `device`, không phải `unauthorized`.

Với một thiết bị:

```bat
adb reverse --list
```

Với nhiều thiết bị:

```bat
adb -s <SERIAL> reverse --list
```

Kỳ vọng có mapping `tcp:8081` và `tcp:5300`.

- USB/ADB reverse OK: quét QR KaitoKid hoặc nhập `exp://127.0.0.1:8081`.
- LAN mode: quét QR hoặc dùng `exp://<IP-LAN-CUA-PC>:8081`; **không** dùng `127.0.0.1` trên điện thoại thật.
- Các server project khác còn hiện ở `8082/8083` là process của project khác trên LAN; không chọn chúng để mở KaitoKid.

## Expo Web vs Vite Web

- `127.0.0.1:8081` -> Expo Web của `apps/mobile`
- `localhost:5173` (thường) -> `apps/web`

## Expo local executable thiếu

`scripts/run-mobile.bat` kiểm tra `apps/mobile/node_modules/.bin/expo.cmd`. Nếu thiếu, script chạy `npm install`.

## Mobile `/checkout` mất sản phẩm sau F5/reload

Cart thật nằm ở backend; danh sách item được chọn cho partial checkout là state riêng. Từ D024, Mobile chỉ persist `CartItemIds` đã chọn để giữ continuity qua reload:

- Expo Web: key `kaitokid_checkout_item_ids` trong `localStorage`;
- Android/iOS: `expo-secure-store`;
- sau Auth hydrate, Mobile tải cart thật từ API rồi chỉ giữ các ID vẫn còn hợp lệ;
- logout chủ động xóa checkout selection đã persist.

Nếu `/checkout` vẫn báo “Chưa có sản phẩm để thanh toán” sau reload:

1. xác nhận phiên đăng nhập đã được restore và không bị logout;
2. ở Expo Web, kiểm tra `localStorage.getItem('kaitokid_checkout_item_ids')` có danh sách ID sau khi bấm checkout từ Cart;
3. xác nhận API cart vẫn trả các item tương ứng;
4. nếu cart API lỗi tạm thời, không xóa selection để tránh mất dữ liệu do network transient;
5. nếu item đã bị xóa/checkout ở nơi khác, ID stale sẽ bị loại khi đối chiếu với cart server.

Không sửa lỗi này bằng cách persist toàn bộ Product/Cart snapshot, giá, tồn kho, coupon, shipping fee hoặc payment state làm nguồn dữ liệu chính. Các giá trị commerce phải được lấy/validate lại từ backend.

## payOS không xuất hiện ở Checkout

Online payment mới chỉ bật khi Node có đủ ba biến:

```text
PAYOS_CLIENT_ID
PAYOS_API_KEY
PAYOS_CHECKSUM_KEY
```

Kiểm tra `GET /api/payment/config`:

- `payOsConfigured=true` và `paymentProvider=payos` khi provider active;
- `supportedMethods` phải có `ATM` khi payOS active;
- nếu `payosEnabled=false` trong payment settings thì ATM bị tắt dù credentials đúng.

Các key `bankEnabled`, `enableBankTransfer`, `bankAccounts` hoặc VietQR legacy **không còn được phép bật ATM cho đơn mới**. Không sửa bằng cách bật lại manual VietQR fallback.

## payOS QR có nhưng đơn không tự thành công

1. xác nhận public HTTPS webhook trỏ đúng `POST /api/payment/payos/webhook`;
2. kiểm tra payment channel payOS đã confirm webhook URL;
3. không dùng return/cancel URL trình duyệt để đánh dấu paid;
4. webhook phải pass checksum, `currency=VND`, amount đúng `DonHang.TongTien` và order mapping theo D027;
5. Web/Mobile poll `/api/payment/status/:orderCode` khoảng 3 giây khi pending; nếu DB chưa có `NgayThanhToan`, kiểm tra webhook/provider trước chứ không sửa UI thành tự xác nhận.

Runbook đầy đủ: `docs/runbooks/PAYOS_PAYMENT_E2E.md`.

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

## Mobile / Expo Web: hai nút xác nhận giao hàng không phản hồi

- `/orders/[id]` trong PR #75 có nút nhận/chưa nhận khi backend trả `canConfirmReceived` hoặc `canReportNotReceived`.
- Expo Web không hỗ trợ `Alert.alert()` như native; hai nút dùng `Modal` React Native để xác nhận trên Web, Android và iOS.
- Nút `Để sau` không gọi API. Đồng ý mới gọi `POST /api/orders/:id/confirm-received` hoặc `POST /api/orders/:id/report-not-received` với token chủ đơn.
- Khóa gửi lặp, hiển thị đang xử lý; thành công thông báo ngay trong màn hình và tải lại trạng thái đơn. Nếu thao tác thành công nhưng tải lại lỗi, vẫn báo thao tác đã ghi nhận và hướng dẫn kéo để làm mới.
- Xác nhận nhận hàng mới chuyển `received_by_customer`/`completed`, bắt đầu cửa sổ hậu mãi server trả. Báo chưa nhận thành `delivery_disputed` để đối soát, không tự hủy hoặc hoàn kho.
- Nghiệm thu trên Expo Web và Android/iOS: thử đồng ý/từ chối modal; xác nhận rằng chỉ đồng ý mới gửi 1 request; kiểm tra trạng thái và lịch sử vận chuyển trong DB.
