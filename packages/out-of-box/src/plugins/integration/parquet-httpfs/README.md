# DataPrism Parquet HTTPFS Plugin

A comprehensive integration plugin for DataPrism that enables streaming and querying of Parquet files directly from cloud storage (AWS S3 and CloudFlare R2) using DuckDB's HTTPFS extension.

## Features

- **Cloud Storage Support**: Stream Parquet files from AWS S3 and CloudFlare R2 without full download
- **Authentication**: Support for AWS Signature v4 and CloudFlare R2 API authentication
- **Performance Optimized**: Memory-efficient streaming with <200MB overhead
- **Schema Introspection**: Automatic schema detection and validation
- **Query Capabilities**: Full SQL query support via DuckDB integration
- **Progress Tracking**: Real-time loading progress and status reporting
- **Error Handling**: Comprehensive error management with retry logic

## Installation

```bash
npm install @dataprism/parquet-httpfs-plugin
```

## Quick Start

```typescript
import { ParquetHttpfsPlugin } from '@dataprism/parquet-httpfs-plugin';

// Initialize the plugin
const plugin = new ParquetHttpfsPlugin();
await plugin.initialize(context);

// Load a public Parquet file
const table = await plugin.loadFile('https://bucket.s3.amazonaws.com/data.parquet');

// Query the data
const results = await plugin.query('SELECT * FROM data LIMIT 100', [table]);
console.log(results);
```

## Authentication

### AWS S3 Authentication

```typescript
import { AWSCredentials } from '@dataprism/parquet-httpfs-plugin';

const awsCredentials: AWSCredentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: 'us-east-1',
  sessionToken: process.env.AWS_SESSION_TOKEN, // optional for STS
};

const table = await plugin.loadFile('s3://my-bucket/data.parquet', {
  authentication: {
    provider: 'aws',
    credentials: awsCredentials,
  },
});
```

### CloudFlare R2 Authentication

```typescript
import { CloudflareCredentials } from '@dataprism/parquet-httpfs-plugin';

const r2Credentials: CloudflareCredentials = {
  accountId: process.env.CF_ACCOUNT_ID!,
  accessKeyId: process.env.CF_R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY!,
  jurisdiction: 'auto', // 'auto', 'eu', or 'fedramp-moderate'
};

const table = await plugin.loadFile('https://account.r2.cloudflarestorage.com/bucket/data.parquet', {
  authentication: {
    provider: 'cloudflare',
    credentials: r2Credentials,
  },
});
```

### CloudFlare R2 with Custom Domain

```typescript
const r2WithCustomDomain: CloudflareCredentials = {
  accountId: process.env.CF_ACCOUNT_ID!,
  accessKeyId: process.env.CF_R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY!,
  customDomain: 'data.mycompany.com',
};

const table = await plugin.loadFile('https://data.mycompany.com/analytics/sales.parquet', {
  authentication: {
    provider: 'cloudflare',
    credentials: r2WithCustomDomain,
  },
});
```

## Advanced Usage

### Loading Multiple Files

```typescript
const urls = [
  's3://data-lake/2023/january.parquet',
  's3://data-lake/2023/february.parquet',
  's3://data-lake/2023/march.parquet',
];

const tables = await plugin.loadMultipleFiles(urls, {
  authentication: {
    provider: 'aws',
    credentials: awsCredentials,
  },
  alias: 'monthly_data',
});

// Tables will be named: monthly_data_0, monthly_data_1, monthly_data_2
```

### Schema Introspection

```typescript
// Get schema information before loading
const schema = await plugin.getSchema('s3://my-bucket/data.parquet');
console.log('Columns:', schema.columns);
console.log('File size:', schema.fileSize);
console.log('Estimated rows:', schema.rowCount);

// Validate file accessibility and format
const validation = await plugin.validateFile('s3://my-bucket/data.parquet');
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
}
```

### Progress Monitoring

```typescript
// Set up progress callback
plugin.onProgress((progress) => {
  console.log(`Loading ${progress.alias}: ${progress.percentComplete}% complete`);
  console.log(`Phase: ${progress.phase}`);
  
  if (progress.bytesLoaded && progress.totalBytes) {
    const mbLoaded = (progress.bytesLoaded / 1024 / 1024).toFixed(1);
    const mbTotal = (progress.totalBytes / 1024 / 1024).toFixed(1);
    console.log(`Data: ${mbLoaded}MB / ${mbTotal}MB`);
  }
});

// Load file with progress tracking
const table = await plugin.loadFile('s3://large-bucket/big-file.parquet', {
  authentication: { provider: 'aws', credentials: awsCredentials },
});
```

