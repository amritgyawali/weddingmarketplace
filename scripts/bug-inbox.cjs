/**
 * Bug inbox: receives the reports the app sends when someone shakes the phone
 * (or picks Settings → Report a problem) and writes each one into
 * `bug-reports/<date>_<time>_<slug>/` in this project:
 *
 *   README.md       what happened, the screen, the account, the device, recent
 *                   screens and console errors, with the screenshot embedded
 *   screenshot.png  the screen exactly as it was when the phone was shaken
 *   report.json     the raw report, for scripts
 *
 * and adds an unticked line to `bug-reports/INDEX.md`.
 *
 * Two ways to run it:
 *   - nothing to do in development: `metro.config.js` mounts it on the dev
 *     server, so `npx expo start` already accepts reports at /__vivah/bug-report;
 *   - `npm run bugs:inbox` starts it on its own (port 8790, or --port N) for
 *     builds pointed at it with EXPO_PUBLIC_BUG_INBOX_URL.
 *
 * Development tool only: it trusts the local network, so never expose it to
 * the internet.
 */
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const BUG_INBOX_PATH = '/__vivah/bug-report';
const MAX_BYTES = 25 * 1024 * 1024;

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
const readable = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const str = (v, max = 4000) => (typeof v === 'string' ? v.slice(0, max) : v == null ? '' : String(v).slice(0, max));

/** First words of the description as a safe folder name. */
function slugOf(text) {
  const slug = str(text, 200)
    .split(/\r?\n/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .slice(0, 6)
    .join('-');
  return slug || 'report';
}

/** Decodes a data URI or bare base64 image; only PNG and JPEG are kept. */
function decodeImage(value) {
  if (typeof value !== 'string' || !value) return null;
  const buffer = Buffer.from(value.replace(/^data:image\/[a-z+]+;base64,/i, ''), 'base64');
  if (buffer.length > 8 && buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') return { buffer, ext: 'png' };
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { buffer, ext: 'jpg' };
  return null;
}

/** One line for a Markdown table cell. */
const cell = (v) => str(v, 500).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

function renderMarkdown(report, received, screenshotFile) {
  const firstLine = str(report.description).split(/\r?\n/)[0].slice(0, 90) || 'Bug report';
  const account = report.account;
  const device = report.device ?? {};
  const app = report.app ?? {};
  const params = report.params && typeof report.params === 'object' ? report.params : {};
  const paramText = Object.keys(params).length ? ` (${Object.entries(params).map(([k, v]) => `${k}=${str(v, 200)}`).join(', ')})` : '';
  const lines = [
    `# ${firstLine}`,
    '',
    '| | |',
    '| --- | --- |',
    `| Reported | ${readable(received)} |`,
    `| Screen | \`${cell(report.route) || '?'}\`${cell(paramText)} |`,
    `| Signed in as | ${account ? `${cell(account.name)} · ${cell(account.role)}${account.staffRole ? ` (${cell(account.staffRole)})` : ''} · \`${cell(account.id)}\`` : 'signed out'} |`,
    `| Device | ${cell(device.os)} ${cell(device.osVersion)} · ${cell(device.width)}×${cell(device.height)} @${cell(device.scale)}x · ${cell(device.runtime)}${device.userAgent ? ` · ${cell(device.userAgent)}` : ''} |`,
    `| App | ${cell(app.name)} ${cell(app.version)} · backend ${cell(app.backend)} · language ${cell(app.language)} · calendar ${cell(app.calendar)} |`,
    '',
    '## What went wrong',
    '',
    str(report.description, 20000).trim() || '_No description._',
    '',
    '## Screenshot',
    '',
    screenshotFile ? `![Screenshot](${screenshotFile})` : '_No screenshot attached._',
    '',
  ];
  const routes = Array.isArray(report.recentRoutes) ? report.recentRoutes.slice(-15) : [];
  if (routes.length) {
    lines.push('## Screens before this one (oldest first)', '');
    for (const r of routes) lines.push(`- ${cell(r.at)} \`${cell(r.path)}\``);
    lines.push('');
  }
  const logs = Array.isArray(report.logs) ? report.logs.slice(-30) : [];
  if (logs.length) {
    lines.push('## Recent console errors and warnings', '', '```');
    for (const l of logs) lines.push(`[${str(l.at)}] ${str(l.level)}: ${str(l.message, 1500)}`);
    lines.push('```', '');
  }
  lines.push('## Fixing it', '', 'Open the screen above as the same role (demo OTP `1234`), reproduce, fix, then tick this report in `../INDEX.md`.', '');
  return { markdown: lines.join('\n'), title: firstLine };
}

