// app.json holds the shared config. This file turns it into one of the
// single-role Play Store apps when EXPO_PUBLIC_APP_EDITION is set (the EAS
// profiles production-vendor, production-freelancer, production-staff and
// production-admin set it; see src/constants/edition.ts and AGENTS.md §2).
// Unset, the config is app.json unchanged: every role app in one binary.

const EDITIONS = {
  vendor: {
    name: 'Vivah for Business',
    id: 'com.vivah.business',
    scheme: 'vivah-business',
    color: '#173F38',
    location: 'Vivah for Business uses your location only when you share it in a chat with a couple or your crew.',
    photos: 'Vivah for Business uses the photos and videos you pick for your portfolio, profile and chats.',
  },
  freelancer: {
    name: 'Vivah Freelancer',
    id: 'com.vivah.freelancer',
    scheme: 'vivah-freelancer',
    color: '#1C2B4A',
    location: 'Vivah Freelancer uses your location to confirm your check-in at the wedding venue, and when you share it in a chat.',
    photos: 'Vivah Freelancer uses the photos you pick for proof of completed work, your portfolio and your profile.',
  },
  staff: {
    name: 'Vivah Staff',
    id: 'com.vivah.staff',
    scheme: 'vivah-staff',
    color: '#4A1020',
    location: 'Vivah Staff uses your location only when you share it in a chat with a couple or crew.',
    photos: 'Vivah Staff uses the photos you pick for chats, your profile and bug reports.',
  },
  admin: {
    name: 'Vivah Admin',
    id: 'com.vivah.admin',
    scheme: 'vivah-admin',
    color: '#231A16',
    location: 'Vivah Admin uses your location only when you share it in a chat.',
    photos: 'Vivah Admin uses the photos you pick for app content, chats and your profile.',
  },
};

// Single-role apps never use these: the camera (photos come from the system picker),
// the microphone, contacts (the couple's guest list), broad storage or overlays.
const BLOCKED = [
  'READ_MEDIA_IMAGES',
  'READ_MEDIA_VIDEO',
  'READ_EXTERNAL_STORAGE',
  'WRITE_EXTERNAL_STORAGE',
  'CAMERA',
  'RECORD_AUDIO',
  'ACTIVITY_RECOGNITION',
  'SYSTEM_ALERT_WINDOW',
  'READ_CONTACTS',
  'WRITE_CONTACTS',
].map((p) => `android.permission.${p}`);

const pluginName = (plugin) => (Array.isArray(plugin) ? plugin[0] : plugin);

module.exports = ({ config }) => {
  const key = (process.env.EXPO_PUBLIC_APP_EDITION || '').trim().toLowerCase();
  const edition = EDITIONS[key];
  if (!edition) return config;

  const icons = `./assets/images/editions/${key}`;
  const plugins = config.plugins
    // The guest list's contact picker is the couple's only.
    .filter((plugin) => pluginName(plugin) !== 'expo-contacts')
    .map((plugin) => {
      switch (pluginName(plugin)) {
        case 'expo-splash-screen':
          return ['expo-splash-screen', { ...plugin[1], backgroundColor: edition.color }];
        case 'expo-location':
          return ['expo-location', { locationWhenInUsePermission: edition.location }];
        case 'expo-image-picker':
          return ['expo-image-picker', { photosPermission: edition.photos, cameraPermission: false, microphonePermission: false }];
        default:
          return plugin;
      }
    });

  return {
    ...config,
    name: edition.name,
    scheme: edition.scheme,
    icon: `${icons}/icon.png`,
    ios: {
      ...config.ios,
      bundleIdentifier: edition.id,
      infoPlist: { ...config.ios.infoPlist, NSLocationWhenInUseUsageDescription: edition.location },
    },
    android: {
      ...config.android,
      package: edition.id,
      adaptiveIcon: {
        backgroundColor: edition.color,
        foregroundImage: `${icons}/android-icon-foreground.png`,
        backgroundImage: `${icons}/android-icon-background.png`,
        monochromeImage: `${icons}/android-icon-monochrome.png`,
      },
      blockedPermissions: [...new Set([...(config.android.blockedPermissions ?? []), ...BLOCKED])],
    },
    plugins,
    extra: { ...config.extra, edition: key },
  };
};