### Complex Queries

```typescript
// Load multiple related datasets
const sales = await plugin.loadFile('s3://data-lake/sales.parquet', { alias: 'sales' });
const customers = await plugin.loadFile('s3://data-lake/customers.parquet', { alias: 'customers' });
const products = await plugin.loadFile('s3://data-lake/products.parquet', { alias: 'products' });

// Perform complex join query
const results = await plugin.query(`
  SELECT 
    c.customer_name,
    p.product_name,
    s.quantity,
    s.total_amount,
    s.sale_date
  FROM sales s
  JOIN customers c ON s.customer_id = c.customer_id
  JOIN products p ON s.product_id = p.product_id
  WHERE s.sale_date >= '2023-01-01'
    AND s.total_amount > 100
  ORDER BY s.total_amount DESC
  LIMIT 1000
`, [sales, customers, products]);

console.log(`Found ${results.rowCount} high-value sales`);
```

### Query Optimization

```typescript
// Get query execution plan
const queryPlan = await plugin.explainQuery(`
  SELECT category, COUNT(*), AVG(price)
  FROM products
  WHERE price > 50
  GROUP BY category
`);

console.log('Estimated cost:', queryPlan.estimated_cost);
console.log('Operations:', queryPlan.operations);
```

### Hybrid Cloud Queries

```typescript
// Load data from different providers
const awsData = await plugin.loadFile('s3://aws-bucket/historical.parquet', {
  alias: 'historical',
  authentication: { provider: 'aws', credentials: awsCredentials }
});

const r2Data = await plugin.loadFile('https://account.r2.cloudflarestorage.com/recent/data.parquet', {
  alias: 'recent',
  authentication: { provider: 'cloudflare', credentials: r2Credentials }
});

// Query across both providers
const hybridResults = await plugin.query(`
  SELECT 
    h.category,
    COUNT(h.*) as historical_count,
    COUNT(r.*) as recent_count,
    AVG(h.value) as historical_avg,
    AVG(r.value) as recent_avg
  FROM historical h
  FULL OUTER JOIN recent r ON h.category = r.category
  GROUP BY h.category
  ORDER BY historical_count DESC
`, [awsData, r2Data]);
```

### Partitioned Dataset Support

The plugin supports loading and querying partitioned datasets stored across multiple Parquet files, with automatic partition discovery and query optimization.

#### Loading Partitioned Datasets

```typescript
// Load a Hive-partitioned dataset
const partitionedDataset = await plugin.loadPartitionedDataset('s3://data-lake/sales', {
  authentication: { provider: 'aws', credentials: awsCredentials },
  partitionScheme: 'hive', // or 'directory', 'custom'
  partitionColumns: ['year', 'month', 'region'],
  maxPartitions: 100, // Limit number of partitions to load
  alias: 'sales_partitioned'
});

console.log(`Loaded ${partitionedDataset.totalFiles} partitions`);
console.log(`Total size: ${(partitionedDataset.totalSizeBytes / 1024 / 1024).toFixed(1)}MB`);
console.log(`Partition columns: ${partitionedDataset.partitionColumns.join(', ')}`);
```

#### Partition Discovery

```typescript
// Discover partitions automatically
const partitions = await plugin.discoverPartitions('s3://data-warehouse/events', {
  authentication: { provider: 'aws', credentials: awsCredentials },
  partitionScheme: 'hive',
  recursive: true,
  maxDepth: 3,
  filePattern: /\.parquet$/i
});

console.log(`Discovered ${partitions.length} partitions:`);
partitions.forEach(partition => {
  console.log(`- ${partition.path}`);
  console.log(`  Partition values: ${JSON.stringify(partition.partitionValues)}`);
  console.log(`  Size: ${(partition.fileSize / 1024 / 1024).toFixed(1)}MB`);
});
```

#### Filtered Partition Loading

