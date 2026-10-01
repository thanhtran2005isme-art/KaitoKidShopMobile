# KaitoKid Node API

`apps/api` là backend runtime duy nhất của KaitoKidShop sau khi retire ASP.NET Core C#.

## Runtime

- NestJS 11 + TypeScript
- Prisma 7 + `@prisma/adapter-mariadb`
- MariaDB `kaitokid`
- REST/Auth/Admin/Customer/media trên cùng origin
- Socket.IO path `/chatHub`
- Port mặc định `5300`

## Chuẩn bị local

```bat
cd apps\api
copy .env.example .env
npm install
npm run db:audit
```

Điền `DATABASE_URL`, `JWT_KEY` và các secret tích hợp cần thiết trong `.env`. Không commit `.env`.

## Database safety

- Fresh schema: `database/KaitoKid_MariaDB.sql`.
- Existing DB migrations: `database/migrations/`.
- Không chạy `prisma migrate reset`, `prisma migrate dev` hoặc `prisma db push` trên database đang có dữ liệu.
- Khi cần introspection: `npm run db:introspect`.

## Chạy

```bat
npm run start:dev
```

Hoặc từ root:

```bat
scripts\run-backend.bat
```

## Gate

```bat
scripts\node-final-cutover-check.bat
scripts\node-final-runtime-smoke.bat
scripts\node-protected-runtime-parity.bat
scripts\node-concurrency-race-gate.bat
scripts\node-realtime-runtime-gate.bat
```
