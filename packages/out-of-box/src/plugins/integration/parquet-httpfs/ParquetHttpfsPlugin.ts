import {
  IIntegrationPlugin,
  PluginManifest,
  PluginContext,
  PluginCapability,
  LocalDataset as Dataset,
  DataType,
  Connection,
  ConnectionTestResult,
  Credentials,
  DataSource,
  DataTarget,
  SyncResult,
  ExportResult,
  IntegrationCapability,
  Protocol,
  DataFormat,
} from "../../types/index.js";

import {
  IParquetHttpfsPlugin,
  LoadOptions,
  TableReference,
  ParquetSchema,
  ValidationResult,
  QueryResult,
  QueryPlan,
  ProgressCallback,
  LoadingStatus,
  LoadingProgress,
  ParquetHttpfsConfig,
  ParquetHttpfsError,
  AWSCredentials,
  CloudflareCredentials,
  PartitionedLoadOptions,
  PartitionDiscoveryOptions,
  PartitionedDataset,
  PartitionInfo,
  PartitionFilter,
} from "./types/interfaces.js";

import { AuthenticationManager } from "./managers/AuthenticationManager.js";
import { DuckDBManager } from "./managers/DuckDBManager.js";
import { SchemaManager } from "./managers/SchemaManager.js";

export class ParquetHttpfsPlugin implements IIntegrationPlugin, IParquetHttpfsPlugin {
  private context: PluginContext | null = null;
  private authManager: AuthenticationManager;
  private duckdbManager: DuckDBManager | null = null;
  private schemaManager: SchemaManager | null = null;
  private config: ParquetHttpfsConfig;
  private loadingStatuses: Map<string, LoadingStatus> = new Map();
  private progressCallbacks: Set<ProgressCallback> = new Set();

  constructor() {
    this.authManager = new AuthenticationManager();
    this.config = {
      defaultTimeout: 30000,
      maxConcurrentConnections: 4,
      enableProgressReporting: true,
      cacheSchema: true,
      retryAttempts: 3,
      chunkSize: 1024 * 1024, // 1MB
      corsConfig: {
        strategy: 'auto', // Use DataPrism Core's automatic CORS handling
        cacheTimeout: 300000,
        retryAttempts: 2
      }
    };
  }

  // Plugin Identity
  getName(): string {
    return "ParquetHttpfsPlugin";
  }

  getVersion(): string {
    return "1.0.0";
  }

  getDescription(): string {
    return "Stream and query Parquet files from cloud storage using DataPrism Core's cloud storage integration (browser-compatible)";
  }

  getAuthor(): string {
    return "DataPrism Team";
  }

  getDependencies() {
    return [
      { name: "duckdb-wasm", version: "^1.28.0", optional: false },
    ];
  }

  // Lifecycle Management
  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    this.duckdbManager = new DuckDBManager(context);
    this.schemaManager = new SchemaManager(context, this.duckdbManager);

