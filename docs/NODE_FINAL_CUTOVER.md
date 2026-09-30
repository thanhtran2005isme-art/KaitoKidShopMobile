# Node Final Cutover — checklist vận hành

Tài liệu này chỉ dùng khi toàn bộ stacked Node migration đã build/test/runtime parity trên **cùng MariaDB `kaitokid`**.

## Trạng thái an toàn mặc định

Trong coexistence:

```env
NODE_FINAL_CUTOVER=false
CART_SWEEPER_ENABLED=false
PAYMENT_SWEEPER_ENABLED=false
CHAT_SWEEPER_ENABLED=false
IMAGE_SEARCH_INDEXER_ENABLED=false
SHIPPING_SIMULATOR_ENABLED=false
```

C# tiếp tục là owner của background write jobs. Node được chạy REST/read/write theo test có chủ đích nhưng không được chạy worker song song.

Web realtime mặc định:

```env
VITE_CHAT_TRANSPORT=signalr
VITE_CHAT_HUB_URL=http://localhost:5265/hubs/chat
```

## Gate trước cutover

1. Backup MariaDB `kaitokid`.
2. `npm run db:audit` phải compatible, 52/52 bảng.
3. Chạy toàn bộ contract gates tới `test:final-cutover`.
4. `npm run cutover:audit`.
5. Runtime test Register/Login/2FA/Staff, Cart/Checkout/Payment/Shipping, Chat customer+agent, Search/Image.
6. Build Web với cả SignalR mode và Socket.IO mode.
7. Giải quyết toàn bộ `legacyOnlySurfaces` trong cutover audit.
8. Chỉ khi blocker list rỗng mới được xem xét `NODE_FINAL_CUTOVER=true`.

## Chuyển realtime Chat

Sau khi Node chat runtime parity pass:

```env
VITE_CHAT_TRANSPORT=socketio
VITE_CHAT_HUB_URL=http://localhost:5300/hubs/chat
```

Test: customer guest, customer login, staff queue, claim atomic, typing, read receipt, reconnect và REST fallback.

## Chuyển background ownership

Thứ tự an toàn cho từng worker:

1. Dừng worker tương ứng bên C#.
2. Xác nhận process C# cũ không còn chạy job đó.
3. Bật đúng **một** Node flag.
4. Quan sát DB/log một chu kỳ đầy đủ.
5. Nếu lỗi: tắt Node flag, khởi động lại C# worker.

Không bật đồng loạt tất cả workers trong một lần cutover.

## Rollback

Rollback không được reset DB.

- Trỏ Web/Mobile/Gateway về C# endpoint trước.
- Tắt toàn bộ Node background writer.
- Khởi động lại C# worker/service.
- Chạy DB audit + kiểm tra cart reservation, payment pending, chat waiting/agent và shipping status.
- Giữ dữ liệu phát sinh trong MariaDB; không copy ngược hay reseed.

## Điều kiện được xóa C#

Chỉ khi:

- `cutover:audit.finalCutoverReady=true`;
- legacy-only surface count = 0;
- runtime parity toàn critical flow pass;
- Web/Mobile/Admin đều đã dùng Node;
- rollback drill đã thử;
- backup có thể restore.

Nếu bất kỳ điều kiện nào chưa đạt, C# vẫn phải được giữ làm rollback/reference.
