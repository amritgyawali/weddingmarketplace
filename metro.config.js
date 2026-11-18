// Expo's default Metro config, with the transform cache kept inside this
// checkout, plus the bug inbox: in development the app sends shake-to-report
// bug reports here and they land in ./bug-reports (see scripts/bug-inbox.cjs).
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const { createBugInbox } = require('./scripts/bug-inbox.cjs');

const config = getDefaultConfig(__dirname);

// Keep the transform cache inside this checkout instead of the shared temp folder.
// Worktrees share one node_modules (a junction), so Expo's cache keys come out the
// same in every checkout, and a cached expo-router entry from one worktree would
// point this app at another worktree's src/app ("Unable to resolve @/...").
const CacheStore = config.cacheStores[0].constructor;
config.cacheStores = [new CacheStore({ root: path.join(__dirname, '.expo', 'metro-cache') })];

// Saved reports are not app code: keep them out of the bundler's file map.
const reports = new RegExp(`^${path.join(__dirname, 'bug-reports').replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&')}[\\\\/].*`);
const blockList = config.resolver.blockList;
config.resolver.blockList = [...(Array.isArray(blockList) ? blockList : blockList ? [blockList] : []), reports, ...editionBlockList()];

/**
 * Single-role apps (EXPO_PUBLIC_APP_EDITION, see src/constants/edition.ts):
 * leave every other role's route files out of the file map, so expo-router
 * never sees them and the bundle drops the screens only they import. Shared
 * routes (start URL, welcome, notifications, legal pages, report a bug, payment return)
 * stay in every edition. Metro tests folders too, so a kept folder's own path
 * (no trailing slash) must not match.
 */
function editionBlockList() {
  const edition = (process.env.EXPO_PUBLIC_APP_EDITION || '').trim().toLowerCase();
  const own = { vendor: 'business', freelancer: 'freelancer', staff: 'platform', admin: 'platform' }[edition];
  const sep = String.raw`[\\/]`;
  const app = path
    .join(__dirname, 'src', 'app')
    .split(/[\\/]/)
    .map((part) => part.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&'))
    .join(sep);
  const startUrl = String.raw`\(edition\)`;
  // `(edition)/index` is the single-role apps' start URL; in the all-roles app `/` is the couple's home tab.
  if (!own) return [new RegExp(`^${app}${sep}${startUrl}(?:${sep}|$)`)];
  const shared = [String.raw`_layout\.tsx$`, String.raw`\+not-found\.tsx$`, String.raw`notifications\.tsx$`, String.raw`report-bug\.tsx$`, `(?:${startUrl}|welcome|legal|pay|${own})(?:${sep}|$)`];
  const blocked = [new RegExp(`^${app}${sep}(?!(?:${shared.join('|')}))`)];
  // The Staff app has no super admin console; the Admin app keeps it.
  if (edition === 'staff') blocked.push(new RegExp(`^${app}${sep}platform${sep}admin(?:${sep}|$)`));
  return blocked;
}

const bugInbox = createBugInbox({ projectRoot: __dirname });
const enhance = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const metro = enhance ? enhance(middleware, server) : middleware;
  return (req, res, next) => bugInbox(req, res, () => metro(req, res, next));
};

module.exports = config;
