# KaitoKid Node API

Backend Node.js/NestJS mới được dựng **song song** với backend ASP.NET Core để chuyển từng module mà không làm mất dữ liệu hiện có.

## Nguyên tắc dữ liệu

- MariaDB `kaitokid` hiện tại là source of truth.
- Không tạo database mới để "copy dữ liệu".
- Không chạy `prisma migrate reset`, `prisma migrate dev` hoặc `prisma db push` trên database đang chứa dữ liệu C#.
- Dùng `prisma db pull` để introspect schema hiện tại.
- Chỉ bỏ C# sau khi API contract + business rule của module Node đã parity pass.

## Chuẩn bị

```bat
cd apps\api
copy .env.example .env
npm install
npm run db:introspect
npm run db:audit
```

Nếu `compatible: true` thì schema cũ đạt contract 52 bảng. Nếu có `missingTables` thì dừng migration và xử lý DB trước.

## Chạy song song

```bat
npm run start:dev
```

Node mặc định chạy `http://localhost:5300`, tách khỏi C# :5053/:5265/:5089/:5155.
Trong phase nền này Web/Mobile vẫn gọi C#; chưa cutover traffic.
