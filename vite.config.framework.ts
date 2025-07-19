import { defineConfig } from "vite";
import { resolve } from "path";

// Framework-only bundle - lighter weight, plugins loaded separately
export default defineConfig({
  build: {
    outDir: "dist/framework-bundles",
    lib: {
      entry: resolve(__dirname, "packages/src/index.ts"),
      name: "DataPrismFramework",
      fileName: (format) => `dataprism-framework.${format === 'iife' ? 'min' : format}.js`,
      formats: ["iife", "umd", "es"],
    },
    rollupOptions: {
      // Keep plugin dependencies external for framework-only bundle
      external: [
        "d3", 
        "papaparse", 
        "ml-kmeans", 
        "plotly.js"
      ],
      output: {
        exports: "named",
        globals: {
          "d3": "d3",
          "papaparse": "Papa",
          "ml-kmeans": "MLKMeans",
          "plotly.js": "Plotly"
        },
        banner: `/*
 * DataPrism Plugin Framework - CDN Bundle
 * Lightweight framework for loading DataPrism plugins
 * 
 * Plugin dependencies (d3, papaparse, etc.) must be loaded separately
 * For complete bundle with all plugins, use dataprism-plugins.min.js
 */`,
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true,
      },
      mangle: {
        keep_classnames: true,
        keep_fnames: true,
      },
    },
    sourcemap: true,
  },
});