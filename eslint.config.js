// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Colours come from tokens (src/constants/theme.ts), never hex literals in screens or components
    // (AGENTS.md §8). Allowed: couple-chosen website and invitation themes, and payment brand marks.
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    ignores: ["src/app/invitations.tsx", "src/app/website.tsx", "src/app/w/**", "src/components/work/Payments.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
          message: "Use a colour token from src/constants/theme.ts instead of a hex literal (AGENTS.md §8).",
        },
      ],
    },
  },
]);