    try {
      // Test CORS support for common cloud storage providers
      const corsTestResults = await this.testCorsSupport();
      this.context.logger.info('CORS support test results:', corsTestResults);
      
      // Initialize DuckDB manager (browser-compatible mode)
      await this.duckdbManager.initialize();
      
      // Check if we're in browser environment
      const isBrowser = typeof window !== 'undefined';
      
      if (isBrowser) {
        this.context.logger.info("ParquetHttpfsPlugin initialized in browser-compatible mode using DataPrism Core cloud storage");
      } else {
        this.context.logger.info("ParquetHttpfsPlugin initialized with full server-side capabilities");
      }
      
      this.context.eventBus.publish('parquet-httpfs:initialized', {
        plugin: this.getName(),
        version: this.getVersion(),
        supportedProviders: this.authManager.listProviders(),
        corsSupport: corsTestResults,
        browserCompatible: isBrowser,
        mode: isBrowser ? 'browser' : 'server'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.context.logger.error("Failed to initialize ParquetHttpfsPlugin:", message);
      throw new ParquetHttpfsError(`Plugin initialization failed: ${message}`, 'INIT_ERROR');
    }
  }

  async activate(): Promise<void> {
    if (!this.context) throw new Error("Plugin not initialized");
    this.context.logger.info("ParquetHttpfsPlugin activated");
  }

  async deactivate(): Promise<void> {
    // Cancel any ongoing operations
    this.loadingStatuses.clear();
    this.progressCallbacks.clear();
    this.context?.logger.info("ParquetHttpfsPlugin deactivated");
  }

  async cleanup(): Promise<void> {
    try {
      await this.duckdbManager?.cleanup();
      this.authManager.cleanup();
      this.schemaManager?.clearCache();
      this.context?.logger.info("ParquetHttpfsPlugin cleaned up");
    } catch (error) {
      this.context?.logger.error("Error during cleanup:", error);
    }
  }

  // Core Operations
  async execute(operation: string, params: any): Promise<any> {
    switch (operation) {
      case "loadFile":
        return this.loadFile(params.url, params.options);
      case "loadMultipleFiles":
        return this.loadMultipleFiles(params.urls, params.options);
      case "getSchema":
        return this.getSchema(params.url);
      case "validateFile":
        return this.validateFile(params.url);
      case "query":
        return this.query(params.sql, params.tables);
      case "explainQuery":
        return this.explainQuery(params.sql);
      case "setCredentials":
        return this.setCredentials(params.provider, params.credentials);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  async configure(settings: any): Promise<void> {
    this.config = { ...this.config, ...settings };
    this.context?.logger.info("ParquetHttpfsPlugin configuration updated");
  }

  // Metadata and Capabilities
  getManifest(): PluginManifest {
    return {
      name: this.getName(),
      version: this.getVersion(),
      description: this.getDescription(),
      author: this.getAuthor(),
      license: "MIT",
      keywords: ["parquet", "s3", "cloudflare", "r2", "httpfs", "duckdb"],
      category: "integration",
      entryPoint: "parquet-httpfs-plugin.js",
      dependencies: this.getDependencies(),
      permissions: [
        { resource: "network", access: "read" },
        { resource: "duckdb", access: "execute" },
        { resource: "memory", access: "write" },
      ],
      configuration: {
        defaultTimeout: { type: "number", default: 30000 },
        maxConcurrentConnections: { type: "number", default: 4 },
        enableProgressReporting: { type: "boolean", default: true },
        cacheSchema: { type: "boolean", default: true },
        retryAttempts: { type: "number", default: 3 },
        chunkSize: { type: "number", default: 1048576 },
      },
      compatibility: {
        minCoreVersion: "1.0.0",
        browsers: ["Chrome 90+", "Firefox 88+", "Safari 14+", "Edge 90+"],
      },
    };
  }

  getCapabilities(): PluginCapability[] {
    return [
      {
        name: "parquet-import",
        description: "Import Parquet files from cloud storage",
        type: "integration",
        version: "1.0.0",
        async: true,
        inputTypes: ["url"],
        outputTypes: ["dataset"],
      },
      {
        name: "schema-introspection",
        description: "Analyze Parquet file schema",
        type: "utility",
        version: "1.0.0",
        async: true,
        inputTypes: ["url"],
        outputTypes: ["schema"],
      },
    ];
  }

  isCompatible(coreVersion: string): boolean {
    return coreVersion >= "1.0.0";
  }

  // IIntegrationPlugin Implementation
  async connect(endpoint: string, credentials?: Credentials): Promise<Connection> {
    const connectionId = `conn_${Date.now()}`;
    
    try {
      if (credentials) {
        const provider = this.authManager.getProviderForUrl(endpoint);
        if (provider) {
          await this.authManager.setCredentials(provider, credentials);
        }
      }

      return {
        id: connectionId,
        endpoint,
        status: "connected",
        metadata: {
          protocol: "https",
          version: "1.0",
          features: ["parquet", "streaming", "authentication"],
          limits: {
            maxRequestSize: 100 * 1024 * 1024, // 100MB
            maxResponseSize: 10 * 1024 * 1024 * 1024, // 10GB
            rateLimit: { requests: 100, windowMs: 60000 },
            timeout: this.config.defaultTimeout,
          },
        },
        lastActivity: new Date().toISOString(),
      };
    } catch (error) {
      throw new ParquetHttpfsError(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'CONNECTION_ERROR');
    }
  }

  async disconnect(): Promise<void> {
    // Clean up any active connections
    await this.cleanup();
  }

  isConnected(): boolean {
    return this.context !== null && this.duckdbManager !== null;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = performance.now();
    
    try {
      // Test basic DuckDB functionality
      if (!this.duckdbManager) {
        throw new Error("DuckDB manager not initialized");
      }

      // Simple test query
      await this.duckdbManager.executeQuery("SELECT 1 as test");
      
      const endTime = performance.now();
      
      return {
        success: true,
        latency: endTime - startTime,
        details: {
          endpoint: "duckdb-httpfs",
          protocol: "httpfs",
          timestamp: new Date().toISOString(),
          version: this.getVersion(),
        },
      };
    } catch (error) {
      const endTime = performance.now();
      
      return {
        success: false,
        latency: endTime - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          endpoint: "duckdb-httpfs",
          protocol: "httpfs",
          timestamp: new Date().toISOString(),
          version: this.getVersion(),
        },
      };
    }
  }

  async authenticate(credentials: Credentials): Promise<boolean> {
    // This will be handled by provider-specific authentication
    return true;
  }

  async refreshAuthentication(): Promise<boolean> {
    // Refresh all provider credentials
    const providers = this.authManager.listProviders();
    const results = await Promise.all(
      providers.map(provider => this.authManager.refreshCredentials(provider))
    );
    
    return results.every(result => result);
  }

  async sync(data: Dataset): Promise<SyncResult> {
    throw new Error("Sync operation not supported - this is a read-only integration");
  }

  async import(source: DataSource): Promise<Dataset> {
    if (source.type !== "url") {
      throw new Error("Only URL data sources are supported");
    }

    const tableRef = await this.loadFile(source.location, source.options as LoadOptions);
    const queryResult = await this.query(`SELECT * FROM ${tableRef.alias}`, [tableRef]);

    return {
      columns: queryResult.columns.map(name => ({ name, type: "string" as DataType })),
      rows: queryResult.data,
    };
  }

  async export(data: Dataset, target: DataTarget): Promise<ExportResult> {
    throw new Error("Export operation not supported - this is a read-only integration");
  }

  getIntegrationCapabilities(): IntegrationCapability[] {
    return [
      {
        name: "parquet-streaming",
        description: "Stream Parquet files from cloud storage",
        type: "import",
        protocols: [
          { name: "https", version: "1.1", description: "HTTPS protocol", secure: true, authentication: ["aws-v4", "bearer"] },
        ],
        formats: ["parquet"],
        bidirectional: false,
        realtime: false,
      },
    ];
  }

  getSupportedProtocols(): Protocol[] {
    return [
      { name: "https", version: "1.1", description: "HTTPS protocol", secure: true, authentication: ["aws-v4", "bearer"] },
    ];
  }

  getSupportedFormats(): DataFormat[] {
    return ["parquet"];
  }

  // IParquetHttpfsPlugin Implementation
  async loadFile(url: string, options: LoadOptions = {}): Promise<TableReference> {
    if (!this.duckdbManager || !this.schemaManager) {
      throw new ParquetHttpfsError("Plugin not properly initialized", 'PLUGIN_NOT_INITIALIZED');
    }

    const alias = options.alias || this.generateAlias(url);
    
    // Create loading status
    const loadingStatus: LoadingStatus = {
      alias,
      url,
      status: 'in-progress',
      startTime: new Date(),
    };
    this.loadingStatuses.set(alias, loadingStatus);

    try {
      // Report progress
      this.reportProgress({
        alias,
        phase: 'connecting',
        percentComplete: 0
      });

      // Set up authentication if provided
      if (options.authentication) {
        await this.authManager.setCredentials(
          options.authentication.provider,
          options.authentication.credentials
        );
      }

      this.reportProgress({
        alias,
        phase: 'loading-schema',
        percentComplete: 25
      });

      // Get schema information
      const schema = await this.schemaManager.getSchema(url);

      this.reportProgress({
        alias,
        phase: 'streaming-data',
        percentComplete: 50
      });

      // Register table with DuckDB
      await this.duckdbManager.registerTable(
        alias,
        url,
        options.authentication?.credentials
      );

      this.reportProgress({
        alias,
        phase: 'complete',
        percentComplete: 100
      });

      const tableRef: TableReference = {
        url,
        alias,
        schema,
        loadedAt: new Date(),
        provider: options.authentication?.provider || 'unknown',
      };

      // Update loading status
      loadingStatus.status = 'completed';
      loadingStatus.endTime = new Date();

      this.context.logger.info(`Successfully loaded Parquet file: ${url} as ${alias}`);
      
      return tableRef;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      // Update loading status
      loadingStatus.status = 'failed';
      loadingStatus.endTime = new Date();
      loadingStatus.error = message;

      this.reportProgress({
        alias,
        phase: 'error',
        percentComplete: 0,
        error: message
      });

      this.context.logger.error(`Failed to load Parquet file ${url}:`, message);
      throw new ParquetHttpfsError(`Failed to load file: ${message}`, 'FILE_LOAD_ERROR', { url, alias });
    }
  }

  async loadMultipleFiles(urls: string[], options: LoadOptions = {}): Promise<TableReference[]> {
    const results: TableReference[] = [];
    
    // Load files concurrently but limit concurrency
    const concurrency = Math.min(this.config.maxConcurrentConnections, urls.length);
    const chunks = this.chunkArray(urls, concurrency);
    
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((url, index) => 
          this.loadFile(url, {
            ...options,
            alias: options.alias ? `${options.alias}_${index}` : undefined
          })
        )
      );
      results.push(...chunkResults);
    }
    
    return results;
  }

