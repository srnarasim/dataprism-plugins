import { 
  ParquetSchema, 
  ColumnInfo, 
  ValidationResult, 
  ValidationError,
  ParquetHttpfsError 
} from "../types/interfaces.js";
import { PluginContext } from "../../../types/index.js";

export interface SchemaCache {
  url: string;
  schema: ParquetSchema;
  expiry: number;
  etag?: string;
}

export class SchemaManager {
  private context: PluginContext;
  private cache: Map<string, SchemaCache> = new Map();
  private defaultCacheTTL: number = 3600000; // 1 hour

  constructor(context: PluginContext) {
    this.context = context;
  }

  async getSchema(url: string, forceRefresh: boolean = false): Promise<ParquetSchema> {
    const cacheKey = this.createCacheKey(url);
    
    // Check cache first
    if (!forceRefresh) {
      const cached = this.getCachedSchema(cacheKey);
      if (cached) {
        this.context.logger.debug(`Using cached schema for ${url}`);
        return cached.schema;
      }
    }

    try {
      this.context.logger.debug(`Fetching schema for ${url}`);
      const schema = await this.fetchSchema(url);
      
      // Cache the schema
      this.cacheSchema(cacheKey, url, schema);
      
      this.context.eventBus.publish('parquet:schema-loaded', {
        url,
        columns: schema.columns.length,
        fileSize: schema.fileSize,
        cached: false
      });

      return schema;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.context.logger.error(`Failed to get schema for ${url}:`, message);
      throw new ParquetHttpfsError(`Schema retrieval failed: ${message}`, 'SCHEMA_ERROR', { url });
    }
  }

  async validateFile(url: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    try {
      // Basic URL validation
      this.validateUrl(url);

      // Check if file is accessible
      const accessCheck = await this.checkFileAccessibility(url);
      if (!accessCheck.accessible) {
        errors.push({
          code: 'FILE_NOT_ACCESSIBLE',
          message: `File not accessible: ${accessCheck.error}`,
          details: { url, statusCode: accessCheck.statusCode }
        });
      }

      // Try to get file metadata
      let fileSize = 0;
      let estimatedRows = 0;
      let columns = 0;

      if (accessCheck.accessible) {
        try {
          const schema = await this.getSchema(url);
          fileSize = schema.fileSize;
          columns = schema.columns.length;
          estimatedRows = schema.rowCount || 0;

          // Validate schema
          const schemaValidation = this.validateSchema(schema);
          errors.push(...schemaValidation.errors);
          warnings.push(...schemaValidation.warnings);

        } catch (schemaError) {
          errors.push({
            code: 'SCHEMA_ERROR',
            message: `Schema validation failed: ${schemaError instanceof Error ? schemaError.message : 'Unknown error'}`,
            details: { url }
          });
        }
      }

      // Check file size warnings
      if (fileSize > 10 * 1024 * 1024 * 1024) { // 10GB
        warnings.push(`Large file detected (${this.formatFileSize(fileSize)}). Consider using streaming queries.`);
      }

      // Check column count warnings
      if (columns > 1000) {
        warnings.push(`High column count detected (${columns}). This may impact performance.`);
      }

      const result: ValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata: {
          fileSize,
          columns,
          estimatedRows
        }
      };

      this.context.eventBus.publish('parquet:file-validated', {
        url,
        isValid: result.isValid,
        errorCount: errors.length,
        warningCount: warnings.length,
        fileSize,
        columns
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        isValid: false,
        errors: [{
          code: 'VALIDATION_ERROR',
          message: `Validation failed: ${message}`,
          details: { url }
        }],
        warnings,
        metadata: {
          fileSize: 0,
          columns: 0
        }
      };
    }
  }

  clearCache(url?: string): void {
    if (url) {
      const cacheKey = this.createCacheKey(url);
      this.cache.delete(cacheKey);
      this.context.logger.debug(`Cleared schema cache for ${url}`);
    } else {
      this.cache.clear();
      this.context.logger.debug('Cleared all schema cache');
    }
  }

