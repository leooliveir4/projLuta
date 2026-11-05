import { defineConfig } from 'vitest/config';

// Caminhos relativos ('./') funcionam no GitHub Pages com qualquer nome de repositório.
// Para fixar um caminho absoluto, defina BASE_PATH (ex.: BASE_PATH=/projLuta/ npm run build).
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
