# DataPrism Parquet HTTPFS Plugin - Product Requirements Prompt (PRP)

## 1. Plugin Overview

**Plugin Name**: `parquet-httpfs-plugin`  
**Category**: Integration Plugin  
**Purpose**: Enable DataPrism to load and query Parquet files directly from cloud storage (AWS S3, Cloudflare R2) using DuckDB's HTTPFS extension for efficient streaming and in-browser analytics  
**Target Use Cases**: 
- Loading remote Parquet datasets for analytics without full download
- Querying large cloud-hosted data files with minimal memory footprint  
- Enabling secure access to private S3 and CloudFlare R2 buckets with authentication
- Supporting multi-GB file analysis in browser environments
- Leveraging CloudFlare R2's global edge network for improved performance
- Cost-effective data analytics with R2's competitive pricing model

## 2. Architecture Integration

**Interface Implementation**: `IIntegrationPlugin`

**Dependencies**:
- DataPrism Core DuckDB-WASM integration
- DuckDB HTTPFS extension (must be compiled with WebAssembly build)
- Browser Fetch API for authentication and CORS handling
- DataPrism EventBus for progress notifications
- DataPrism ServiceRegistry for shared memory management

**Data Flow**:
```
Cloud Storage (S3/R2) → HTTPFS Extension → DuckDB-WASM → DataPrism Core → Plugin API
```

**Performance Impact**:
- Memory: <200MB overhead for plugin initialization
- Network: Streaming reads minimize bandwidth usage
- CPU: Leverage DuckDB's columnar processing efficiency
- Storage: No local file caching required

## 3. Functional Requirements

### Core Features

#### A. Remote File Loading
- Support HTTP/HTTPS URLs for Parquet files on S3-compatible storage
- Utilize DuckDB HTTPFS extension for streaming file access
- Enable partial file reads for query optimization
- Support both public and authenticated private buckets

#### B. Authentication Management
- AWS Signature v4 authentication for private S3 buckets
- Support for temporary credentials (STS tokens)
- CloudFlare R2 S3-compatible authentication with R2 API tokens
- CloudFlare R2 custom domain support with CNAME configuration
- Signed URL support for time-limited access (both S3 and R2)
- Credential validation and refresh mechanisms
- Support for CloudFlare Workers integration for enhanced security

#### C. Schema Introspection
- Extract Parquet schema metadata (columns, types, row counts)
- Expose schema information to DataPrism visualization layer
- Handle schema evolution and validation
- Provide column statistics and data profiling

#### D. Query Execution
- Register remote Parquet files as queryable tables in DuckDB
- Support complex SQL queries with pushdown optimization
- Enable JOIN operations between multiple remote files
- Provide query result streaming for large datasets

### Configuration Schema

```typescript
interface ParquetHttpfsConfig {
  defaultTimeout: number; // Default: 30000ms
  maxConcurrentConnections: number; // Default: 4
  enableProgressReporting: boolean; // Default: true
  cacheSchema: boolean; // Default: true
  retryAttempts: number; // Default: 3
  chunkSize: number; // Default: 1MB for streaming
}
```

### Error Handling
- Network connectivity failures with retry logic
- Authentication errors with clear messaging
- CORS policy violations with diagnostic information
- File format validation and corruption detection
- Resource quota enforcement and graceful degradation

### Validation Requirements
- URL format validation for supported storage providers
- Authentication credential format validation
- File accessibility verification before query execution
- Schema compatibility checks for multi-file operations

## 4. Technical Specifications

### API Design

