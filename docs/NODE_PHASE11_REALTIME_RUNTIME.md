# Phase 11 — Realtime Socket.IO + staff claim runtime gate

Gate này chạy sau khi:

1. source/final contract gate PASS;
2. live Node smoke PASS;
3. protected customer/staff/RBAC runtime PASS;
4. commerce concurrency/race gate PASS;
5. Node API đang chạy tại `http://127.0.0.1:5300`.

## Chạy gate

Từ repo root:

```bat
scripts\node-realtime-runtime-gate.bat
```

Launcher kiểm tra `/health` và DB 52/52, tạo backup MariaDB vào `.runtime-backups/`, cài test dependency bằng `npm install --no-package-lock`, sau đó chạy `npm run test:realtime-runtime`.

Backup có dạng:

```text
.runtime-backups\kaitokid-phase11-realtime-YYYYMMDD-HHMMSS.sql
```

## Fixture cô lập

Gate không dùng tài khoản staff production. Nó tự tạo:

- một `VaiTro` tạm;
- mapping chỉ gồm `chat.view` và `chat.reply`;
- hai `NhanVien` tạm với mật khẩu random đã hash;
- login hai staff qua `/api/auth/staff/login` để lấy JWT thật;
- một guest conversation tạm.

Cleanup trong `finally` xóa theo thứ tự:

1. `TinNhan` của conversation fixture;
2. `CuocHoiThoai` fixture;
3. `LichSuDangNhapNV` của tất cả staff thuộc role fixture;
4. `NhanVien` thuộc role fixture;
5. `VaiTro_QuyenHan`;
6. `VaiTro` fixture.

Cleanup theo `roleId`, nên vẫn dọn được nếu quá trình tạo staff fail giữa chừng.

## Runtime matrix

Gate kiểm tra trực tiếp Socket.IO path `/chatHub` và MariaDB:

1. **Guest identity theo handshake**
   - guest A connect bằng `guestId=A`;
   - payload cố gửi `guestId=B`;
   - DB phải không có message spoof.

2. **Reconnect**
   - guest A disconnect;
   - connect lại cùng `guestId=A`;
   - join lại conversation và tiếp tục nhận/gửi realtime.

3. **Unauthorized guest isolation**
   - guest B thử join conversation của guest A;
   - guest B không được nhận message broadcast của conversation đó.

4. **Hai staff claim cùng conversation**
   - hai JWT staff thật emit `ClaimConversation` gần như đồng thời;
   - DB cuối phải `TrangThai='agent'`;
   - `NhanVienId` chỉ thuộc một trong hai fixture staff;
   - đúng một client nhận `ClaimFailed`;
   - số bot system-message sau claim tăng đúng `+1`.

5. **Customer realtime send**
   - guest đã reconnect emit `SendMessage`;
   - chính guest nhận `ReceiveMessage`;
   - DB có đúng một `TinNhan` với `LoaiNguoiGui='customer'`.

6. **Staff realtime reply**
   - staff thắng claim emit `AgentSendMessage`;
   - guest A nhận đúng message;
   - guest B không nhận;
   - DB có đúng một `TinNhan` với `LoaiNguoiGui='agent'`.

## Parity với C#

C# legacy `ChatHub.AgentSendMessage` yêu cầu staff đã xác thực nhưng không bắt buộc staff đó phải là người đang được gán `NhanVienId` của conversation. Node giữ hành vi parity này; gate không tự thêm rule ownership mới ngoài phạm vi migration.

Node có hardening bổ sung cho guest identity/room authorization để payload không thể đổi `guestId` sau handshake.

## PASS

Kết thúc phải có:

```text
[PASS] Phase 11 realtime Socket.IO + staff claim gate passed.
```

Giữ file backup cho tới khi hoàn tất toàn bộ Phase 11 final gate và rollback drill.

## Nếu FAIL

- Không merge `main`.
- Giữ backup realtime.
- Gửi toàn bộ subtest lỗi và log Node API.
- Kiểm tra DB fixture đã cleanup trước khi cân nhắc restore dump.

## Sau gate này vẫn còn

- Admin inventory/variant concurrency;
- stock-receipt create/cancel concurrency;
- worker ownership Node-only evidence;
- Web/Mobile/Admin smoke;
- soak;
- rollback drill về C#.
