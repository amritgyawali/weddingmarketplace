// Expo's default Metro config, plus the bug inbox: in development the app sends
// shake-to-report bug reports here and they land in ./bug-reports
// (see scripts/bug-inbox.cjs).
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const { createBugInbox } = require('./scripts/bug-inbox.cjs');

const config = getDefaultConfig(__dirname);

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