```typescript
interface IParquetHttpfsPlugin extends IIntegrationPlugin {
  // Core loading functionality
  loadFile(url: string, options?: LoadOptions): Promise<TableReference>;
  loadMultipleFiles(urls: string[], options?: LoadOptions): Promise<TableReference[]>;
  
  // Schema operations
  getSchema(url: string): Promise<ParquetSchema>;
  validateFile(url: string): Promise<ValidationResult>;
  
  // Query operations
  query(sql: string, tables: TableReference[]): Promise<QueryResult>;
  explainQuery(sql: string): Promise<QueryPlan>;
  
  // Authentication
  setCredentials(provider: string, credentials: Credentials): void;
  refreshCredentials(provider: string): Promise<void>;
  
  // Progress monitoring
  onProgress(callback: ProgressCallback): void;
  getLoadingStatus(): LoadingStatus[];
}

interface LoadOptions {
  authentication?: {
    provider: 'aws' | 'cloudflare' | 'custom';
    credentials: AWSCredentials | CloudflareCredentials | CustomCredentials;
  };
  cors?: CORSOptions;
  timeout?: number;
  alias?: string;
  streaming?: boolean;
}

interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region?: string;
}

interface CloudflareCredentials {
  accountId: string;
  accessKeyId: string; // R2 API Token ID
  secretAccessKey: string; // R2 API Token Secret
  jurisdiction?: 'auto' | 'eu' | 'fedramp-moderate'; // R2 jurisdiction
  customDomain?: string; // Custom domain for R2 bucket
  workerEndpoint?: string; // CloudFlare Worker proxy endpoint
}

interface ParquetSchema {
  columns: ColumnInfo[];
  rowCount?: number;
  fileSize: number;
  metadata: Record<string, any>;
}

interface TableReference {
  url: string;
  alias: string;
  schema: ParquetSchema;
  loadedAt: Date;
}
```

### Data Structures

```typescript
// Internal plugin state management
class ParquetHttpfsManager {
  private loadedTables: Map<string, TableReference>;
  private credentials: Map<string, Credentials>;
  private duckdbConnection: DuckDBConnection;
  private progressTrackers: Map<string, ProgressTracker>;
}

// Query result handling
interface QueryResult {
  data: any[][];
  columns: string[];
  rowCount: number;
  executionTime: number;
  bytesProcessed: number;
}
```

### Integration Points

#### DuckDB HTTPFS Integration
```typescript
// Initialize HTTPFS extension for AWS S3
await this.duckdbConnection.query(`
  INSTALL httpfs;
  LOAD httpfs;
  SET s3_region='${region}';
  SET s3_access_key_id='${accessKey}';
  SET s3_secret_access_key='${secretKey}';
`);

// Initialize HTTPFS extension for CloudFlare R2
await this.duckdbConnection.query(`
  INSTALL httpfs;
  LOAD httpfs;
  SET s3_endpoint='${r2Endpoint}'; -- e.g., 'https://accountid.r2.cloudflarestorage.com'
  SET s3_access_key_id='${r2AccessKey}';
  SET s3_secret_access_key='${r2SecretKey}';
  SET s3_url_style='path'; -- R2 uses path-style URLs
`);

// Create table from remote Parquet (works for both S3 and R2)
await this.duckdbConnection.query(`
  CREATE TABLE ${alias} AS 
  SELECT * FROM read_parquet('${url}');
`);
```

#### DataPrism Core Service Integration
```typescript
// Register with service registry
this.context.serviceRegistry.register('parquet-httpfs', this);

// Publish loading events
this.context.eventBus.publish('parquet:loading-started', { url, alias });
this.context.eventBus.publish('parquet:schema-loaded', { alias, schema });
this.context.eventBus.publish('parquet:loading-completed', { alias, rowCount });
```

## 5. Development Implementation

### File Structure
```
packages/out-of-box/parquet-httpfs/
├── src/
│   ├── ParquetHttpfsPlugin.ts          # Main plugin implementation
│   ├── managers/
│   │   ├── AuthenticationManager.ts    # Credential management
│   │   ├── SchemaManager.ts           # Schema introspection
│   │   └── QueryManager.ts            # Query execution
│   ├── providers/
│   │   ├── AWSProvider.ts             # AWS S3 authentication
│   │   ├── CloudflareProvider.ts      # CloudFlare R2 comprehensive support
│   │   ├── R2WorkerProvider.ts        # CloudFlare Worker proxy integration
│   │   └── BaseProvider.ts            # Common provider interface
│   ├── types/
│   │   ├── interfaces.ts              # TypeScript interfaces
│   │   └── schemas.ts                 # Configuration schemas
│   └── utils/
│       ├── validation.ts              # URL and credential validation
│       ├── error-handling.ts          # Error management
│       └── progress-tracking.ts       # Loading progress utilities
├── tests/
│   ├── unit/
│   ├── integration/
│   └── performance/
├── examples/
│   ├── basic-usage.ts
│   ├── authentication-examples.ts
│   └── advanced-queries.ts
├── docs/
│   ├── api-reference.md
│   └── authentication-guide.md
└── package.json
```

