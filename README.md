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
│  └─ KaitoKidShop.slnx
├─ scripts/
│  ├─ run-mobile.bat
│  ├─ run-web.bat
│  ├─ run-backend.bat
│  ├─ run-all.bat
│  ├─ stop-all.bat
│  └─ stop-all.ps1
├─ package.json
├─ .gitignore
└─ README.md
```

## Cài dependencies

```bat
cd apps\mobile
npm install

cd ..\web
npm install
```

## Chạy development trên Windows

Từ root repository:

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
