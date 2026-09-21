# Technical Decisions

This file records durable decisions and their rationale. It is not a chronological transcript.

## D001 — Use a full-stack monorepo

**Date:** 2026-09-21

**Decision:** Keep client applications under `apps/`, backend code under `backend/`, development launchers under `scripts/`, and documentation under `docs/`.

**Rationale:** The previous repository mixed mobile source at the root, backend under `BACKEND/`, and web under a nested `web/kaito-kid-react/` directory. The normalized structure makes ownership and tooling clearer.

**Consequence:** Do not move mobile/web source trees back to the repository root.

## D002 — Keep a root `run.bat` for the common mobile workflow

**Date:** 2026-09-21

**Decision:** Keep `run.bat` at repository root as a convenience launcher for API.Auth, API.Customer and Expo Mobile.

**Rationale:** The developer frequently uses the mobile stack and wants a one-click Windows workflow.

**Consequence:** Lower-level scripts remain in `scripts/`, while root `run.bat` acts as the convenient entry point.

## D003 — Use MariaDB locally through Pomelo

**Date:** 2026-09-21

**Decision:** Runtime backend persistence uses MariaDB 10.4.x / MySQL protocol through `Pomelo.EntityFrameworkCore.MySql`.

**Rationale:** The local development environment uses XAMPP MariaDB 10.4.32.

**Consequence:** Backend DbContexts use `AddMariaDb<TContext>()` / `UseMySql`. Legacy SQL Server migrations are retained only as historical material.

## D004 — Use one consolidated MariaDB schema for a fresh local database

**Date:** 2026-09-21

**Decision:** For a fresh MariaDB setup, use `backend/Database/KaitoKid_MariaDB.sql` rather than independently applying the legacy EF migration trees.

**Rationale:** Multiple DbContexts overlap tables, while the consolidated schema represents the intended local database.

**Consequence:** Do not run the old SQL Server migrations against MariaDB.

## D005 — Keep local DB credentials outside Git

**Date:** 2026-09-21

**Decision:** Store the local connection string in `backend/db.local.bat`, generated from `backend/db.local.example.bat`.

**Rationale:** A real password must not be committed, while the Windows launcher still needs a one-click development experience.

**Consequence:** `backend/db.local.bat` is gitignored and loaded through `scripts/load-db-local.bat`.

## D006 — Use short-lived branches + PRs for meaningful changes

**Date:** 2026-09-21

**Decision:** Develop meaningful changes on focused branches, merge through PRs, then delete stale merged branches.

**Rationale:** This provides reviewable history and safer rollback without turning branches into permanent documentation.

**Consequence:** Project memory is kept in Git history and `docs/`, not in long-lived “memory branches”.

## D007 — Treat Git + structured docs as durable AI project memory

**Date:** 2026-09-21

**Decision:** New AI/chat sessions should reconstruct context from `AGENTS.md`, `docs/AI_HANDOFF.md`, architecture/decision/troubleshooting docs, relevant source, and Git history.

**Rationale:** Chat memory is not a reliable store for an entire repository, every commit, and a long-running transcript.

**Consequence:** Keep `AI_HANDOFF.md` current and concise. Move old chronology to `docs/history/` rather than letting one file grow indefinitely.
