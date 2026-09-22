# Architecture

## Overview

KaitoKidShop is a full-stack monorepo with separate mobile and web clients backed by ASP.NET Core services and a shared MariaDB database.

```text
                 ┌─────────────────┐
                 │  apps/mobile    │
                 │ Expo / RN       │
                 └────────┬────────┘
                          │
                 Auth :5053 / Customer :5265
                          │
                 ┌────────▼────────┐
                 │ ASP.NET Core    │
                 │ backend APIs    │
                 └────────┬────────┘
                          │ Pomelo / EF Core
                 ┌────────▼────────┐
                 │ MariaDB 10.4.32 │
                 │ kaitokid        │
                 └─────────────────┘

                 ┌─────────────────┐
                 │   apps/web      │
                 │ React + Vite    │
                 └────────┬────────┘
                          │
                       APIs
```

## Top-level layout

### `apps/mobile`

Expo/React Native application.

Important paths:

- `src/app` — Expo Router screens/routes
- `src/services/api-client.ts` — API.Customer HTTP client
- `src/services/auth.service.ts` — API.Auth client
- `src/services/orders.api.ts` — Orders/Tracking/Cancel/Reorder client
- `src/app/orders` — order list/detail/tracking routes
- `app.config.js` — runtime Expo configuration and LAN API auto-detection
- `package.json` — mobile dependencies/scripts

API.Customer URL resolution:

1. `EXPO_PUBLIC_API_URL`, when explicitly set
2. Android emulator fallback when applicable
3. Expo runtime `extra.apiUrl`, normally populated by LAN auto-detection
4. platform fallback

API.Auth currently reads `EXPO_PUBLIC_AUTH_API_URL`, with localhost fallback.

For USB-connected Android development, `scripts/run-mobile.bat` attempts ADB reverse for ports 8081, 5053 and 5265.

### `apps/web`

Independent React + TypeScript + Vite client.

This is not the same thing as Expo Web. A browser on port 8081 is rendering the mobile Expo application; the Vite application normally runs separately.

### `backend`

ASP.NET Core backend.

Services:

- `API.Auth` — authentication service, port 5053
- `API.Customer` — customer/shop API, port 5265
- `API.Admin` — admin API, port 5089
- `API.Gateway` — API gateway, port 5155
- `API.Customer.Tests` — tests
- `DbHelper` — shared database registration/interceptors
- `Shared` — shared backend functionality
- `Database` — schema/migration/bootstrap assets

Solution file:

`backend/KaitoKidShop.slnx`

## Persistence

Current runtime database is MariaDB/MySQL-compatible.

`DbHelper/DbExtensions.cs` registers DbContexts using:

- Pomelo
- `UseMySql`
- `MariaDbServerVersion(10.4.32)`

The consolidated MariaDB schema is:

`backend/Database/KaitoKid_MariaDB.sql`

Legacy SQL Server/T-SQL files and old EF migrations remain for history. They are not the source for a fresh MariaDB setup.

## Local secret flow

Committed code must not contain real database passwords.

```text
backend/db.local.example.bat
            │ copy on first run
            ▼
backend/db.local.bat       (gitignored)
            │
            ▼
scripts/load-db-local.bat
            │
            ▼
ConnectionStrings__DefaultConnection
            │ inherited by child processes
            ▼
ASP.NET Core APIs
```

## Development launch flow

Root `run.bat` is optimized for mobile development:

```text
run.bat
  ├─ load local MariaDB configuration
  ├─ API.Auth :5053
  ├─ API.Customer :5265
  └─ Expo Mobile :8081
```

`scripts/run-backend.bat` starts all four backend services.

`scripts/run-all.bat` is the broader full-stack launcher.

## Source-of-truth rules

- Current code/configuration: Git `main`
- Current operational state: `docs/AI_HANDOFF.md`
- Stable architecture: this file
- Technical rationale: `docs/DECISIONS.md`
- Durable UI/UX rules: `docs/UI_UX.md`
- Repeatable fixes: `docs/TROUBLESHOOTING.md`
- Older chronology: `docs/history/`


## Mobile state layering

Protected shopping/checkout state is layered under auth:

```text
AuthProvider
  └─ NotificationsProvider
       └─ ShoppingProvider
            └─ CheckoutProvider
                 └─ Expo Router screens
```

- `NotificationsContext` owns only global unread-notification count/badge state.
- `ShoppingContext` owns wishlist/cart data and prepared checkout cart-item IDs.
- `CheckoutContext` owns checkout-scoped address, shipping option, coupon/combo, payment method, note and pending order.
- Full checkout state is not serialized into route query parameters. Order code may be used as a navigation identifier for payment/success recovery.

## Checkout source-of-truth boundary

For order creation, API.Customer is authoritative for:

- cart item ownership;
- product prices and selected subtotal;
- coupon validity;
- combo discount;
- stock/reservation;
- shipping quote;
- enabled payment methods.

`CreateOrderDTO.CartItemIds` enables partial checkout. Selected items are converted into the order and removed from Cart; unselected items remain reserved in Cart.

Payment account/QR data comes from `CauHinhCuaHang`. Mobile does not embed bank credentials or a VietQR gateway URL.


## Orders/Tracking security boundary

PHASE 7 keeps order history private to the authenticated customer:

- `GET /api/orders` and `GET /api/orders/{id}` filter by JWT user ID;
- `PUT /api/orders/{id}/cancel` checks ownership and server-side cancellation rules;
- `GET /api/shipping/track/{orderCode}` requires authorization and filters by both order code + JWT user ID;
- `POST /api/cart/reorder/{orderId}` checks order ownership before adding any item;
- `OrderDTO.CanCancel` is computed by API.Customer; Mobile does not duplicate cancellation eligibility rules.

Mobile order pages keep data screen-local rather than adding a global Orders context. Reorder refreshes `ShoppingContext` because Cart/badge is global shopping state.


## Reviews/Notifications/Account boundary

PHASE 8 keeps post-purchase/account rules server-authoritative:

- Review create requires an authenticated user, an owned `completed` order, the requested product and a purchased size/color variant from that exact order.
- `OrderDTO.HasReviewed` is variant-aware (`order + product + size + color`) while preserving wildcard compatibility for legacy reviews without variant metadata.
- Newly submitted reviews remain `pending`; Product Detail continues to expose only approved reviews, while Order Detail treats the submitted variant as already reviewed.
- Review/avatar media is selected with Expo Image Picker and uploaded as multipart to API.Customer; upload requests use a longer 45-second timeout without changing normal API timeouts.
- Notification read/delete endpoints remain owner-scoped. Mobile uses backend `link` only when it is an explicit internal path.
- Account delete must call `CartService.ClearCartAsync` before removing Cart rows so product/variant reservations are released. Notifications, wishlist and addresses are removed; review display names are anonymized; order history remains per the existing backend retention contract.
- Profile, points and vouchers are screen-local data. Only unread notification count is global because the Account tab badge needs cross-screen state.
