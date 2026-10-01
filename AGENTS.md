# Repository guidance

KaitoKidShop is a full-stack monorepo.

## Required reading order for AI / coding agents

Before making non-trivial changes, read:

1. `AGENTS.md`
2. `docs/AI_HANDOFF.md`
3. `docs/BRAND.md`
4. `docs/UI_UX.md` + `skill/.codex/skills/ui-ux-pro-max/SKILL.md` for UI/UX work
5. `docs/ROADMAP.md`
6. `docs/PHASES_5_10.md` when relevant
7. `docs/ARCHITECTURE.md`
8. Relevant sections of `docs/DECISIONS.md`, `docs/decisions/`, and `docs/TROUBLESHOOTING.md`
9. Relevant source files and recent Git history

Git and repository documentation are the durable source of truth. Do not reconstruct current architecture from old chat memory.

## Current repository layout

- Backend: `apps/api` — NestJS 11 + TypeScript + Prisma 7, single backend origin on port `5300`.
- Mobile: `apps/mobile` — Expo SDK 57 + React Native.
- Web/Admin: `apps/web` — React + TypeScript + Vite.
- Database assets: `database` — MariaDB fresh schema and SQL migrations.
- Development/runtime scripts: `scripts`.
- Root launcher: `run.bat` starts Node API + Expo Mobile.
- Documentation: `docs`.

The legacy ASP.NET Core `backend/` tree is retired. Do not reintroduce runtime fallbacks to ports `5053`, `5265`, `5089`, or `5155`.

## Backend invariants

- MariaDB `kaitokid` remains the data source of truth.
- REST, Auth, Admin, Customer, media and Socket.IO are served by `apps/api`.
- Realtime path is `/chatHub` on the same Node origin.
- Background workers are owned by Node. Critical workers remain individually feature-flagged.
- Do not run `prisma migrate reset`, `prisma migrate dev` or `prisma db push` on an existing data-bearing database.
- Use `prisma db pull` / `npm run db:introspect` for introspection.
- Real secrets belong only in `apps/api/.env` or deployment secret storage; never commit them.

## Mandatory UI/UX workflow

For any UI/UX change:

1. read `docs/UI_UX.md`;
2. read `skill/.codex/skills/ui-ux-pro-max/SKILL.md`;
3. generate/search the design system first;
4. use the stack guideline appropriate to the surface (`react-native` for Mobile);
5. preserve brand/data rules from `docs/BRAND.md` and existing tokens;
6. review accessibility, touch targets, keyboard/form behavior, loading/error/empty states and responsive behavior before commit.

## Workflow

For meaningful changes:

1. Start from current `main`.
2. Create a focused short-lived branch.
3. Change only required files.
4. Validate relevant build/tests/runtime gates.
5. Commit with a Vietnamese description.
6. Open a PR and merge only when clean.
7. Update docs when architecture, operations or durable decisions change.

### Commit granularity

Default: **one task/fix/PHASE = one aggregate commit**.

- Do not commit file-by-file or step-by-step.
- Batch all changes for the same task, validate, then commit once.
- Prefer squash merge so `main` receives one meaningful commit.
- Split only when work items are truly independent and need separate rollback/review.

### Commit language

AI/GPT-created commits must use Vietnamese descriptions. Conventional prefixes such as `feat:`, `fix:`, `docs:`, `chore:` are allowed.

## Documentation maintenance

- `docs/AI_HANDOFF.md`: concise current state.
- `docs/ARCHITECTURE.md`: stable current architecture.
- `docs/BRAND.md`: brand/catalog rules.
- `docs/UI_UX.md`: durable UI/UX rules.
- `docs/ROADMAP.md`: phase status/next work.
- `docs/DECISIONS.md` and `docs/decisions/`: durable technical decisions.
- `docs/TROUBLESHOOTING.md`: repeatable operational fixes.
- `docs/history/`: old chronology.

## Security

Never commit passwords, private tokens, API keys, OAuth client secrets, email credentials or machine-specific secrets.

Local backend configuration belongs in:

```text
apps/api/.env
```

The committed template is:

```text
apps/api/.env.example
```
