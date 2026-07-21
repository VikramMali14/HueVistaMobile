// ESLint flat config (ESLint 9) using Expo's shared rules.
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'babel.config.js', 'jest.config.js', 'eslint.config.js'],
  },
];
