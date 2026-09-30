/**
 * Runs scripts/personaCheck.ts in plain Node (24+ strips TypeScript types)
 * through ts-loader.mjs. Only pure modules (data, services, types) may be
 * reached from the check.
 *
 *   npm run check:personas            compare against scripts/persona-matrix.json
 *   npm run check:personas -- --update rewrite the expected matrix
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import './ts-loader.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const matrixFile = path.join(here, 'persona-matrix.json');

const { runPersonaCheck } = await import(pathToFileURL(path.join(here, 'personaCheck.ts')).href);
const { errors, notes, matrix } = runPersonaCheck();

notes.forEach((n) => console.log(`note: ${n}`));
const update = process.argv.includes('--update');
if (update) {
  writeFileSync(matrixFile, `${JSON.stringify(matrix, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(matrix).length} personas to scripts/persona-matrix.json`);
} else if (existsSync(matrixFile)) {
  const expected = JSON.parse(readFileSync(matrixFile, 'utf8'));
  for (const name of new Set([...Object.keys(expected), ...Object.keys(matrix)])) {
    const want = expected[name] ?? [];
    const got = matrix[name] ?? [];
    const added = got.filter((t) => !want.includes(t));
    const removed = want.filter((t) => !got.includes(t));
    if (!(name in matrix)) errors.push(`matrix: fixture ${name} was removed`);
    else if (!(name in expected)) errors.push(`matrix: new fixture ${name} (run with --update if intended)`);
    else if (added.length || removed.length) errors.push(`matrix: ${name} ${added.map((t) => `+${t}`).concat(removed.map((t) => `-${t}`)).join(' ')} (run with --update if intended)`);
  }
} else {
  errors.push('scripts/persona-matrix.json is missing (run with --update)');
}

if (errors.length) {
  errors.forEach((e) => console.error(`error: ${e}`));
  console.error(`\nPersona check failed with ${errors.length} error${errors.length > 1 ? 's' : ''}.`);
  process.exit(1);
}
console.log(`Persona check passed: ${Object.keys(matrix).length} personas.`);
