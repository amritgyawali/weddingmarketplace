/**
 * Builds the generated half of the documentation: docs/reference/.
 *
 * It reads the source with the TypeScript compiler (no app code runs) and the
 * SQL migrations as text, then writes one Markdown page per source folder that
 * lists every exported function, component, hook, constant, type and store
 * action with its signature and its JSDoc, plus the route map, the database
 * objects per migration, the Edge Functions, the scripts, a JSDoc coverage
 * report and index.json (the same data for tools and AI agents).
 *
 *   npm run docs:generate   rewrite docs/reference/
 *   npm run docs:check      exit 1 if docs/reference/ is out of date
 *
 * The output is deterministic (sorted, no timestamps), so running it on
 * unchanged code produces no diff. Never edit docs/reference/ by hand: change
 * the JSDoc in the code and run the generator. Hand-written guides live in
 * docs/handbook/.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = path.join(root, 'docs', 'reference');
const check = process.argv.includes('--check');

const rel = (p) => path.relative(root, p).split(path.sep).join('/');
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const oneLine = (s, max = 160) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};
const cell = (s) => s.replace(/\|/g, '\\|');
/** Link from a page in docs/reference/ (or a subfolder) to a source line. */
const src = (file, line, depth = 0) => `${'../'.repeat(depth + 2)}${file.replace(/[()[\] ]/g, (c) => encodeURIComponent(c).replace('(', '%28').replace(')', '%29'))}${line ? `#L${line}` : ''}`;

function walk(dir, filter) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, filter));
    else if (filter(p)) out.push(p);
  }
  return out;
}

// ─── TypeScript extraction ──────────────────────────────────────────────────

const isTs = (p) => /\.tsx?$/.test(p) && !p.endsWith('.d.ts');

function jsDocOf(node, sf) {
  const docs = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc);
  const doc = docs[docs.length - 1];
  if (!doc) return '';
  const text = typeof doc.comment === 'string' ? doc.comment : (doc.comment ?? []).map((c) => c.text ?? c.getText(sf)).join('');
  const tags = (doc.tags ?? [])
    .filter((t) => ['deprecated', 'returns', 'example'].includes(t.tagName.text))
    .map((t) => `@${t.tagName.text} ${typeof t.comment === 'string' ? t.comment : ''}`.trim());
  return [text.trim(), ...tags].filter(Boolean).join(' ');
}

/** The first JSDoc block of a file that sits above the imports, or right after them and above nothing exported. */
function fileDoc(sf) {
  const text = sf.getFullText();
  const first = sf.statements[0];
  if (!first) return '';
  const ranges = ts.getLeadingCommentRanges(text, first.getFullStart()) ?? [];
  const block = ranges.find((r) => text.slice(r.pos, r.pos + 3) === '/**');
  if (!block) return '';
  const owned = !ts.isImportDeclaration(first) && ranges[ranges.length - 1] === block && hasExport(first);
  if (owned) return '';
  return cleanBlock(text.slice(block.pos, block.end));
}

const cleanBlock = (c) =>
  c
    .replace(/^\/\*\*?/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\* ?/, ''))
    .join('\n')
    .trim();

