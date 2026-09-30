/**
 * A tiny stand-in for the parts of Supabase's HTTP API the app calls, backed by
 * the real migrations on PGlite: email-code sign-in (send-otp, verify,
 * refresh, logout) and RPCs (/rest/v1/rpc/<fn>, run as the signed-in user with
 * RLS on). For end-to-end UI tests of the Supabase build without a project.
 *
 *   node scripts/db/local-api.mjs            listens on http://localhost:54321
 *
 * Start the app against it with:
 *   EXPO_PUBLIC_BACKEND=supabase EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local npx expo start --web
 *
 * The email code is always 123456. The access token is the user's id, so this
 * must never face the internet.
 */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

import { freshDb } from './harness.mjs';

const PORT = Number(process.env.PORT ?? 54321);
const CODE = '123456';
const db = await freshDb();
await db.exec(`
  insert into cities (id, name, province, grp) values ('kathmandu', 'Kathmandu', 'Bagmati', 'VALLEY') on conflict do nothing;
  insert into staff_access_codes (code_hash) values (crypt('VIVAH-2027-OPS', gen_salt('bf')));
`);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-upsert',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const send = (res, status, body) => {
  res.writeHead(status, { ...cors, 'Content-Type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
};
const readBody = (req) => new Promise((resolve) => {
  let data = '';
  req.on('data', (c) => (data += c));
  req.on('end', () => resolve(data ? JSON.parse(data) : {}));
});
const tokenFor = (user) => ({ access_token: user.id, refresh_token: `r-${user.id}`, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user });

async function asUser(userId, fn) {
  await db.exec(`set request.jwt.claim.sub = '${userId}'; set request.jwt.claim.role = 'authenticated'; set role authenticated;`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; reset request.jwt.claim.sub; reset request.jwt.claim.role;`);
  }
}

createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 200);
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const body = req.method === 'POST' ? await readBody(req) : {};
    const auth = (req.headers.authorization ?? '').replace(/^Bearer /, '');

    if (url.pathname === '/functions/v1/send-otp') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(body.email ?? ''))) return send(res, 400, { message: 'Enter a valid email address' });
      console.log(`code for ${body.email}: ${CODE}`);
      return send(res, 200, { sent: true });
    }
    if (url.pathname === '/auth/v1/verify') {
      if (body.token !== CODE) return send(res, 403, { msg: 'Token has expired or is invalid' });
      const email = String(body.email).toLowerCase();
      let user = (await db.query(`select id, email from auth.users where email = $1`, [email])).rows[0];
      if (!user) user = (await db.query(`insert into auth.users (id, email) values ($1, $2) returning id, email`, [randomUUID(), email])).rows[0];
      return send(res, 200, tokenFor(user));
    }
    if (url.pathname === '/auth/v1/token') {
      const id = String(body.refresh_token ?? '').replace(/^r-/, '');
      const user = (await db.query(`select id, email from auth.users where id::text = $1`, [id])).rows[0];
      return user ? send(res, 200, tokenFor(user)) : send(res, 400, { msg: 'Invalid refresh token' });
    }
    if (url.pathname === '/auth/v1/logout') return send(res, 204);

    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
    if (rpc) {
      if (!auth) return send(res, 401, { message: 'JWT required' });
      const names = Object.keys(body);
      const args = names.map((k, i) => `${k} => $${i + 1}`).join(', ');
      const values = names.map((k) => (body[k] !== null && typeof body[k] === 'object' ? JSON.stringify(body[k]) : body[k]));
      try {
        const rows = await asUser(auth, async () => (await db.query(`select ${rpc[1]}(${args}) as r`, values)).rows);
        return send(res, 200, rows[0]?.r ?? null);
      } catch (e) {
        return send(res, 400, { message: e.message });
      }
    }
    return send(res, 404, { message: `Not in the local API: ${url.pathname}` });
  } catch (e) {
    return send(res, 500, { message: e.message });
  }
}).listen(PORT, () => console.log(`Local Supabase stand-in on http://localhost:${PORT} (email code ${CODE}, staff code VIVAH-2027-OPS)`));
