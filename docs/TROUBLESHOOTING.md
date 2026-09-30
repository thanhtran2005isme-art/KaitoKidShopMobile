# Troubleshooting

## Expo window closes immediately

### Symptom

The Expo terminal opens and disappears before the error can be read.

### Current behavior

The launch scripts keep Expo errors visible. If this regresses, ensure the Expo process is launched in a persistent terminal and that error paths pause before exiting.

## Windows reports `The syntax of the command is incorrect.`

### Cause seen previously

Nested `cmd /k` + `call` quoting around the Expo batch file caused invalid Windows CMD syntax.

### Fix

Root `run.bat` launches `scripts/run-mobile.bat` directly with `start` instead of nesting additional CMD quoting.

## `'expo' is not recognized as an internal or external command`

### Cause seen previously

`node_modules` existed, but the local Expo executable did not. Checking only for the directory produced a false positive.

### Current fix

`scripts/run-mobile.bat` checks:

```text
apps/mobile/node_modules/.bin/expo.cmd
```

If it is missing, the script runs `npm install`, then invokes the local Expo CLI directly.

## Mobile says “Chưa kết nối được backend”

Do not assume this always means the network path is wrong.

Check in this order:

1. Confirm Expo log shows the intended API.Customer URL.
2. Confirm API.Customer is listening on port 5265.
3. Inspect API.Customer console for EF Core/Pomelo exceptions.
4. Confirm MariaDB is running.
5. Confirm the database and user credentials work.
6. On a physical device, confirm LAN/firewall reachability.

A backend database exception can cause the mobile UI to show a generic backend connection message even when HTTP routing is otherwise correct.

## MariaDB error 1045 — Access denied

### Typical symptom

```text
ERROR 1045 (28000): Access denied for user 'kaitokid'@'localhost'
```

### Checks

Confirm MariaDB:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root -e "SELECT VERSION(); SHOW DATABASES;"
```

Confirm table count:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root -e "SELECT COUNT(*) AS table_count FROM information_schema.tables WHERE table_schema='kaitokid' AND table_type='BASE TABLE';"
```

Expected base table count for the current local schema after email-registration verification migration: `52`.

Confirm the application DB user exists:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root -e "SELECT User,Host FROM mysql.user WHERE User='kaitokid';"
```

Then ensure the password in local MariaDB matches the password in the gitignored `backend/db.local.bat`.

Do not put the real password in committed `appsettings.json`.

## First run after cloning asks for DB configuration

This is expected.

`scripts/load-db-local.bat` creates:

```text
backend/db.local.bat
```

from:

```text
backend/db.local.example.bat
```

Replace `CHANGE_ME` with the local MariaDB password, save, and run the launcher again.

## Expo Web vs separate web app

- `127.0.0.1:8081` → Expo Web rendering of `apps/mobile`
- Vite development server (normally `localhost:5173`) → `apps/web`

A wide browser window at port 8081 is still the mobile code rendered for web; it is not the separate web client.

## Physical Android device cannot reach APIs

For Wi-Fi/LAN development:

- PC and phone should be on the same reachable network.
- API.Customer must listen on `0.0.0.0:5265`.
- Windows Firewall must allow the required port.
- Use `EXPO_PUBLIC_API_URL=http://<PC-LAN-IP>:5265` when auto-detection is unsuitable.

For USB/ADB development, the mobile launcher attempts reverse mappings for:

- 8081
- 5053
- 5265


## Expo Web warning: `props.pointerEvents is deprecated`

The application source does not currently pass `pointerEvents` as a React Native prop. The warning is emitted by the Expo Router / React Navigation web dependency chain.

A development-only filter in `apps/mobile/src/utils/web-warning-filter.ts` suppresses only this exact upstream warning while preserving all other `console.warn` output.

Do not silence broader warnings. Remove the filter when the Expo Router navigation dependency includes the upstream `style.pointerEvents` fix.

## Banner/product image 404s on API.Customer

Database seed data contains URLs such as:

```text
/slide_1.jpg
/products/jean-nu-1.jpg
```

The three slider images exist in `apps/web/public`, so API.Customer additionally serves that directory as shared static media.

The seeded `/products/*.jpg` files do not exist anywhere in the repository (including the pre-monorepo history that was checked during the fix). API.Customer therefore returns a lightweight KaitoKid SVG placeholder for missing `/products/*` requests rather than returning 404.

When real product files are added to a configured static directory, static-file middleware takes precedence automatically and the fallback is not used.


## Add to Cart báo lỗi cột `SoLuongDaGiu` hoặc `GiuDenLuc`

PHASE 4 dùng reservation tồn kho ở cả cấp sản phẩm và biến thể.

Nếu API.Customer log lỗi kiểu:

