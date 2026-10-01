# Phase 11 — Commerce + Payment + Admin concurrency/race runtime gate

Gate này chạy sau khi:

1. `scripts\node-final-cutover-check.bat` PASS;
2. `scripts\node-final-runtime-smoke.bat` PASS;
3. `scripts\node-protected-runtime-parity.bat` PASS;
4. Node API đang chạy Node-only trên `http://127.0.0.1:5300`.

## Chạy

```bat
scripts\node-concurrency-race-gate.bat
```

Launcher bắt buộc:

- Node `/health` phải `ok`, DB audit 52/52;
- đọc `DATABASE_URL` từ `apps/api/.env`;
- tìm `mysqldump.exe` hoặc `mariadb-dump.exe`;
- tạo snapshot `.runtime-backups/kaitokid-phase11-race-*.sql` trước mutation;
- chỉ sau backup hợp lệ mới set `RUNTIME_RACE_CONFIRM=YES`.

`.runtime-backups/` đã git-ignore và không được commit.

## Orchestrator

`apps/api/test/run-concurrency-runtime-race.mjs` cài một mock shipping branch cô lập `phase11-race` rồi chạy tuần tự:

```text
concurrency-runtime-race.test.mjs
payment-terminal-runtime-race.test.mjs
admin-concurrency-runtime-race.test.mjs
```

Nếu `shipping/config` đã tồn tại, raw `GiaTri` được snapshot rồi restore chính xác. Nếu chưa tồn tại, gate tạo một row tạm dựa trên `INFORMATION_SCHEMA.COLUMNS` và xóa lại trong `finally`.

Nếu bất kỳ test file nào fail, orchestrator dừng file tiếp theo nhưng vẫn restore shipping fixture.

## Coverage

### 1. Customer commerce

- hai `AddToCart` đồng thời cùng customer/product/variant;
- hai checkout đồng thời cùng reservation → chỉ một order commit;
- double order cancel → stock/sold/coupon chỉ restore một lần;
- payment expiry và customer cancel chạy gần nhau → không double-restock.

Test đọc DB sau mutation, không chỉ HTTP status; product/variant snapshot được restore trong `finally`.

### 2. Payment terminal race

Gate tạo order tạm rồi ép cùng lúc:

- `GET /api/payment/status/:orderCode` để kích hoạt expiry path;
- customer `POST /api/payment/cancel/:orderCode`;
- admin-role `POST /api/payment/mark-paid/:orderCode`.

Invariant:

- cancel và mark-paid không được cùng commit;
- final state chỉ `cancelled` hoặc `confirmed`;
- `cancelled` phải trả stock/sold về snapshot đúng một lần;
- `confirmed` phải giữ đúng một lần giảm stock/tăng sold và có `NgayThanhToan`;
- chỉ một terminal shipping-history (`cancelled` hoặc `payment_confirmed`) được ghi.

### 3. Admin inventory / variant / stock receipt

Gate tạo staff/role tạm có `inventory.view` + `inventory.manage`, chọn product không có cart/reservation và ít nhất hai variant rồi snapshot toàn bộ product/variant.

Các race:

1. hai inventory export gần cạn cùng lúc → đúng một request thành công, request còn lại `400`, không tồn âm;
2. hai variant khác nhau của cùng product update đồng thời → cả hai update tồn tại, `SanPham.TonKho` bằng tổng variant, không lost-update;
3. một stock receipt bị cancel đồng thời hai lần → đúng một cancel thành công, stock rollback đúng một lần;
4. hai stock receipt cùng product/variant create đồng thời → ID và `MaPhieu` phải khác nhau, aggregate tăng đúng tổng; cancel hai phiếu độc lập đồng thời → aggregate trở lại baseline.

Gate xóa receipt/detail/history fixture, restore `TonKhoBienThe` gồm stock + average cost, restore product snapshot, rồi xóa staff/role test trong `finally`.

## PASS

Kết thúc phải có:

```text
[PASS] Phase 11 commerce + payment + admin inventory/variant/stock-receipt race gate passed.
```

Nếu DB ban đầu không có `shipping/config`, cleanup thành công còn in:

```text
[FIXTURE] Removed temporary shipping/config row; original absence restored.
```

Giữ backup cho tới khi toàn bộ final cutover + rollback drill hoàn tất.

## Nếu FAIL

- không merge `main`;
- giữ backup và toàn bộ output;
- xác định race nào fail và kiểm tra cleanup/snapshot trước khi restore dump;
- không chạy lại mutation mù trên cùng dữ liệu.

## Sau gate này vẫn còn

- realtime Socket.IO + staff claim runtime gate;
- worker ownership Node-only verification;
- Web + Mobile + Admin smoke;
- soak;
- rollback Node → C#.

Chỉ khi các mục trên cùng protected/concurrency gate đều có bằng chứng PASS mới được tạo retirement PR xóa backend C#.