```typescript
// Load only specific partitions using filters
const filteredDataset = await plugin.loadPartitionedDataset('s3://analytics/user-events', {
  authentication: { provider: 'aws', credentials: awsCredentials },
  partitionScheme: 'hive',
  partitionFilter: {
    column: 'year',
    operator: '>=',
    value: '2023'
  },
  unionMode: 'union_by_name', // Handle schema evolution
  alias: 'recent_events'
});
```

#### Advanced Partition Filtering

```typescript
// Multiple filter conditions
const complexDataset = await plugin.loadPartitionedDataset('s3://logs/application', {
  authentication: { provider: 'aws', credentials: awsCredentials },
  partitionScheme: 'hive',
  partitionFilter: {
    column: 'region',
    operator: 'in',
    value: ['us-east-1', 'us-west-2', 'eu-west-1']
  },
  maxPartitions: 50
});

// Query with automatic partition pruning
const regionalStats = await plugin.queryPartitioned(`
  SELECT 
    region,
    year,
    month,
    COUNT(*) as event_count,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(session_duration) as avg_session_duration
  FROM recent_events
  WHERE year = '2024'
    AND month IN ('01', '02', '03')
    AND event_type = 'page_view'
  GROUP BY region, year, month
  ORDER BY region, year, month
`, complexDataset);

console.log(`Query processed ${regionalStats.bytesProcessed} bytes across partitions`);
```

#### Directory-Based Partitioning

```typescript
// Load directory-partitioned data (e.g., /2024/01/data.parquet, /2024/02/data.parquet)
const directoryDataset = await plugin.loadPartitionedDataset('s3://timeseries/daily-metrics', {
  authentication: { provider: 'aws', credentials: awsCredentials },
  partitionScheme: 'directory',
  partitionColumns: ['year', 'month'], // Will be inferred from directory structure
  alias: 'daily_metrics'
});

// Time-series analysis query
const timeSeriesAnalysis = await plugin.queryPartitioned(`
  SELECT 
    year,
    month,
    DATE_TRUNC('week', date_column) as week,
    SUM(metric_value) as weekly_total,
    AVG(metric_value) as weekly_avg,
    MIN(metric_value) as weekly_min,
    MAX(metric_value) as weekly_max
  FROM daily_metrics
  WHERE year >= '2023'
  GROUP BY year, month, week
  ORDER BY year, month, week
`, directoryDataset);
```

#### Cross-Provider Partitioned Queries

```typescript
// Load partitioned data from multiple cloud providers
const awsPartitions = await plugin.loadPartitionedDataset('s3://archive/historical-data', {
  authentication: { provider: 'aws', credentials: awsCredentials },
  partitionScheme: 'hive',
  alias: 'historical_aws'
});

const r2Partitions = await plugin.loadPartitionedDataset('https://account.r2.cloudflarestorage.com/current-data', {
  authentication: { provider: 'cloudflare', credentials: r2Credentials },
  partitionScheme: 'hive',
  alias: 'current_r2'
});

// Compare data across providers and time periods
const crossProviderAnalysis = await plugin.query(`
  WITH historical_summary AS (
    SELECT 
      region,
      product_category,
      COUNT(*) as historical_count,
      SUM(revenue) as historical_revenue
    FROM historical_aws
    WHERE year = '2023'
    GROUP BY region, product_category
  ),
  current_summary AS (
    SELECT 
      region,
      product_category,
      COUNT(*) as current_count,
      SUM(revenue) as current_revenue
    FROM current_r2
    WHERE year = '2024'
    GROUP BY region, product_category
  )
  SELECT 
    COALESCE(h.region, c.region) as region,
    COALESCE(h.product_category, c.product_category) as product_category,
    h.historical_count,
    c.current_count,
    h.historical_revenue,
    c.current_revenue,
    CASE 
      WHEN h.historical_revenue > 0 
      THEN ((c.current_revenue - h.historical_revenue) * 100.0 / h.historical_revenue)
      ELSE NULL 
    END as revenue_growth_percent
  FROM historical_summary h
  FULL OUTER JOIN current_summary c 
    ON h.region = c.region AND h.product_category = c.product_category
  ORDER BY revenue_growth_percent DESC NULLS LAST
`, []);

console.log(`Cross-provider analysis completed: ${crossProviderAnalysis.rowCount} rows`);
```

#### Performance Optimization for Partitioned Data

