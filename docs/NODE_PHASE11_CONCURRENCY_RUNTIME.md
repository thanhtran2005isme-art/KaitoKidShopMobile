# Phase 11 — Commerce concurrency/race runtime gate

Gate này chạy sau khi:

1. `scripts\node-final-cutover-check.bat` PASS;
2. `scripts\node-final-runtime-smoke.bat` PASS;
3. protected runtime customer/staff/RBAC PASS;
4. Node API đang chạy trên `http://127.0.0.1:5300`.

## Mục tiêu

Kiểm tra race thật qua HTTP Node + MariaDB thật, không chỉ contract/unit test:

- 2 request `AddToCart` đồng thời cho cùng customer/product/variant;
- 2 checkout đồng thời trên cùng cart reservation;
- 2 request cancel cùng một order;
- payment expiry và customer cancel chạy gần như cùng lúc.

Sau mỗi race, test đọc trực tiếp DB để xác nhận:

- không tạo duplicate cart/order;
- `SoLuongDaGiu` không bị double reserve;
- stock product/variant chỉ giảm một lần khi checkout;
- cancel/expiry chỉ restore stock/sold đúng một lần;
- order cuối cùng có state nhất quán.

## Safety

Chạy từ repo root:

```bat
scripts\node-concurrency-race-gate.bat
```

Launcher bắt buộc:

- Node `/health` phải `ok` và DB audit 52/52;
- đọc `DATABASE_URL` từ `apps/api/.env`;
- tìm `mysqldump.exe` hoặc `mariadb-dump.exe` (XAMPP được auto-detect);
- tạo backup vào `.runtime-backups/` trước mutation;
- chỉ sau khi backup hợp lệ mới set `RUNTIME_RACE_CONFIRM=YES` và chạy test.

`.runtime-backups/` đã được git-ignore và không được commit.

Test tự tạo customer fixture tạm với email `@example.invalid`. Nó chỉ chọn product khi:

- `TrangThai='active'`;
- stock >= 8;
- `SoLuongDaGiu=0`;
- không có row `GioHang` hiện hữu cho product đó;
- nếu product có variant, variant được chọn phải stock >= 8, reserved=0 và `KichCo`/`MauSac` phải tương thích với `SanPham.DanhSachSize`/`SanPham.DanhSachMau` theo cùng rule JSON-array mà `CartService` dùng;
- nếu product không có variant, fixture lấy size/màu đầu tiên từ `DanhSachSize`/`DanhSachMau` thay vì luôn gửi chuỗi rỗng.

Race test in rõ product/variant/size/color fixture trước khi gọi API. Nếu API trả lỗi, assertion in cả HTTP status và response body. Các race phụ thuộc chỉ chạy khi race trước đã hoàn tất toàn bộ assertion, tránh tạo chuỗi lỗi giả từ một fixture hỏng.

### Shipping fixture cô lập

Race gate không phụ thuộc cấu hình giao hàng production hiện tại. Trước khi chạy 4 race subtest, orchestrator `apps/api/test/run-concurrency-runtime-race.mjs` xử lý cả hai trạng thái DB:

**Nếu `shipping/config` đã tồn tại:**

1. giữ nguyên raw `GiaTri` ban đầu;
2. tạm bật `MockEnabled=true`;
3. tạm bật `MockOnlyServeBranches=true`;
4. thêm branch riêng `phase11-race` tại `Phase 11 Race Province`;
5. chạy race test bằng mock shipping của fixture;
6. trong `finally`, restore đúng raw `GiaTri` ban đầu;
7. đọc lại DB và assert cấu hình sau restore khớp snapshot.

**Nếu `shipping/config` không tồn tại:**

1. đọc metadata bảng `CauHinhCuaHang` từ `INFORMATION_SCHEMA.COLUMNS`;
2. tạo đúng một row `shipping/config` tạm chỉ phục vụ race fixture;
3. chạy 4 race subtest;
4. trong `finally`, xóa row fixture đó;
5. đọc lại DB và assert trạng thái ban đầu được khôi phục: không còn row `shipping/config`.

Orchestrator không tạo schema/table và không giữ lại cấu hình shipping production mới sau khi gate kết thúc.

Vì vậy `provider: "mock"` trong race test là fixture cố ý, không phải provider production được auto-discover. Gate này kiểm tra concurrency của cart/order/payment; parity provider shipping thật được nghiệm thu ở smoke/runtime shipping riêng.

Trong `finally`, race test xóa order/detail/shipping-history/cart/login-activity/customer fixture và restore snapshot product/variant. Orchestrator sau đó restore chính xác trạng thái shipping config ban đầu — kể cả trạng thái ban đầu là “không có row”.

## PASS

Kết thúc phải có:

```text
[PASS] Phase 11 commerce concurrency/race gate passed.
```

Nếu DB ban đầu không có `shipping/config`, cleanup thành công còn phải in:

```text
[FIXTURE] Removed temporary shipping/config row; original absence restored.
```

Backup path được in lại ở cuối. Không xóa backup cho tới khi toàn bộ Phase 11 final gate + rollback drill hoàn tất.

## Nếu FAIL

- Không merge `main`.
- Giữ file `.runtime-backups\kaitokid-phase11-race-*.sql`.
- Gửi toàn bộ output test để xác định race nào fail.
- Không restore dump mù nếu fixture cleanup đã thành công; trước tiên đối chiếu các row test, product/variant và shipping config đã được restore.

## Chưa bao phủ trong gate này

Gate này chỉ đóng commerce customer race. Trước C# retirement vẫn còn:

- inventory/variant concurrent adjustment phía Admin;
- stock-receipt create/cancel concurrency;
- 2 staff claim cùng conversation;
- Socket.IO connect/join/send/reconnect + identity/RBAC;
- soak + rollback drill.