### Build Configuration

```typescript
// webpack.config.js
module.exports = {
  entry: './src/ParquetHttpfsPlugin.ts',
  output: {
    filename: 'parquet-httpfs-plugin.js',
    library: 'ParquetHttpfsPlugin',
    libraryTarget: 'umd'
  },
  externals: {
    'duckdb-wasm': 'DuckDB',
    '@dataprism/core': 'DataPrismCore'
  },
  optimization: {
    minimize: true,
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all'
        }
      }
    }
  }
};
```

### Testing Strategy

#### Unit Tests (Vitest)
```typescript
describe('ParquetHttpfsPlugin', () => {
  test('should validate S3 URLs correctly', () => {
    const plugin = new ParquetHttpfsPlugin();
    expect(plugin.validateUrl('https://bucket.s3.amazonaws.com/file.parquet')).toBe(true);
  });

  test('should handle authentication errors gracefully', async () => {
    const plugin = new ParquetHttpfsPlugin();
    await expect(plugin.loadFile(url, invalidAuth)).rejects.toThrow('Authentication failed');
  });
});
```

#### Integration Tests
```typescript
describe('Integration with DuckDB', () => {
  test('should load public Parquet file successfully', async () => {
    const result = await plugin.loadFile('https://public-bucket.s3.amazonaws.com/sample.parquet');
    expect(result.schema.columns.length).toBeGreaterThan(0);
  });
});
```

#### Performance Tests
```typescript
describe('Performance benchmarks', () => {
  test('should load 1GB file within memory limits', async () => {
    const startMemory = performance.memory.usedJSHeapSize;
    await plugin.loadFile(largeFileUrl);
    const endMemory = performance.memory.usedJSHeapSize;
    expect(endMemory - startMemory).toBeLessThan(200 * 1024 * 1024); // 200MB limit
  });
});
```

## 6. Performance Optimization

### Memory Management
- Implement streaming reads to avoid loading entire files into memory
- Use DuckDB's columnar storage for efficient data representation
- Implement garbage collection for unused table references
- Monitor memory usage and enforce quota limits

### Caching Strategy
```typescript
class SchemaCache {
  private cache: Map<string, CachedSchema> = new Map();
  
  get(url: string): ParquetSchema | null {
    const cached = this.cache.get(url);
    if (cached && !this.isExpired(cached)) {
      return cached.schema;
    }
    return null;
  }
  
  set(url: string, schema: ParquetSchema, ttl: number = 3600000): void {
    this.cache.set(url, {
      schema,
      expiry: Date.now() + ttl
    });
  }
}
```

### Lazy Loading
- Load schema information on-demand
- Initialize DuckDB HTTPFS extension only when needed
- Defer credential validation until first file access
- Implement progressive loading for large result sets

### Background Processing
```typescript
// Use Web Workers for heavy schema processing
class SchemaWorker {
  private worker: Worker;
  
  async processSchema(url: string): Promise<ParquetSchema> {
    return new Promise((resolve, reject) => {
      this.worker.postMessage({ action: 'processSchema', url });
      this.worker.onmessage = (event) => {
        if (event.data.success) {
          resolve(event.data.schema);
        } else {
          reject(new Error(event.data.error));
        }
      };
    });
  }
}
```

## 7. Quality Assurance

### Testing Framework

