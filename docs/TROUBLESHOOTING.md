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

## Trang Admin Khách hàng không hiển thị thống kê

- `/admin/customers` gọi Node API `:5300`: `GET /api/admin/customers`, `GET /api/admin/customers/summary` và `GET /api/admin/customers/:id/analytics`. Các request dùng staff JWT.
- 401: đăng nhập lại Staff/Admin. 403: kiểm tra quyền `customers.view`. 500: đọc log NestJS và kiểm tra MariaDB `kaitokid`.
- Không coi lỗi API là tệp khách rỗng; màn hình hiển thị lỗi và có nút Thử tải lại.
- Số lượng khách/đơn và doanh thu tổng quan truy vấn tại MariaDB theo `NguoiDung.Id` và `DonHang.NguoiDungId`, không tính từ một trang danh sách phân trang.
- Doanh thu, AOV, nhóm sản phẩm/danh mục mua nhiều chỉ tính đơn có `TrangThai='completed'`. Khách có đơn `pending/confirmed/shipping` sẽ có số đơn nhưng chi tiêu hoàn thành có thể bằng 0.
- Với đơn đã hoàn thành mà vẫn không thấy ở khách, kiểm tra `NguoiDungId` và `TrangThai` bằng SQL chỉ đọc; không ghép theo Email hay sửa trạng thái order để tăng số liệu.

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

## Mobile / Expo Web: hai nút xác nhận giao hàng không phản hồi

- `/orders/[id]` trong PR #75 có nút nhận/chưa nhận khi backend trả `canConfirmReceived` hoặc `canReportNotReceived`.
- Expo Web không hỗ trợ `Alert.alert()` như native; hai nút dùng `Modal` React Native để xác nhận trên Web, Android và iOS.
- Nút `Để sau` không gọi API. Đồng ý mới gọi `POST /api/orders/:id/confirm-received` hoặc `POST /api/orders/:id/report-not-received` với token chủ đơn.
- Khóa gửi lặp, hiển thị đang xử lý; thành công thông báo ngay trong màn hình và tải lại trạng thái đơn. Nếu thao tác thành công nhưng tải lại lỗi, vẫn báo thao tác đã ghi nhận và hướng dẫn kéo để làm mới.
- Xác nhận nhận hàng mới chuyển `received_by_customer`/`completed`, bắt đầu cửa sổ hậu mãi server trả. Báo chưa nhận thành `delivery_disputed` để đối soát, không tự hủy hoặc hoàn kho.
- Nghiệm thu trên Expo Web và Android/iOS: thử đồng ý/từ chối modal; xác nhận rằng chỉ đồng ý mới gửi 1 request; kiểm tra trạng thái và lịch sử vận chuyển trong DB.

## Ví KaitoKid không xuất hiện / API báo thiếu bảng

