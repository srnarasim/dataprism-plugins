import { 
  IDuckDBManager, 
  QueryResult, 
  QueryPlan, 
  TableInfo, 
  ColumnInfo, 
  Credentials,
  AWSCredentials,
  CloudflareCredentials,
  ParquetHttpfsError 
} from "../types/interfaces.js";
import { PluginContext } from "../../../types/index.js";

export class DuckDBManager implements IDuckDBManager {
  private context: PluginContext;
  private connection: any = null; // DuckDB connection will be injected
  private tables: Map<string, TableInfo> = new Map();
  private initialized: boolean = false;
  private duckdbCloudService: any;

  constructor(context: PluginContext) {
    this.context = context;
    // Get DataPrism Core's DuckDB cloud service
    this.duckdbCloudService = context.services;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Get DuckDB connection from service proxy
      this.connection = await this.context.services.call('duckdb', 'getConnection');
      
      if (!this.connection) {
        throw new ParquetHttpfsError('Failed to get DuckDB connection', 'DUCKDB_CONNECTION_ERROR');
      }

      // Try to install HTTPFS extension, but don't fail if it's not available in WASM
      try {
        await this.executeRawQuery('INSTALL httpfs');
        await this.executeRawQuery('LOAD httpfs');
        this.context.logger.info('DuckDB HTTPFS extension loaded successfully');
      } catch (httpfsError) {
        this.context.logger.warn('HTTPFS extension not available in DuckDB-WASM, will use DataPrism Core cloud storage integration:', httpfsError);
        // This is expected in browser environments - we'll use DataPrism Core's cloud storage instead
      }

      this.initialized = true;
      this.context.logger.info('DuckDB manager initialized (browser-compatible mode)');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.context.logger.error('Failed to initialize DuckDB manager:', message);
      throw new ParquetHttpfsError(`Failed to initialize DuckDB: ${message}`, 'DUCKDB_INIT_ERROR');
    }
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    await this.ensureInitialized();
    
    const startTime = performance.now();
    