#### Comprehensive Test Coverage
```typescript
// Test data providers
const TEST_FILES = {
  s3Public: 'https://public-test-bucket.s3.amazonaws.com/test.parquet',
  s3Private: 'https://private-test-bucket.s3.amazonaws.com/test.parquet',
  s3Large: 'https://test-bucket.s3.amazonaws.com/large-10gb.parquet',
  r2Public: 'https://pub-bucket.r2-test-account.dev/test.parquet',
  r2Private: 'https://test-account.r2.cloudflarestorage.com/private-bucket/test.parquet',
  r2CustomDomain: 'https://data.example.com/test.parquet',
  r2Worker: 'https://data-proxy.example.workers.dev/test.parquet',
  corrupted: 'https://test-bucket.s3.amazonaws.com/corrupted.parquet'
};

// Mock authentication for testing
class MockAuthProvider implements AuthProvider {
  async authenticate(credentials: Credentials): Promise<boolean> {
    return credentials.accessKeyId === 'test-key';
  }
}
```

#### Performance Benchmarks
- Query response time: <2 seconds for typical analytical queries
- Memory usage: <200MB plugin overhead + data streaming
- File loading: Support up to 10GB files without browser crashes
- Network efficiency: Minimize data transfer through query pushdown

#### Error Scenarios
```typescript
describe('Error handling', () => {
  test('network timeout', async () => {
    await expect(plugin.loadFile(url, { timeout: 1 })).rejects.toThrow('Timeout');
  });
  
  test('CORS violation', async () => {
    await expect(plugin.loadFile(corsBlockedUrl)).rejects.toThrow('CORS');
  });
  
  test('authentication failure', async () => {
    await expect(plugin.loadFile(privateUrl, invalidAuth)).rejects.toThrow('Authentication');
  });
});
```

#### Browser Compatibility Testing
- Chrome 90+ with WebAssembly support
- Firefox 88+ with SharedArrayBuffer enabled
- Safari 14+ with proper CORS handling
- Edge 90+ with full DuckDB-WASM compatibility

## 8. Security and Compliance

### Credential Management
```typescript
class SecureCredentialStore {
  private credentials: Map<string, EncryptedCredentials> = new Map();
  
  store(provider: string, credentials: Credentials): void {
    const encrypted = this.encrypt(JSON.stringify(credentials));
    this.credentials.set(provider, encrypted);
  }
  
  retrieve(provider: string): Credentials | null {
    const encrypted = this.credentials.get(provider);
    if (encrypted) {
      return JSON.parse(this.decrypt(encrypted));
    }
    return null;
  }
  
  private encrypt(data: string): EncryptedCredentials {
    // Implementation using Web Crypto API
  }
}
```

### Input Validation
- URL format validation with allowlist patterns
- SQL injection prevention in query parameters  
- Credential format validation before storage
- File size limits and resource quota enforcement

### Audit Logging
```typescript
class AuditLogger {
  log(event: AuditEvent): void {
    const entry = {
      timestamp: new Date().toISOString(),
      event: event.type,
      resource: event.resource,
      user: event.user,
      success: event.success,
      details: this.sanitizeDetails(event.details)
    };
    
    this.context.eventBus.publish('audit:log', entry);
  }
}
```

## 9. CloudFlare R2 Implementation Details

### R2-Specific Configuration

