# KaitoKidShop

Full-stack monorepo gồm Mobile, Web và ASP.NET Core backend.

## Cấu trúc

```text
KaitoKidShop/
├─ apps/
│  ├─ mobile/              # Expo + React Native
│  └─ web/                 # React + Vite
├─ backend/
│  ├─ API.Auth/
│  ├─ API.Customer/
│  ├─ API.Customer.Tests/
│  ├─ API.Admin/
│  ├─ API.Gateway/
│  ├─ DbHelper/
│  ├─ Shared/
│  ├─ Database/
│  ├─ db.local.example.bat
│  └─ KaitoKidShop.slnx
├─ scripts/
│  ├─ load-db-local.bat
│  ├─ run-mobile.bat
│  ├─ run-web.bat
│  ├─ run-backend.bat
│  ├─ run-all.bat
│  ├─ stop-all.bat
│  └─ stop-all.ps1
├─ docs/
│  ├─ AI_HANDOFF.md
│  ├─ ARCHITECTURE.md
│  ├─ DECISIONS.md
│  ├─ TROUBLESHOOTING.md
│  └─ history/
├─ run.bat                # API.Auth + API.Customer + Expo Mobile
├─ package.json
├─ .gitignore
└─ README.md
```

## Tài liệu dự án / AI handoff

Khi bắt đầu một phiên làm việc mới, đọc theo thứ tự:

1. `AGENTS.md`
2. `docs/AI_HANDOFF.md`
3. `docs/ARCHITECTURE.md`
4. Tài liệu liên quan trong `docs/DECISIONS.md` và `docs/TROUBLESHOOTING.md`
5. Git history/source code liên quan đến task

`AI_HANDOFF.md` chỉ giữ trạng thái hiện tại. Lịch sử cũ được chuyển sang `docs/history/` để file handoff không phình vô hạn.

## Cài dependencies

```bat
cd apps\mobile
npm install

cd ..\web
npm install
```

## MariaDB local

Backend dùng MariaDB/MySQL qua Pomelo. Cấu hình bí mật local nằm trong:

```text
backend\db.local.bat
```

File này được `.gitignore` và không được push lên GitHub.

Lần đầu chạy `run.bat`, launcher sẽ tự tạo `backend\db.local.bat` từ file mẫu và mở Notepad. Thay `CHANGE_ME` bằng password local của user MariaDB `kaitokid`, lưu file rồi chạy lại `run.bat`.

Mẫu connection string:

```bat
set "ConnectionStrings__DefaultConnection=Server=localhost;Port=3306;Database=kaitokid;User=kaitokid;Password=CHANGE_ME;CharSet=utf8mb4;"
```

## Chạy development trên Windows

Mobile + API.Auth + API.Customer:

```bat
run.bat
```

Hoặc chạy từng phần từ root repository:

```bat
scripts\run-backend.bat
scripts\run-web.bat
scripts\run-mobile.bat
```

Hoặc chạy toàn bộ:

```bat
scripts\run-all.bat
```

Dừng stack development:

```bat
scripts\stop-all.bat
```

## npm shortcuts

```bash
npm run mobile
npm run web
npm run web:build
```

## Backend ports

- API.Gateway: 5155
- API.Auth: 5053
- API.Admin: 5089
- API.Customer: 5265

Tài liệu riêng: `apps/mobile/README.md` và `apps/web/README.md`.
