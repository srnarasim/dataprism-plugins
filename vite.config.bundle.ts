import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: "dist/bundles",
    lib: {
      entry: resolve(__dirname, "src/complete-bundle.ts"),
      name: "DataPrismPlugins",
      fileName: (format) => `dataprism-plugins.${format === 'iife' ? 'min' : format}.js`,
      formats: ["iife", "umd", "es"],
    },
    rollupOptions: {
      // Bundle ALL dependencies for CDN version
      external: [],
      output: {
        exports: "named",
        globals: {},
        // Add banner
        banner: `/*
 * DataPrism Plugins - CDN Bundle
 * Complete plugin framework with all dependencies bundled
 * 
 * Includes: Framework, CSV Importer, Charts, Clustering, Performance Monitor, IronCalc Formula Engine, LangGraph Integration, MCP Integration, Parquet HTTPFS
 * Dependencies: d3, papaparse, ml-kmeans, plotly.js, @langchain/core, @langchain/langgraph, @modelcontextprotocol/sdk
 */`,
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for plugin debugging
        drop_debugger: true,
      },
      mangle: {
        keep_classnames: true, // Preserve plugin class names
        keep_fnames: true,     // Preserve function names for plugin API
      },
    },
    sourcemap: true,
  },
  // Optimize plugin dependencies
  optimizeDeps: {
    include: ["d3", "papaparse", "ml-kmeans", "plotly.js"],
  },
});