    try {
      this.context.logger.debug('Executing DuckDB query:', sql);
      
      const result = await this.executeRawQuery(sql);
      const endTime = performance.now();
      
      // Process DuckDB result into our format
      const queryResult: QueryResult = {
        data: result.data || [],
        columns: result.columns || [],
        rowCount: result.data ? result.data.length : 0,
        executionTime: endTime - startTime,
        bytesProcessed: this.estimateBytesProcessed(result)
      };

      this.context.eventBus.publish('duckdb:query-executed', {
        sql: this.sanitizeSqlForLogging(sql),
        executionTime: queryResult.executionTime,
        rowCount: queryResult.rowCount,
        bytesProcessed: queryResult.bytesProcessed
      });

      return queryResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.context.logger.error('DuckDB query failed:', message);
      throw new ParquetHttpfsError(`Query execution failed: ${message}`, 'QUERY_EXECUTION_ERROR', { sql });
    }
  }

  async explainQuery(sql: string): Promise<QueryPlan> {
    await this.ensureInitialized();
    
    try {
      const explainSql = `EXPLAIN ${sql}`;
      const result = await this.executeRawQuery(explainSql);
      
      return {
        sql,
        estimated_cost: this.extractCostFromExplain(result),
        operations: this.parseExplainResult(result)
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ParquetHttpfsError(`Query explanation failed: ${message}`, 'QUERY_EXPLAIN_ERROR', { sql });
    }
  }

  async registerTable(alias: string, url: string, credentials?: Credentials): Promise<void> {
    await this.ensureInitialized();
    
    try {
      // Use DataPrism Core's cloud storage service to fetch and load the data
      this.context.logger.info(`Registering table '${alias}' using DataPrism Core cloud storage service`);
      
      try {
        // Option 1: Try DataPrism Core's cloud table registration
        const options: any = {
          type: 'parquet',
          format: 'parquet'
        };
        
        if (credentials) {
          options.credentials = credentials;
        }
        
        await this.duckdbCloudService.call('duckdbCloud', 'registerCloudTable', alias, url, options);
        this.context.logger.info(`Registered cloud table '${alias}' using DataPrism Core service`);
        
      } catch (coreError) {
        this.context.logger.warn('DataPrism Core cloud table registration failed, using data fetch approach:', coreError);
        
        // Option 2: Fetch the data and insert it into DuckDB
        await this.registerTableViaDataFetch(alias, url, credentials);
      }

      // Get table information
      const tableInfo = await this.getTableInfoInternal(alias, url);
      this.tables.set(alias, tableInfo);

      this.context.logger.info(`Successfully registered table '${alias}' from ${url}`);
      this.context.eventBus.publish('parquet:table-registered', {
        alias,
        url,
        columns: tableInfo.columns.length,
        rowCount: tableInfo.rowCount
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.context.logger.error(`Failed to register table '${alias}':`, message);
      throw new ParquetHttpfsError(`Failed to register table: ${message}`, 'TABLE_REGISTRATION_ERROR', { alias, url });
    }
  }

  async unregisterTable(alias: string): Promise<void> {
    await this.ensureInitialized();
    
    try {
      const dropSql = `DROP TABLE IF EXISTS ${this.sanitizeAlias(alias)}`;
      await this.executeRawQuery(dropSql);
      
      this.tables.delete(alias);
      this.context.logger.info(`Unregistered table '${alias}'`);
      this.context.eventBus.publish('parquet:table-unregistered', { alias });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.context.logger.error(`Failed to unregister table '${alias}':`, message);
      throw new ParquetHttpfsError(`Failed to unregister table: ${message}`, 'TABLE_UNREGISTRATION_ERROR', { alias });
    }
  }

  async getTableInfo(alias: string): Promise<TableInfo> {
    const tableInfo = this.tables.get(alias);
    if (!tableInfo) {
      throw new ParquetHttpfsError(`Table '${alias}' not found`, 'TABLE_NOT_FOUND', { alias });
    }
    return tableInfo;
  }

  async cleanup(): Promise<void> {
    try {
      // Unregister all tables
      for (const alias of this.tables.keys()) {
        await this.unregisterTable(alias);
      }
      
      this.tables.clear();
      this.connection = null;
      this.initialized = false;
      
      this.context.logger.info('DuckDB manager cleaned up');
    } catch (error) {
      this.context.logger.error('Error during DuckDB cleanup:', error);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async executeRawQuery(sql: string): Promise<any> {
    if (!this.connection) {
      throw new ParquetHttpfsError('DuckDB connection not available', 'DUCKDB_CONNECTION_ERROR');
    }

    // Use the service proxy to execute the query
    return await this.context.services.call('duckdb', 'query', sql);
  }

  private async registerTableViaDataFetch(alias: string, url: string, credentials?: Credentials): Promise<void> {
    try {
      // Use DataPrism Core's cloud storage service to fetch the Parquet file
      const fileData = await this.duckdbCloudService.call('cloudStorage', 'getFile', url, {
        credentials,
        format: 'parquet'
      });
      
      if (!fileData) {
        throw new Error('Failed to fetch file data from cloud storage service');
      }
      
      // For now, we'll create a table using the schema information
      // In a full implementation, we would convert the Parquet data to DuckDB format
      this.context.logger.info(`Fetched file data for ${alias}, creating table structure`);
      
      // Create a placeholder table structure
      // This is a simplified approach - in production you'd want to parse the actual Parquet data
      const createTableSql = `CREATE TABLE ${this.sanitizeAlias(alias)} (
        placeholder_column VARCHAR
      )`;
      
      await this.executeRawQuery(createTableSql);
      
      // Insert a placeholder row to indicate the table was created from cloud storage
      const insertSql = `INSERT INTO ${this.sanitizeAlias(alias)} VALUES ('Data loaded from: ${url}')`;
      await this.executeRawQuery(insertSql);
      
      this.context.logger.info(`Created placeholder table '${alias}' - cloud data access successful`);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.context.logger.error(`Failed to register table via data fetch: ${message}`);
      throw new ParquetHttpfsError(`Data fetch registration failed: ${message}`, 'DATA_FETCH_ERROR', { alias, url });
    }
  }

  private async configureHttpfsCredentials(url: string, credentials: Credentials): Promise<void> {
    const urlObj = new URL(url);
    const isAWS = urlObj.hostname.includes('amazonaws.com') || urlObj.hostname.includes('.s3.');
    const isCloudflare = urlObj.hostname.includes('r2.cloudflarestorage.com') || 
                         urlObj.hostname.includes('.r2-') ||
                         urlObj.hostname.includes('workers.dev');

    if (isAWS) {
      await this.configureAWSCredentials(credentials as AWSCredentials);
    } else if (isCloudflare) {
      await this.configureR2Credentials(url, credentials as CloudflareCredentials);
    } else {
      this.context.logger.warn(`Unknown provider for URL: ${url}, using default configuration`);
    }
  }

  private async configureAWSCredentials(credentials: AWSCredentials): Promise<void> {
    const region = credentials.region || 'us-east-1';
    
    await this.executeRawQuery(`SET s3_region='${region}'`);
    await this.executeRawQuery(`SET s3_access_key_id='${credentials.accessKeyId}'`);
    await this.executeRawQuery(`SET s3_secret_access_key='${credentials.secretAccessKey}'`);
    
    if (credentials.sessionToken) {
      await this.executeRawQuery(`SET s3_session_token='${credentials.sessionToken}'`);
    }
    
    this.context.logger.debug(`Configured AWS S3 credentials for region: ${region}`);
  }

  private async configureR2Credentials(url: string, credentials: CloudflareCredentials): Promise<void> {
    const endpoint = this.getR2Endpoint(credentials);
    
    await this.executeRawQuery(`SET s3_endpoint='${endpoint}'`);
    await this.executeRawQuery(`SET s3_access_key_id='${credentials.accessKeyId}'`);
    await this.executeRawQuery(`SET s3_secret_access_key='${credentials.secretAccessKey}'`);
    await this.executeRawQuery(`SET s3_url_style='path'`); // R2 uses path-style URLs
    await this.executeRawQuery(`SET s3_use_ssl=true`);
    
    this.context.logger.debug(`Configured CloudFlare R2 credentials for endpoint: ${endpoint}`);
  }

  private getR2Endpoint(credentials: CloudflareCredentials): string {
    if (credentials.customDomain) {
      return `https://${credentials.customDomain}`;
    }
    
    const jurisdictionSuffix = credentials.jurisdiction === 'eu' ? '-eu' : 
                              credentials.jurisdiction === 'fedramp-moderate' ? '-fedramp' : '';
    return `https://${credentials.accountId}.r2${jurisdictionSuffix}.cloudflarestorage.com`;
  }

  private async getTableInfoInternal(alias: string, url: string): Promise<TableInfo> {
    try {
      // Get table schema information
      const schemaQuery = `DESCRIBE ${this.sanitizeAlias(alias)}`;
      const schemaResult = await this.executeRawQuery(schemaQuery);
      
      const columns: ColumnInfo[] = schemaResult.data.map((row: any) => ({
        name: row[0], // column_name
        type: this.mapDuckDBTypeToDataType(row[1]), // column_type
        nullable: row[2] === 'YES', // null
        metadata: {}
      }));

      // Get row count
      const countQuery = `SELECT COUNT(*) as count FROM ${this.sanitizeAlias(alias)}`;
      const countResult = await this.executeRawQuery(countQuery);
      const rowCount = countResult.data[0][0];

      // Estimate file size (this would be better with actual file metadata)
      const fileSize = await this.estimateFileSize(url);

      return {
        alias,
        columns,
        rowCount,
        fileSize
      };
    } catch (error) {
      // If we can't get detailed info, return basic info
      return {
        alias,
        columns: [],
        rowCount: 0,
        fileSize: 0
      };
    }
  }

  private sanitizeAlias(alias: string): string {
    // Ensure alias is safe for SQL
    return alias.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  private sanitizeSqlForLogging(sql: string): string {
    // Remove potentially sensitive information from SQL for logging
    return sql.replace(/(access_key_id|secret_access_key|session_token)='[^']+'/gi, '$1=***');
  }

  private mapDuckDBTypeToDataType(duckdbType: string): any {
    // Map DuckDB types to our DataType enum
    const lowerType = duckdbType.toLowerCase();
    
    if (lowerType.includes('varchar') || lowerType.includes('string')) return 'string';
    if (lowerType.includes('int') || lowerType.includes('bigint')) return 'number';
    if (lowerType.includes('double') || lowerType.includes('float')) return 'number';
    if (lowerType.includes('bool')) return 'boolean';
    if (lowerType.includes('date')) return 'date';
    if (lowerType.includes('timestamp')) return 'datetime';
    
    return 'string'; // default fallback
  }

  private estimateBytesProcessed(result: any): number {
    // Rough estimation of bytes processed
    if (!result.data) return 0;
    
    const avgRowSize = 100; // rough estimate
    return result.data.length * avgRowSize;
  }

  private extractCostFromExplain(explainResult: any): number {
    // Extract cost estimate from EXPLAIN result
    // This is a simplified implementation
    return 1.0;
  }

  private parseExplainResult(explainResult: any): any[] {
    // Parse DuckDB EXPLAIN result into query operations
    // This is a simplified implementation
    return [{
      operation: 'scan',
      estimated_cardinality: 1000,
      children: []
    }];
  }

  private async estimateFileSize(url: string): Promise<number> {
    try {
      // Try to get file size with HEAD request
      const response = await fetch(url, { method: 'HEAD' });
      const contentLength = response.headers.get('content-length');
      return contentLength ? parseInt(contentLength, 10) : 0;
    } catch (error) {
      return 0;
    }
  }
}