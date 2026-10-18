/**
 * Smoke-tests direct role entry and captures the running Expo web app at phone dimensions.
 * Run Metro on 8093, then PLAYWRIGHT_MODULE=/path/to/playwright node scripts/capture-play-store.cjs.
 * These are browser-rendered app captures, not Android device screenshots.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = path.resolve(process.env.PLAY_STORE_OUTPUT || '../play-store-output-20261019');
const base = process.env.APP_URL || 'http://localhost:8093';
const results = [];
const errors = [];

async function ready(page) {
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.waitForTimeout(1000);
}
async function session(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('vivah-session'))?.state.session);
}
async function snap(page, name) {
  await ready(page);
  await page.screenshot({ path: path.join(output, 'screenshots', `${name}.png`), animations: 'disabled' });
}
async function signOut(page, route) {
  await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByRole('alert').getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByRole('button', { name: 'Continue as Couple', exact: true }).waitFor();
  assert.equal(await session(page), null);
}

(async () => {
  await fs.mkdir(path.join(output, 'screenshots'), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const roles = [
      ['Couple', 'customer', 'acc_customer_demo', '/', '/settings', '02-couple-home'],
      ['Venue or business', 'vendor', 'acc_vendor_demo', '/business', '/business/settings', '05-business-dashboard'],
      ['Freelancer', 'freelancer', 'acc_freelancer_demo', '/freelancer', '/freelancer/settings', '06-freelancer-gigs'],
      ['Vivah staff', 'platform', 'acc_platform_demo', '/platform', '/platform/settings', '07-staff-dashboard'],
      ['Super admin', 'platform', 'acc_platform_admin', '/platform/admin', '/platform/settings', '08-super-admin'],
    ];
    for (const [label, role, accountId, route, settings, file] of roles) {
      const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      page.setDefaultTimeout(60000);
      page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
      await page.goto(base, { timeout: 180000 });
      await page.getByRole('button', { name: `Continue as ${label}`, exact: true }).waitFor();
      assert.equal(await page.getByText('Get started', { exact: true }).count(), 0);
      if (role === 'customer') await snap(page, '01-choose-user-type');
      await page.getByRole('button', { name: `Continue as ${label}`, exact: true }).click();
      await page.waitForFunction((id) => JSON.parse(localStorage.getItem('vivah-session'))?.state.session?.accountId === id, accountId);
      await page.waitForURL((url) => route === '/' ? !url.pathname.startsWith('/welcome') : url.pathname.startsWith(route));
      await snap(page, file);
      assert.deepEqual(await session(page), { accountId, role });
      await page.reload();
      await ready(page);
      assert.deepEqual(await session(page), { accountId, role });
      results.push(`PASS ${label}: one tap, correct account and role, reload persistence`);
      if (role === 'customer') {
        await page.goto(`${base}/my-wedding`);
        await snap(page, '03-event-planning');
        await page.goto(`${base}/vendors/photo-video`);
        await snap(page, '04-find-services');
        await page.goto(`${base}/platform/admin`);
        await ready(page);
        assert.ok(!new URL(page.url()).pathname.startsWith('/platform'));
        results.push('PASS couple cannot enter the admin app');
      }
      if (role === 'vendor' || role === 'platform') {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(`${base}${route}`);
        await ready(page);
        assert.deepEqual(await session(page), { accountId, role });
        results.push(`PASS ${label}: desktop width`);
        await page.setViewportSize({ width: 360, height: 640 });
      }
      if (label === 'Super admin') {
        await page.goto(`${base}/platform/admin`);
        await page.getByText('Reset all demo data', { exact: true }).click();
        await page.getByRole('alert').getByRole('button', { name: 'Reset', exact: true }).click();
        await page.getByText('Demo data restored', { exact: true }).waitFor();
        results.push('PASS reset demo data');
      }
      await signOut(page, settings);
      await page.goto(`${base}/welcome/login`);
      await page.getByRole('button', { name: 'Continue as Couple', exact: true }).waitFor();
      assert.ok(!new URL(page.url()).pathname.endsWith('/login'));
      await page.goto(`${base}/welcome/setup`);
      await page.getByRole('button', { name: 'Continue as Couple', exact: true }).waitFor();
      assert.ok(!new URL(page.url()).pathname.endsWith('/setup'));
      await page.getByRole('button', { name: `Continue as ${label}`, exact: true }).click();
      await page.waitForFunction((id) => JSON.parse(localStorage.getItem('vivah-session'))?.state.session?.accountId === id, accountId);
      results.push(`PASS ${label}: logout, hidden login/setup deep links, sign in again`);
      await context.close();
    }
    assert.deepEqual(errors, [], 'No browser runtime errors');
    results.push('PASS no browser runtime errors');
  } finally {
    await browser.close();
    await fs.writeFile(path.join(output, 'browser-validation.json'), JSON.stringify({ source: 'Expo web at phone dimensions; not a native device test', screenshots: '1080x1920 PNG', results, errors }, null, 2));
    console.log(results.join('\n'));
    if (errors.length) console.error(errors.join('\n'));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