```typescript
interface R2Configuration {
  endpoint: string; // e.g., 'https://accountid.r2.cloudflarestorage.com'
  jurisdiction: 'auto' | 'eu' | 'fedramp-moderate';
  customDomain?: string;
  corsPolicy: CORSPolicy;
  pathStyle: boolean; // R2 uses path-style URLs by default
}

class CloudflareR2Provider extends BaseProvider {
  private accountId: string;
  private jurisdiction: string;
  private customDomain?: string;
  
  constructor(credentials: CloudflareCredentials) {
    super();
    this.accountId = credentials.accountId;
    this.jurisdiction = credentials.jurisdiction || 'auto';
    this.customDomain = credentials.customDomain;
  }
  
  getEndpoint(): string {
    if (this.customDomain) {
      return `https://${this.customDomain}`;
    }
    
    const jurisdictionSuffix = this.jurisdiction === 'eu' ? '-eu' : 
                              this.jurisdiction === 'fedramp-moderate' ? '-fedramp' : '';
    return `https://${this.accountId}.r2${jurisdictionSuffix}.cloudflarestorage.com`;
  }
  
  async configureHttpfs(connection: DuckDBConnection): Promise<void> {
    await connection.query(`
      SET s3_endpoint='${this.getEndpoint()}';
      SET s3_access_key_id='${this.credentials.accessKeyId}';
      SET s3_secret_access_key='${this.credentials.secretAccessKey}';
      SET s3_url_style='path';
      SET s3_use_ssl=true;
    `);
  }
}
```

### R2 Worker Proxy Integration

```typescript
class R2WorkerProxy {
  private workerEndpoint: string;
  private authToken: string;
  
  constructor(workerEndpoint: string, authToken: string) {
    this.workerEndpoint = workerEndpoint;
    this.authToken = authToken;
  }
  
  async proxyRequest(originalUrl: string): Promise<string> {
    const proxyUrl = `${this.workerEndpoint}/proxy`;
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        originalUrl,
        operation: 'read_parquet'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Worker proxy failed: ${response.statusText}`);
    }
    
    return response.text();
  }
}
```

### R2 Performance Optimizations

```typescript
class R2PerformanceOptimizer {
  private edgeLocationCache: Map<string, string> = new Map();
  
  async selectOptimalEndpoint(accountId: string, userLocation?: GeolocationPosition): Promise<string> {
    // CloudFlare R2 automatically routes to nearest edge location
    // but we can optimize based on jurisdiction requirements
    
    if (userLocation) {
      const { latitude, longitude } = userLocation.coords;
      
      // EU jurisdiction for European users
      if (this.isEuropeanLocation(latitude, longitude)) {
        return `https://${accountId}.r2-eu.cloudflarestorage.com`;
      }
      
      // FedRAMP for US government requirements
      if (this.requiresFedRAMP(userLocation)) {
        return `https://${accountId}.r2-fedramp.cloudflarestorage.com`;
      }
    }
    
    // Default auto-routing
    return `https://${accountId}.r2.cloudflarestorage.com`;
  }
  
  private isEuropeanLocation(lat: number, lon: number): boolean {
    // Simplified EU boundary check
    return lat >= 35 && lat <= 72 && lon >= -25 && lon <= 45;
  }
}
```

## 10. Documentation and Examples

### API Documentation Structure
```markdown
# Parquet HTTPFS Plugin API Reference

## Installation
npm install @dataprism/parquet-httpfs-plugin

## Basic Usage
```typescript
const plugin = new ParquetHttpfsPlugin();
await plugin.initialize(context);

// Load public file from S3
const s3Table = await plugin.loadFile('https://bucket.s3.amazonaws.com/data.parquet');

// Load public file from CloudFlare R2
const r2Table = await plugin.loadFile('https://pub-bucket.account.r2.dev/data.parquet');

// Query data from either provider
const results = await plugin.query('SELECT * FROM data LIMIT 100', [s3Table]);
```

## Authentication Examples
```typescript
// AWS S3 with access keys
await plugin.loadFile(url, {
  authentication: {
    provider: 'aws',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: 'us-east-1'
    }
  }
});

// CloudFlare R2 with standard S3-compatible API
await plugin.loadFile(url, {
  authentication: {
    provider: 'cloudflare',
    credentials: {
      accountId: process.env.CF_ACCOUNT_ID,
      accessKeyId: process.env.CF_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY,
      jurisdiction: 'auto' // or 'eu', 'fedramp-moderate'
    }
  }
});

// CloudFlare R2 with custom domain
await plugin.loadFile('https://data.example.com/dataset.parquet', {
  authentication: {
    provider: 'cloudflare',
    credentials: {
      accountId: process.env.CF_ACCOUNT_ID,
      accessKeyId: process.env.CF_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY,
      customDomain: 'data.example.com'
    }
  }
});

// CloudFlare R2 via Workers proxy for enhanced security
await plugin.loadFile('https://data-proxy.example.workers.dev/dataset.parquet', {
  authentication: {
    provider: 'cloudflare',
    credentials: {
      accountId: process.env.CF_ACCOUNT_ID,
      accessKeyId: process.env.CF_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY,
      workerEndpoint: 'https://data-proxy.example.workers.dev'
    }
  }
});
```

