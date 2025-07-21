import type { 
  IDataProcessorPlugin, 
  IIntegrationPlugin,
  PluginContext,
  Dataset,
  PluginManifest,
  PluginCapability,
  ProcessingOptions,
  ValidationResult,
  PluginDependency
} from '../../../src/interfaces/index.js';

// ProcessingMetrics is not in the framework, define it locally
export interface ProcessingMetrics {
  averageProcessingTime: number;
  throughput: number;
  memoryUsage: number;
  cpuUsage: number;
  successRate: number;
  lastUpdated: string;
}

// IronCalc-specific types (inline to avoid import issues)
export interface FormulaResult {
  value: string;
  error?: string;
  execution_time_ms: number;
  dependencies?: string[];
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

export interface BulkFormulaRequest {
  formula: string;
  address: string;
}

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

// Simple error handler (inline implementation)
export class IronCalcErrorHandler {
  static createNotInitializedError(pluginName: string): Error {
    return new Error(`${pluginName} plugin not initialized`);
  }
  
  static createTimeoutError(operation: string, timeout: number): Error {
    return new Error(`${operation} timeout after ${timeout}ms`);
  }
  
  static createMemoryLimitError(usage: number, limit: number): Error {
    return new Error(`Memory usage ${usage} bytes exceeds limit ${limit}MB`);
  }
  
  static handleFormulaError(error: any, operation: string, context?: string): Error {
    const message = context ? `${operation} in ${context}: ${error}` : `${operation}: ${error}`;
    return new Error(message);
  }
  
  static validateFormulaInput(formula: string): void {
    if (!formula || formula.trim().length === 0) {
      throw new Error('Formula cannot be empty');
    }
  }
  
  static validateCellReference(sheet: string, row: number, col: number): void {
    if (!sheet || sheet.trim().length === 0) {
      throw new Error('Sheet name cannot be empty');
    }
    if (row < 1 || col < 1) {
      throw new Error('Row and column must be positive numbers');
    }
  }
}

export class IronCalcFormulaPlugin implements IDataProcessorPlugin, IIntegrationPlugin {
  private engine: IronCalcWasmEngine | null = null;
  private wasmModule: IronCalcWasmModule | null = null;
  private config: IronCalcConfig;
  private context: PluginContext | null = null;
  private isInitialized = false;
  private operationTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.config = {
      maxCells: 100000,
      enableCustomFunctions: true,
      memoryLimitMB: 512,
      calculationTimeout: 30000,
      autoRecalculation: true,
      cacheSize: 10000,
      logLevel: 'info'
    };
  }

  // IPlugin interface methods
  getName(): string { 
    return 'ironcalc-formula-engine'; 
  }
  
  getVersion(): string { 
    return '0.1.0'; 
  }
  
  getDescription(): string { 
    return 'Excel-compatible formula engine powered by IronCalc WASM'; 
  }
  
  getAuthor(): string { 
    return 'DataPrism Team'; 
  }
  
  getDependencies(): PluginDependency[] { 
    return [
      { name: '@dataprism/core', version: '^1.0.0', optional: false },
      { name: 'ironcalc', version: '^0.4.0', optional: false }
    ]; 
  }

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    context.logger.info('Initializing IronCalc formula engine...');