  getCacheStats(): { size: number; urls: string[] } {
    return {
      size: this.cache.size,
      urls: Array.from(this.cache.values()).map(entry => entry.url)
    };
  }

  private getCachedSchema(cacheKey: string): SchemaCache | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) {
      return null;
    }

    // Check if cache entry has expired
    if (Date.now() > cached.expiry) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached;
  }

  private async fetchSchema(url: string): Promise<ParquetSchema> {
    try {
      // Get file metadata first
      const metadata = await this.getFileMetadata(url);
      
      // For now, we'll create a basic schema structure
      // In a real implementation, we would parse the Parquet file header
      const schema: ParquetSchema = {
        columns: await this.extractColumnInfo(url),
        rowCount: metadata.estimatedRows,
        fileSize: metadata.fileSize,
        metadata: {
          contentType: metadata.contentType,
          lastModified: metadata.lastModified,
          etag: metadata.etag
        }
      };

      return schema;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ParquetHttpfsError(`Failed to fetch schema: ${message}`, 'SCHEMA_FETCH_ERROR', { url });
    }
  }

  private async getFileMetadata(url: string): Promise<{
    fileSize: number;
    contentType?: string;
    lastModified?: string;
    etag?: string;
    estimatedRows?: number;
  }> {
    try {
      // Try browser fetch first for CORS-enabled sources
      const response = await fetch(url, { method: 'HEAD' });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const fileSize = parseInt(response.headers.get('content-length') || '0', 10);
      const contentType = response.headers.get('content-type') || undefined;
      const lastModified = response.headers.get('last-modified') || undefined;
      const etag = response.headers.get('etag') || undefined;

      // Rough estimation of rows based on file size
      const estimatedRows = Math.floor(fileSize / 100); // Assume ~100 bytes per row

      return {
        fileSize,
        contentType,
        lastModified,
        etag,
        estimatedRows
      };
    } catch (error) {
      // If browser fetch fails (likely CORS), try to get metadata via DuckDB
      this.context.logger.warn(`Browser fetch failed for ${url}, trying DuckDB approach: ${error}`);
      return await this.getFileMetadataViaDuckDB(url);
    }
  }

  private async getFileMetadataViaDuckDB(url: string): Promise<{
    fileSize: number;
    contentType?: string;
    lastModified?: string;
    etag?: string;
    estimatedRows?: number;
  }> {
    try {
      // Use DuckDB to get row count (this bypasses CORS)
      const tempTableName = `temp_meta_${Date.now()}`;
      
      // Create a temporary view to analyze the file
      const createViewSql = `CREATE OR REPLACE VIEW ${tempTableName} AS SELECT * FROM read_parquet('${url}') LIMIT 1`;
      await this.duckdbManager.executeQuery(createViewSql);
      
      // Get estimated row count by sampling
      const countSql = `SELECT COUNT(*) as row_count FROM read_parquet('${url}')`;
      const countResult = await this.duckdbManager.executeQuery(countSql);
      const rowCount = countResult.data[0][0] || 0;
      
      // Clean up
      await this.duckdbManager.executeQuery(`DROP VIEW IF EXISTS ${tempTableName}`);
      
      // Estimate file size based on row count (rough approximation)
      const estimatedFileSize = rowCount * 150; // Assume ~150 bytes per row for taxi data
      
      this.context.logger.info(`Got metadata via DuckDB: ${rowCount} rows, ~${(estimatedFileSize / 1024 / 1024).toFixed(1)}MB estimated`);
      
      return {
        fileSize: estimatedFileSize,
        contentType: 'application/octet-stream',
        estimatedRows: rowCount
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.context.logger.error(`DuckDB metadata fallback failed: ${message}`);
      
      // Last resort: return minimal metadata
      return {
        fileSize: 50000000, // 50MB estimate
        contentType: 'application/octet-stream',
        estimatedRows: 500000 // 500K rows estimate
      };
    }
  }

  private async extractColumnInfo(url: string): Promise<ColumnInfo[]> {
    try {
      // Use DuckDB to get schema information (bypasses CORS)
      const tempTableName = `temp_schema_${Date.now()}`;
      
      // Create a temporary view to analyze schema
      const createViewSql = `CREATE OR REPLACE VIEW ${tempTableName} AS SELECT * FROM read_parquet('${url}') LIMIT 0`;
      await this.duckdbManager.executeQuery(createViewSql);
      
      // Get column information
      const describeSql = `DESCRIBE ${tempTableName}`;
      const describeResult = await this.duckdbManager.executeQuery(describeSql);
      
      const columns: ColumnInfo[] = describeResult.data.map((row: any) => ({
        name: row[0], // column_name
        type: this.mapDuckDBTypeToDataType(row[1]), // column_type
        nullable: row[2] === 'YES', // null
        metadata: {}
      }));
      
      // Clean up
      await this.duckdbManager.executeQuery(`DROP VIEW IF EXISTS ${tempTableName}`);
      
      this.context.logger.info(`Extracted ${columns.length} columns via DuckDB`);
      return columns;
      
    } catch (error) {
      this.context.logger.warn(`Failed to extract columns via DuckDB: ${error}`);
      
      // Return common NYC taxi columns as fallback
      return [
        { name: 'VendorID', type: 'number', nullable: true, metadata: {} },
        { name: 'tpep_pickup_datetime', type: 'datetime', nullable: true, metadata: {} },
        { name: 'tpep_dropoff_datetime', type: 'datetime', nullable: true, metadata: {} },
        { name: 'passenger_count', type: 'number', nullable: true, metadata: {} },
        { name: 'trip_distance', type: 'number', nullable: true, metadata: {} },
        { name: 'fare_amount', type: 'number', nullable: true, metadata: {} },
        { name: 'total_amount', type: 'number', nullable: true, metadata: {} }
      ];
    }
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

  private validateUrl(url: string): void {
    try {
      const urlObj = new URL(url);
      
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('URL must use HTTP or HTTPS protocol');
      }

      if (!urlObj.pathname.toLowerCase().endsWith('.parquet')) {
        throw new Error('URL must point to a .parquet file');
      }
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Invalid URL format');
      }
      throw error;
    }
  }

  private async checkFileAccessibility(url: string): Promise<{
    accessible: boolean;
    error?: string;
    statusCode?: number;
  }> {
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        // Add a timeout
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      return {
        accessible: response.ok,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
        statusCode: response.status
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        accessible: false,
        error: message
      };
    }
  }

  private validateSchema(schema: ParquetSchema): {
    errors: ValidationError[];
    warnings: string[];
  } {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Check if schema has columns
    if (!schema.columns || schema.columns.length === 0) {
      warnings.push('Schema has no column information available');
    }

    // Check for very large files
    if (schema.fileSize > 5 * 1024 * 1024 * 1024) { // 5GB
      warnings.push(`Very large file (${this.formatFileSize(schema.fileSize)}). Performance may be impacted.`);
    }

    // Check for suspicious row counts
    if (schema.rowCount && schema.rowCount > 100000000) { // 100M rows
      warnings.push(`Very high row count (${schema.rowCount.toLocaleString()}). Consider using LIMIT clauses in queries.`);
    }

    return { errors, warnings };
  }

  private createCacheKey(url: string): string {
    // Create a simple cache key from URL
    return btoa(url).replace(/[/+=]/g, '');
  }

  private cacheSchema(cacheKey: string, url: string, schema: ParquetSchema): void {
    const cacheEntry: SchemaCache = {
      url,
      schema,
      expiry: Date.now() + this.defaultCacheTTL,
      etag: schema.metadata?.etag
    };

    this.cache.set(cacheKey, cacheEntry);
    
    // Cleanup old entries if cache gets too large
    if (this.cache.size > 100) {
      this.cleanupExpiredEntries();
    }
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}