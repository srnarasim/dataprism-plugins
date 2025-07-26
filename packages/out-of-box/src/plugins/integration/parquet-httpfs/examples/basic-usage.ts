/**
 * Basic Usage Example - Parquet HTTPFS Plugin
 * 
 * This example demonstrates the fundamental operations of the Parquet HTTPFS plugin:
 * - Plugin initialization
 * - Loading public Parquet files
 * - Basic querying
 * - Schema introspection
 */

import { ParquetHttpfsPlugin } from '../ParquetHttpfsPlugin.js';
import type { PluginContext } from '../../../types/index.js';

// Example: Basic plugin setup and usage
async function basicUsageExample() {
  console.log('🚀 DataPrism Parquet HTTPFS Plugin - Basic Usage Example');
  
  // Initialize the plugin with mock context
  // In a real application, this context would be provided by DataPrism Core
  const mockContext: PluginContext = {
    pluginName: 'ParquetHttpfsPlugin',
    coreVersion: '1.0.0',
    services: {
      call: async (service: string, method: string, ...args: any[]) => {
        // Mock DuckDB service calls
        if (service === 'duckdb' && method === 'getConnection') {
          return { query: async (sql: string) => ({ data: [], columns: [] }) };
        }
        if (service === 'duckdb' && method === 'query') {
          return { data: [['Sample data']], columns: ['sample_column'] };
        }
        return null;
      },
      hasPermission: () => true,
    },
    eventBus: {
      publish: (event: string, data: any) => console.log('📢 Event:', event, data),
      subscribe: () => ({ unsubscribe: () => {} }),
      unsubscribe: () => {},
      once: () => ({ unsubscribe: () => {} }),
    },
    logger: {
      debug: (...args) => console.log('🔍 DEBUG:', ...args),
      info: (...args) => console.log('ℹ️ INFO:', ...args),
      warn: (...args) => console.warn('⚠️ WARN:', ...args),
      error: (...args) => console.error('❌ ERROR:', ...args),
    },
    config: {},
    resources: {
      maxMemoryMB: 4000,
      maxCpuPercent: 80,
      maxExecutionTime: 30000,
    },
  };

  const plugin = new ParquetHttpfsPlugin();

  try {
    // Step 1: Initialize the plugin
    console.log('\n📦 Step 1: Initializing plugin...');
    await plugin.initialize(mockContext);
    console.log('✅ Plugin initialized successfully');

    // Step 2: Load a public Parquet file
    console.log('\n📂 Step 2: Loading public Parquet file...');
    const publicFileUrl = 'https://example-public-bucket.s3.amazonaws.com/sample-data.parquet';
    
    // Mock successful fetch response for public file
    globalThis.fetch = async (url: string | URL, init?: RequestInit) => {
      return {
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => {
            if (name === 'content-length') return '1048576'; // 1MB
            if (name === 'content-type') return 'application/octet-stream';
            return null;
          }
        }
      } as Response;
    };

    const tableRef = await plugin.loadFile(publicFileUrl, {
      alias: 'sample_data'
    });

    console.log('✅ File loaded successfully:');
    console.log(`   - Alias: ${tableRef.alias}`);
    console.log(`   - URL: ${tableRef.url}`);
    console.log(`   - Loaded at: ${tableRef.loadedAt}`);

    // Step 3: Query the loaded data
    console.log('\n🔍 Step 3: Querying the data...');
    const queryResult = await plugin.query('SELECT * FROM sample_data LIMIT 10', [tableRef]);
    
    console.log('✅ Query executed successfully:');
    console.log(`   - Rows returned: ${queryResult.rowCount}`);
    console.log(`   - Columns: ${queryResult.columns.join(', ')}`);
    console.log(`   - Execution time: ${queryResult.executionTime.toFixed(2)}ms`);
    console.log(`   - Bytes processed: ${queryResult.bytesProcessed}`);

    // Step 4: Schema introspection
    console.log('\n📋 Step 4: Inspecting schema...');
    const schema = await plugin.getSchema(publicFileUrl);
    
    console.log('✅ Schema retrieved:');
    console.log(`   - File size: ${(schema.fileSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - Estimated rows: ${schema.rowCount || 'Unknown'}`);
    console.log(`   - Columns: ${schema.columns.length}`);
    
    if (schema.columns.length > 0) {
      console.log('   - Column details:');
      schema.columns.forEach((col, index) => {
        console.log(`     ${index + 1}. ${col.name} (${col.type})`);
      });
    }

    // Step 5: File validation
    console.log('\n✅ Step 5: Validating file...');
    const validation = await plugin.validateFile(publicFileUrl);
    
    console.log('✅ Validation completed:');
    console.log(`   - Valid: ${validation.isValid}`);
    console.log(`   - Errors: ${validation.errors.length}`);
    console.log(`   - Warnings: ${validation.warnings.length}`);
    
    if (validation.warnings.length > 0) {
      console.log('   - Warnings:');
      validation.warnings.forEach((warning, index) => {
        console.log(`     ${index + 1}. ${warning}`);
      });
    }

    // Step 6: Get plugin information
    console.log('\n📊 Step 6: Plugin information...');
    const manifest = plugin.getManifest();
    const capabilities = plugin.getCapabilities();
    
    console.log('✅ Plugin details:');
    console.log(`   - Name: ${manifest.name}`);
    console.log(`   - Version: ${manifest.version}`);
    console.log(`   - Description: ${manifest.description}`);
    console.log(`   - Capabilities: ${capabilities.length}`);
    
    capabilities.forEach((cap, index) => {
      console.log(`     ${index + 1}. ${cap.name} - ${cap.description}`);
    });

  } catch (error) {
    console.error('❌ Error during basic usage example:', error);
  } finally {
    // Step 7: Cleanup
    console.log('\n🧹 Step 7: Cleaning up...');
    await plugin.cleanup();
    console.log('✅ Cleanup completed');
  }
}

