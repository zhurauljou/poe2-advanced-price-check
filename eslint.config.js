// ESLint: рекомендованные правила. Главный процесс, скрипты и тесты — Node (CommonJS); части окна — браузер с общей
// областью видимости (функции одной части вызываются из другой), поэтому для них no-undef / no-unused-vars не годятся.
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'dist/**', 'out/**', 'PoE 2 Price Checker/**', 'test/fixtures/**'] },
  js.configs.recommended,
  {
    files: ['src/main/**/*.js', 'scripts/**/*.js', 'test/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }], 'no-empty': ['error', { allowEmptyCatch: true }] },
  },
  {
    // Общие модули: и require в главном процессе, и <script> в окне.
    files: ['src/shared/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-empty': ['error', { allowEmptyCatch: true }] },
  },
  {
    files: ['src/renderer/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: { ...globals.browser } },
    rules: { 'no-undef': 'off', 'no-unused-vars': 'off', 'no-redeclare': 'off', 'no-empty': ['error', { allowEmptyCatch: true }] },
  },
];
