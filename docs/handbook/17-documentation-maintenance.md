# 17. Documentation maintenance

Documentation stays useful only if it stays true. Vivah keeps it true in three ways: docs change **with** the code (R-GEN-6), the code reference is **generated** (R-DOC-3), and a **weekly pass** catches what slipped through (R-DOC-4).

## 1. What lives where

| Kind | Location | Updated |
|---|---|---|
| Binding rules for agents | `AGENTS.md` | with every change that alters a rule or architecture fact |
| Guides (why and how) | `docs/handbook/*.md` | with every change; reviewed weekly |
| Code reference (what) | `docs/reference/` | generated: `npm run docs:generate`; regenerated weekly |
| In-code docs | JSDoc on exports, header comment per file, `--` header per migration | with every change |
| Product overview | `README.md` | when features change |
| Strategy and runbooks | `docs/MASTER_PLAN.md`, `docs/SETUP_SUPABASE.md`, `docs/LAUNCH.md` | when plans or setup change |
| Test status | `TEST_REPORT.md` | after a full test run; when defects open or close |
| Decisions | `docs/handbook/20-decision-log.md` | when a decision is made |

## 2. The generator

```bash
npm run docs:generate   # rewrite docs/reference/ from the code
npm run docs:check      # exit 1 if docs/reference/ is out of date
```

`scripts/docs/generate-reference.mjs` parses the TypeScript with the compiler API (no app code runs) and reads the SQL as text. It writes:

- `README.md`: index of pages;
- `routes.md`: every route by role with its screen's JSDoc;
- `store-actions.md`: every `*Actions` interface member (the app's API) with signature and JSDoc;
- `database.md`: per migration, its header comment and the tables, views, types, functions, triggers, jobs, policy and index counts;
- `edge-functions.md`, `scripts.md` (npm scripts, script headers, workflows);
- `code/<folder>.md`: every export of every source folder with signature, JSDoc and members;
- `coverage.md`: exports without JSDoc, worst files first;
- `index.json`: the same as data for tools and AI.

Output is deterministic (sorted, no timestamps): unchanged code gives no diff. If you improve the generator, keep it dependency-free (it uses only `typescript`, already a dev dependency) and deterministic.

## 3. The weekly documentation pass

**When:** every Monday. The `docs-weekly.yml` GitHub workflow regenerates `docs/reference/` automatically and opens a pull request when it changed. The prose review below needs a person or an AI agent (the owner can schedule a Claude Code routine with the prompt in §5).

**Steps (about 30–60 minutes):**

1. `git fetch origin` and branch `docs/weekly-YYYY-MM-DD` from `origin/main` (in its own worktree).
2. List what merged since the last pass: `git log --since="8 days ago" --merges --first-parent origin/main --format="%h %s"`, and `git diff --stat <last-pass-commit>..origin/main`.
3. `npm run docs:generate`. Read the diff of `docs/reference/`: new routes, actions, exports, migrations.
4. For each merged change, update the handbook guide(s) that describe that area. Check especially:
   - new routes or screens → [03-frontend.md](03-frontend.md), and [01](01-product-and-domain.md) if a feature is new;
   - new or changed actions, collections, persist versions → [05](05-state-and-data.md);
   - new migrations or RPCs → [07](07-database.md), [06](06-backend.md);
   - money or status rules → [08](08-business-logic.md) and `AGENTS.md` §4–§5;
   - tools, occasions, trades, permissions → [09](09-personas-and-access.md), [10](10-toolkits.md);
   - design tokens → [04](04-ui-ux.md);
   - workflows, env vars, SDK version → [14](14-devops-and-release.md);
   - fixed or new defects → [12 §4](12-testing-and-qa.md#4-known-defects), `AGENTS.md` §10, `TEST_REPORT.md`.
5. **Verify facts:** for every code name the touched guides mention, confirm it still exists (search `docs/reference/index.json`). Fix or remove stale names.
6. **Raise JSDoc coverage:** pick 20–40 exports from the top of `docs/reference/coverage.md` (or the files touched that week) and add one-line JSDoc that says what each is *for*. Doc comments only: **no behaviour changes** in a docs pull request. Re-run `npm run docs:generate`.
7. Add decisions made that week to [20-decision-log.md](20-decision-log.md).
8. Update the "Last full review" line in [README.md](README.md) with the date and the `main` commit or PR number.
9. Run `npx tsc --noEmit`, `npx expo lint` (JSDoc edits touch source files) and `npm run docs:check`.
10. Commit (`Weekly docs pass: <date>`), push, open a pull request into `main` listing what was updated and the coverage before and after.

**Coverage target:** 43% of exports had JSDoc on 2 October 2026. Aim for +5 points a week until 90%, then keep it there; every new export must have JSDoc (R-DOC-1).

## 4. Writing style for docs

- Plain English, short sentences, sentence case headings (R-DOC-5).
- Explain *why* as well as *what*; a reader in five years needs the reason.
- Date anything that will change ("as of 2 Oct 2026").
- Use exact code names in backticks; link files with relative links.
- Prefer tables for lookups and numbered steps for procedures.
- One topic per guide; link instead of repeating. If a rule appears in two places, `AGENTS.md` is canonical.

## 5. Prompt for an AI-run weekly pass

Use this as the prompt of a scheduled agent (for example a Claude Code routine on this repository, weekly on Monday morning Nepal time):

> Run the weekly documentation pass for the Vivah repository exactly as described in `docs/handbook/17-documentation-maintenance.md` §3. Read `AGENTS.md` first and follow its git workflow: work on a new branch `docs/weekly-<today>` from the latest `origin/main`, change only documentation and JSDoc comments (no behaviour changes), run `npm run docs:generate`, `npx tsc --noEmit`, `npx expo lint` and `npm run docs:check`, then commit, push and open a pull request into `main` that lists every guide you updated, the merged pull requests you covered, and JSDoc coverage before and after. Never merge, never push to `main`, never force-push. If nothing merged since the last pass and coverage work is done, open no pull request and say so.
