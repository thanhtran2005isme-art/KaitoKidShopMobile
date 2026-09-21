# AI Handoff — Current State

Last updated: 2026-09-22

This file is intentionally concise. It describes the current state needed to continue work quickly. Historical detail belongs in `docs/history/`, and exact code history belongs in Git.

## Repository

- GitHub: `thanhtran2005isme-art/KaitoKidShopMobile`
- Default branch: `main`
- Project name used in docs/UI: KaitoKidShop
- Brand: **KaitoKid = thời trang trẻ em 0–12 tuổi**
- Brand rules: `docs/BRAND.md`
- Current roadmap: PHASE 1–3 hoàn tất, tiếp theo PHASE 4 — Wishlist + Add to Cart
- Roadmap source: `docs/ROADMAP.md`
- Structure: full-stack monorepo
- Git convention: mọi commit do AI/GPT tạo phải có phần mô tả bằng **tiếng Việt**; có thể giữ tiền tố Conventional Commits như `feat:`, `fix:`, `docs:`.

## Current structure

```text
KaitoKidShop/
├─ apps/
│  ├─ mobile/       Expo + React Native
│  └─ web/          React + TypeScript + Vite
├─ backend/         ASP.NET Core services + database assets
├─ scripts/         Windows development launchers
├─ docs/            durable project/AI context
├─ run.bat          API.Auth + API.Customer + Expo Mobile
├─ AGENTS.md
└─ README.md
```

## Development stack

### Mobile

- Expo SDK 57
- React Native
- Metro/Expo development port: `8081`
- `http://127.0.0.1:8081` is Expo Web for the mobile app, not the separate Vite web app.
- Customer API environment variable: `EXPO_PUBLIC_API_URL`
- Auth API environment variable: `EXPO_PUBLIC_AUTH_API_URL`
- `apps/mobile/app.config.js` can auto-detect a LAN IPv4 for API.Customer when no explicit customer API URL is provided.

### Web

- React + TypeScript + Vite
- Typical development port: `5173`
- Source lives in `apps/web`

### Backend

- ASP.NET Core / .NET 10 projects
- API.Auth: `5053`
- API.Customer: `5265`
- API.Admin: `5089`
- API.Gateway: `5155`

### Database

- Local server used during development: MariaDB `10.4.32` from XAMPP
- EF provider: `Pomelo.EntityFrameworkCore.MySql 8.0.3`
- Database: `kaitokid`
- Verified base table count: `51`
- Backend DbContexts register through `AddMariaDb<TContext>()`
- Legacy SQL Server migrations remain as history and are excluded from compilation.
- Initial/fresh MariaDB schema source: `backend/Database/KaitoKid_MariaDB.sql`
- Dữ liệu seed đã chuẩn hóa sang trẻ em.
- Database local hiện tại cần chạy `backend/Database/migrations/20260922_phase1_kids_branding.sql` sau khi pull PHASE 1.

## Local database credentials

Secrets are not stored in Git.

- Template: `backend/db.local.example.bat`
- Local secret file: `backend/db.local.bat`
- `backend/db.local.bat` is gitignored.
- `scripts/load-db-local.bat` loads `ConnectionStrings__DefaultConnection`.
- On first launch, the helper creates the local file from the template and asks the developer to replace `CHANGE_ME`.

## Main development launchers

### Mobile + main APIs

Run from repository root:

```bat
run.bat
```

It loads local DB configuration, then starts:

1. API.Auth
2. API.Customer
3. Expo Mobile

### Backend services

```bat
scripts\run-backend.bat
```

Starts API.Auth, API.Customer, API.Admin and API.Gateway after loading local DB configuration.

### Other launchers

- `scripts/run-mobile.bat`
- `scripts/run-web.bat`
- `scripts/run-all.bat`
- `scripts/stop-all.bat`

## Verified working state

As of 2026-09-21:

- MariaDB is reachable locally.
- Database `kaitokid` exists with 51 base tables.
- API.Auth starts on port 5053.
- API.Customer starts on port 5265 with correct local DB credentials.
- Expo/Metro starts on port 8081.
- The mobile home screen loads categories and product data from API.Customer.
- PHASE 2 Home UI đã được nâng cấp: header, cart badge có token, hero auto-slide + dots, promo strip, root categories, discovery tiles, product cards và skeleton loading.
- PHASE 3 Product Detail đã hoàn chỉnh phần xem/chọn: gallery, màu, size, size guide, số lượng, tồn kho, specs, review read-only, share và related products.
- API Product Detail trả `variantInventory` từ `TonKhoBienThe` nếu có; nếu chưa có dữ liệu biến thể thì mobile fallback về `SanPham.TonKho`.
- Product Detail cho phép mở cả sản phẩm `active` và `out-of-stock`; Home/Search vẫn chỉ liệt kê sản phẩm đang bán.
- Login mobile hiện dùng `AuthContext.login(email, password)` để lưu access token/session cho các API được bảo vệ.
- Expo Web renders the mobile app successfully at `127.0.0.1:8081`.
- API.Customer serves shared media from `apps/web/public` so existing banner URLs such as `/slide_1.jpg` resolve on port 5265.
- Seed product image paths under `/products/` currently have no source files in the repository; API.Customer returns a branded placeholder instead of 404 until real product media is added.

## Known non-blocking item

- PHASE 2 đã static-review nhưng chưa chạy được `npm/tsc` trong môi trường công cụ do không có DNS/network tới GitHub. Cần xác nhận runtime trên máy local sau khi pull.
- Wishlist/Add-to-cart thật chưa được nối; chúng là PHASE 4. Cart đầy đủ thuộc PHASE 5.
- Seed hiện chưa có ảnh phụ hoặc `TonKhoBienThe` mẫu; Product Detail đã có fallback tương thích và không cần migration mới cho PHASE 3.
- A NuGet warning about a known vulnerability in `Microsoft.OpenApi 2.0.0` has been observed during API.Auth build. It did not block startup, but dependency remediation should be handled separately rather than mixed into unrelated changes.

## How a new AI/chat should resume

1. Read `AGENTS.md`.
2. Read this file.
3. Read `docs/BRAND.md`.
4. Read `docs/ROADMAP.md`.
5. Read `docs/ARCHITECTURE.md`.
6. Read task-relevant decisions/troubleshooting.
7. Inspect the relevant current files.
8. Check recent Git history/PRs when the reason for existing code matters.
9. Khi tạo commit mới, viết commit message bằng tiếng Việt theo quy tắc trong `AGENTS.md`.

For exact historical changes, use Git rather than relying on this file.
