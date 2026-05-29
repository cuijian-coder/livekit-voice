import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'electron/main/main.ts'),
      formats: ['cjs'],
      fileName: () => 'main.cjs',
    },
    outDir: 'electron-dist',
    emptyOutDir: true,
    rollupOptions: {
      external: ['electron', 'path'],
    },
  },
})