```typescript
// Optimize partitioned queries with explicit partition pruning
const optimizedQuery = `
  SELECT 
    customer_segment,
    SUM(order_value) as total_revenue,
    COUNT(*) as order_count,
    AVG(order_value) as avg_order_value
  FROM sales_partitioned
  WHERE 
    -- Partition pruning: only scan relevant partitions
    year = '2024' 
    AND month IN ('01', '02', '03')
    AND region = 'us-east-1'
    -- Regular filters
    AND customer_segment IN ('premium', 'enterprise')
    AND order_value > 100
  GROUP BY customer_segment
  ORDER BY total_revenue DESC
`;

const optimizedResults = await plugin.queryPartitioned(optimizedQuery, partitionedDataset);

console.log(`Optimized query executed in ${optimizedResults.executionTime}ms`);
console.log(`Processed ${(optimizedResults.bytesProcessed / 1024 / 1024).toFixed(1)}MB`);
```

### Real-World Example: NYC Taxi Data on CloudFlare R2

The plugin has been tested and validated with the NYC Yellow Taxi dataset hosted on CloudFlare R2. This provides a real-world example of how to work with public Parquet datasets.

```typescript
// NYC Taxi Data Analysis Example
const plugin = new ParquetHttpfsPlugin();
await plugin.initialize(context);

// Load NYC taxi data from CloudFlare R2 (public dataset)
const taxiData = await plugin.loadFile(
  'https://pub-7deacab667344397ae6d3e2ea97f11f8.r2.dev/yellow_tripdata_2023-01.parquet',
  { alias: 'nyc_taxi_jan_2023' }
);

// Analyze trip patterns
const peakHours = await plugin.query(`
  SELECT 
    EXTRACT(hour FROM tpep_pickup_datetime) as hour,
    COUNT(*) as trip_count,
    AVG(fare_amount) as avg_fare
  FROM nyc_taxi_jan_2023
  WHERE tpep_pickup_datetime IS NOT NULL
  GROUP BY EXTRACT(hour FROM tpep_pickup_datetime)
  ORDER BY trip_count DESC
  LIMIT 5
`, [taxiData]);

console.log('Peak taxi hours:', peakHours.data);
```

#### Multi-Month Analysis

```typescript
// Load multiple months for comparison
const monthlyFiles = [
  'https://pub-7deacab667344397ae6d3e2ea97f11f8.r2.dev/yellow_tripdata_2023-01.parquet',
  'https://pub-7deacab667344397ae6d3e2ea97f11f8.r2.dev/yellow_tripdata_2023-06.parquet'
];

const tables = await plugin.loadMultipleFiles(monthlyFiles, {
  alias: 'taxi_comparison'
});

// Compare winter vs summer patterns
const seasonalComparison = await plugin.query(`
  SELECT 
    'January' as month,
    COUNT(*) as trips,
    AVG(trip_distance) as avg_distance,
    AVG(total_amount) as avg_fare
  FROM taxi_comparison_0
  
  UNION ALL
  
  SELECT 
    'June' as month,
    COUNT(*) as trips,
    AVG(trip_distance) as avg_distance,
    AVG(total_amount) as avg_fare
  FROM taxi_comparison_1
`, tables);

console.log('Seasonal comparison:', seasonalComparison.data);
```

#### Data Quality Assessment

```typescript
// Comprehensive data quality check
const qualityReport = await plugin.query(`
  SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN trip_distance <= 0 THEN 1 END) as invalid_distance,
    COUNT(CASE WHEN fare_amount <= 0 THEN 1 END) as invalid_fare,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_amount) as median_fare,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_amount) as p95_fare
  FROM nyc_taxi_jan_2023
  WHERE total_amount > 0
`, [taxiData]);

console.log('Data quality metrics:', qualityReport.data[0]);
```

## Configuration

```typescript
// Configure plugin settings
await plugin.configure({
  defaultTimeout: 45000,           // 45 second timeout
  maxConcurrentConnections: 8,     // Allow 8 concurrent downloads
  enableProgressReporting: true,   // Enable progress callbacks
  cacheSchema: true,               // Cache schema information
  retryAttempts: 5,                // Retry failed requests 5 times
  chunkSize: 2048 * 1024,         // 2MB streaming chunks
});
```

## Error Handling