### Usage Examples

#### Basic File Loading
```typescript
import { ParquetHttpfsPlugin } from '@dataprism/parquet-httpfs-plugin';

const plugin = new ParquetHttpfsPlugin();
await plugin.initialize(context);

// Load and query public Parquet file
const table = await plugin.loadFile('https://public-bucket.s3.amazonaws.com/taxi-data.parquet');
const results = await plugin.query(`
  SELECT pickup_borough, COUNT(*) as trip_count 
  FROM taxi_data 
  WHERE trip_distance > 5 
  GROUP BY pickup_borough 
  ORDER BY trip_count DESC
`, [table]);
```

#### Advanced Multi-File Queries
```typescript
// Load multiple related files from different providers
const trips = await plugin.loadFile('s3://data-lake/trips/2023/parquet', { alias: 'trips' });
const zones = await plugin.loadFile('https://account.r2.cloudflarestorage.com/zones/zones.parquet', { 
  alias: 'zones',
  authentication: {
    provider: 'cloudflare',
    credentials: r2Credentials
  }
});

// Join across files
const results = await plugin.query(`
  SELECT z.zone_name, COUNT(*) as trip_count
  FROM trips t
  JOIN zones z ON t.pickup_zone_id = z.zone_id
  WHERE t.trip_date >= '2023-01-01'
  GROUP BY z.zone_name
  ORDER BY trip_count DESC
  LIMIT 10
`, [trips, zones]);
```

#### Progress Monitoring
```typescript
plugin.onProgress((progress) => {
  console.log(`Loading ${progress.alias}: ${progress.percentComplete}%`);
  updateProgressBar(progress.percentComplete);
});

const table = await plugin.loadFile(largeFileUrl);
```

### R2-Specific Usage Examples

```typescript
// Load from R2 with different jurisdictions
const euTable = await plugin.loadFile('https://account.r2-eu.cloudflarestorage.com/bucket/data.parquet', {
  authentication: {
    provider: 'cloudflare',
    credentials: {
      accountId: 'account-id',
      accessKeyId: 'r2-key-id',
      secretAccessKey: 'r2-secret',
      jurisdiction: 'eu'
    }
  }
});

// Load from R2 via custom domain
const customTable = await plugin.loadFile('https://data.mycompany.com/analytics/sales.parquet', {
  authentication: {
    provider: 'cloudflare',
    credentials: {
      accountId: 'account-id',
      accessKeyId: 'r2-key-id',
      secretAccessKey: 'r2-secret',
      customDomain: 'data.mycompany.com'
    }
  }
});

// Hybrid queries across S3 and R2
const s3Data = await plugin.loadFile('s3://aws-bucket/historical.parquet', { 
  alias: 'historical',
  authentication: { provider: 'aws', credentials: awsCredentials }
});

const r2Data = await plugin.loadFile('https://account.r2.cloudflarestorage.com/recent/data.parquet', { 
  alias: 'recent',
  authentication: { provider: 'cloudflare', credentials: r2Credentials }
});

// Join data from both providers
const hybridResults = await plugin.query(`
  SELECT h.category, r.recent_sales, h.historical_avg
  FROM historical h
  JOIN recent r ON h.category = r.category
  WHERE r.date >= '2024-01-01'
`, [s3Data, r2Data]);
```

### R2 Performance Benchmarks