  async getSchema(url: string): Promise<ParquetSchema> {
    if (!this.schemaManager) {
      throw new ParquetHttpfsError("Schema manager not initialized", 'PLUGIN_NOT_INITIALIZED');
    }
    
    return await this.schemaManager.getSchema(url);
  }

  async validateFile(url: string): Promise<ValidationResult> {
    if (!this.schemaManager) {
      throw new ParquetHttpfsError("Schema manager not initialized", 'PLUGIN_NOT_INITIALIZED');
    }
    
    return await this.schemaManager.validateFile(url);
  }

  async query(sql: string, tables: TableReference[]): Promise<QueryResult> {
    if (!this.duckdbManager) {
      throw new ParquetHttpfsError("DuckDB manager not initialized", 'PLUGIN_NOT_INITIALIZED');
    }
    
    return await this.duckdbManager.executeQuery(sql);
  }

  async explainQuery(sql: string): Promise<QueryPlan> {
    if (!this.duckdbManager) {
      throw new ParquetHttpfsError("DuckDB manager not initialized", 'PLUGIN_NOT_INITIALIZED');
    }
    
    return await this.duckdbManager.explainQuery(sql);
  }

  setCredentials(provider: string, credentials: any): void {
    this.authManager.setCredentials(provider, credentials);
  }

