import { DataType } from "../../../types/index.js";

// Core Plugin Interfaces
export interface IParquetHttpfsPlugin {
  // Core loading functionality
  loadFile(url: string, options?: LoadOptions): Promise<TableReference>;
  loadMultipleFiles(urls: string[], options?: LoadOptions): Promise<TableReference[]>;
  
  // Partitioned dataset support
  loadPartitionedDataset(baseUrl: string, options?: PartitionedLoadOptions): Promise<PartitionedDataset>;
  discoverPartitions(baseUrl: string, options?: PartitionDiscoveryOptions): Promise<PartitionInfo[]>;
  
  // Schema operations
  getSchema(url: string): Promise<ParquetSchema>;
  validateFile(url: string): Promise<ValidationResult>;
  
  // Query operations
  query(sql: string, tables: TableReference[]): Promise<QueryResult>;
  queryPartitioned(sql: string, dataset: PartitionedDataset): Promise<QueryResult>;
  explainQuery(sql: string): Promise<QueryPlan>;
  
  // Authentication
  setCredentials(provider: string, credentials: Credentials): void;
  refreshCredentials(provider: string): Promise<void>;
  
  // Progress monitoring
  onProgress(callback: ProgressCallback): void;
  getLoadingStatus(): LoadingStatus[];
}

// Configuration and Options
export interface LoadOptions {
  authentication?: {
    provider: 'aws' | 'cloudflare' | 'custom';
    credentials: AWSCredentials | CloudflareCredentials | CustomCredentials;
  };
  cors?: CORSOptions;
  timeout?: number;
  alias?: string;
  streaming?: boolean;
}

// Partitioned Dataset Support
export interface PartitionedLoadOptions extends LoadOptions {
  partitionScheme?: 'hive' | 'directory' | 'custom';
  partitionColumns?: string[];
  maxPartitions?: number;
  partitionFilter?: PartitionFilter;
  unionMode?: 'union_all' | 'union_by_name';
}

export interface PartitionDiscoveryOptions extends LoadOptions {
  recursive?: boolean;
  maxDepth?: number;
  filePattern?: RegExp;
  partitionScheme?: 'hive' | 'directory' | 'custom';
}

export interface PartitionedDataset {
  baseUrl: string;
  alias: string;
  partitions: PartitionInfo[];
  schema: ParquetSchema;
  partitionColumns: string[];
  totalFiles: number;
  totalSizeBytes: number;
  loadedAt: Date;
}

export interface PartitionInfo {
  path: string;
  partitionValues: Record<string, string>;
  fileSize: number;
  rowCount?: number;
  lastModified?: Date;
}

export interface PartitionFilter {
  column: string;
  operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'not_in';
  value: string | string[];
}

export interface ParquetHttpfsConfig {
  defaultTimeout: number; // Default: 30000ms
  maxConcurrentConnections: number; // Default: 4
  enableProgressReporting: boolean; // Default: true
  cacheSchema: boolean; // Default: true
  retryAttempts: number; // Default: 3
  chunkSize: number; // Default: 1MB for streaming
  corsConfig?: {
    strategy: 'auto' | 'proxy' | 'direct'; // DataPrism Core CORS handling strategy
    cacheTimeout: number; // Cache timeout for CORS preflight responses
    retryAttempts: number; // Number of retry attempts for CORS failures
  };
}

export interface CORSOptions {
  enabled: boolean;
  allowedOrigins?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
}

// Authentication Credentials
export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region?: string;
}

export interface CloudflareCredentials {
  accountId: string;
  accessKeyId: string; // R2 API Token ID
  secretAccessKey: string; // R2 API Token Secret
  jurisdiction?: 'auto' | 'eu' | 'fedramp-moderate'; // R2 jurisdiction
  customDomain?: string; // Custom domain for R2 bucket
  workerEndpoint?: string; // CloudFlare Worker proxy endpoint
}

export interface CustomCredentials {
  [key: string]: string | number | boolean;
}

export type Credentials = AWSCredentials | CloudflareCredentials | CustomCredentials;

// Schema and Data Structures
export interface ParquetSchema {
  columns: ColumnInfo[];
  rowCount?: number;
  fileSize: number;
  metadata: Record<string, any>;
}

export interface ColumnInfo {
  name: string;
  type: DataType;
  nullable: boolean;
  metadata?: Record<string, any>;
}

export interface TableReference {
  url: string;
  alias: string;
  schema: ParquetSchema;
  loadedAt: Date;
  provider: string;
}

// Query Operations
export interface QueryResult {
  data: any[][];
  columns: string[];
  rowCount: number;
  executionTime: number;
  bytesProcessed: number;
}

export interface QueryPlan {
  sql: string;
  estimated_cost: number;
  operations: QueryOperation[];
}

export interface QueryOperation {
  operation: string;
  estimated_cardinality: number;
  children: QueryOperation[];
}

// Progress and Status
export interface ProgressCallback {
  (progress: LoadingProgress): void;
}

export interface LoadingProgress {
  alias: string;
  phase: 'connecting' | 'authenticating' | 'loading-schema' | 'streaming-data' | 'complete' | 'error';
  percentComplete: number;
  bytesLoaded?: number;
  totalBytes?: number;
  rowsProcessed?: number;
  error?: string;
}

export interface LoadingStatus {
  alias: string;
  url: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  error?: string;
}

// Validation
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  metadata: {
    fileSize: number;
    columns: number;
    estimatedRows?: number;
  };
}

export interface ValidationError {
  code: string;
  message: string;
  details?: any;
}

// Provider Interfaces
export interface IAuthProvider {
  authenticate(credentials: Credentials): Promise<boolean>;
  refreshCredentials(): Promise<boolean>;
  getHeaders(url: string, method: string): Promise<Record<string, string>>;
  validateCredentials(credentials: Credentials): boolean;
}

export interface IDuckDBManager {
  initialize(): Promise<void>;
  executeQuery(sql: string): Promise<QueryResult>;
  explainQuery(sql: string): Promise<QueryPlan>;
  registerTable(alias: string, url: string, credentials?: Credentials): Promise<void>;
  unregisterTable(alias: string): Promise<void>;
  getTableInfo(alias: string): Promise<TableInfo>;
  cleanup(): Promise<void>;
}

export interface TableInfo {
  alias: string;
  columns: ColumnInfo[];
  rowCount?: number;
  fileSize: number;
}

// R2-Specific Types
export interface R2Configuration {
  endpoint: string; // e.g., 'https://accountid.r2.cloudflarestorage.com'
  jurisdiction: 'auto' | 'eu' | 'fedramp-moderate';
  customDomain?: string;
  corsPolicy: CORSOptions;
  pathStyle: boolean; // R2 uses path-style URLs by default
}

// Error Types
export class ParquetHttpfsError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ParquetHttpfsError';
  }
}

export class AuthenticationError extends ParquetHttpfsError {
  constructor(message: string, provider: string) {
    super(message, 'AUTHENTICATION_ERROR', { provider });
  }
}

export class ValidationError extends ParquetHttpfsError {
  constructor(message: string, url: string) {
    super(message, 'VALIDATION_ERROR', { url });
  }
}

export class NetworkError extends ParquetHttpfsError {
  constructor(message: string, url: string, statusCode?: number) {
    super(message, 'NETWORK_ERROR', { url, statusCode });
  }
}