```text
Unknown column 'SoLuongDaGiu'
Unknown column 'GiuDenLuc'
```

hãy chạy migration:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root kaitokid < backend\Database\migrations\20260922_phase4_cart_reservation.sql
```

sau đó restart `run.bat`.

Migration dùng `ADD COLUMN IF NOT EXISTS`, nên có thể chạy lại an toàn.

## Wishlist/Add to Cart trả 401

Wishlist và Cart đều là API có `[Authorize]`.

Kiểm tra:

1. Đăng nhập qua mobile để `AuthContext` lưu access token.
2. Sau login, `ShoppingContext` phải tự refresh wishlist/cart count.
3. Mobile tự refresh access token qua `/api/Auth/refresh` trước khi hết hạn và retry một lần khi API.Customer trả 401 cho request Bearer.
4. Nếu refresh token cũng hết hạn/không hợp lệ, session được xóa và người dùng đăng nhập lại.
5. Không hard-code Bearer token vào source hoặc `.env`.

## Add to Cart báo size/màu không hợp lệ

Backend PHASE 4 kiểm tra lựa chọn với `DanhSachSize`, `DanhSachMau` và `TonKhoBienThe`.

- Nếu sản phẩm có variant inventory, cặp size + màu phải tồn tại thật.
- Nếu chưa có variant inventory, backend dùng tồn khả dụng cấp sản phẩm nhưng vẫn validate size/màu đã khai báo.
- Không gửi giá trị tự chế từ UI.


## Lookbook PHASE 9 không có filter hoặc hotspot

PHASE 9 bổ sung metadata `Season/Style` và hotspot mẫu cho dữ liệu Lookbook local hiện có.

Sau khi pull PHASE 9 trên database đã tồn tại, chạy:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root kaitokid < backend\Database\migrations\20260924_phase9_discovery_seed.sql
```

Sau đó restart API.Customer.

Migration tra Lookbook theo title và sản phẩm theo SKU, dùng `NOT EXISTS` khi thêm hotspot nên có thể chạy lại an toàn. Nếu Collection vẫn trống, kiểm tra `SanPham.BoSuuTapId`; PHASE 9 không filter Collection ở client mà dùng `GET /api/products?CollectionId=...`.


## Ảnh Lookbook PHASE 9 trả 404

Seed hiện dùng `/lookbook/school-1.jpg` và `/lookbook/weekend-1.jpg` nhưng repository chưa có hai file ảnh này.

API.Customer PHASE 9 có fallback SVG branded cho `/lookbook/*`, tương tự product placeholder. Nếu vẫn thấy 404 sau khi pull, restart API.Customer để middleware/route mới có hiệu lực. Khi media thật được thêm vào static-file provider, file thật sẽ được phục vụ trước fallback.

## PHASE 10 vẫn thấy ảnh áo tím / "Hình ảnh sản phẩm đang cập nhật"

Mobile lấy ảnh từ `SanPham.HinhAnh`. Fallback tím chỉ xuất hiện khi record vẫn dùng đường dẫn legacy `/products/*.jpg` không có file thật.

