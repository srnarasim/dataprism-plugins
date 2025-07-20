import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: './ts/ironcalc-plugin.ts',
      name: 'DataPrismIronCalcPlugin',
      formats: ['es', 'umd'],
      fileName: (format) => `ironcalc-plugin.${format}.js`
    },
    rollupOptions: {
      external: ['@dataprism/plugins'],
      output: {
        globals: {
          '@dataprism/plugins': 'DataPrismPlugins'
        }
      }
    },
    sourcemap: true,
    target: 'es2022',
    outDir: 'dist'
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
  server: {
    fs: {
      allow: ['..', '../../..']
    }
  }
});