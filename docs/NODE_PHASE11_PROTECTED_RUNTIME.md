# Node Phase 11 — Protected runtime parity

## Mục tiêu

Gate này chạy **sau** `scripts\node-final-runtime-smoke.bat` và trước concurrency/destructive gate. Nó kiểm tra protected traffic thật qua Node `:5300` ở hai lớp:

1. session parity bằng customer/staff test account thật;
2. Auth lifecycle + granular RBAC bằng fixture tạm, tự cleanup sau test.

Gate không tạo order và không chỉnh tồn kho thật.

## Chạy

Không commit credential test vào Git, `.env` hoặc script:

```bat
scripts\node-protected-runtime-parity.bat
```

PowerShell hỏi customer email/password và staff email/password. Password nhập bằng `SecureString`; credential chỉ tồn tại trong environment của process test và được restore/xóa khi kết thúc.

## Coverage

### Session/customer/staff thật

- anonymous bị reject ở protected endpoint;
- customer login + `/api/Auth/me`;
- refresh token rotation và replay token cũ bị reject;
- account/cart/wishlist/addresses/orders protected read;
- customer JWT bị chặn khỏi `/api/admin/*`;
- staff login + `/api/auth/staff/me`;
- staff JWT đọc Admin products.

### Auth lifecycle fixture tạm

`auth-runtime-parity.test.mjs` tạo email `@example.invalid`, sau đó kiểm tra:

- `register` chỉ tạo `PendingRegistration`;
- `verify-email` mới tạo `NguoiDung` và `EmailDaXacThuc=1`;
- nếu local bật `AUTH_REQUIRE_OTP_FOR_REGISTER`, gate tự tạo/đọc OTP fixture để hoàn tất register;
- OTP request/verify chỉ dùng được một lần;
- TOTP setup → enable → login-2fa → disable bằng mã TOTP thật;
- chuỗi login sai kích hoạt lockout và mật khẩu đúng vẫn bị chặn khi locked;
- forgot/reset password consume reset token, clear lockout/failed-attempt;
- change-password revoke refresh token cũ; mật khẩu cũ fail, mật khẩu mới login được.

Gate cố ý fail sớm nếu local bật `AUTH_REQUIRE_RECAPTCHA=true`, vì không được dùng CAPTCHA giả trong runtime parity.

### Granular staff RBAC fixture tạm

Gate tạo role/staff tạm:

- chỉ `inventory.view` → đọc inventory được;
- thiếu `inventory.manage` → mutation trả `403`;
- cấp thêm `inventory.manage`, login lại để lấy JWT mới → request vượt permission guard và dừng ở product-not-found `404`, không sửa stock.

Fixture Auth/RBAC, login history, OTP/reset token, pending registration và role/staff test đều được cleanup trong `finally`.

## PASS

Kết quả cuối phải có:

```text
[PASS] Protected runtime: login/session + register/verify + OTP/2FA + lockout/reset/change-password + RBAC passed.
```

PASS gate này chưa đủ để retire C#. Tiếp tục chạy concurrency/race, realtime, Web/Mobile/Admin smoke, soak và rollback drill.
