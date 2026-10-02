# 15. Git and collaboration

How work moves from an idea to `main`. Rules: R-GIT-1 … R-GIT-6 in [00-rules-and-regulations.md](00-rules-and-regulations.md). The canonical short version is `AGENTS.md` §9 "Git workflow".

## 1. Repository

- GitHub: `https://github.com/amritgyawali/weddingmarketplace` (remote `origin`). Push and open pull requests **only** here (R-GIT-6). Other remotes on a machine belong to other accounts; never push to them.
- Default branch: `main`. Only the owner merges into it.

## 2. The workflow

```
origin/main ──► git worktree add -b feature/x ../wt-x origin/main
                git push -u origin feature/x            (push the new branch at once)
                … work, check (Definition of Done) …
                git add <only your files>
                git commit
                git push
                open a pull request into main           (one PR per task)
                owner reviews and merges
```

1. **Branch** from the latest `origin/main` (`git fetch origin` first). Names: `feature/<short-name>`, `fix/<short-name>`, `docs/<short-name>`.
2. **Push immediately** (`git push -u origin <branch>`), so the branch exists on GitHub from the start.
3. **Commit** only the files your task changed (R-GIT-3). Message: a short imperative subject line, a blank line, then what changed and why. Quote rule ids when relevant.
4. **Pull request into `main`**, always (R-GIT-2), even when the branch was cut from another feature branch. If a PR for the branch exists, pushing updates it; don't open a duplicate.
5. **Description:** what changed and why; how it was tested (which checks, which roles smoke-tested); what the reviewer should look at. Mark it draft and list failures if a check could not pass.
6. **Never** merge, push to `main`, force-push or rewrite pushed history (R-GIT-4).

Opening a PR without the `gh` CLI: `POST https://api.github.com/repos/amritgyawali/weddingmarketplace/pulls` with the token from `git credential fill`. Never print the token (R-SEC-6).

## 3. Parallel work and worktrees

The owner often runs several AI sessions and people on the repo at once.

- Never switch branches in a working tree someone else is using (R-GIT-5). Use a separate worktree per task: `git worktree add -b <branch> ../wt-<name> origin/main`.
- A worktree needs `node_modules`: on Windows, create a junction to an existing install (`mklink /J node_modules ..\wedding-app\node_modules`) instead of reinstalling.
- Shared hot spots that collide often: `src/store/db/*`, `src/types/platform.ts`, `src/app/_layout.tsx`, `src/i18n/ne/index.ts`, `AGENTS.md`. Agree who owns them before editing; keep edits there small.
- Fetch before pushing; other sessions may have pushed merge commits to the same branch.
- Use a temporary WIP commit rather than `git stash` (the stash stack is shared between worktrees).

## 4. Code review checklist

Reviewers (people or AI) check, in order:

1. **Prime directive:** nothing existing breaks (routes, actions, persisted keys, statuses, seed ids, demo).
2. **Layering:** business rules in services, state changes in store actions, no writes from screens.
3. **Invariants** (R-BIZ-*): quote versions, totals, milestones, splits, payables.
4. **Personas:** rules added, matrix updated intentionally.
5. **Security:** permissions in actions and SQL; no secrets; no personal data in telemetry.
6. **UI:** tokens, type, sentence case, empty states, both widths, Nepali lines.
7. **SQL:** new migration only, RLS, definer + search_path, tests in `scripts/db`.
8. **Docs:** JSDoc on new exports, handbook and `AGENTS.md` updated, `npm run docs:generate` run.
9. **Checks:** CI green.

## 5. Commit message example

```
Add deposits tool for vendors

Vendors asked to track security deposits they hold for couples and when
they go back. New vendor.deposits tool on EntryList (toolEntries, no new
persisted key), visible to businesses with core.finance. Persona matrix
updated: every vendor fixture gains the tool.

Checks: tsc, lint, check:personas, docs:generate. Smoke-tested as
Rajesh (venue) at phone and desktop width.
```