  async refreshCredentials(provider: string): Promise<void> {
    const refreshed = await this.authManager.refreshCredentials(provider);
    if (!refreshed) {
      throw new ParquetHttpfsError(`Failed to refresh credentials for provider: ${provider}`, 'CREDENTIAL_REFRESH_ERROR');
    }
  }

  onProgress(callback: ProgressCallback): void {
    this.progressCallbacks.add(callback);
  }

  getLoadingStatus(): LoadingStatus[] {
    return Array.from(this.loadingStatuses.values());
  }

  // Partitioned Dataset Support
  async loadPartitionedDataset(baseUrl: string, options: PartitionedLoadOptions = {}): Promise<PartitionedDataset> {
    if (!this.duckdbManager || !this.schemaManager) {
      throw new ParquetHttpfsError("Plugin not properly initialized", 'PLUGIN_NOT_INITIALIZED');
    }

    const alias = options.alias || this.generateAlias(baseUrl);
    
    try {
      this.context?.logger.info(`Loading partitioned dataset from: ${baseUrl}`);
      
      // Discover partitions
      const partitions = await this.discoverPartitions(baseUrl, {
        ...options,
        partitionScheme: options.partitionScheme || 'hive',
      });

      if (partitions.length === 0) {
        throw new ParquetHttpfsError(`No partitions found at ${baseUrl}`, 'NO_PARTITIONS_FOUND');
      }

      // Apply partition filter if provided
      const filteredPartitions = options.partitionFilter 
        ? this.applyPartitionFilter(partitions, options.partitionFilter)
        : partitions;

      if (options.maxPartitions && filteredPartitions.length > options.maxPartitions) {
        filteredPartitions.splice(options.maxPartitions);
      }

      // Get schema from first partition
      const samplePartition = filteredPartitions[0];
      const schema = await this.schemaManager.getSchema(samplePartition.path);

      // Extract partition columns based on scheme
      const partitionColumns = this.extractPartitionColumns(filteredPartitions, options.partitionScheme || 'hive');

      // Register partitioned view in DuckDB
      await this.registerPartitionedView(alias, filteredPartitions, options);

      const totalFiles = filteredPartitions.length;
      const totalSizeBytes = filteredPartitions.reduce((sum, p) => sum + p.fileSize, 0);

      const dataset: PartitionedDataset = {
        baseUrl,
        alias,
        partitions: filteredPartitions,
        schema,
        partitionColumns,
        totalFiles,
        totalSizeBytes,
        loadedAt: new Date(),
      };

      this.context?.logger.info(`Successfully loaded partitioned dataset with ${totalFiles} partitions`);
      
      return dataset;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.context?.logger.error(`Failed to load partitioned dataset from ${baseUrl}:`, message);
      throw new ParquetHttpfsError(`Failed to load partitioned dataset: ${message}`, 'PARTITIONED_LOAD_ERROR', { baseUrl });
    }
  }

