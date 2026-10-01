# Node Phase 11 — Protected runtime parity

## Mục tiêu

Gate này chạy **sau** `scripts\node-final-runtime-smoke.bat` và trước các test concurrency/destructive. Nó kiểm tra đường protected thật qua Node `:5300` nhưng không tạo đơn, không chỉnh tồn kho và không sửa dữ liệu hồ sơ.

## Credential

Không commit credential test vào Git, `.env` hoặc script. Chạy:

```bat
scripts\node-protected-runtime-parity.bat
```

PowerShell sẽ hỏi:

- customer email/username test;
- customer password (ẩn);
- staff email test;
- staff password (ẩn).

Credential chỉ tồn tại trong environment của process test và được xóa sau khi chạy.

Nên dùng customer test **không bật 2FA** cho gate tự động này. Flow 2FA được kiểm tra riêng trong runtime matrix.

## Những gì gate kiểm tra

1. protected endpoint reject anonymous;
2. customer login thật qua Node;
3. `/api/Auth/me`;
4. refresh-token rotation và replay token cũ phải bị reject;
5. các protected read surface: account, cart, wishlist, addresses, orders;
6. customer JWT bị chặn khỏi `/api/admin/*`;
7. staff login + `/api/auth/staff/me`;
8. staff JWT truy cập được Admin products read surface.

Gate này có thể ghi login activity, cập nhật `LanDangNhapCuoi` và rotate refresh token. Nó không thay đổi cart item, order, inventory, coupon hoặc stock receipt.

## PASS

Kết quả cuối phải có:

```text
[PASS] Protected runtime parity customer/staff/RBAC passed.
```

Sau PASS mới chuyển sang concurrency/race gate. Concurrency/destructive gate bắt buộc backup MariaDB trước khi chạy và phải kiểm tra trạng thái DB sau mutation, không chỉ HTTP status.
