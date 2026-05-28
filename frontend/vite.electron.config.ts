import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: {
        main: resolve(__dirname, 'electron/main.ts'),
        preload: resolve(__dirname, 'electron/preload.ts'),
      },
      formats: ['cjs'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    outDir: 'electron-dist',
    emptyOutDir: true,
    rollupOptions: {
      external: ['electron', 'fs', 'path'],
    },
  },
})
