import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';
export default [
  { ignores: ['client/dist/**', 'playwright-report/**', 'test-results/**', '.local/**'] },
  js.configs.recommended,
  { files: ['server/**/*.js', 'api/**/*.js', 'client/vite.config.js', 'e2e/**/*.js'], languageOptions: { globals: globals.node } },
  { files: ['e2e/**/*.spec.js'], languageOptions: { globals: globals.browser } },
  {
    files: ['client/src/**/*.{js,jsx}'],
    languageOptions: { globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { react, 'react-hooks': hooks },
    rules: { 'react/jsx-uses-vars': 'error', 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error' },
  },
];