```typescript
import { ParquetHttpfsError, AuthenticationError, ValidationError } from '@dataprism/parquet-httpfs-plugin';

try {
  const table = await plugin.loadFile('s3://restricted-bucket/data.parquet', {
    authentication: {
      provider: 'aws',
      credentials: invalidCredentials,
    },
  });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Authentication failed:', error.message);
    // Handle credential refresh or user re-authentication
  } else if (error instanceof ValidationError) {
    console.error('File validation failed:', error.message);
    // Handle invalid file format or accessibility issues  
  } else if (error instanceof ParquetHttpfsError) {
    console.error('Plugin error:', error.message, error.code);
    // Handle other plugin-specific errors
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Performance Optimization

### Memory Management

```typescript
// For large files, configure smaller chunk sizes
await plugin.configure({
  chunkSize: 512 * 1024, // 512KB chunks for memory-constrained environments
  maxConcurrentConnections: 2, // Reduce concurrency to save memory
});

// Monitor loading status
const statuses = plugin.getLoadingStatus();
statuses.forEach(status => {
  console.log(`${status.alias}: ${status.status} (${status.startTime})`);
});
```

### Query Performance

```typescript
// Use LIMIT for large datasets
const sample = await plugin.query('SELECT * FROM large_table LIMIT 1000', [table]);

// Use column selection to reduce data transfer
const summary = await plugin.query(`
  SELECT category, COUNT(*), AVG(price) 
  FROM products 
  GROUP BY category
`, [table]);

// Use WHERE clauses to filter data at source
const filtered = await plugin.query(`
  SELECT * FROM sales 
  WHERE sale_date >= '2023-01-01' 
    AND total_amount > 100
`, [table]);
```

## CloudFlare R2 Specific Features

### Jurisdiction Support

```typescript
// EU jurisdiction for European users
const euCredentials: CloudflareCredentials = {
  accountId: 'your-account-id',
  accessKeyId: 'your-access-key',
  secretAccessKey: 'your-secret-key',
  jurisdiction: 'eu',
};

// FedRAMP for US government requirements
const fedrampCredentials: CloudflareCredentials = {
  accountId: 'your-account-id',
  accessKeyId: 'your-access-key',
  secretAccessKey: 'your-secret-key',
  jurisdiction: 'fedramp-moderate',
};
```

### Worker Proxy Integration

```typescript
// Use CloudFlare Workers for enhanced security
const workerCredentials: CloudflareCredentials = {
  accountId: 'your-account-id',
  accessKeyId: 'your-worker-token',
  secretAccessKey: 'your-worker-secret',
  workerEndpoint: 'https://data-proxy.example.workers.dev',
};

const table = await plugin.loadFile('https://data-proxy.example.workers.dev/secure-data.parquet', {
  authentication: {
    provider: 'cloudflare',
    credentials: workerCredentials,
  },
});
```

## Browser Compatibility

The plugin supports modern browsers with WebAssembly and SharedArrayBuffer:

- Chrome 90+
- Firefox 88+ (with SharedArrayBuffer enabled)
- Safari 14+
- Edge 90+

### CORS Configuration

Ensure your S3/R2 buckets have proper CORS policies:

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://your-app-domain.com"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["Content-Length", "Content-Type", "ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure your bucket has proper CORS configuration
2. **Authentication Failures**: Verify credentials and permissions
3. **File Not Found**: Check URL format and file accessibility
4. **Memory Issues**: Reduce chunk size and concurrent connections
5. **Slow Performance**: Check network connectivity and file size

### Debug Mode

```typescript
// Enable detailed logging
await plugin.configure({
  enableProgressReporting: true,
});

// Monitor events
plugin.context?.eventBus.subscribe('parquet:loading-progress', (progress) => {
  console.log('Loading progress:', progress);
});

plugin.context?.eventBus.subscribe('duckdb:query-executed', (result) => {
  console.log('Query executed:', result);
});
```

## API Reference

See the [API Documentation](./docs/api-reference.md) for detailed interface definitions and method signatures.

## Examples

Check the [examples directory](./examples/) for complete working examples:

- [Basic Usage](./examples/basic-usage.ts)
- [Authentication Examples](./examples/authentication-examples.ts)
- [Advanced Queries](./examples/advanced-queries.ts)
- [Performance Optimization](./examples/performance-optimization.ts)

## Contributing

Please see the main DataPrism Plugins [Contributing Guide](../../../../CONTRIBUTING.md) for information on how to contribute to this plugin.

## License

MIT License - see [LICENSE](../../../../LICENSE) for details.