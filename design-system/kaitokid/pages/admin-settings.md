# Admin Settings — Payment / Bank Account

## Mục tiêu

Cấu hình tài khoản nhận chuyển khoản phải giảm tối đa lỗi nhập tay và không cho Admin tự khai báo tên ngân hàng/chủ tài khoản không được xác minh.

## Bank selector

- Tên ngân hàng không phải text input.
- Dùng catalog ngân hàng từ backend/VietQR, option hiển thị logo + short name + tên đầy đủ khi có.
- Giá trị nghiệp vụ lưu theo BIN/code chuẩn; không dựa vào casing hoặc chuỗi tên hiển thị.
- Chỉ cho chọn ngân hàng có `transferSupported` và `lookupSupported`.

## Account verification

- Số tài khoản: chỉ chữ số, 6–19 ký tự.
- Khi đổi ngân hàng hoặc số tài khoản, phải clear `accountHolder` + `verifiedAt` ngay.
- CTA `Xác minh tài khoản` gọi backend lookup.
- Thành công: hiển thị trạng thái verified, tự điền chủ tài khoản từ provider và khóa field đó.
- Thất bại: lỗi đặt ngay trong bank card; không fallback sang nhập tay tên chủ tài khoản.
- Khi bấm lưu Payment, toàn bộ bank slot được xác minh lại trước khi persist.

## Legacy config

Bank slot cũ chỉ có `bankName/accountNumber/accountHolder` được phép hiển thị để người quản trị nhận biết dữ liệu cũ, nhưng phải được xem là **chưa xác minh**. Admin phải chọn lại ngân hàng chuẩn và lookup thành công trước lần lưu kế tiếp.

## QR

QR upload/URL là phần riêng. Ảnh QR không được dùng để suy ra tên ngân hàng hoặc chủ tài khoản. Checkout có thể ưu tiên VietQR động theo từng đơn và dùng QR tĩnh như fallback theo payment contract hiện hành.

## Trạng thái UI

- catalog loading/error/retry;
- lookup idle/loading/verified/error;
- button save disabled/loading trong lúc verify;
- thông báo lỗi cụ thể, không dùng toast chung chung làm nguồn trạng thái duy nhất.
