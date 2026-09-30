/**
 * Lets plain Node (24+, which strips TypeScript types) import the app's pure
 * modules: resolves the `@/…` alias and extensionless imports. Only pure
 * modules (data, services, types, utils) may be reached this way.
 */
import { existsSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidates = (base) => [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')];
const isFile = (p) => existsSync(p) && statSync(p).isFile();

registerHooks({
  resolve(specifier, context, next) {
    let base = null;
    if (specifier.startsWith('file:')) base = fileURLToPath(specifier);
    else if (specifier.startsWith('@/')) base = path.join(root, 'src', specifier.slice(2));
    else if (/^\.\.?\//.test(specifier) && context.parentURL?.startsWith('file:')) base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    const found = base && candidates(base).find(isFile);
    return found ? { url: pathToFileURL(found).href, format: /\.tsx?$/.test(found) ? 'module-typescript' : 'module', shortCircuit: true } : next(specifier, context);
  },
});

/** Imports an app module by its `@/…` path. */
export const importApp = (spec) => import(pathToFileURL(path.join(root, 'src', spec.replace(/^@\//, ''))).href + (spec.endsWith('.ts') ? '' : '.ts'));
