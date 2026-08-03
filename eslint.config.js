// ESLint flat config (ESLint 9) using Expo's shared rules.
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    // Build tooling that runs on Node, not in the app bundle.
    files: ['scripts/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { __dirname: 'readonly', __filename: 'readonly' },
    },
  },
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'babel.config.js', 'jest.config.js', 'eslint.config.js'],
  },
];
