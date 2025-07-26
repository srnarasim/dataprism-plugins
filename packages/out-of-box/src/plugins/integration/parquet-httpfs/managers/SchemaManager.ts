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
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ParquetHttpfsError(`Failed to get file metadata: ${message}`, 'METADATA_ERROR', { url });
    }
  }

  private async extractColumnInfo(url: string): Promise<ColumnInfo[]> {
    // This is a simplified implementation
    // In a real implementation, we would parse the Parquet file header
    // For now, return empty array - columns will be discovered when table is registered
    return [];
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