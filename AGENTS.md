# Repository guidance

KaitoKidShop is a full-stack monorepo.

- Mobile: `apps/mobile` — Expo SDK 57 + React Native. Before changing Expo APIs, read https://docs.expo.dev/versions/v57.0.0/.
- Web: `apps/web` — React + TypeScript + Vite.
- Backend: `backend` — ASP.NET Core services.
- Development launchers: `scripts`.

Keep app-specific configuration inside its app directory. Do not place mobile or web source trees back at repository root.
