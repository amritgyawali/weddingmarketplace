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
config.resolver.blockList = [...(Array.isArray(blockList) ? blockList : blockList ? [blockList] : []), reports];

const bugInbox = createBugInbox({ projectRoot: __dirname });
const enhance = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const metro = enhance ? enhance(middleware, server) : middleware;
  return (req, res, next) => bugInbox(req, res, () => metro(req, res, next));
};

module.exports = config;
