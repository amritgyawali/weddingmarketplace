# 16. AI agents guide

This page is for AI coding agents (Claude Code, Codex, Cursor, Copilot, Gemini and whatever comes next) and for people who direct them. It says how to load context cheaply, how to change code safely, and what to leave behind for the next session.

The binding rules are in [`AGENTS.md`](../../AGENTS.md) (loaded automatically by most agents; `CLAUDE.md` imports it) and [00-rules-and-regulations.md](00-rules-and-regulations.md).

## 1. Load context in this order

1. `AGENTS.md`: product decisions, architecture, invariants, definition of done, git workflow. **Always.**
2. [`llms.txt`](../../llms.txt): a one-page map of the docs.
3. The handbook guide for the area you will touch (table in [README.md](README.md)).
4. `docs/reference/index.json` for exact names: every route, every exported symbol with kind, signature, JSDoc and line. Search it instead of opening files one by one. Example:
   ```bash
   node -e "const j=require('./docs/reference/index.json');for(const f of j.files)for(const e of f.exports)if(/quote/i.test(e.name))console.log(f.file+':'+e.line,e.kind,e.name,'-',e.doc.slice(0,80))"
   ```
5. Only then open the source files you will change, and their callers (`grep -rn "actionName" src`).

If the reference looks stale (a symbol in the code is missing from it), run `npm run docs:generate` first.

## 2. Before writing code

- Restate the task in terms of this codebase: which store action, which service, which screen, which migration.
- Check whether something already exists (search `index.json` for the noun). Reuse beats new code.
- Identify the invariants in play (R-BIZ-*) and the persona rules (R-PER-*).
- Check for parallel sessions or people working on the same files ([15 §3](15-git-and-collaboration.md#3-parallel-work-and-worktrees)); work in your own worktree and branch.
- For any Expo, React Native or EAS API, read the versioned docs for the SDK in `package.json` (57 as of Oct 2026) at `https://docs.expo.dev/versions/v57.0.0/`; training data is often wrong about Expo (R-OPS-4).

## 3. While writing code

- Follow the layer rules: services pure, actions own state changes and side effects, screens only call actions (R-ARCH-*).
- Extend, don't mutate: optional fields, new actions, new migrations.
- Match the surrounding style: small typed helpers, a one-line JSDoc on every export, no comment noise, `@/…` imports.
- Add the Nepali line for every new English string.
- Never silence a check (R-GEN-4). Never cast to `any` to make types pass.
- Don't touch the owner's live services or apply SQL anywhere (R-PROD-10).

## 4. Before saying "done"

1. Run the Definition of Done ([12 §1](12-testing-and-qa.md#1-definition-of-done)). Report real results, including failures, with the output.
2. Update docs in the same change (R-GEN-6): JSDoc → `npm run docs:generate`; the handbook guide; `AGENTS.md` if a rule or architecture fact changed.
3. Commit only your files, push, open a pull request into `main` (R-GIT-*).
4. In your final message, list what changed, what was checked, and anything left open.

## 5. Writing for the next agent

- Prefer facts the code can't tell: *why* a choice was made, what was tried and failed, owner decisions with dates. Put durable ones in [20-decision-log.md](20-decision-log.md).
- Date time-sensitive statements ("as of 2 Oct 2026").
- Don't duplicate the code reference in prose; link to it.
- Keep `AGENTS.md` short and binding; put explanations in the handbook.

## 6. Prompts that work well with this repo

- "Read AGENTS.md and docs/handbook/08-business-logic.md, then change the default payment schedule to 40/40/20 everywhere it must change (services, SQL mirror, parity fixtures, docs)."
- "Using docs/reference/index.json, list every store action that writes the audit log and check each one also notifies the affected party."
- "Add a vendor tool for X following docs/handbook/10-toolkits.md §5."
- "Run the weekly documentation pass described in docs/handbook/17-documentation-maintenance.md."

## 7. Machine-readable files

| File | Content |
|---|---|
| `docs/reference/index.json` | `routes[]` (path, kind, file, component, doc) and `files[]` (file, doc, exports[] with name, kind, line, signature, doc, members) |
| `scripts/persona-matrix.json` | Which tools and staff routes each persona fixture sees |
| `scripts/parity-fixtures.json` | Money test cases shared by the app and SQL |
| `.env.example` | Every environment variable with an explanation |
