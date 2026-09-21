# Repository guidance

KaitoKidShop is a full-stack monorepo.

## Required reading order for AI / coding agents

Before making non-trivial changes, read:

1. `AGENTS.md` (this file)
2. `docs/AI_HANDOFF.md` — current project state
3. `docs/BRAND.md` — KaitoKid brand/data rules
4. `docs/ROADMAP.md` — current implementation phase
5. `docs/ARCHITECTURE.md` — stable system architecture
6. The task-relevant sections of `docs/DECISIONS.md` and `docs/TROUBLESHOOTING.md`
7. Relevant source files and recent Git history for the area being changed

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
5. Commit changes with a Vietnamese commit message.
6. Open a PR and merge only when clean.
7. Update documentation when the project state, architecture, operational procedure, or a durable decision changes.

### Số lượng commit cho mỗi task/fix/phase

Mặc định **một yêu cầu sửa, một task hoặc một PHASE = một commit duy nhất**.

Quy tắc:

- Không commit riêng từng file.
- Không commit từng bước trung gian trong lúc đang triển khai.
- Gom toàn bộ thay đổi thuộc cùng một task/fix/PHASE, kiểm tra xong rồi mới tạo **một commit tổng hợp**.
- Nếu một task sửa nhiều file, phải dùng cơ chế batch commit (ví dụ Git tree/commit hoặc tương đương) thay vì API cập nhật file nào commit file đó.
- Khi merge PR, ưu tiên **squash merge** để `main` chỉ nhận một commit cho task/PHASE đó.
- Chỉ tách nhiều commit khi thay đổi thực sự là nhiều công việc độc lập, cần rollback riêng, hoặc người dùng yêu cầu rõ ràng.
- Không gom các task không liên quan vào cùng một commit.

Ví dụ đúng:

- PHASE 5 sửa 12 file → 1 commit: `feat: hoàn thành phase 5 giỏ hàng mobile`
- Một lần fix lỗi ảnh 404 sửa 4 file → 1 commit: `fix: sửa toàn bộ đường dẫn ảnh sản phẩm bị 404`

Ví dụ không nên làm:

- `feat: sửa file cart.tsx`
- `fix: sửa service cart`
- `docs: cập nhật roadmap`
- `docs: cập nhật handoff`

nếu tất cả các thay đổi trên cùng thuộc một PHASE/task duy nhất.

### Ngôn ngữ commit

Tất cả commit do AI/GPT tạo cho repository này phải viết bằng **tiếng Việt**.

Có thể giữ tiền tố Conventional Commits bằng tiếng Anh như `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, nhưng phần mô tả sau tiền tố phải là tiếng Việt, rõ ràng và nói đúng nội dung thay đổi.

Ví dụ:

- `feat: hoàn thiện giỏ hàng trên mobile`
- `fix: sửa đường dẫn ảnh sản phẩm bị 404`
- `docs: cập nhật trạng thái dự án cho phiên làm việc mới`

Không dùng commit message chung chung như `update`, `fix stuff`, `changes` hoặc mô tả hoàn toàn bằng tiếng Anh, trừ khi người dùng yêu cầu khác một cách rõ ràng.

Do not use long-lived branches as project memory. Branches are for work in progress; merged history belongs in Git.

## Documentation maintenance

- Keep `docs/AI_HANDOFF.md` concise and focused on the current state.
- Put stable system structure in `docs/ARCHITECTURE.md`.
- Keep brand positioning and catalog rules in `docs/BRAND.md`.
- Keep phase status and next work in `docs/ROADMAP.md`.
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