Kiểm tra `/health` trước. Nếu chưa 55/55, chạy wallet migration:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root kaitokid < database\migrations\20261006_wallet_refund_withdrawal.sql
```

Sau đó restart Node API và kiểm tra:

- `GET /api/wallet`
- `GET /api/wallet/transactions`
- Customer Web `/wallet`
- Mobile `account/wallet`

Không tạo balance giả ở localStorage/client để “sửa” màn hình trống.

## Checkout dùng ví nhưng payOS vẫn yêu cầu nguyên `TongTien`

Backend phải là authority của hai số:

```text
walletUsed = net order_payment - order_payment_reversal
amountDue  = TongTien - walletUsed
```

Kiểm tra:

1. order DTO có `walletUsed` và `amountDue` đúng;
2. payment instructions trả `total=amountDue`;
3. payOS payment amount cũng bằng `amountDue`;
4. Web/Mobile chỉ gửi `useWallet`, không gửi số tiền ví tự tính làm authority;
5. nếu order đã cancel/expire, projection phải tính reversal để `walletUsed` trở về 0.

Không sửa bằng cách đổi `DonHang.TongTien`; trường đó luôn là full order total.

## Hủy/hết hạn đơn nhưng số dư ví không trở lại

Kiểm tra ledger `GiaoDichVi` theo order reference:

- phải có `order_payment` nếu ví từng bị debit;
- cancel/expiry hợp lệ phải có đúng một `order_payment_reversal`;
- unique idempotency cấm reversal trùng cùng order/type.

Với ATM/payOS, cancel/expiry phải provider-first. Nếu provider đã paid hoặc chưa xác nhận cancel, backend **không** được local-restore inventory/coupon/wallet.

## Refund return chưa vào Ví KaitoKid

Flow mới chỉ credit tiền khi:

1. customer đã xác nhận nhận hàng;
2. return request trong 15 ngày;
3. Admin approve;
4. hàng vật lý đã quay về;
5. Admin chọn `restock` hoặc `quarantine` và xác nhận kiểm hàng.

Trong transaction bước 5 phải có marker `refund_wallet_credited` và ledger `refund_credit`. Dữ liệu `refund_pending/refund_completed_manual` chỉ dành cho case legacy.

## Withdrawal bị treo / số dư nằm ở “tạm giữ”

State machine:

```text
pending -> approved -> completed
pending/approved -> rejected
```

- tạo request: available giảm, held tăng;
- approve: chưa đổi balance;
- reject: held trả về available;
- complete: held giảm sau khi Admin đã chuyển khoản thực tế và nhập bank reference.

Admin cần `wallet.view` để xem và `wallet.manage` để duyệt/từ chối/hoàn tất. Không chỉnh trực tiếp `ViDienTu` bằng UI/admin form.

## Không hủy được tài khoản vì Ví KaitoKid

Đây là guard chủ ý. Account deletion bị chặn nếu:

- `SoDuKhaDung > 0`;
- `SoDuTamGiu > 0`;
- hoặc còn withdrawal `pending/approved`.

Khách phải xử lý/rút hết tiền và hoàn tất các yêu cầu đang chạy trước khi anonymize account.

## payOS QR có nhưng đơn không tự thành công

1. xác nhận public HTTPS webhook trỏ đúng `POST /api/payment/payos/webhook`;
2. kiểm tra payment channel payOS đã confirm webhook URL;
3. không dùng return/cancel URL trình duyệt để đánh dấu paid;
4. webhook phải pass checksum, `currency=VND`, amount đúng **`amountDue` sau ví** và provider order code map reversible về `MaDonHang`;
5. Web/Mobile poll `/api/payment/status/:orderCode`; nếu DB chưa có `NgayThanhToan`, kiểm tra webhook/provider trước chứ không sửa UI thành tự xác nhận.

Runbook đầy đủ: `docs/runbooks/PAYOS_PAYMENT_E2E.md`.

## Mobile / Expo Web POST /api/Auth/refresh trả HTTP 401

- API `:5300` đã kết nối được; 401 nghĩa là refresh token bị từ chối, **không phải** lỗi Cloudflare, CORS hoặc LAN.
- Backend hiện lưu 1 refresh token trên mỗi `NguoiDung`. Đăng nhập ở Web/thiết bị khác, đổi mật khẩu hoặc sau thời hạn `JWT_REFRESH_TOKEN_DAYS` (mặc định 7 ngày) có thể khiến refresh token cũ hết hiệu lực. Phải **đăng nhập lại một lần**; không tắt xác thực 401.
- Mobile tự xóa session cũ khi refresh trả 401 và trở về chế độ guest; request 401 vẫn có thể xuất hiện trong Network của trình duyệt, nhưng app không log thêm `[KaitoKid Auth Error]` cho tình huống này.
- Sự cố tạm thời (mất mạng, timeout hoặc API 5xx) **không xóa** refresh token đang lưu; lần gọi sau có thể thử lại. Không lưu token hoặc thông tin đăng nhập vào log.
- Race login/refresh/restore được chặn bằng session generation và hàng đợi ghi storage để refresh cũ không ghi đè/xóa session đăng nhập mới.
- Nếu UI vẫn hiển thị sai sau khi pull: dừng Expo, chạy `npx expo start --clear` trong `apps/mobile`, rồi thử đăng nhập mới. Không cần xóa toàn bộ storage của những người dùng khác.
- `"shadow*" style props are deprecated` là cảnh báo React Native Web độc lập với 401; không ảnh hưởng refresh token.
