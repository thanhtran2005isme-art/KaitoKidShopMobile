# D028 — Ví KaitoKid dùng ledger và withdrawal hold

**Ngày:** 2026-10-06

## Bối cảnh

KaitoKid cần hai khả năng sau hậu mãi:

1. tiền hoàn hàng vào số dư nội bộ để khách dùng mua tiếp;
2. khách có thể rút số dư về tài khoản ngân hàng, Admin xử lý chuyển khoản thực tế.

Không dùng mô hình chỉ có một cột `SoDu` để Admin cộng/trừ tùy ý. Hệ thống tiền phải có audit, idempotency và chống race/double-spend.

## Quyết định

Ví KaitoKid gồm ba lớp dữ liệu:

- `ViDienTu`: snapshot số dư khả dụng và số dư tạm giữ;
- `GiaoDichVi`: ledger append-only cho mọi biến động tiền;
- `YeuCauRutTien`: state machine của yêu cầu rút về ngân hàng.

Schema hiện hành tăng từ **52 lên 55 bảng**.

## Số dư

`ViDienTu` có hai bucket:

- `SoDuKhaDung`: có thể dùng thanh toán đơn hoặc tạo yêu cầu rút;
- `SoDuTamGiu`: đã dành cho withdrawal đang xử lý, không thể chi tiêu lại.

Invariant:

```text
SoDuKhaDung >= 0
SoDuTamGiu >= 0
```

Mọi thay đổi balance phải khóa row ví trong transaction và đồng thời ghi ledger.

## Ledger

Các loại giao dịch tối thiểu:

- `refund_credit`: hoàn đơn vào ví;
- `order_payment`: dùng ví thanh toán đơn;
- `order_payment_reversal`: trả lại phần ví khi đơn bị hủy/hết hạn;
- `withdrawal_hold`: chuyển available → held lúc khách tạo yêu cầu rút;
- `withdrawal_released`: trả held → available khi từ chối/hủy xử lý;
- `withdrawal_completed`: giảm held sau khi Admin thực sự chuyển tiền.

Unique key:

```text
(NguoiDungId, Loai, ThamChieuLoai, ThamChieuId)
```

được dùng làm idempotency boundary. Cùng một order không được `refund_credit` hoặc reversal hai lần.

## Hoàn hàng → Ví KaitoKid

Theo D026, chỉ sau khi:

1. khách request return trong 15 ngày;
2. Admin duyệt;
3. hàng vật lý quay về;
4. Admin kiểm và chọn `restock` hoặc `quarantine`;

thì transaction nhận hàng hoàn mới:

- xử lý inventory;
- chuyển `DonHang` sang `returned`;
- credit `DonHang.TongTien` vào ví bằng `refund_credit`;
- ghi `refund_wallet_credited`.

Không tạo `refund_pending` cho case mới. `refund_pending/refund_completed_manual` chỉ còn để tương thích dữ liệu legacy.

## Dùng ví khi checkout

Customer Web/Mobile chỉ gửi:

```json
{ "useWallet": true }
```

Backend tự tính:

```text
walletUsed = min(SoDuKhaDung, DonHang.TongTien)
amountDue = DonHang.TongTien - walletUsed
```

Không cho client tự quyết định số tiền ví cần trừ.

`DonHang.TongTien` vẫn giữ nguyên nghĩa là **tổng giá trị đơn sau discount + shipping**. Không đổi `TongTien` thành số tiền gateway/COD còn phải thu.

API order/payment trả thêm:

- `walletUsed`;
- `amountDue`;
- khi cần, `orderTotal` để phân biệt full total với external payable.

### Ví trả đủ

Nếu `amountDue = 0`:

- order được xác nhận thanh toán ngay trong transaction tạo đơn;
- không tạo payOS payment;
- Web/Mobile không mở màn QR;
- shipping có thể bắt đầu theo rule đơn đã paid/confirmed hiện hành.

### Ví trả một phần

- COD: phần còn lại là nghĩa vụ thanh toán COD;
- ATM/payOS: payOS chỉ được tạo/verify/reconcile đúng `amountDue`;
- webhook payOS có amount khác `amountDue` phải bị từ chối.

## Hủy / hết hạn

Nếu order đã dùng ví nhưng bị hủy hoặc ATM hết hạn chưa thanh toán:

- inventory/coupon/cart xử lý theo workflow hiện hành;
- `order_payment_reversal` trả lại đúng phần `walletUsed`;
- reversal nằm trong cùng transaction local cancellation/expiry;
- repeated callback/double click không được credit lại lần hai.

## Withdrawal

State machine:

```text
pending -> approved -> completed
    \          
     -> rejected
approved -> rejected
```

### Tạo yêu cầu

Khách gửi:

- số tiền;
- ngân hàng;
- số tài khoản;
- tên chủ tài khoản;
- ghi chú tùy chọn.

Ngay trong transaction tạo request:

```text
available -= amount
held += amount
```

và ghi `withdrawal_hold`.

### Duyệt

Admin duyệt `pending -> approved`. Balance không đổi vì tiền đã hold từ lúc customer request.

### Hoàn tất

Chỉ sau khi Admin thực sự chuyển khoản bên ngoài KaitoKid:

- nhập mã giao dịch ngân hàng;
- `approved -> completed`;
- `held -= amount`;
- ghi `withdrawal_completed`.

### Từ chối

Với `pending` hoặc `approved`:

```text
held -= amount
available += amount
```

và ghi `withdrawal_released`.

## RBAC

Tài chính dùng quyền riêng:

- `wallet.view`;
- `wallet.manage`.

Không dùng `orders.update_status` thay cho quyền tài chính.

Endpoint nhận hàng hoàn cần đồng thời:

- `orders.update_status`;
- `inventory.manage`;
- `wallet.manage`;

vì thao tác đó vừa thay đổi order, inventory vừa phát sinh credit tiền.

## Hủy tài khoản

Không cho anonymize/hủy tài khoản khi:

- `available > 0`;
- `held > 0`;
- có withdrawal `pending` hoặc `approved`.

Lý do: tài khoản hiện được anonymize chứ không xóa vật lý; mất quyền truy cập khi tiền vẫn tồn tại là lỗi tài chính.

## API

Customer:

- `GET /api/wallet`
- `GET /api/wallet/transactions`
- `GET /api/wallet/withdrawals`
- `POST /api/wallet/withdrawals`

Admin:

- `GET /api/admin/wallet/withdrawals`
- `POST /api/admin/wallet/withdrawals/:id/approve`
- `POST /api/admin/wallet/withdrawals/:id/reject`
- `POST /api/admin/wallet/withdrawals/:id/complete`

## UI

Customer Web/Mobile:

- xem available/held/total;
- xem ledger;
- tạo withdrawal;
- xem trạng thái withdrawal;
- bật/tắt “Dùng số dư Ví KaitoKid” ở checkout.

Admin:

- lọc/list withdrawal;
- duyệt;
- từ chối và release hold;
- sau khi chuyển khoản, nhập bank reference và complete.

Không có UI “sửa số dư”.

## Database rollout

Existing DB phải chạy:

```text
database/migrations/20261006_wallet_refund_withdrawal.sql
```

sau đó `/health` phải audit **55/55** bảng.

Migration là create-only/idempotent với dữ liệu hiện hữu; không được dùng `prisma migrate reset`, `prisma migrate dev` hoặc `db push` trên database có dữ liệu.