    try {
      // Load WASM module
      const wasmPath = this.getWasmModulePath();
      context.logger.debug(`Loading WASM module from: ${wasmPath}`);
      
      this.wasmModule = await this.loadWasmModule(wasmPath);
      
      // Initialize WASM
      await this.wasmModule.default();
      this.wasmModule.init_ironcalc_plugin();

      // Create engine instance
      this.engine = new this.wasmModule.IronCalcEngine();
      this.isInitialized = true;
      
      context.logger.info('IronCalc formula engine initialized successfully');
      
      // Apply initial configuration
      await this.configure(this.config);
      
    } catch (error) {
      const message = `Failed to initialize IronCalc: ${error}`;
      context.logger.error(message);
      throw IronCalcErrorHandler.handleFormulaError(error, 'initialization');
    }
  }

  async activate(): Promise<void> {
    if (!this.isInitialized) {
      throw IronCalcErrorHandler.createNotInitializedError(this.getName());
    }
    this.context?.logger.info('IronCalc plugin activated');
  }

  async deactivate(): Promise<void> {
    if (this.operationTimeout) {
      clearTimeout(this.operationTimeout);
      this.operationTimeout = null;
    }
    this.context?.logger.info('IronCalc plugin deactivated');
  }

  async cleanup(): Promise<void> {
    if (this.engine) {
      try {
        this.engine.clearCache();
      } catch (error) {
        this.context?.logger.warn('Error clearing cache during cleanup:', error);
      }
    }
    
    this.engine = null;
    this.wasmModule = null;
    this.isInitialized = false;
    this.context?.logger.info('IronCalc plugin cleaned up');
  }

  async configure(settings: Partial<IronCalcConfig>): Promise<void> {
    this.config = { ...this.config, ...settings };
    this.context?.logger.info('IronCalc configured:', this.config);
    
    // Apply memory limits if engine is available
    if (this.engine && this.config.memoryLimitMB) {
      const currentMemory = this.engine.getMemoryUsage();
      const limitBytes = this.config.memoryLimitMB * 1024 * 1024;
      
      if (currentMemory > limitBytes) {
        this.context?.logger.warn(`Memory usage (${Math.round(currentMemory / 1024 / 1024)}MB) exceeds configured limit (${this.config.memoryLimitMB}MB)`);
      }
    }
  }

  getManifest(): PluginManifest {
    return {
      name: this.getName(),
      version: this.getVersion(),
      description: this.getDescription(),
      author: this.getAuthor(),
      license: 'MIT',
      homepage: 'https://github.com/srnarasim/dataprism-plugins',
      repository: 'https://github.com/srnarasim/dataprism-plugins',
      keywords: ['formula', 'excel', 'spreadsheet', 'calculation', 'wasm', 'ironcalc'],
      category: 'data-processing',
      entryPoint: './dist/ironcalc-plugin.js',
      dependencies: this.getDependencies(),
      permissions: [
        { resource: 'data', access: 'read' },
        { resource: 'data', access: 'write' },
        { resource: 'workers', access: 'execute' },
        { resource: 'storage', access: 'read' }
      ],
      configuration: {
        maxCells: { 
          type: 'number', 
          default: 100000, 
          description: 'Maximum number of cells allowed' 
        },
        enableCustomFunctions: { 
          type: 'boolean', 
          default: true, 
          description: 'Enable custom function registration' 
        },
        memoryLimitMB: { 
          type: 'number', 
          default: 512, 
          description: 'Memory limit in MB' 
        },
        calculationTimeout: { 
          type: 'number', 
          default: 30000, 
          description: 'Calculation timeout in ms' 
        },
        autoRecalculation: { 
          type: 'boolean', 
          default: true, 
          description: 'Enable automatic recalculation on data changes' 
        },
        cacheSize: {
          type: 'number',
          default: 10000,
          description: 'Formula cache size'
        },
        logLevel: {
          type: 'string',
          default: 'info',
          description: 'Logging level (debug, info, warn, error)'
        }
      },
      compatibility: {
        minCoreVersion: '1.0.0',
        browsers: ['chrome >= 90', 'firefox >= 88', 'safari >= 14', 'edge >= 90']
      }
    };
  }

  getCapabilities(): PluginCapability[] {
    return [
      {
        name: 'formula-evaluation',
        description: 'Evaluate Excel-compatible formulas',
        type: 'processing',
        version: '1.0.0',
        async: true,
        inputTypes: ['string', 'object'],
        outputTypes: ['string', 'number', 'boolean']
      },
      {
        name: 'bulk-calculation',
        description: 'Batch formula evaluation for large datasets',
        type: 'processing',
        version: '1.0.0',
        async: true,
        inputTypes: ['array'],
        outputTypes: ['array']
      },
      {
        name: 'dataset-processing',
        description: 'Process datasets with embedded formulas',
        type: 'processing',
        version: '1.0.0',
        async: true,
        inputTypes: ['object'],
        outputTypes: ['object']
      }
    ];
  }

  isCompatible(coreVersion: string): boolean {
    // Simple semver check - in production, use proper semver library
    const [major] = coreVersion.split('.');
    return parseInt(major) >= 1;
  }

  // IDataProcessorPlugin methods
  async process(dataset: Dataset, options?: ProcessingOptions): Promise<Dataset> {
    this.ensureInitialized();
    this.context?.logger.info('Processing dataset with formulas:', dataset.name);

    const processedData = { ...dataset };
    
    // Find formula fields in schema
    const formulaFields = dataset.schema.fields.filter(field => 
      field.type === 'string' && field.description?.includes('formula:')
    );

    if (formulaFields.length > 0) {
      this.context?.logger.debug(`Found ${formulaFields.length} formula fields`);
      processedData.data = await this.processFormulaColumns(dataset.data, formulaFields);
    } else {
      this.context?.logger.debug('No formula fields found in dataset');
    }

    return processedData;
  }

  async transform(dataset: Dataset, rules: any[]): Promise<Dataset> {
    this.ensureInitialized();
    this.context?.logger.info('Transforming dataset with rules:', rules.length);
    
    // For now, just process any embedded formulas
    return this.process(dataset);
  }

  async validate(dataset: Dataset): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];
    
    // Validate dataset size against limits
    if (dataset.data.length > this.config.maxCells) {
      errors.push({
        field: 'dataset',
        message: `Dataset too large: ${dataset.data.length} rows exceeds limit of ${this.config.maxCells}`,
        code: 'DATASET_TOO_LARGE'
      });
    }

    // Check memory usage if engine is available
    if (this.engine) {
      const memoryUsage = this.engine.getMemoryUsage();
      const limitBytes = this.config.memoryLimitMB * 1024 * 1024;
      
      if (memoryUsage > limitBytes * 0.9) { // Warn at 90% of limit
        warnings.push({
          field: 'memory',
          message: `High memory usage: ${Math.round(memoryUsage / 1024 / 1024)}MB (limit: ${this.config.memoryLimitMB}MB)`,
          code: 'HIGH_MEMORY_USAGE'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      statistics: {
        totalRows: dataset.data.length,
        validRows: dataset.data.length - errors.length,
        invalidRows: errors.length,
        errorCount: errors.length,
        warningCount: warnings.length,
        completeness: 100,
        uniqueness: 100
      },
      summary: {
        overallScore: errors.length === 0 ? (warnings.length === 0 ? 100 : 85) : 50,
        dataQuality: errors.length === 0 ? 
          (warnings.length === 0 ? 'excellent' : 'good') : 'fair',
        recommendations: [
          ...(errors.length > 0 ? ['Reduce dataset size to stay within limits'] : []),
          ...(warnings.length > 0 ? ['Monitor memory usage'] : [])
        ]
      }
    };
  }

  getProcessingCapabilities(): any[] {
    return this.getCapabilities().filter(cap => cap.type === 'processing');
  }

  getSupportedDataTypes(): string[] {
    return ['string', 'number', 'integer', 'boolean', 'date', 'datetime'];
  }

  getPerformanceMetrics(): ProcessingMetrics {
    if (!this.engine) {
      return {
        averageProcessingTime: 0,
        throughput: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        successRate: 1,
        lastUpdated: new Date().toISOString()
      };
    }

    try {
      const wasmMetricsStr = this.engine.getPerformanceMetrics();
      const wasmMetrics: PerformanceMetrics = JSON.parse(wasmMetricsStr);
      
      return {
        averageProcessingTime: wasmMetrics.average_execution_time,
        throughput: wasmMetrics.total_evaluations,
        memoryUsage: wasmMetrics.memory_usage_bytes,
        cpuUsage: 0, // Would need additional measurement
        successRate: 1 - wasmMetrics.error_rate,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      this.context?.logger.warn('Failed to get WASM performance metrics:', error);
      return {
        averageProcessingTime: 0,
        throughput: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        successRate: 1,
        lastUpdated: new Date().toISOString()
      };
    }
  }

  async batch(datasets: Dataset[]): Promise<Dataset[]> {
    this.ensureInitialized();
    this.context?.logger.info(`Processing ${datasets.length} datasets in batch`);
    
    return Promise.all(datasets.map(dataset => this.process(dataset)));
  }

  async stream(dataStream: ReadableStream<Dataset>): Promise<ReadableStream<Dataset>> {
    this.ensureInitialized();
    
    const transformer = new TransformStream({
      transform: async (chunk, controller) => {
        try {
          const processed = await this.process(chunk);
          controller.enqueue(processed);
        } catch (error) {
          this.context?.logger.error('Error in stream processing:', error);
          controller.error(error);
        }
      }
    });

    return dataStream.pipeThrough(transformer);
  }

  // IIntegrationPlugin methods (basic implementation)
  async connect(): Promise<boolean> {
    return this.isInitialized;
  }

  async disconnect(): Promise<void> {
    // IronCalc doesn't require external connections
  }

  async sync(): Promise<any> {
    return { status: 'synced', timestamp: Date.now() };
  }

  async import(data: any, format: string): Promise<any> {
    if (format === 'xlsx') {
      throw new Error('XLSX import not yet implemented - requires IronCalc XLSX feature');
    }
    throw new Error(`Unsupported import format: ${format}`);
  }

  async export(data: any, format: string): Promise<any> {
    if (format === 'xlsx') {
      throw new Error('XLSX export not yet implemented - requires IronCalc XLSX feature');
    }
    throw new Error(`Unsupported export format: ${format}`);
  }

  // Core functionality methods
  async execute(operation: string, params: any): Promise<any> {
    this.ensureInitialized();

    switch (operation) {
      case 'evaluateFormula':
        return this.evaluateFormula(params.formula, params.sheet, params.row, params.col);
      case 'bulkEvaluate':
        return this.bulkEvaluateFormulas(params.formulas);
      case 'processDataset':
        return this.processFormulaDataset(params.dataset, params.formulaColumns);
      case 'setCellValue':
        return this.setCellValue(params.sheet, params.row, params.col, params.value);
      case 'getCellValue':
        return this.getCellValue(params.sheet, params.row, params.col);
      case 'createSheet':
        return this.createSheet(params.name);
      case 'getMetrics':
        return this.getPerformanceMetrics();
      case 'clearCache':
        return this.clearCache();
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }

  // Private implementation methods
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.engine) {
      throw IronCalcErrorHandler.createNotInitializedError(this.getName());
    }
  }

  private async evaluateFormula(
    formula: string, 
    sheet: string = 'Sheet1', 
    row: number = 1, 
    col: number = 1
  ): Promise<FormulaResult> {
    this.ensureInitialized();
    
    try {
      // Validate inputs
      IronCalcErrorHandler.validateFormulaInput(formula);
      IronCalcErrorHandler.validateCellReference(sheet, row, col);
      
      // Set up timeout if configured
      const timeoutPromise = this.config.calculationTimeout > 0 
        ? new Promise<never>((_, reject) => {
            this.operationTimeout = setTimeout(() => {
              reject(IronCalcErrorHandler.createTimeoutError('evaluateFormula', this.config.calculationTimeout));
            }, this.config.calculationTimeout);
          })
        : null;

      // Execute formula evaluation
      const evaluationPromise = new Promise<FormulaResult>((resolve, reject) => {
        try {
          const resultStr = this.engine!.evaluateFormula(formula, sheet, row, col);
          const result: FormulaResult = JSON.parse(resultStr);
          resolve(result);
        } catch (error) {
          reject(IronCalcErrorHandler.handleFormulaError(error, 'formula evaluation', `${sheet}:${this.colToLetter(col)}${row}`));
        }
      });

      // Race between evaluation and timeout
      const result = timeoutPromise 
        ? await Promise.race([evaluationPromise, timeoutPromise])
        : await evaluationPromise;

      // Clear timeout if it was set
      if (this.operationTimeout) {
        clearTimeout(this.operationTimeout);
        this.operationTimeout = null;
      }

      return result;
    } catch (error) {
      // Clear timeout on error
      if (this.operationTimeout) {
        clearTimeout(this.operationTimeout);
        this.operationTimeout = null;
      }
      throw error;
    }
  }

  private async bulkEvaluateFormulas(formulas: BulkFormulaRequest[]): Promise<FormulaResult[]> {
    this.ensureInitialized();
    this.context?.logger.debug(`Bulk evaluating ${formulas.length} formulas`);
    
    // Process in batches to avoid memory issues
    const batchSize = 100;
    const results: FormulaResult[] = [];
    
    for (let i = 0; i < formulas.length; i += batchSize) {
      const batch = formulas.slice(i, i + batchSize);
      const batchPromises = batch.map(f => 
        this.evaluateFormula(f.formula, f.sheet, f.row, f.col)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Check memory usage periodically
      if (i % (batchSize * 10) === 0) {
        const memoryUsage = this.engine!.getMemoryUsage();
        const limitBytes = this.config.memoryLimitMB * 1024 * 1024;
        
        if (memoryUsage > limitBytes) {
          throw IronCalcErrorHandler.createMemoryLimitError(memoryUsage, this.config.memoryLimitMB);
        }
      }
    }
    
    return results;
  }

  private async processFormulaColumns(data: any[], formulaFields: any[]): Promise<any[]> {
    this.ensureInitialized();
    
    return data.map((row: any, rowIndex: number) => {
      const processedRow = { ...row };
      
      for (const field of formulaFields) {
        const formulaMatch = field.description?.match(/formula:(.+)/);
        if (formulaMatch) {
          const formula = formulaMatch[1].trim();
          try {
            // Replace column references with actual values
            const processedFormula = this.substituteColumnReferences(formula, row);
            const resultStr = this.engine!.evaluateFormula(
              processedFormula,
              'Data',
              rowIndex + 1,
              1
            );
            const result: FormulaResult = JSON.parse(resultStr);
            
            // Set the processed value, handling errors
            processedRow[field.name] = result.error ? null : result.value;
            
          } catch (error) {
            processedRow[field.name] = null;
            this.context?.logger.warn(`Formula error in row ${rowIndex}, field ${field.name}:`, error);
          }
        }
      }
      
      return processedRow;
    });
  }

  private async processFormulaDataset(
    dataset: Dataset, 
    formulaColumns: FormulaColumn[]
  ): Promise<Dataset> {
    this.ensureInitialized();
    this.context?.logger.debug(`Processing dataset with ${formulaColumns.length} formula columns`);
    
    const processedData = dataset.data.map((row, rowIndex) => {
      const processedRow = { ...row };
      
      for (const formulaCol of formulaColumns) {
        try {
          const processedFormula = this.substituteColumnReferences(formulaCol.formula, row);
          const resultStr = this.engine!.evaluateFormula(
            processedFormula,
            'DataSheet',
            rowIndex + 1,
            1
          );
          const result: FormulaResult = JSON.parse(resultStr);
          
          // Type conversion based on column type
          let value = result.error ? null : result.value;
          if (value !== null && formulaCol.type) {
            value = this.convertValueToType(value, formulaCol.type);
          }
          
          processedRow[formulaCol.name] = value;
        } catch (error) {
          processedRow[formulaCol.name] = null;
          this.context?.logger.warn(`Formula error in ${formulaCol.name}, row ${rowIndex}:`, error);
        }
      }
      
      return processedRow;
    });

    return {
      ...dataset,
      data: processedData
    };
  }

  private setCellValue(sheet: string, row: number, col: number, value: string): void {
    this.ensureInitialized();
    IronCalcErrorHandler.validateCellReference(sheet, row, col);
    
    this.engine!.setCellValue(sheet, row, col, value);
  }

  private getCellValue(sheet: string, row: number, col: number): string {
    this.ensureInitialized();
    IronCalcErrorHandler.validateCellReference(sheet, row, col);
    
    return this.engine!.getCellValue(sheet, row, col);
  }

  private createSheet(name: string): void {
    this.ensureInitialized();
    
    if (!name || name.trim().length === 0) {
      throw new Error('Sheet name cannot be empty');
    }
    
    if (name.length > 31) {
      throw new Error('Sheet name too long (max 31 characters)');
    }
    
    this.engine!.createSheet(name);
  }

  private clearCache(): void {
    this.ensureInitialized();
    this.engine!.clearCache();
  }

  private substituteColumnReferences(formula: string, rowData: any): string {
    let processedFormula = formula;
    
    // Replace column references like [ColumnName] with actual values
    Object.keys(rowData).forEach(key => {
      const regex = new RegExp(`\\[${key}\\]`, 'g');
      const value = rowData[key];
      
      if (value === null || value === undefined) {
        processedFormula = processedFormula.replace(regex, '0');
      } else if (typeof value === 'string') {
        // Escape quotes in strings
        const escapedValue = value.replace(/"/g, '""');
        processedFormula = processedFormula.replace(regex, `"${escapedValue}"`);
      } else {
        processedFormula = processedFormula.replace(regex, String(value));
      }
    });
    
    return processedFormula;
  }

  private convertValueToType(value: string, type: string): any {
    switch (type) {
      case 'number':
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
      case 'boolean':
        return value.toLowerCase() === 'true' || value === '1';
      case 'date':
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
      default:
        return value;
    }
  }

  private colToLetter(col: number): string {
    let result = '';
    let c = col;
    while (c > 0) {
      c--;
      result = String.fromCharCode(65 + (c % 26)) + result;
      c = Math.floor(c / 26);
    }
    return result;
  }

  private getWasmModulePath(): string {
    if (typeof window === 'undefined') return '';
    
    // Development vs production path detection
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return './pkg/dataprism_ironcalc_plugin.js';
    }
    
    // Production CDN path
    return 'https://srnarasim.github.io/dataprism-plugins/plugins/ironcalc-formula/pkg/dataprism_ironcalc_plugin.js';
  }

  private async loadWasmModule(wasmPath: string): Promise<IronCalcWasmModule> {
    try {
      // Dynamic import with proper error handling
      const module = await import(/* @vite-ignore */ wasmPath);
      return module as IronCalcWasmModule;
    } catch (error) {
      throw IronCalcErrorHandler.handleFormulaError(
        error, 
        `WASM module loading from ${wasmPath}`
      );
    }
  }
}

// Plugin factory function for easy instantiation
export function createIronCalcPlugin(config?: Partial<IronCalcConfig>): IronCalcFormulaPlugin {
  const plugin = new IronCalcFormulaPlugin();
  if (config) {
    plugin.configure(config);
  }
  return plugin;
}

// Auto-registration for CDN usage
if (typeof window !== 'undefined' && (window as any).DataPrismPluginRegistry) {
  try {
    const plugin = new IronCalcFormulaPlugin();
    (window as any).DataPrismPluginRegistry.register(plugin);
    console.log('IronCalc plugin auto-registered successfully');
  } catch (error) {
    console.warn('Failed to auto-register IronCalc plugin:', error);
  }
}