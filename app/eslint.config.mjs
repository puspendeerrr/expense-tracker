import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  { ignores: ['dist/**', 'android/**', '.expo/**', 'expo-env.d.ts'] },
  { files: ['**/*.{ts,tsx}'], extends: [js.configs.recommended, tseslint.configs.recommended] },
]);
