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

## payOS báo chưa được cấu hình

PR #75 dùng payOS làm provider thanh toán online theo D027. Backend cần đủ ba secret:

```env
PAYOS_CLIENT_ID=...
PAYOS_API_KEY=...
PAYOS_CHECKSUM_KEY=...
```

Các giá trị phải lấy từ đúng Payment Channel trong payOS và chỉ đặt trong `apps/api/.env`/deployment secret. Sau khi đổi env phải restart Node API.

Không đưa ba secret này vào:

- `VITE_*`;
- `EXPO_PUBLIC_*`;
- Admin settings;
- source/Git.

`GET /api/payment/config` chỉ được expose boolean/provider status, không trả secret.

## payOS tạo order nhưng Web/Mobile không hiện QR

Kiểm tra theo thứ tự:

1. đơn dùng online payment compatibility code `ATM`;
2. `GET /api/payment/instructions/{MaDonHang}` với JWT đúng chủ đơn trả `provider=payos`;
3. response có `qrUrl` và/hoặc `checkoutUrl`;
4. `qrUrl` dạng `data:image/png;base64,...` phải được client render trực tiếp, không prepend API origin;
5. nếu request đã tồn tại và provider GET không trả raw `qrCode`, `qrMode=payos_checkout` là hợp lệ: QR lúc này mở payOS Hosted Checkout;
6. nếu amount provider khác `DonHang.TongTien`, backend phải reject thay vì hiển thị payment không khớp.

Customer Web/Mobile không tự ghép URL VietQR từ bank/account khi payOS active.

## Khách đã quét QR/trừ tiền nhưng app chưa báo thành công

Mobile/Web **không đọc biến động số dư ngân hàng**. Luồng đúng là:

```text
Ngân hàng -> payOS -> signed webhook -> Node -> DB -> client poll Node -> success
```

Kiểm tra:

1. backend có public HTTPS URL để payOS gọi được từ Internet;
2. webhook đã đăng ký/confirm đúng URL:
   `POST /api/payment/payos/webhook`;
3. reverse proxy không chặn POST/body;
4. `PAYOS_CHECKSUM_KEY` đúng Payment Channel;
5. webhook amount đúng `DonHang.TongTien` và currency là VND;
6. `DonHang.Id` đúng integer `orderCode` payOS gửi về;
7. sau webhook hợp lệ, `DonHang.NgayThanhToan` phải có giá trị và `TrangThai='confirmed'`;
8. Mobile/Web đang kết nối đúng Node API `:5300` và poll `/api/payment/status/{MaDonHang}`.

Nếu webhook chưa tới backend thì client poll mãi vẫn pending — đây là đúng fail-safe behavior, không được cho client tự đánh dấu paid.

Runbook đầy đủ:

```text
docs/runbooks/PAYOS_PAYMENT_E2E.md
```

## payOS webhook trả 400

Các nguyên nhân cần phân biệt:

- signature/checksum sai -> reject;
- `currency != VND` -> reject;
- amount khác tổng đơn -> reject;
- payment method của đơn không phải online compatibility code -> reject;
- malformed payload -> reject.

Signed sample webhook mà payOS dùng để confirm URL có thể mang `orderCode` không tồn tại trong KaitoKid. Sau khi signature hợp lệ, trường hợp này phải ACK 2xx/ignore và **không** tạo order giả.

Không “sửa” lỗi signature bằng cách tắt verify webhook.

## Payment hết hạn/hủy nhưng tồn kho không được hoàn ngay

Với payOS đây có thể là behavior đúng. Cancel/expiry dùng provider-first:

```text
PAID      -> confirm paid, không hoàn tồn/coupon
PENDING   -> cancel payOS trước
CANCELLED -> mới cancel commerce và restore
unknown   -> fail closed
```

Nếu payOS/network đang lỗi và backend chưa xác nhận terminal state, KaitoKid cố ý không restore stock/coupon để tránh bán trùng sau một giao dịch thực tế đã vào tiền.

Khi debug cần kiểm tra provider status trước khi sửa trực tiếp DB.

## Payment thành công nhưng chưa tạo Lalamove shipment

Với online payment, shipment chỉ được tạo **sau** verified paid. Kiểm tra:

1. `NgayThanhToan` đã set;
2. history có `payment_confirmed`;
3. `NhaVanChuyen`/`MaDichVuVanChuyen` của order đúng provider/service đã quote;
4. order chưa có tracking cũ;
5. Lalamove credentials/config đúng;
6. nếu create carrier thất bại, xử lý theo Lalamove hardened lifecycle của PR #75; không giả trạng thái shipped.

Duplicate payOS webhook không được tạo shipment lần hai.

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
