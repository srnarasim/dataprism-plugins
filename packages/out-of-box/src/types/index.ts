/**
 * Type compatibility layer for DataPrism Core CDN types
 * This file provides type-safe access to DataPrism core types loaded from CDN
 */

import { getCoreTypes } from '../core-loader';

// Re-export types with lazy loading
let coreTypesPromise: Promise<any> | null = null;

export async function getDataPrismTypes() {
  if (!coreTypesPromise) {
    coreTypesPromise = getCoreTypes();
  }
  return coreTypesPromise;
}

// Type aliases for compatibility - these will be dynamically resolved
export type Dataset = any;
export type DataType = 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'object';
export type IPlugin = any;
export type IVisualizationPlugin = any;
export type IIntegrationPlugin = any;
export type IDataProcessorPlugin = any;
export type IUtilityPlugin = any;
export type PluginManifest = any;
export type PluginContext = any;
export type PluginCapability = any;
export type VisualizationType = any;
export type RenderConfig = any;
export type Dimensions = any;
export type InteractionEvent = any;
export type InteractionFeature = any;
export type ExportFormat = any;
export type VisualizationConfig = any;

// Re-export common types that are stable
export interface Column {
  name: string;
  type: DataType;
}

// Local dataset interface for immediate use
export interface LocalDataset {
  columns: Column[];
  rows: any[][];
}

// Helper function to ensure types are loaded before use
export async function withDataPrismTypes<T>(
  callback: (types: any) => T | Promise<T>
): Promise<T> {
  const types = await getDataPrismTypes();
  return callback(types);
}

// Utility to check if core types are available
export async function isDataPrismCoreAvailable(): Promise<boolean> {
  try {
    await getDataPrismTypes();
    return true;
  } catch (error) {
    console.warn('[DataPrism Types] Core types not available:', error);
    return false;
  }
}