# Swagger / OpenAPI — KaitoKidShop Node API

Swagger dùng để xem danh sách REST API của `apps/api` và thử request trong môi trường development.

## URL

Sau khi chạy:

```bat
scripts\run-all.bat
```

hoặc:

```bat
scripts\run-backend.bat
```

mở:

```text
http://localhost:5300/docs
```

OpenAPI JSON:

```text
http://localhost:5300/docs-json
```

Nếu truy cập từ thiết bị khác cùng LAN, dùng IP máy chạy backend, ví dụ:

```text
http://<IP-LAN-CUA-PC>:5300/docs
```

Backend vẫn listen trên `0.0.0.0:5300`; Windows Firewall phải cho phép cổng `5300` nếu truy cập qua LAN.

## JWT / Authorize

Swagger khai báo Bearer scheme `kaitokid-jwt` để thử protected API.

1. đăng nhập bằng flow KaitoKid hiện có để lấy access token;
2. bấm **Authorize** ở Swagger UI;
3. nhập **chỉ access token**, không tự thêm chữ `Bearer`;
4. Swagger sẽ gửi `Authorization: Bearer <token>` cho request thử.

Security requirement được khai báo toàn cục để thuận tiện cho `Try it out`. Điều này không thay đổi Auth/RBAC thật của backend: endpoint public vẫn public, endpoint protected vẫn phải qua guard/RBAC hiện hành.

## Khi nào Swagger được bật

Mặc định:

- development/local: bật;
- `NODE_ENV=production`: tắt.

Override explicit:

```text
SWAGGER_ENABLED=true
```

để bật, hoặc:

```text
SWAGGER_ENABLED=false
```

để tắt ở bất kỳ môi trường nào.

Không bật Swagger public production chỉ để debug nếu endpoint không được bảo vệ ở tầng network/reverse proxy phù hợp.

## Phạm vi tài liệu tự sinh

`SwaggerModule.createDocument(..., { deepScanRoutes: true })` quét toàn bộ controller HTTP của NestJS nên `/docs` là inventory route/method hiện hành của Node API.

Chi tiết schema request/response phụ thuộc metadata TypeScript/Swagger của từng DTO/controller. Những DTO chưa có metadata OpenAPI đầy đủ vẫn xuất hiện route nhưng schema có thể chưa chi tiết từng field. Khi bổ sung API/DTO mới, ưu tiên thêm metadata Swagger trong cùng task nếu endpoint cần tài liệu contract chi tiết.

Swagger không thay thế source of truth nghiệp vụ. Khi có mâu thuẫn, ưu tiên current `main`/branch code, database contract và durable decisions trong `docs/decisions/`.

## Regression gate

Có static contract:

```bat
npm --prefix apps\api run test:swagger
```

`test:final-cutover` cũng bao gồm `swagger-contract.test.mjs` để tránh vô tình mất `/docs`, `/docs-json`, JWT scheme hoặc production gate trong các lần refactor sau.
