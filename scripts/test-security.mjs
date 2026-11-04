/**
 * Checks the app's link guard (src/utils/safeUrl.ts): links typed by other
 * people open only when they are web, email, phone, SMS or WhatsApp links,
 * so `javascript:`, `data:` and app-launching links never run. Node 24+
 * strips the TypeScript (22.18+ works too).
 *
 *   npm run test:security
 */
import './ts-loader.mjs';

import { importApp } from './ts-loader.mjs';

const { isSafeLink, linkScheme } = await importApp('@/utils/safeUrl');

const results = [];
const ok = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail });

const safe = ['https://drive.google.com/drive/folders/abc', 'http://example.com', 'https://daraz.com.np/products/x?y=1#z', 'mailto:hello@vivah.com.np', 'tel:+9779800000004', 'sms:9800000001?body=Hi', 'whatsapp://send?phone=9779800000004', '  https://vivah.app/w/aakriti-weds-sujan  '];
for (const url of safe) ok(`opens ${url.trim()}`, isSafeLink(url));

const unsafe = [
  'javascript:alert(document.cookie)',
  'JavaScript:alert(1)',
  ' javascript:alert(1)',
  'java\tscript:alert(1)',
  'java\nscript:alert(1)',
  '\u0000javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  'intent://scan/#Intent;scheme=zxing;end',
  'file:///etc/passwd',
  'https://bank.com.np@evil.example/login',
  'https://',
  'http:/example.com',
  '//evil.example',
  'example.com',
  '',
  `https://example.com/${'a'.repeat(3000)}`,
];
for (const url of unsafe) ok(`refuses ${JSON.stringify(url).slice(0, 60)}`, !isSafeLink(url));
ok('refuses things that are not text', !isSafeLink(undefined) && !isSafeLink(null) && !isSafeLink(42));

ok('device files open only when the caller allows them', isSafeLink('file:///data/user/0/contract.pdf', { files: true }) && isSafeLink('content://media/1', { files: true }) && !isSafeLink('content://media/1'));
ok('even with files allowed, javascript: is refused', !isSafeLink('javascript:alert(1)', { files: true }));
ok('the scheme is read through hidden characters', linkScheme('java\tscript:x') === 'javascript:' && linkScheme('no scheme here') === null);

results.forEach((r) => console.log(`${r.pass ? 'pass' : 'FAIL'}  ${r.name}${!r.pass && r.detail ? `  (${r.detail})` : ''}`));
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
