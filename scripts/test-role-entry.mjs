/** Verifies direct demo entry cannot be enabled for a Supabase build, including missing credentials. */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const cases = [
  { name: 'default local demo', backend: undefined, entry: undefined, expected: true },
  { name: 'explicit local demo', backend: 'mock', entry: 'direct', expected: true },
  { name: 'legacy credentials opt-out', backend: 'mock', entry: 'credentials', expected: false },
  { name: 'Supabase without keys', backend: 'supabase', entry: 'direct', expected: false },
  { name: 'Supabase with keys', backend: 'supabase', entry: 'direct', keys: true, expected: false },
];
const names = ['EXPO_PUBLIC_BACKEND', 'EXPO_PUBLIC_ROLE_ENTRY', 'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
const assign = (name, value) => value === undefined ? delete process.env[name] : process.env[name] = value;
try {
  for (const [i, c] of cases.entries()) {
    assign(names[0], c.backend);
    assign(names[1], c.entry);
    assign(names[2], c.keys ? 'https://example.supabase.co' : undefined);
    assign(names[3], c.keys ? 'public-test-placeholder' : undefined);
    const env = await import(`${pathToFileURL(path.resolve('src/constants/env.ts')).href}?test=${i}`);
    assert.equal(env.usesDirectRoleEntry(), c.expected, c.name);
    console.log(`PASS ${c.name}`);
  }
} finally {
  for (const name of names) assign(name, previous[name]);
}
