/**
 * Applies every migration in supabase/migrations to a throwaway in-process
 * Postgres (PGlite) and fails on the first error. No Supabase project, no
 * Docker, nothing deployed.
 *
 *   npm run db:check
 */
import { freshDb, migrationFiles } from './harness.mjs';

const started = Date.now();
try {
  const db = await freshDb();
  const { rows } = await db.query(`select count(*)::int as tables from pg_tables where schemaname = 'public'`);
  const { rows: rls } = await db.query(`select count(*)::int as off from pg_tables where schemaname = 'public' and not rowsecurity`);
  const { rows: off } = await db.query(`select tablename from pg_tables where schemaname = 'public' and not rowsecurity order by 1`);
  console.log(`Applied ${migrationFiles().length} migrations in ${((Date.now() - started) / 1000).toFixed(1)} s: ${rows[0].tables} tables.`);
  if (rls[0].off) {
    console.error(`error: RLS is off on ${rls[0].off} tables: ${off.map((r) => r.tablename).join(', ')}`);
    process.exit(1);
  }
  console.log('RLS is on for every table.');
  await db.close();
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exit(1);
}
