import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['cjs', 'esm'],
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: true,
  outExtension({ format }) {
    if (format === 'cjs') {
      return { js: '.cjs.js' }
    }
    if (format === 'esm') {
      return { js: '.js' }
    }
    return {}
  }
})
