// Expo's default Metro config, with the transform cache kept inside this checkout.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Keep the transform cache inside this checkout instead of the shared temp folder.
// Worktrees share one node_modules (a junction), so Expo's cache keys come out the
// same in every checkout, and a cached expo-router entry from one worktree would
// point this app at another worktree's src/app ("Unable to resolve @/...").
const CacheStore = config.cacheStores[0].constructor;
config.cacheStores = [new CacheStore({ root: path.join(__dirname, '.expo', 'metro-cache') })];

module.exports = config;