/** Writes one report to disk and returns the folder name. */
function saveReport(projectRoot, report, dir = 'bug-reports') {
  const root = path.join(projectRoot, dir);
  const received = new Date();
  let folder = `${stamp(received)}_${slugOf(report.description)}`;
  for (let i = 2; fs.existsSync(path.join(root, folder)); i++) folder = `${stamp(received)}_${slugOf(report.description)}-${i}`;
  const target = path.join(root, folder);
  fs.mkdirSync(target, { recursive: true });

  const image = decodeImage(report.screenshot);
  const screenshotFile = image ? `screenshot.${image.ext}` : null;
  if (image) fs.writeFileSync(path.join(target, screenshotFile), image.buffer);

  const { markdown, title } = renderMarkdown(report, received, screenshotFile);
  fs.writeFileSync(path.join(target, 'README.md'), markdown);
  const { screenshot: _omit, ...rest } = report;
  fs.writeFileSync(path.join(target, 'report.json'), JSON.stringify({ ...rest, receivedAt: received.toISOString(), screenshotFile }, null, 2) + '\n');

  const index = path.join(root, 'INDEX.md');
  if (!fs.existsSync(index)) fs.writeFileSync(index, '# Bug reports\n\nNewest last. Tick a line when the bug is fixed.\n\n');
  fs.appendFileSync(index, `- [ ] ${readable(received)} · \`${cell(report.route) || '?'}\` · [${cell(title)}](${folder}/README.md)\n`);
  return folder;
}

function send(res, status, body, cors) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...(cors ? { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } : {}),
  });
  res.end(JSON.stringify(body));
}

/**
 * Connect-style middleware for POST/GET /__vivah/bug-report. Other requests go
 * to `next` (Metro); without `next` they get a 404 (standalone server).
 */
function createBugInbox({ projectRoot, dir = 'bug-reports', cors = true, log = console.log } = {}) {
  return function bugInbox(req, res, next) {
    const url = (req.url || '').split('?')[0];
    if (url !== BUG_INBOX_PATH) return next ? next() : send(res, 404, { ok: false, error: 'Not found' }, cors);
    if (req.method === 'OPTIONS') return send(res, 204, {}, cors);
    if (req.method === 'GET') return send(res, 200, { ok: true }, cors);
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST' }, cors);

    const chunks = [];
    let size = 0;
    let aborted = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES && !aborted) {
        aborted = true;
        send(res, 413, { ok: false, error: 'Report too large' }, cors);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (aborted) return;
      try {
        const report = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!report || typeof report !== 'object' || !str(report.description).trim()) return send(res, 400, { ok: false, error: 'Describe the bug first' }, cors);
        const folder = saveReport(projectRoot, report, dir);
        log(`\n  Bug report saved: ${path.join(dir, folder)}\n`);
        send(res, 200, { ok: true, folder: `${dir}/${folder}` }, cors);
      } catch (e) {
        send(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Could not save the report' }, cors);
      }
    });
  };
}

module.exports = { BUG_INBOX_PATH, createBugInbox, saveReport };

if (require.main === module) {
  const flag = process.argv.indexOf('--port');
  const port = Number(flag > -1 ? process.argv[flag + 1] : process.env.BUG_INBOX_PORT) || 8790;
  const projectRoot = path.resolve(path.dirname(require.main.filename), '..');
  const inbox = createBugInbox({ projectRoot });
  http.createServer((req, res) => inbox(req, res)).listen(port, '0.0.0.0', () => {
    console.log(`Bug inbox listening on http://0.0.0.0:${port}${BUG_INBOX_PATH}`);
    console.log(`Reports go to ${path.join(projectRoot, 'bug-reports')}`);
  });
}
