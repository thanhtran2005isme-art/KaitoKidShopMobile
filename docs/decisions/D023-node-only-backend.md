# D023 — Retire ASP.NET Core và chốt Node là backend runtime duy nhất

**Ngày:** 2026-10-01

## Quyết định

KaitoKidShop dùng `apps/api` (NestJS + Prisma/MariaDB) làm backend runtime duy nhất. Legacy ASP.NET Core services, solution, DbHelper, Shared và API.Gateway được xóa khỏi source hiện hành.

SQL schema/migration không bị xóa; toàn bộ `backend/Database` được giữ nguyên nội dung và chuyển sang top-level `database/`.

Web/Mobile/Admin không được fallback về các port C# cũ `5053`, `5265`, `5089`, `5155`. Backend Node dùng một origin mặc định `:5300`, Socket.IO dùng `/chatHub` trên cùng origin.

Background worker ownership thuộc Node; biến owner cũ chỉ còn compatibility input và không được phép làm Node tự nhường ownership cho runtime đã retire.

## Lý do

PR #40 đã merge migration Node đầy đủ vào `main` sau khi project owner xác nhận PASS các gate source/build, Auth/RBAC runtime, commerce/payment/admin race, realtime, Web/Mobile/Admin smoke, soak và rollback. Giữ C# lâu hơn sau mốc này tạo hai nguồn runtime, tăng nguy cơ dual-worker, cấu hình nhầm port và drift business rule.

## Hệ quả

- `run.bat` và `scripts/run-all.bat` chỉ khởi động Node stack.
- `scripts/run-backend.bat` là alias Node API.
- Secret local nằm ở `apps/api/.env`.
- Fresh MariaDB schema nằm ở `database/KaitoKid_MariaDB.sql`.
- Regression gate phải fail nếu runtime client/launcher tái xuất hiện port C# hoặc `dotnet` backend command.
- Các `docs/NODE_*` migration runbook trước đây được xem là lịch sử cutover; khi xung đột, D023 + `docs/ARCHITECTURE.md` + current `main` thắng.

D023 supersede phần kiến trúc runtime của D001–D005 và D002 nơi các quyết định cũ còn nhắc `backend/`, Pomelo/.NET launcher hoặc split C# ports. Các business decision D010–D022 vẫn giữ nguyên trừ khi có quyết định mới thay thế rõ ràng.
