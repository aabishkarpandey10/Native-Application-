// @ts-check
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  {
    ignores: [
      "dist/**",
      "web-build/**",
      "build-output/**",
      ".cache/**",
      ".agents/**",
      "node_modules/**",
      "backend/**",
    ],
  },
  ...expoConfig,
  {
    rules: {
      "import/no-named-as-default": "off",
      "import/no-named-as-default-member": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/no-require-imports": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);
