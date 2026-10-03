// Installed test builds with shake-to-report (EXPO_PUBLIC_BUG_REPORTS=on) post
// bug reports to the bug inbox on the developer's computer over plain http on
// the local Wi-Fi, which Android release builds block by default. This allows
// it for those builds only; store builds are left untouched.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withBugInboxCleartext(config) {
  if (process.env.EXPO_PUBLIC_BUG_REPORTS !== 'on') return config;
  return withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (app) app.$['android:usesCleartextTraffic'] = 'true';
    return mod;
  });
};