const hasExport = (node) => (node.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
const isDefault = (node) => (node.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);

function paramsText(params, sf) {
  return params.map((p) => p.getText(sf)).join(', ');
}

function fnSignature(node, sf) {
  const params = oneLine(paramsText(node.parameters, sf), 220);
  const ret = node.type ? `: ${oneLine(node.type.getText(sf), 120)}` : '';
  const generics = node.typeParameters ? `<${node.typeParameters.map((t) => t.getText(sf)).join(', ')}>` : '';
  return `${generics}(${params})${ret}`;
}

function classify(name, file, fnLike) {
  if (fnLike && /^use[A-Z]/.test(name)) return 'hook';
  if (fnLike && /^[A-Z]/.test(name) && file.endsWith('.tsx')) return 'component';
  return fnLike ? 'function' : 'const';
}

function members(node, sf) {
  const list = node.members ?? (node.type && ts.isTypeLiteralNode(node.type) ? node.type.members : []);
  return list
    .filter((m) => m.name)
    .map((m) => {
      const name = m.name.getText(sf);
      const optional = !!m.questionToken;
      let type = '';
      if (ts.isMethodSignature(m)) type = fnSignature(m, sf);
      else if (m.type) type = m.type.getText(sf);
      return { name, optional, type: oneLine(type, 200), doc: oneLine(jsDocOf(m, sf), 300), line: sf.getLineAndCharacterOfPosition(m.getStart(sf)).line + 1 };
    });
}

function extract(file) {
  const text = read(file);
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const fileRel = rel(file);
  const symbols = [];
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const push = (s) => symbols.push({ file: fileRel, ...s });

  for (const st of sf.statements) {
    const exported = (st.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (ts.isExportDeclaration(st)) {
      const from = st.moduleSpecifier ? st.moduleSpecifier.getText(sf).replace(/['"]/g, '') : '';
      const names = st.exportClause && ts.isNamedExports(st.exportClause) ? st.exportClause.elements.map((e) => e.name.text) : ['*'];
      push({ name: names.join(', '), kind: 're-export', signature: from ? `from '${from}'` : '', doc: '', line: lineOf(st) });
      continue;
    }
    if (ts.isExportAssignment(st)) {
      push({ name: 'default', kind: 'default', signature: oneLine(st.expression.getText(sf), 120), doc: jsDocOf(st, sf), line: lineOf(st) });
      continue;
    }
    if (!exported) continue;
    const doc = jsDocOf(st, sf);
    if (ts.isFunctionDeclaration(st)) {
      const name = st.name?.text ?? 'default';
      push({ name, kind: isDefault(st) ? (file.endsWith('.tsx') ? 'component' : 'function') : classify(name, file, true), signature: fnSignature(st, sf), doc, line: lineOf(st), default: isDefault(st) || undefined });
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        const name = d.name.getText(sf);
        const init = d.initializer;
        const fn = init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) ? init : undefined;
        const wrapped = init && ts.isCallExpression(init) && init.arguments[0] && (ts.isArrowFunction(init.arguments[0]) || ts.isFunctionExpression(init.arguments[0])) ? init.arguments[0] : undefined;
        let signature = '';
        if (fn) signature = fnSignature(fn, sf);
        else if (wrapped) signature = `${init.expression.getText(sf)}(${fnSignature(wrapped, sf)})`;
        else if (d.type) signature = `: ${oneLine(d.type.getText(sf), 160)}`;
        else if (init) {
          const t = init.getText(sf);
          signature = t.length <= 90 ? `= ${oneLine(t)}` : ts.isObjectLiteralExpression(init) ? '= { … }' : ts.isArrayLiteralExpression(init) ? `= [ … ${init.elements.length} items ]` : `= ${oneLine(t, 90)}`;
        }
        push({ name, kind: classify(name, file, !!(fn || wrapped)), signature: oneLine(signature, 260), doc: doc || jsDocOf(d, sf), line: lineOf(d) });
      }
    } else if (ts.isInterfaceDeclaration(st)) {
      push({ name: st.name.text, kind: 'interface', signature: st.heritageClauses ? oneLine(st.heritageClauses.map((h) => h.getText(sf)).join(' ')) : '', doc, line: lineOf(st), members: members(st, sf) });
    } else if (ts.isTypeAliasDeclaration(st)) {
      const m = ts.isTypeLiteralNode(st.type) ? members(st, sf) : undefined;
      push({ name: st.name.text, kind: 'type', signature: m ? '{ … }' : `= ${oneLine(st.type.getText(sf), 260)}`, doc, line: lineOf(st), members: m });
    } else if (ts.isEnumDeclaration(st)) {
      push({ name: st.name.text, kind: 'enum', signature: st.members.map((m) => m.name.getText(sf)).join(' | '), doc, line: lineOf(st) });
    } else if (ts.isClassDeclaration(st)) {
      push({ name: st.name?.text ?? 'default', kind: 'class', signature: '', doc, line: lineOf(st) });
    }
  }
  return { file: fileRel, doc: fileDoc(sf), symbols };
}

// ─── Routes (src/app) ───────────────────────────────────────────────────────

function routeOf(fileRel) {
  const parts = fileRel.replace(/^src\/app\//, '').replace(/\.tsx?$/, '').split('/');
  const name = parts.pop();
  const groups = parts.filter((p) => /^\(.*\)$/.test(p));
  const segs = parts.filter((p) => !/^\(.*\)$/.test(p));
  if (name === '_layout') return { kind: 'layout', path: `/${segs.join('/')}`, groups };
  if (name === '+html' || name === '+not-found') return { kind: 'special', path: name, groups };
  if (name !== 'index') segs.push(name);
  return { kind: 'screen', path: `/${segs.join('/')}`, groups };
}

const roleOfRoute = (p) => (p.startsWith('/business') ? 'Vendor (business)' : p.startsWith('/freelancer') ? 'Freelancer' : p.startsWith('/platform') ? 'Platform staff' : ['/w/', '/rsvp/', '/legal/'].some((x) => p.startsWith(x)) ? 'Public (signed out)' : p.startsWith('/welcome') || p.startsWith('/onboarding') ? 'Sign-in and onboarding' : 'Couple (customer) and shared');

// ─── SQL ────────────────────────────────────────────────────────────────────

function sqlHeader(text) {
  const lines = [];
  for (const l of text.split('\n')) {
    if (!l.startsWith('--')) break;
    const t = l.replace(/^--\s?/, '');
    if (/^=+$/.test(t.trim())) continue;
    lines.push(t);
  }
  return lines.join('\n').trim();
}

function sqlObjects(text) {
  const grab = (re, i = 1) => [...new Set([...text.matchAll(re)].map((m) => m[i].replace(/^public\./, '')))].sort();
  return {
    tables: grab(/create table (?:if not exists )?([\w.]+)/gi),
    alteredTables: grab(/alter table (?:only )?(?:if exists )?([\w.]+)/gi),
    views: grab(/create (?:or replace )?view ([\w.]+)/gi),
    types: grab(/create type ([\w.]+)/gi),
    functions: grab(/create (?:or replace )?function ([\w.]+)\s*\(/gi),
    triggers: grab(/create (?:or replace )?trigger (\w+)/gi),
    policies: [...text.matchAll(/create policy "?([^"\n]+?)"? on ([\w.]+)/gi)].length,
    indexes: [...text.matchAll(/create (?:unique )?index/gi)].length,
    cron: grab(/cron\.schedule\(\s*'([^']+)'/gi),
  };
}

// ─── Page writers ───────────────────────────────────────────────────────────

const HEADER = (title, what) => `<!-- Generated by scripts/docs/generate-reference.mjs. Do not edit: change the code's JSDoc and run \`npm run docs:generate\`. -->\n\n# ${title}\n\n${what}\n`;

function symbolBlock(s, depth) {
  const lines = [];
  const kind = s.default ? `${s.kind}, default export` : s.kind;
  lines.push(`### \`${s.name}\``);
  lines.push('');
  lines.push(`*${kind}* · [${s.file}:${s.line}](${src(s.file, s.line, depth)})`);
  lines.push('');
  if (s.signature && s.kind !== 'interface') lines.push('```ts', `${s.kind === 'type' ? `type ${s.name} ` : s.kind === 'enum' ? '' : s.name}${s.signature}`, '```', '');
  if (s.signature && s.kind === 'interface') lines.push(`\`${s.signature}\``, '');
  lines.push(s.doc ? s.doc : '_No JSDoc yet._', '');
  if (s.members?.length) {
    lines.push('| Member | Type | Notes |', '|---|---|---|');
    for (const m of s.members) lines.push(`| \`${m.name}${m.optional ? '?' : ''}\` | \`${cell(m.type || '…')}\` | ${cell(m.doc)} |`);
    lines.push('');
  }
  return lines.join('\n');
}

function folderPage(folder, files, depth) {
  const out = [HEADER(`\`${folder}/\``, `Every exported symbol in \`${folder}/\`, file by file. The guide that explains how this folder fits the app is linked from [the reference index](${'../'.repeat(depth)}README.md).`)];
  out.push('## Files', '');
  for (const f of files) out.push(`- [\`${path.basename(f.file)}\`](#${anchor(path.basename(f.file))}) (${f.symbols.length} exports)${f.doc ? ` · ${oneLine(f.doc.split('\n\n')[0], 140)}` : ''}`);
  out.push('');
  for (const f of files) {
    out.push(`## ${path.basename(f.file)}`, '', `Source: [${f.file}](${src(f.file, 0, depth)})`, '');
    if (f.doc) out.push(f.doc, '');
    if (!f.symbols.length) out.push('_No exports._', '');
    for (const s of f.symbols) out.push(symbolBlock(s, depth));
  }
  return out.join('\n');
}

const anchor = (h) => h.toLowerCase().replace(/[^\w\- ]/g, '').replace(/ /g, '-');

// ─── Main ───────────────────────────────────────────────────────────────────

const pages = new Map();
const write = (name, body) => pages.set(name, `${body.trimEnd()}\n`);

const tsFiles = [...walk(path.join(root, 'src'), isTs), ...walk(path.join(root, 'supabase', 'functions'), isTs)];
const extracted = tsFiles.map(extract);

// Folder pages (src/app is covered by routes.md).
const byFolder = new Map();
for (const f of extracted) {
  if (f.file.startsWith('src/app/')) continue;
  const folder = path.posix.dirname(f.file);
  if (!byFolder.has(folder)) byFolder.set(folder, []);
  byFolder.get(folder).push(f);
}
const folderPageName = (folder) => `code/${folder.replace(/^src\//, '').replace(/^supabase\/functions/, 'functions').replace(/\//g, '.')}.md`;
for (const [folder, files] of [...byFolder].sort()) write(folderPageName(folder), folderPage(folder, files, 1));

// Routes.
const routeRows = extracted
  .filter((f) => f.file.startsWith('src/app/'))
  .map((f) => ({ ...routeOf(f.file), file: f.file, doc: f.doc || f.symbols.find((s) => s.default)?.doc || '', component: f.symbols.find((s) => s.default)?.name ?? '' }))
  .sort((a, b) => a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind));
{
  const out = [HEADER('Routes', 'Every file in `src/app/` is a route (Expo Router). Layouts (`_layout.tsx`) define the navigators and the `Stack.Protected` role guards. Groups in parentheses, such as `(tabs)`, do not appear in the URL. See [the frontend guide](../handbook/03-frontend.md) for how routing and guards work.')];
  for (const role of [...new Set(routeRows.map((r) => roleOfRoute(r.path)))].sort()) {
    out.push(`## ${role}`, '', '| URL | Kind | Screen | File | Notes |', '|---|---|---|---|---|');
    for (const r of routeRows.filter((x) => roleOfRoute(x.path) === role)) out.push(`| \`${r.path}\`${r.groups.length ? ` ${r.groups.join(' ')}` : ''} | ${r.kind} | \`${r.component}\` | [${r.file.replace('src/app/', '')}](${src(r.file, 0)}) | ${cell(oneLine(r.doc, 200))} |`);
    out.push('');
  }
  write('routes.md', out.join('\n'));
}

// Store actions: every *Actions interface plus the store hooks.
{
  const storeFiles = extracted.filter((f) => f.file.startsWith('src/store/'));
  const out = [HEADER('Store actions (the app\'s API)', 'Screens change data only by calling these actions. Each one is a future server endpoint (see `supabase/migrations/0011_core_rpc.sql` for the ones that already have an RPC). The rules every action follows are in [the state guide](../handbook/05-state-and-data.md).')];
  for (const f of storeFiles) {
    const actionIfaces = f.symbols.filter((s) => s.kind === 'interface' && /Actions$/.test(s.name));
    if (!actionIfaces.length) continue;
    for (const s of actionIfaces) {
      out.push(`## ${s.name}`, '', `Source: [${f.file}:${s.line}](${src(f.file, s.line)})${f.doc ? ` · ${oneLine(f.doc, 200)}` : ''}`, '', '| Action | Signature | What it does |', '|---|---|---|');
      for (const m of s.members ?? []) out.push(`| \`${m.name}\` | \`${cell(m.type)}\` | ${cell(m.doc) || '_No JSDoc yet._'} |`);
      out.push('');
    }
  }
  write('store-actions.md', out.join('\n'));
}

// Database.
{
  const migs = walk(path.join(root, 'supabase', 'migrations'), (p) => p.endsWith('.sql'));
  const out = [HEADER('Database (Supabase / Postgres)', 'One section per migration, in the order they apply. Migrations are append-only: never edit one that exists, add the next number. Explained in [the database guide](../handbook/07-database.md).')];
  for (const m of migs) {
    const text = read(m);
    const o = sqlObjects(text);
    out.push(`## ${path.basename(m)}`, '', `Source: [${rel(m)}](${src(rel(m), 0)})`, '');
    const h = sqlHeader(text);
    if (h) out.push('```text', h, '```', '');
    const list = (label, xs) => xs.length && out.push(`- **${label} (${xs.length}):** ${xs.map((x) => `\`${x}\``).join(', ')}`);
    list('Tables created', o.tables);
    list('Views', o.views);
    list('Types', o.types);
    list('Functions', o.functions);
    list('Triggers', o.triggers);
    list('Scheduled jobs', o.cron);
    list('Tables altered', o.alteredTables.filter((t) => !o.tables.includes(t)));
    if (o.policies || o.indexes) out.push(`- **Policies:** ${o.policies} · **Indexes:** ${o.indexes}`);
    out.push('');
  }
  write('database.md', out.join('\n'));
}

// Edge Functions.
{
  const fnDir = path.join(root, 'supabase', 'functions');
  const fns = existsSync(fnDir) ? readdirSync(fnDir).filter((d) => !d.startsWith('_') && existsSync(path.join(fnDir, d, 'index.ts'))).sort() : [];
  const out = [HEADER('Edge Functions', 'Deno functions in `supabase/functions/`, no npm dependencies. Shared, Node-testable logic is in `_shared/` ([code reference](code/functions._shared.md)). Explained in [the backend guide](../handbook/06-backend.md).')];
  for (const fn of fns) {
    const f = extracted.find((x) => x.file === `supabase/functions/${fn}/index.ts`);
    out.push(`## ${fn}`, '', `Source: [supabase/functions/${fn}/index.ts](${src(`supabase/functions/${fn}/index.ts`, 0)})`, '', f?.doc || '_No header comment yet._', '');
  }
  write('edge-functions.md', out.join('\n'));
}

// Scripts.
{
  const pkg = JSON.parse(read(path.join(root, 'package.json')));
  const out = [HEADER('Scripts', 'npm scripts and the Node scripts behind them. All run locally with no network unless the header says otherwise.'), '## npm scripts', '', '| Command | Runs |', '|---|---|'];
  for (const [k, v] of Object.entries(pkg.scripts)) out.push(`| \`npm run ${k}\` | \`${cell(v)}\` |`);
  out.push('', '## Script files', '');
  const files = walk(path.join(root, 'scripts'), (p) => /\.(mjs|js|ts|sh|awk)$/.test(p));
  for (const p of files) {
    const text = read(p);
    let doc = '';
    if (/\.(mjs|js|ts)$/.test(p)) {
      const m = text.match(/\/\*\*([\s\S]*?)\*\//);
      if (m && text.indexOf(m[0]) < 400) doc = cleanBlock(m[0]);
    } else doc = text.split('\n').filter((l) => l.startsWith('#') && !l.startsWith('#!')).map((l) => l.replace(/^#\s?/, '')).slice(0, 12).join('\n');
    out.push(`### ${rel(p)}`, '', `Source: [${rel(p)}](${src(rel(p), 0)})`, '', doc || '_No header comment yet._', '');
  }
  const wf = walk(path.join(root, '.github', 'workflows'), (p) => /\.ya?ml$/.test(p));
  if (wf.length) {
    out.push('## GitHub workflows', '');
    for (const p of wf) {
      const doc = read(p).split('\n').filter((l) => l.startsWith('#')).map((l) => l.replace(/^#\s?/, '')).join(' ');
      out.push(`- [${rel(p)}](${src(rel(p), 0)}): ${doc || '_no header comment_'}`);
    }
    out.push('');
  }
  write('scripts.md', out.join('\n'));
}

// JSDoc coverage.
const all = extracted.flatMap((f) => f.symbols).filter((s) => s.kind !== 're-export');
const documentable = all.filter((s) => !(s.default && s.file.startsWith('src/app/')));
const missing = documentable.filter((s) => !s.doc);
{
  const out = [HEADER('JSDoc coverage', 'Exported symbols that have no JSDoc yet. The weekly documentation pass (see [the maintenance guide](../handbook/17-documentation-maintenance.md)) works through this list; whoever touches a file should document its exports too.')];
  const pct = documentable.length ? Math.round(((documentable.length - missing.length) / documentable.length) * 100) : 100;
  out.push(`**${documentable.length - missing.length} of ${documentable.length} exports documented (${pct}%).** Files without a header comment: ${extracted.filter((f) => !f.doc).length} of ${extracted.length}.`, '');
  const byFile = new Map();
  for (const s of missing) byFile.set(s.file, [...(byFile.get(s.file) ?? []), s]);
  out.push('| File | Undocumented exports |', '|---|---|');
  for (const [file, xs] of [...byFile].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))) out.push(`| [${file}](${src(file, 0)}) | ${xs.map((s) => `\`${s.name}\``).join(', ')} |`);
  write('coverage.md', out.join('\n'));
}

// Index (README) and machine-readable index.json.
{
  const out = [HEADER('Code reference', 'Generated from the source. For the *why*, read [the handbook](../handbook/README.md) first; come here for the *what*: exact names, signatures and the JSDoc of every export.')];
  out.push('## Pages', '', '- [Routes](routes.md): every screen URL, by role', '- [Store actions](store-actions.md): the app\'s API, every action with its signature', '- [Database](database.md): tables, views, functions, triggers and jobs per migration', '- [Edge Functions](edge-functions.md)', '- [Scripts](scripts.md): npm scripts, Node scripts, GitHub workflows', '- [JSDoc coverage](coverage.md): what still needs a doc comment', '- `index.json`: all of the above as data (for tools and AI agents)', '', '## Code by folder', '', '| Folder | Files | Exports | Page |', '|---|---|---|---|');
  for (const [folder, files] of [...byFolder].sort()) out.push(`| \`${folder}/\` | ${files.length} | ${files.reduce((n, f) => n + f.symbols.length, 0)} | [${folderPageName(folder).replace('code/', '')}](${folderPageName(folder)}) |`);
  write('README.md', out.join('\n'));
  const index = {
    note: 'Generated by scripts/docs/generate-reference.mjs. Paths are relative to the repo root; line numbers are 1-based.',
    routes: routeRows.map(({ path: p, kind, file, component, doc }) => ({ path: p, kind, file, component, doc: oneLine(doc, 400) })),
    files: extracted.map((f) => ({ file: f.file, doc: oneLine(f.doc, 600), exports: f.symbols.map(({ name, kind, signature, doc, line, members: m }) => ({ name, kind, line, signature, doc, ...(m ? { members: m.map(({ name: n, optional, type, doc: d }) => ({ name: n, optional, type, doc: d })) } : {}) })) })),
  };
  pages.set('index.json', `${JSON.stringify(index, null, 1)}\n`);
}

// Write or check.
const existing = walk(outDir, () => true).map((p) => rel(p).replace('docs/reference/', ''));
if (check) {
  const stale = [...pages].filter(([name, body]) => !existsSync(path.join(outDir, name)) || read(path.join(outDir, name)) !== body).map(([n]) => n);
  const extra = existing.filter((n) => !pages.has(n));
  if (stale.length || extra.length) {
    console.error(`docs/reference is out of date (${[...stale, ...extra].join(', ')}). Run: npm run docs:generate`);
    process.exit(1);
  }
  console.log(`docs/reference is up to date (${pages.size} files).`);
} else {
  for (const n of existing) if (!pages.has(n)) rmSync(path.join(outDir, n));
  for (const [name, body] of pages) {
    mkdirSync(path.dirname(path.join(outDir, name)), { recursive: true });
    writeFileSync(path.join(outDir, name), body);
  }
  console.log(`Wrote ${pages.size} files to docs/reference/ · ${all.length} exports, ${missing.length} without JSDoc · ${routeRows.length} route files.`);
}
