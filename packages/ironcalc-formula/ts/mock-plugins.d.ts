// Mock types for DataPrism plugins framework
// In a real implementation, these would come from @dataprism/plugins

export interface IPlugin {
  getName(): string;
  getVersion(): string;
  getDescription(): string;
  getAuthor(): string;
  getDependencies(): PluginDependency[];
  initialize(context: PluginContext): Promise<void>;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  cleanup(): Promise<void>;
  execute(operation: string, params: any): Promise<any>;
  configure(settings: any): Promise<void>;
  getManifest(): PluginManifest;
  getCapabilities(): PluginCapability[];
  isCompatible(coreVersion: string): boolean;
}

export interface IDataProcessorPlugin extends IPlugin {
  process(data: Dataset, options?: ProcessingOptions): Promise<Dataset>;
  transform(data: Dataset, rules: any[]): Promise<Dataset>;
  validate(data: Dataset): Promise<ValidationResult>;
  getProcessingCapabilities(): any[];
  getSupportedDataTypes(): string[];
  getPerformanceMetrics(): ProcessingMetrics;
  batch(datasets: Dataset[]): Promise<Dataset[]>;
  stream(dataStream: ReadableStream<Dataset>): Promise<ReadableStream<Dataset>>;
}

export interface IIntegrationPlugin extends IPlugin {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  sync(): Promise<any>;
  import(data: any, format: string): Promise<any>;
  export(data: any, format: string): Promise<any>;
}

export interface Dataset {
  id: string;
  name: string;
  schema: DataSchema;
  data: any[];
  metadata: DataMetadata;
}

export interface DataSchema {
  fields: DataField[];
  primaryKey?: string[];
  indexes?: any[];
}

export interface DataField {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
  constraints?: any[];
}

export interface DataMetadata {
  createdAt: string;
  updatedAt: string;
  source?: string;
  tags?: string[];
  size: number;
  checksum?: string;
  [key: string]: any;
}

export interface ProcessingOptions {
  mode?: 'sync' | 'async' | 'streaming';
  batchSize?: number;
  timeout?: number;
  validation?: boolean;
  caching?: boolean;
  parallel?: boolean;
  priority?: 'low' | 'normal' | 'high';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  statistics: ValidationStatistics;
  summary: ValidationSummary;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
  row?: number;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  value?: any;
  row?: number;
}

export interface ValidationStatistics {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errorCount: number;
  warningCount: number;
  completeness: number;
  uniqueness: number;
}

export interface ValidationSummary {
  overallScore: number;
  dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  recommendations: string[];
}

export interface ProcessingMetrics {
  averageProcessingTime: number;
  throughput: number;
  memoryUsage: number;
  cpuUsage: number;
  successRate: number;
  lastUpdated: string;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  homepage?: string;
  repository?: string;
  keywords: string[];
  category: PluginCategory;
  entryPoint: string;
  dependencies: PluginDependency[];
  permissions: PluginPermission[];
  configuration: PluginConfigSchema;
  compatibility: {
    minCoreVersion: string;
    maxCoreVersion?: string;
    browsers: string[];
  };
}

export type PluginCategory = 'data-processing' | 'visualization' | 'integration' | 'utility';

export interface PluginDependency {
  name: string;
  version: string;
  optional: boolean;
}

export interface PluginPermission {
  resource: string;
  access: 'read' | 'write' | 'execute';
  scope?: string;
}

export interface PluginConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
    default?: any;
    description?: string;
    validation?: any[];
  };
}

export interface PluginCapability {
  name: string;
  description: string;
  type: 'processing' | 'visualization' | 'integration' | 'utility';
  version: string;
  async: boolean;
  inputTypes?: string[];
  outputTypes?: string[];
}

export interface PluginContext {
  pluginName: string;
  coreVersion: string;
  services: any;
  eventBus: any;
  logger: PluginLogger;
  config: any;
  resources: ResourceQuota;
}

export interface PluginLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export interface ResourceQuota {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxExecutionTime: number;
  maxNetworkRequests?: number;
}