Sau khi checkout PHASE 10, chạy:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root kaitokid < backend\Database\migrations\20260929_phase10_multiaudience_media.sql
```

Sau đó restart `run.bat` và refresh Expo. Migration cập nhật seed SKU chuẩn sang HTTPS photo URL, đồng bộ snapshot ảnh đơn cũ, bổ sung sample Nam/Nữ người lớn và Lookbook đa audience. Nếu dùng tài khoản MariaDB khác `root`, thay bằng credential local trong `backend/db.local.bat`.

API.Customer vẫn giữ fallback `/products/*` và `/lookbook/*` để dữ liệu legacy hoặc URL lỗi không tạo 404; fallback không phải media production.


## Google Sign-In Mobile/Web

KaitoKid dùng Google OAuth theo hai đường nhưng đều quy về API.Auth `POST /api/Auth/google`:

- **Android native**: `@react-native-google-signin/google-signin` lấy Google ID token rồi gửi backend.
- **Expo Web**: Google Identity Services lấy OAuth access token rồi gửi backend.
- Backend luôn kiểm tra token với Google và bắt buộc audience khớp `Google:ClientId` trước khi phát JWT KaitoKid.

Google Web Client ID hiện tại là public OAuth identifier (không phải secret) và có thể override bằng:

```text
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web-client-id>
Google__ClientId=<web-client-id>
```

### Google Cloud cho Expo Web

Trong OAuth Client loại **Web application**, thêm Authorized JavaScript origins dùng khi dev:

```text
http://localhost:8081
http://127.0.0.1:8081
```

Luồng popup token không cần lưu Client Secret ở Mobile/Web.

### Google Cloud cho Android

App Android dùng package:

```text
com.kaitokid.shopmobile
```

Tạo thêm OAuth Client ID loại **Android** cho đúng package trên và SHA-1 của APK/dev build. Web Client ID vẫn là giá trị truyền vào `GoogleSignin.configure({ webClientId })` để ID token có audience mà backend kiểm tra.

Google Sign-In native **không chạy trong Expo Go** vì cần native module. Dùng development/native build, ví dụ:

```bat
cd apps\mobile
npm install
npx expo run:android
```

Nếu gặp `DEVELOPER_ERROR`, gần như luôn do package name hoặc SHA-1 trong Android OAuth Client không khớp build đang cài trên máy.

### Expo Web báo 401 `Token Google không hợp lệ`

Nếu popup Google mở/chọn tài khoản thành công nhưng request `POST /api/Auth/google` trả 401, kiểm tra log API.Auth trước. Google `tokeninfo` hiện có thể trả schema mới như `aud`, `azp`, `sub`, `email_verified`, `exp`, `expires_in`; các tài liệu/API client cũ cũng có các tên `audience`, `issued_to`, `user_id`, `verified_email`.

Backend phải chấp nhận cả hai schema nhưng vẫn **fail closed** nếu không có audience đúng `Google:ClientId` hoặc token hết hạn. Cảnh báo browser `Cross-Origin-Opener-Policy policy would block the window.closed call` có thể xuất hiện khi Google popup đóng và không phải nguyên nhân của 401 nếu request `/api/Auth/google` vẫn được gửi.



## Đăng ký email: không nhận được mail xác nhận

Flow mới chỉ tạo `PendingRegistration` khi submit form; `NguoiDung` chỉ xuất hiện sau khi click link xác nhận.

1. Chạy migration:
   ```bat
   "C:\xampp\mysql\bin\mysql.exe" -u root kaitokid < backend\Database\migrations\20260930_registration_email_verification.sql
   ```
2. Restart API.Auth sau migration.
3. Nếu startup log ghi `Email backend : CONSOLE (mock)`, email **không đi ra Internet**; link chỉ được in trong console. Muốn gửi thật, cấu hình Brevo bằng environment/local secret, không commit key:
   ```bat
   set Email__Brevo__ApiKey=<BREVO_API_KEY>
   set Email__Brevo__SenderEmail=<EMAIL_DA_XAC_THUC_TREN_BREVO>
   set Email__Brevo__SenderName=KaitoKid Shop
   ```
4. `Auth__EmailVerifyUrl` phải là URL mà người nhận email mở được. Web dev mặc định là `http://localhost:5173/verify-email`. Nếu chỉ test API trực tiếp có thể trỏ tới `http://<LAN-IP>:5053/api/Auth/verify-email`; production phải dùng domain HTTPS công khai.
5. Link mặc định hết hạn sau 24 giờ. Submit đăng ký lại cùng email sẽ phát token mới và làm link cũ mất hiệu lực.

Không đưa Brevo API key, mật khẩu email hoặc verification token vào Git/log công khai.

## Node migration: Prisma P1000 hoặc test không tìm thấy dist/modules

### Prisma P1000 — Authentication failed

Node migration dùng chính MariaDB `kaitokid` của backend C#. Nếu `npm run db:introspect` báo `P1000`, mật khẩu trong `apps/api/.env -> DATABASE_URL` không khớp user MariaDB hiện tại.

Nguồn credential local là file gitignored `backend/db.local.bat`. Không commit hoặc gửi mật khẩu vào log/chat công khai.

### `Cannot find module dist/scripts/...` hoặc `dist/modules/...`

Build Node dùng `tsc -p tsconfig.build.json` với `rootDir=src` và `outDir=dist`. Output hợp lệ là `dist/main.js`, `dist/scripts/*`, `dist/modules/*`; `dist/src/*` là layout cũ bị sai.

## Node migration: audit báo thiếu đủ 52 bảng dù actualTableCount = 52

### Triệu chứng

`db:audit` có thể báo `missingTables` chứa toàn bộ tên PascalCase như `NguoiDung`, trong khi `extraTables` lại chứa chính các bảng đó ở dạng chữ thường như `nguoidung`.

### Nguyên nhân

MariaDB/MySQL trên Windows thường dùng `lower_case_table_names=1`, nên `information_schema.TABLES` trả tên bảng chữ thường và phép so sánh tên bảng phải theo chế độ case-insensitive của server.

### Cách xử lý hiện hành

Audit đọc `@@lower_case_table_names`: giá trị khác `0` thì so sánh tên bảng không phân biệt hoa/thường; giá trị `0` thì giữ so sánh chính xác để không che lỗi casing trên Linux. Không đổi tên bảng và không sửa dữ liệu.

### Node migration: lỗi `Cannot find module 'jose'`

JWT compatibility không phụ thuộc package `jose`. Node dùng `node:crypto` để xác minh HS256, issuer, audience, exp/nbf và chữ ký tương thích token C# hiện tại.


## Node migration: reservation bị release hai lần khi chạy song song C# + Node

Trong migration, C# `CartReservationSweeper` và Node không được cùng làm owner của job hết hạn giỏ. Node mặc định:

```env
CART_SWEEPER_ENABLED=false
```

Chỉ đổi thành `true` khi đã dừng sweeper C# tại cutover. Việc gọi các endpoint Cart Node trực tiếp để parity test vẫn hoạt động khi sweeper Node tắt; reservation hết hạn tiếp tục do C# process xử lý trong giai đoạn coexistence.


## Node migration: đơn ATM bị auto-cancel hai lần

Trong coexistence, chỉ C# được làm owner của `PaymentExpirySweeper`. Node phải giữ:

```env
PAYMENT_SWEEPER_ENABLED=false
```

Chỉ bật Node sweeper sau khi background job C# đã dừng ở cutover. Endpoint `GET /api/payment/status/:orderCode` vẫn tự xử lý expiry có row lock/idempotent khi được gọi trực tiếp.

## Node migration: shipping provider ngoài không trả phí

Node đọc shipping config JSON từ `CauHinhCuaHang` trước, rồi mới fallback env. GHN cần token + shop ID; GHTK cần token. Không commit token thật. Nếu provider ngoài lỗi, service giữ behavior fallback Mock của C#; nếu `MockOnlyServeBranches=true` mà tỉnh không có branch KaitoKid thì Mock có thể trả rỗng theo đúng cấu hình.


## Node migration Phase 8: build báo thiếu `bcryptjs`

Phase 8 thêm BCrypt pure-JS để tương thích trực tiếp `MatKhauHash` của C#. Sau khi pull branch Phase 8 cần chạy:

```bat
cd apps\api
npm install
npm run build
```

Không đổi/reset hash trong DB. Hash BCrypt cũ tiếp tục đăng nhập được; plain-text legacy nếu có chỉ được chấp nhận khi khớp chính xác rồi rehash sau lần đăng nhập hợp lệ.

## Node Auth trả 401 Google/Facebook

Node không dùng token OAuth giả. Cần cấu hình local/deploy, không commit secret:

- `GOOGLE_CLIENT_ID`: phải đúng Web Client ID mà Mobile/Web đang dùng làm audience.
- `FACEBOOK_APP_ID`: bắt buộc để bật Facebook verification path.
- Brevo/reCAPTCHA/OAuth secrets chỉ nằm trong `.env` local hoặc secret manager.

Nếu `GOOGLE_CLIENT_ID` sai, cả ID token native và access token Expo Web đều fail closed. Node hỗ trợ các field tokeninfo hiện tại `aud/azp` và legacy `audience/issued_to`.

## Node staff token bị 403 dù role là admin

RBAC cố ý không bypass chỉ vì claim `role=admin`. Quyền được cho phép khi JWT có `user_type=staff` và một trong hai điều kiện đúng: `is_super_admin=true`, hoặc token chứa đúng claim `permission`. Đây là parity với hardening C# hiện tại.


## Node Phase 9: realtime Web không kết nối

Phase 9 đổi backend chat từ SignalR sang Socket.IO. Sau cutover cấu hình Web:

```env
VITE_CHAT_HUB_URL=http://localhost:5300
VITE_CHAT_HUB_PATH=/chatHub
```

Chạy `npm install` trong `apps/web` vì dependency realtime đổi sang `socket.io-client`.

## Node Phase 9: image search `ready=false`

Đây là trạng thái hợp lệ nếu repo/local chưa có CLIP ONNX model. Repo không commit model binary. Đặt model tại `IMAGE_SEARCH_MODEL_PATH`, restart Node, rồi chỉ bật `IMAGE_INDEXER_ENABLED=true` khi model load thành công. Không tạo lại DB.

## Node Phase 9: npm install native image dependencies lỗi

Phase 9 dùng `onnxruntime-node` và `sharp`. Không dùng `npm audit fix --force` để chữa lỗi cài đặt. Giữ Node version đáp ứng `engines >=20.19`, xóa/chỉnh dependency chỉ sau khi có log lỗi cụ thể. Image search soft-disable khi thiếu model, nhưng package vẫn phải cài để TypeScript/build resolve module.

## Cutover: có được tắt hết backend C# không?

Chưa. Node 9-phase hiện chốt API.Auth + API.Customer; `API.Admin` còn 23 controller C#. Chỉ cutover Auth/Customer sau parity, giữ API.Admin C# cho tới migration riêng.