// Example: Loading multiple files
async function multipleFilesExample() {
  console.log('\n🚀 Multiple Files Example');
  
  const plugin = new ParquetHttpfsPlugin();
  // ... (initialization code similar to above)
  
  try {
    const urls = [
      'https://example-bucket.s3.amazonaws.com/data1.parquet',
      'https://example-bucket.s3.amazonaws.com/data2.parquet',
      'https://example-bucket.s3.amazonaws.com/data3.parquet',
    ];

    console.log('📂 Loading multiple files...');
    const tables = await plugin.loadMultipleFiles(urls, {
      alias: 'batch_data'
    });

    console.log(`✅ Loaded ${tables.length} files:`);
    tables.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.alias} from ${table.url}`);
    });

    // Query across multiple tables
    const unionQuery = `
      SELECT 'file1' as source, * FROM batch_data_0 LIMIT 5
      UNION ALL
      SELECT 'file2' as source, * FROM batch_data_1 LIMIT 5
      UNION ALL
      SELECT 'file3' as source, * FROM batch_data_2 LIMIT 5
    `;

    const result = await plugin.query(unionQuery, tables);
    console.log(`✅ Union query returned ${result.rowCount} rows`);

  } catch (error) {
    console.error('❌ Error in multiple files example:', error);
  } finally {
    await plugin.cleanup();
  }
}

// Example: Progress monitoring
async function progressMonitoringExample() {
  console.log('\n🚀 Progress Monitoring Example');
  
  const plugin = new ParquetHttpfsPlugin();
  // ... (initialization code)
  
  try {
    // Set up progress monitoring
    plugin.onProgress((progress) => {
      const percentage = progress.percentComplete.toFixed(1);
      console.log(`📊 Progress: ${progress.alias} - ${percentage}% (${progress.phase})`);
      
      if (progress.bytesLoaded && progress.totalBytes) {
        const loaded = (progress.bytesLoaded / 1024 / 1024).toFixed(1);
        const total = (progress.totalBytes / 1024 / 1024).toFixed(1);
        console.log(`   Data: ${loaded}MB / ${total}MB`);
      }
      
      if (progress.error) {
        console.error(`   Error: ${progress.error}`);
      }
    });

    console.log('📂 Loading file with progress monitoring...');
    const table = await plugin.loadFile('https://example-bucket.s3.amazonaws.com/large-file.parquet', {
      alias: 'monitored_data'
    });

    console.log('✅ File loaded with progress tracking');
    
    // Check final loading status
    const statuses = plugin.getLoadingStatus();
    console.log(`📋 Final status: ${statuses.length} operations tracked`);
    statuses.forEach(status => {
      const duration = status.endTime 
        ? `${status.endTime.getTime() - status.startTime.getTime()}ms`
        : 'ongoing';
      console.log(`   ${status.alias}: ${status.status} (${duration})`);
    });

  } catch (error) {
    console.error('❌ Error in progress monitoring example:', error);
  } finally {
    await plugin.cleanup();
  }
}

// Run examples
async function runAllExamples() {
  console.log('🎯 DataPrism Parquet HTTPFS Plugin - Basic Usage Examples\n');
  
  await basicUsageExample();
  await multipleFilesExample();
  await progressMonitoringExample();
  
  console.log('\n🎉 All basic examples completed!');
}

// Export for use in other examples or applications
export {
  basicUsageExample,
  multipleFilesExample,
  progressMonitoringExample,
  runAllExamples
};

// Run if this file is executed directly
if (import.meta.url === new URL(import.meta.resolve('./basic-usage.ts')).href) {
  runAllExamples().catch(console.error);
}