// Complete DataPrism Plugins Bundle
// Framework + All Out-of-Box Plugins

// Re-export everything from the framework
export * from "../packages/src/index.js";

// Re-export everything from out-of-box plugins
export * from "../packages/out-of-box/src/index.js";

// Additional convenience exports for CDN usage
import { PluginManager } from "../packages/src/index.js";
import { 
  PLUGIN_REGISTRY, 
  PLUGIN_METADATA,
  createVisualizationPlugin,
  createIntegrationPlugin,
  createProcessingPlugin,
  createUtilityPlugin,
  getAvailablePlugins,
  getPluginsByCategory
} from "../packages/out-of-box/src/index.js";

// Main plugin loader function for CDN users
export async function loadDataPrismCore() {
  // This is a placeholder for DataPrism core loading
  // In a real implementation, this would load the core engine
  console.log('[DataPrism Plugins] Core loading function called');
  return Promise.resolve({
    version: '1.0.0',
    loaded: true
  });
}

// Convenience factory for creating a pre-configured plugin manager
export async function createPluginManager() {
  const manager = new PluginManager();
  await manager.initialize();
  return manager;
}

// Plugin bundle metadata
export const BUNDLE_INFO = {
  name: "DataPrism Plugins Complete Bundle",
  version: "1.0.0",
  timestamp: new Date().toISOString(),
  framework: {
    name: "DataPrism Plugin Framework",
    version: "1.0.0"
  },
  plugins: PLUGIN_METADATA,
  totalPlugins: Object.keys(PLUGIN_METADATA).length,
  categories: ["visualization", "integration", "processing", "utility"]
};

// Export plugin utilities for easy access
export const PluginUtils = {
  createVisualizationPlugin,
  createIntegrationPlugin,
  createProcessingPlugin,
  createUtilityPlugin,
  getAvailablePlugins,
  getPluginsByCategory,
  PLUGIN_REGISTRY,
  PLUGIN_METADATA,
  BUNDLE_INFO
};