/**
 * DataPrism Core CDN Loader
 * Dynamically loads DataPrism core dependencies from CDN with fallback strategies
 */

export interface CoreLoaderConfig {
  baseUrl?: string;
  version?: string;
  timeout?: number;
  retries?: number;
  fallbackToPeer?: boolean;
}

export interface CoreTypes {
  IPlugin: any;
  IVisualizationPlugin: any;
  IIntegrationPlugin: any;
  IDataProcessorPlugin: any;
  IUtilityPlugin: any;
  Dataset: any;
  PluginManifest: any;
  [key: string]: any;
}

export class CoreLoader {
  private static instance: CoreLoader;
  private config: CoreLoaderConfig;
  private loadPromise: Promise<CoreTypes> | null = null;
  private loadedTypes: CoreTypes | null = null;

  constructor(config: CoreLoaderConfig = {}) {
    this.config = {
      baseUrl: 'https://srnarasim.github.io/dataprism-core',
      version: 'latest',
      timeout: 30000,
      retries: 3,
      fallbackToPeer: true,
      ...config,
    };
  }

  static getInstance(config?: CoreLoaderConfig): CoreLoader {
    if (!CoreLoader.instance) {
      CoreLoader.instance = new CoreLoader(config);
    }
    return CoreLoader.instance;
  }

  /**
   * Load DataPrism core types and interfaces from CDN
   */
  async loadCore(): Promise<CoreTypes> {
    if (this.loadedTypes) {
      return this.loadedTypes;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.performLoad();
    return this.loadPromise;
  }

  private async performLoad(): Promise<CoreTypes> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retries!; attempt++) {
      try {
        console.log(`[CoreLoader] Attempt ${attempt}/${this.config.retries} to load DataPrism core from CDN...`);
        
        // Try loading from CDN
        const types = await this.loadFromCDN();
        this.loadedTypes = types;
        console.log('[CoreLoader] Successfully loaded DataPrism core from CDN');
        return types;

      } catch (error) {
        lastError = error as Error;
        console.warn(`[CoreLoader] CDN load attempt ${attempt} failed:`, error);
        
        if (attempt < this.config.retries!) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`[CoreLoader] Retrying in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }

    // Fallback to peer dependency if enabled
    if (this.config.fallbackToPeer) {
      try {
        console.log('[CoreLoader] Falling back to peer dependency...');
        const types = await this.loadFromPeer();
        this.loadedTypes = types;
        console.log('[CoreLoader] Successfully loaded DataPrism core from peer dependency');
        return types;
      } catch (error) {
        console.error('[CoreLoader] Peer dependency fallback failed:', error);
      }
    }

    // All attempts failed
    const error = new Error(
      `Failed to load DataPrism core after ${this.config.retries} attempts. Last error: ${lastError?.message}`
    );
    console.error('[CoreLoader]', error);
    throw error;
  }

  private async loadFromCDN(): Promise<CoreTypes> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      // Load orchestration layer from CDN
      const orchestrationUrl = `${this.config.baseUrl}/orchestration/index.js`;
      console.log(`[CoreLoader] Loading from: ${orchestrationUrl}`);

      const module = await import(orchestrationUrl);
      
      // Extract the types and interfaces we need
      const types: CoreTypes = {
        // Core interfaces
        IPlugin: module.IPlugin || class {},
        IVisualizationPlugin: module.IVisualizationPlugin || class {},
        IIntegrationPlugin: module.IIntegrationPlugin || class {},
        IDataProcessorPlugin: module.IDataProcessorPlugin || class {},
        IUtilityPlugin: module.IUtilityPlugin || class {},
        
        // Data types
        Dataset: module.Dataset || class {},
        PluginManifest: module.PluginManifest || class {},
        
        // Include all exported members
        ...module,
      };

      return types;

    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async loadFromPeer(): Promise<CoreTypes> {
    try {
      // Try loading from peer dependency using dynamic import to avoid build-time resolution
      const moduleName = '@dataprism/core';
      const module = await import(/* @vite-ignore */ moduleName);
      
      const types: CoreTypes = {
        IPlugin: module.IPlugin || class {},
        IVisualizationPlugin: module.IVisualizationPlugin || class {},
        IIntegrationPlugin: module.IIntegrationPlugin || class {},
        IDataProcessorPlugin: module.IDataProcessorPlugin || class {},
        IUtilityPlugin: module.IUtilityPlugin || class {},
        Dataset: module.Dataset || class {},
        PluginManifest: module.PluginManifest || class {},
        ...module,
      };

      return types;
    } catch (error) {
      throw new Error(`Peer dependency @dataprism/core not available: ${error.message}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if core types are already loaded
   */
  isLoaded(): boolean {
    return this.loadedTypes !== null;
  }

  /**
   * Get loaded types (throws if not loaded)
   */
  getTypes(): CoreTypes {
    if (!this.loadedTypes) {
      throw new Error('DataPrism core not loaded. Call loadCore() first.');
    }
    return this.loadedTypes;
  }

  /**
   * Reset the loader state (for testing)
   */
  reset(): void {
    this.loadPromise = null;
    this.loadedTypes = null;
  }
}

// Default singleton instance
export const coreLoader = CoreLoader.getInstance();

// Convenience function for loading core
export async function loadDataPrismCore(config?: CoreLoaderConfig): Promise<CoreTypes> {
  const loader = config ? new CoreLoader(config) : coreLoader;
  return loader.loadCore();
}

// Type-safe access to core types
export async function getCoreTypes(): Promise<CoreTypes> {
  return coreLoader.loadCore();
}