  async discoverPartitions(baseUrl: string, options: PartitionDiscoveryOptions = {}): Promise<PartitionInfo[]> {
    if (!this.duckdbManager) {
      throw new ParquetHttpfsError("DuckDB manager not initialized", 'PLUGIN_NOT_INITIALIZED');
    }

    try {
      const partitions: PartitionInfo[] = [];
      const scheme = options.partitionScheme || 'hive';
      const maxDepth = options.maxDepth || 10;
      const filePattern = options.filePattern || /\.parquet$/i;

      // For cloud storage, we'll use a different approach than filesystem listing
      // We'll attempt to build common partition patterns and test them
      const commonPatterns = this.generateCommonPartitionPatterns(baseUrl, scheme);
      
      for (const pattern of commonPatterns) {
        try {
          const partitionInfo = await this.testPartitionPath(pattern, scheme);
          if (partitionInfo && filePattern.test(partitionInfo.path)) {
            partitions.push(partitionInfo);
          }
        } catch (error) {
          // Partition doesn't exist, continue
          continue;
        }
      }

      // If no partitions found with common patterns, try direct listing approach
      if (partitions.length === 0) {
        const directPartitions = await this.discoverPartitionsDirectly(baseUrl, options);
        partitions.push(...directPartitions);
      }

      this.context?.logger.info(`Discovered ${partitions.length} partitions from ${baseUrl}`);
      
      return partitions.sort((a, b) => a.path.localeCompare(b.path));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.context?.logger.error(`Failed to discover partitions from ${baseUrl}:`, message);
      throw new ParquetHttpfsError(`Failed to discover partitions: ${message}`, 'PARTITION_DISCOVERY_ERROR', { baseUrl });
    }
  }

