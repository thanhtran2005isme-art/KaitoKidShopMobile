# Repository guidance

KaitoKidShop is a full-stack monorepo.

## Required reading order for AI / coding agents

Before making non-trivial changes, read:

1. `AGENTS.md` (this file)
2. `docs/AI_HANDOFF.md` — current project state
3. `docs/ARCHITECTURE.md` — stable system architecture
4. The task-relevant sections of `docs/DECISIONS.md` and `docs/TROUBLESHOOTING.md`
5. Relevant source files and recent Git history for the area being changed

Do not assume an old chat transcript is the source of truth. Git and the repository documentation are the durable project memory.

## Repository layout

- Mobile: `apps/mobile` — Expo SDK 57 + React Native.
- Web: `apps/web` — React + TypeScript + Vite.
- Backend: `backend` — ASP.NET Core services.
- Development launchers: `scripts`.
- Root launcher: `run.bat` starts API.Auth + API.Customer + Expo Mobile.
- Project documentation: `docs`.

Before changing Expo APIs, check the Expo SDK 57 documentation.

## Workflow

For meaningful changes:

1. Start from current `main`.
2. Create a focused branch.
3. Change only the required files.
4. Validate the relevant code/configuration.
5. Open a PR and merge only when clean.
6. Update documentation when the project state, architecture, operational procedure, or a durable decision changes.

Do not use long-lived branches as project memory. Branches are for work in progress; merged history belongs in Git.

## Documentation maintenance

- Keep `docs/AI_HANDOFF.md` concise and focused on the current state.
- Put stable system structure in `docs/ARCHITECTURE.md`.
- Record important technical choices in `docs/DECISIONS.md`.
- Record repeatable fixes in `docs/TROUBLESHOOTING.md`.
- Move older chronological detail to `docs/history/YYYY-MM.md`.
- Do not duplicate complete commit diffs in Markdown; reference PR numbers or commit SHAs instead.

## Security

Never commit passwords, tokens, API keys, or machine-specific secrets.

MariaDB local credentials belong in:

`backend/db.local.bat`

That file is gitignored. The committed template is:

`backend/db.local.example.bat`

## Repository conventions

Keep app-specific configuration inside its app directory. Do not place mobile or web source trees back at repository root.

Preserve the monorepo top-level structure:

- `apps/mobile`
- `apps/web`
- `backend`
- `scripts`
- `docs`

When a path changes, update launchers and documentation together.