```typescript
// Performance testing for R2 vs S3
describe('R2 Performance Comparison', () => {
  test('R2 edge performance should be competitive with S3', async () => {
    const startTime = performance.now();
    
    const r2Table = await plugin.loadFile(r2TestUrl, {
      authentication: { provider: 'cloudflare', credentials: r2Credentials }
    });
    
    const r2LoadTime = performance.now() - startTime;
    
    // R2 should leverage edge caching for improved performance
    expect(r2LoadTime).toBeLessThan(3000); // 3 second threshold
  });
  
  test('R2 custom domain performance', async () => {
    const customDomainTable = await plugin.loadFile('https://data.example.com/test.parquet', {
      authentication: {
        provider: 'cloudflare',
        credentials: { ...r2Credentials, customDomain: 'data.example.com' }
      }
    });
    
    expect(customDomainTable.schema.columns.length).toBeGreaterThan(0);
  });
});
```

## 11. Success Criteria and Validation

### Functional Success Metrics
- ✅ Load Parquet files from S3/R2 without full download
- ✅ Authenticate with private S3 buckets using AWS Signature v4
- ✅ Authenticate with private R2 buckets using S3-compatible API
- ✅ Support CloudFlare R2 custom domains and Worker proxies
- ✅ Extract and expose accurate schema information from both providers
- ✅ Execute complex SQL queries with acceptable performance
- ✅ Handle network errors and timeouts gracefully
- ✅ Seamlessly switch between S3 and R2 providers in multi-file queries

### Performance Validation
- Query response time: <2 seconds for 95% of analytical queries on files up to 1GB
- Memory usage: Plugin overhead <200MB, total memory <4GB for 1M row datasets
- File loading: Support files up to 10GB with progress reporting
- Network efficiency: Minimize data transfer through columnar reading

### Integration Testing
```typescript
describe('DataPrism Integration', () => {
  test('should integrate with visualization plugins', async () => {
    const table = await parquetPlugin.loadFile(testFileUrl);
    const results = await parquetPlugin.query('SELECT * FROM test_data LIMIT 1000', [table]);
    
    const vizPlugin = context.serviceRegistry.resolve('visualization');
    await vizPlugin.render('chart', results);
    
    expect(vizPlugin.getRenderedCharts()).toHaveLength(1);
  });
});
```

### Security Validation
- All credentials encrypted in memory and never logged
- CORS policies properly enforced and reported
- Input validation prevents injection attacks
- Resource quotas prevent browser crashes

## 11. Risk Mitigation

### Technical Risks
- **DuckDB HTTPFS Compatibility**: Validate WebAssembly build includes HTTPFS extension
- **Browser Memory Limits**: Implement streaming and pagination for large datasets  
- **Network Reliability**: Robust retry logic and offline handling
- **CORS Restrictions**: Clear documentation for proper bucket configuration

### Performance Risks
- **Large File Handling**: Progressive loading and query result streaming
- **Memory Leaks**: Comprehensive cleanup and garbage collection
- **Network Bottlenecks**: Connection pooling and request optimization

### Security Risks
- **Credential Exposure**: Secure storage and transmission protocols
- **Access Control**: Proper validation of authentication tokens
- **Data Privacy**: No sensitive data logging or caching
- **R2-Specific Risks**: CloudFlare Worker proxy security, custom domain certificate validation

## 12. Future Enhancements

### Phase 2 Features
- Delta Lake support for versioned datasets
- Parquet file metadata caching for faster subsequent loads  
- Automatic schema evolution handling
- Query result caching with intelligent invalidation
- CloudFlare R2 Zero Trust integration for enhanced security
- R2 event triggers for real-time data processing

### Advanced Integrations  
- Integration with cloud data catalogs (AWS Glue, CloudFlare Analytics)
- Support for partitioned datasets across both S3 and R2
- Column-level security and filtering
- Real-time streaming data support
- CloudFlare Workers integration for serverless data processing
- R2 bucket lifecycle management and cost optimization

This comprehensive PRP provides the foundation for implementing a robust, secure, and performant Parquet HTTPFS plugin for DataPrism, enabling seamless cloud data analytics in the browser environment.