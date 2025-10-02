module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports' },
    ],
  },
  env: {
    node: true,
    es2022: true,
  },
  overrides: [
    {
      // Disable type-checking rules for test files
      files: ['**/*.test.ts', '**/*.spec.ts'],
      parserOptions: {
        project: null,
      },
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
      ],
    },
  ],
};
