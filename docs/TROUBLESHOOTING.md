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

Expected base table count for the current local schema: `51`.

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
3. Nếu token cũ hết hạn, logout/login lại.
4. Không hard-code Bearer token vào source hoặc `.env`.

## Add to Cart báo size/màu không hợp lệ

Backend PHASE 4 kiểm tra lựa chọn với `DanhSachSize`, `DanhSachMau` và `TonKhoBienThe`.

- Nếu sản phẩm có variant inventory, cặp size + màu phải tồn tại thật.
- Nếu chưa có variant inventory, backend dùng tồn khả dụng cấp sản phẩm nhưng vẫn validate size/màu đã khai báo.
- Không gửi giá trị tự chế từ UI.
