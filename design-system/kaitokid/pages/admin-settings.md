# Admin Settings — Payment

## Trạng thái hiện hành

Online payment của KaitoKid trên PR #75 đã cutover sang **payOS** theo D027.

Admin bank/VietQR verification được tạo ở giai đoạn trước của cùng PR và hiện chỉ là **legacy migration surface**. Nó không còn là payment provider, không còn quyền bật ATM cho đơn mới và không được mở rộng thêm như UX thanh toán hiện hành.

## payOS runtime

- Secrets `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` chỉ cấu hình ở backend/deployment; không nhập hoặc hiển thị trong Admin Web.
- Nếu đủ credentials và không có `payosEnabled=false`, backend tự quảng bá online payment qua compatibility method `ATM` + `paymentProvider=payos`.
- `bankEnabled`, `enableBankTransfer`, `bankAccounts` legacy không được kích hoạt online payment mới.
- Customer QR/payment link do backend/payOS cấp theo đúng order; Admin không upload QR làm authority.

## Legacy bank/VietQR section

Nếu code/UI cũ vẫn còn hiển thị trong migration window:

- coi dữ liệu bank/account là thông tin legacy, không phải source of truth của payment mới;
- không dùng trạng thái verify VietQR để quyết định Web/Mobile có được thanh toán online hay không;
- không thêm dependency customer checkout mới vào `VIETQR_CLIENT_ID` / `VIETQR_API_KEY`;
- không khôi phục dynamic `img.vietqr.io` hoặc QR upload làm payment path chính;
- cleanup UI này phải giữ nguyên dữ liệu DB cũ trừ khi có migration riêng được duyệt.

## UI hướng tới sau cleanup

Payment tab nên chỉ thể hiện:

1. COD enabled + COD fee;
2. payOS runtime status: configured / disabled / unavailable;
3. hướng dẫn rằng credentials được quản lý bằng backend secrets;
4. link/runbook kiểm thử payOS nếu cần;
5. không hiển thị secret thật.

## Trạng thái UI cần có

- payOS configured/active;
- payOS missing credentials;
- payOS disabled bởi `payosEnabled=false`;
- save COD loading/error/success;
- legacy data, nếu còn hiển thị, phải có nhãn rõ “legacy” và không được gây hiểu nhầm là provider hiện hành.

Durable decision: `docs/decisions/D027-payos-payment-lifecycle.md`.
Runbook: `docs/runbooks/PAYOS_PAYMENT_E2E.md`.