  async queryPartitioned(sql: string, dataset: PartitionedDataset): Promise<QueryResult> {
    if (!this.duckdbManager) {
      throw new ParquetHttpfsError("DuckDB manager not initialized", 'PLUGIN_NOT_INITIALIZED');
    }

    try {
      // Replace dataset alias in SQL with the partitioned view
      const optimizedSql = this.optimizePartitionedQuery(sql, dataset);
      
      this.context?.logger.info(`Executing partitioned query on ${dataset.totalFiles} partitions`);
      
      const result = await this.duckdbManager.executeQuery(optimizedSql);
      
      this.context?.logger.info(`Partitioned query completed, processed ${result.bytesProcessed} bytes`);
      
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.context?.logger.error(`Failed to execute partitioned query:`, message);
      throw new ParquetHttpfsError(`Partitioned query failed: ${message}`, 'PARTITIONED_QUERY_ERROR', { sql });
    }
  }

  // CORS support testing
  private async testCorsSupport(): Promise<any> {
    try {
      // Test common cloud storage providers
      const testUrls = [
        'https://pub-7deacab667344397ae6d3e2ea97f11f8.r2.dev', // CloudFlare R2
        'https://s3.amazonaws.com', // AWS S3
      ];
      
      const results: any = {};
      
      for (const testUrl of testUrls) {
        try {
          const corsResult = await this.context.services.call('httpClient', 'testCorsSupport', testUrl);
          results[testUrl] = corsResult;
        } catch (error) {
          results[testUrl] = { supported: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      }
      
      return results;
    } catch (error) {
      this.context.logger.warn('CORS support testing failed:', error);
      return {};
    }
  }

  // Private helper methods
  private generateAlias(url: string): string {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const filename = pathParts[pathParts.length - 1];
    const nameWithoutExt = filename.replace('.parquet', '');
    const timestamp = Date.now().toString().slice(-6);
    return `${nameWithoutExt}_${timestamp}`.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  private reportProgress(progress: LoadingProgress): void {
    if (!this.config.enableProgressReporting) {
      return;
    }

    this.progressCallbacks.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        this.context?.logger.warn("Progress callback error:", error);
      }
    });

    this.context?.eventBus.publish('parquet:loading-progress', progress);
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // Partitioned dataset helper methods
  private applyPartitionFilter(partitions: PartitionInfo[], filter: PartitionFilter): PartitionInfo[] {
    return partitions.filter(partition => {
      const value = partition.partitionValues[filter.column];
      if (!value) return false;

      switch (filter.operator) {
        case '=':
          return value === filter.value;
        case '!=':
          return value !== filter.value;
        case '>':
          return value > filter.value;
        case '>=':
          return value >= filter.value;
        case '<':
          return value < filter.value;
        case '<=':
          return value <= filter.value;
        case 'in':
          return Array.isArray(filter.value) && filter.value.includes(value);
        case 'not_in':
          return Array.isArray(filter.value) && !filter.value.includes(value);
        default:
          return true;
      }
    });
  }

  private extractPartitionColumns(partitions: PartitionInfo[], scheme: string): string[] {
    if (partitions.length === 0) return [];

    const firstPartition = partitions[0];
    return Object.keys(firstPartition.partitionValues);
  }

  private async registerPartitionedView(alias: string, partitions: PartitionInfo[], options: PartitionedLoadOptions): Promise<void> {
    if (!this.duckdbManager) return;

    const unionMode = options.unionMode || 'union_all';
    
    // Create a UNION ALL query for all partitions
    const unionQueries = partitions.map(partition => {
      const partitionColumns = Object.entries(partition.partitionValues)
        .map(([key, value]) => `'${value}' as ${key}`)
        .join(', ');
      
      return partitionColumns 
        ? `SELECT *, ${partitionColumns} FROM read_parquet('${partition.path}')`
        : `SELECT * FROM read_parquet('${partition.path}')`;
    });

    const viewSql = `CREATE OR REPLACE VIEW ${alias} AS ${unionQueries.join(` ${unionMode.toUpperCase()} `)}`;
    
    try {
      await this.duckdbManager.executeQuery(viewSql);
      this.context?.logger.info(`Created partitioned view ${alias} with ${partitions.length} partitions`);
    } catch (error) {
      this.context?.logger.error(`Failed to create partitioned view ${alias}:`, error);
      throw error;
    }
  }

  private generateCommonPartitionPatterns(baseUrl: string, scheme: string): string[] {
    const patterns: string[] = [];
    const baseUrlObj = new URL(baseUrl);
    
    if (scheme === 'hive') {
      // Generate common Hive partitioning patterns
      const currentYear = new Date().getFullYear();
      const years = [currentYear, currentYear - 1, currentYear - 2];
      
      for (const year of years) {
        for (let month = 1; month <= 12; month++) {
          const monthPad = month.toString().padStart(2, '0');
          patterns.push(`${baseUrl}/year=${year}/month=${monthPad}/data.parquet`);
          patterns.push(`${baseUrl}/dt=${year}-${monthPad}-01/data.parquet`);
        }
      }
      
      // Common business partitions
      const regions = ['us', 'eu', 'asia'];
      for (const region of regions) {
        patterns.push(`${baseUrl}/region=${region}/data.parquet`);
      }
    } else if (scheme === 'directory') {
      // Generate common directory patterns
      const currentYear = new Date().getFullYear();
      for (let year = currentYear - 2; year <= currentYear; year++) {
        patterns.push(`${baseUrl}/${year}/data.parquet`);
        for (let month = 1; month <= 12; month++) {
          const monthPad = month.toString().padStart(2, '0');
          patterns.push(`${baseUrl}/${year}/${monthPad}/data.parquet`);
        }
      }
    }

    return patterns;
  }

  private async testPartitionPath(path: string, scheme: string): Promise<PartitionInfo | null> {
    try {
      // Try to get basic info about the file
      const schema = await this.schemaManager?.getSchema(path);
      if (!schema) return null;

      // Extract partition values from path
      const partitionValues = this.extractPartitionValuesFromPath(path, scheme);

      return {
        path,
        partitionValues,
        fileSize: schema.fileSize,
        rowCount: schema.rowCount,
        lastModified: new Date(), // We don't have this info from schema
      };
    } catch (error) {
      return null;
    }
  }

  private async discoverPartitionsDirectly(baseUrl: string, options: PartitionDiscoveryOptions): Promise<PartitionInfo[]> {
    // For cloud storage, we can't do directory listing easily
    // This is a placeholder for more advanced discovery logic
    // In a real implementation, you might use cloud provider APIs
    
    this.context?.logger.warn('Direct partition discovery not fully implemented for cloud storage');
    return [];
  }

  private extractPartitionValuesFromPath(path: string, scheme: string): Record<string, string> {
    const values: Record<string, string> = {};
    
    if (scheme === 'hive') {
      // Extract Hive-style partitions (key=value)
      const matches = path.match(/([^\/]+)=([^\/]+)/g);
      if (matches) {
        for (const match of matches) {
          const [key, value] = match.split('=');
          values[key] = value;
        }
      }
    } else if (scheme === 'directory') {
      // Extract directory-based partitions
      const url = new URL(path);
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      
      // Assume common patterns like /year/month/day
      if (pathParts.length >= 2) {
        const year = pathParts[pathParts.length - 3];
        const month = pathParts[pathParts.length - 2];
        
        if (year && /^\d{4}$/.test(year)) {
          values['year'] = year;
        }
        if (month && /^\d{2}$/.test(month)) {
          values['month'] = month;
        }
      }
    }
    
    return values;
  }

  private optimizePartitionedQuery(sql: string, dataset: PartitionedDataset): string {
    // Simple optimization: replace table references with the partitioned view
    let optimizedSql = sql;
    
    // Replace any reference to dataset.alias with the actual partitioned view
    const tablePattern = new RegExp(`\\b${dataset.alias}\\b`, 'gi');
    optimizedSql = optimizedSql.replace(tablePattern, dataset.alias);
    
    // Add partition pruning hints if WHERE clause contains partition columns
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+GROUP\s+BY|\s+ORDER\s+BY|\s+LIMIT|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1];
      const hasPartitionFilters = dataset.partitionColumns.some(col => 
        whereClause.toLowerCase().includes(col.toLowerCase())
      );
      
      if (hasPartitionFilters) {
        this.context?.logger.info('Query contains partition filters - partition pruning will be applied');
      }
    }
    
    return optimizedSql;
  }
}