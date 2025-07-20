// Core plugin types - mock implementation for development
export type { 
  IPlugin,
  IDataProcessorPlugin, 
  IIntegrationPlugin,
  PluginContext,
  Dataset,
  DataSchema,
  DataField,
  PluginManifest,
  PluginCapability,
  ProcessingOptions,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationStatistics,
  ValidationSummary,
  ProcessingMetrics,
  PluginDependency,
  PluginPermission,
  PluginConfigSchema
} from './mock-plugins.js';

// IronCalc-specific types

export interface FormulaResult {
  value: string;
  error?: string;
  execution_time_ms: number;
  cell_address: string;
  formula_type: string;
}

export interface PerformanceMetrics {
  total_evaluations: number;
  average_execution_time: number;
  error_rate: number;
  memory_usage_bytes: number;
  cache_hit_rate: number;
}

export interface IronCalcConfig {
  maxCells: number;
  enableCustomFunctions: boolean;
  memoryLimitMB: number;
  calculationTimeout: number;
  autoRecalculation: boolean;
  cacheSize: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface FormulaColumn {
  name: string;
  formula: string;
  dependencies?: string[];
  type?: 'number' | 'string' | 'boolean' | 'date';
}

export interface CellReference {
  sheet: string;
  row: number;
  col: number;
}

export interface BulkFormulaRequest {
  formula: string;
  sheet: string;
  row: number;
  col: number;
}

export interface FormulaValidationOptions {
  checkSyntax: boolean;
  checkReferences: boolean;
  checkCircularDependencies: boolean;
  maxComplexity?: number;
}

export interface FormulaValidationResult {
  isValid: boolean;
  syntaxErrors: string[];
  referenceErrors: string[];
  circularDependencies: string[];
  complexity: number;
  recommendations: string[];
}

// WASM module interface (matches Rust exports)
export interface IronCalcWasmModule {
  IronCalcEngine: new() => IronCalcWasmEngine;
  init_ironcalc_plugin(): void;
  default(): Promise<void>;
}

export interface IronCalcWasmEngine {
  evaluateFormula(formula: string, sheet: string, row: number, col: number): string;
  setCellValue(sheet: string, row: number, col: number, value: string): void;
  getCellValue(sheet: string, row: number, col: number): string;
  createSheet(name: string): void;
  getPerformanceMetrics(): string;
  clearCache(): void;
  getMemoryUsage(): number;
}

// Error types for better error handling
export enum IronCalcErrorType {
  FORMULA_SYNTAX = 'FORMULA_SYNTAX',
  CELL_REFERENCE = 'CELL_REFERENCE', 
  CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE',
  FUNCTION_NOT_FOUND = 'FUNCTION_NOT_FOUND',
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  DIVISION_BY_ZERO = 'DIVISION_BY_ZERO',
  WASM_ERROR = 'WASM_ERROR',
  MEMORY_LIMIT = 'MEMORY_LIMIT',
  TIMEOUT = 'TIMEOUT',
  PLUGIN_NOT_INITIALIZED = 'PLUGIN_NOT_INITIALIZED'
}

export class IronCalcError extends Error {
  constructor(
    public type: IronCalcErrorType,
    message: string,
    public context?: any,
    public cellAddress?: string
  ) {
    super(message);
    this.name = 'IronCalcError';
  }

  toJSON() {
    return {
      type: this.type,
      message: this.message,
      context: this.context,
      cellAddress: this.cellAddress,
      name: this.name,
      stack: this.stack
    };
  }
}