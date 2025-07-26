/**
 * Authentication Examples - Parquet HTTPFS Plugin
 * 
 * This example demonstrates various authentication scenarios:
 * - AWS S3 with access keys
 * - AWS S3 with STS temporary credentials
 * - CloudFlare R2 with different jurisdictions
 * - CloudFlare R2 with custom domains
 * - CloudFlare R2 with Worker proxy
 */

import { ParquetHttpfsPlugin } from '../ParquetHttpfsPlugin.js';
import type { AWSCredentials, CloudflareCredentials } from '../types/interfaces.js';
import type { PluginContext } from '../../../types/index.js';

// Create mock context for examples
function createMockContext(): PluginContext {
  return {
    pluginName: 'ParquetHttpfsPlugin',
    coreVersion: '1.0.0',
    services: {
      call: async (service: string, method: string, ...args: any[]) => {
        if (service === 'duckdb' && method === 'getConnection') {
          return { query: async (sql: string) => ({ data: [], columns: [] }) };
        }
        if (service === 'duckdb' && method === 'query') {
          return { data: [['auth-test']], columns: ['test_column'] };
        }
        return null;
      },
      hasPermission: () => true,
    },
    eventBus: {
      publish: (event: string, data: any) => console.log('📢 Event:', event),
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
}

// Mock successful fetch responses
function setupMockFetch() {
  globalThis.fetch = async (url: string | URL, init?: RequestInit) => {
    console.log(`🌐 Mocked fetch: ${url}`);
    return {
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          if (name === 'content-length') return '2097152'; // 2MB
          if (name === 'content-type') return 'application/octet-stream';
          if (name === 'etag') return '"abc123"';
          return null;
        }
      }
    } as Response;
  };
}

// Example 1: AWS S3 with standard access keys
async function awsBasicAuthExample() {
  console.log('\n🔐 AWS S3 Basic Authentication Example');
  
  const plugin = new ParquetHttpfsPlugin();
  await plugin.initialize(createMockContext());
  
  try {
    const awsCredentials: AWSCredentials = {
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      region: 'us-east-1',
    };

    console.log('📂 Loading S3 file with access key authentication...');
    const table = await plugin.loadFile('https://my-private-bucket.s3.amazonaws.com/sales-data.parquet', {
      authentication: {
        provider: 'aws',
        credentials: awsCredentials,
      },
      alias: 'aws_sales_data',
    });

    console.log('✅ AWS S3 file loaded successfully');
    console.log(`   - Table alias: ${table.alias}`);
    console.log(`   - Provider: ${table.provider}`);

    // Test query
    const result = await plugin.query('SELECT COUNT(*) as total_rows FROM aws_sales_data', [table]);
    console.log(`   - Query result: ${result.rowCount} rows returned`);

  } catch (error) {
    console.error('❌ AWS basic auth error:', error);
  } finally {
    await plugin.cleanup();
  }
}

// Example 2: AWS S3 with STS temporary credentials
async function awsSTSAuthExample() {
  console.log('\n🔐 AWS S3 STS Temporary Credentials Example');
  
  const plugin = new ParquetHttpfsPlugin();
  await plugin.initialize(createMockContext());
  
  try {
    const stsCredentials: AWSCredentials = {
      accessKeyId: 'ASIAINODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      sessionToken: 'AQoEXAMPLEH4aoAH0gNCAPyJxz4BlCFFxWNE1OPTgk5TthT+FvwqnKwRcOIfrRh3c/LTo6UDdyJwOOvEVPvLXCrrrUtdnniCEXAMPLE/IvU1dYUg2RVAJBanLiHb4IgRmpRV3zrkuWJOgQs8IZZaIv2BXIa2R4OlgkBN9bkUDNCJiBeb/AXlzBBko7b15fjrBs2+cTQtpZ3CYWFXG8C5zqx37wnOE49mRl/+OtkIKGO7fAE',
      region: 'us-west-2',
    };

    console.log('📂 Loading S3 file with STS credentials...');
    const table = await plugin.loadFile('https://secure-bucket.s3.us-west-2.amazonaws.com/confidential.parquet', {
      authentication: {
        provider: 'aws',
        credentials: stsCredentials,
      },
      alias: 'secure_data',
    });

    console.log('✅ AWS S3 file loaded with STS credentials');
    console.log(`   - Session token used: ${stsCredentials.sessionToken ? 'Yes' : 'No'}`);
    console.log(`   - Region: ${stsCredentials.region}`);

  } catch (error) {
    console.error('❌ AWS STS auth error:', error);
  } finally {
    await plugin.cleanup();
  }
}

// Example 3: CloudFlare R2 basic authentication
async function cloudflareR2BasicExample() {
  console.log('\n🔐 CloudFlare R2 Basic Authentication Example');
  
  const plugin = new ParquetHttpfsPlugin();
  await plugin.initialize(createMockContext());
  
  try {
    const r2Credentials: CloudflareCredentials = {
      accountId: 'your-account-id-here',
      accessKeyId: 'your-r2-access-key-id',
      secretAccessKey: 'your-r2-secret-access-key',
      jurisdiction: 'auto',
    };

    console.log('📂 Loading CloudFlare R2 file...');
    const table = await plugin.loadFile('https://your-account.r2.cloudflarestorage.com/data-bucket/analytics.parquet', {
      authentication: {
        provider: 'cloudflare',
        credentials: r2Credentials,
      },
      alias: 'r2_analytics',
    });

    console.log('✅ CloudFlare R2 file loaded successfully');
    console.log(`   - Jurisdiction: ${r2Credentials.jurisdiction}`);
    console.log(`   - Account ID: ${r2Credentials.accountId}`);

  } catch (error) {
    console.error('❌ CloudFlare R2 basic auth error:', error);
  } finally {
    await plugin.cleanup();
  }
}

// Example 4: CloudFlare R2 with EU jurisdiction
async function cloudflareR2EUExample() {
  console.log('\n🔐 CloudFlare R2 EU Jurisdiction Example');
  
  const plugin = new ParquetHttpfsPlugin();
  await plugin.initialize(createMockContext());
  
  try {
    const euR2Credentials: CloudflareCredentials = {
      accountId: 'eu-account-id',
      accessKeyId: 'eu-r2-access-key',
      secretAccessKey: 'eu-r2-secret-key',
      jurisdiction: 'eu', // Force EU data location compliance
    };

    console.log('📂 Loading CloudFlare R2 file from EU jurisdiction...');
    const table = await plugin.loadFile('https://eu-account.r2-eu.cloudflarestorage.com/gdpr-data/user-analytics.parquet', {
      authentication: {
        provider: 'cloudflare',
        credentials: euR2Credentials,
      },
      alias: 'eu_user_data',
    });

    console.log('✅ CloudFlare R2 EU file loaded successfully');
    console.log(`   - Jurisdiction: ${euR2Credentials.jurisdiction} (GDPR compliant)`);
    console.log('   - Data remains in EU for compliance');

  } catch (error) {
    console.error('❌ CloudFlare R2 EU auth error:', error);
  } finally {
    await plugin.cleanup();
  }
}

// Example 5: CloudFlare R2 with custom domain
async function cloudflareR2CustomDomainExample() {
  console.log('\n🔐 CloudFlare R2 Custom Domain Example');
  
  const plugin = new ParquetHttpfsPlugin();
  await plugin.initialize(createMockContext());
  
  try {
    const customDomainCredentials: CloudflareCredentials = {
      accountId: 'company-account-id',
      accessKeyId: 'company-r2-key',
      secretAccessKey: 'company-r2-secret',
      customDomain: 'data.company.com', // Branded domain
    };

    console.log('📂 Loading file from custom domain...');
    const table = await plugin.loadFile('https://data.company.com/reports/quarterly-sales.parquet', {
      authentication: {
        provider: 'cloudflare',
        credentials: customDomainCredentials,
      },
      alias: 'quarterly_sales',
    });

    console.log('✅ File loaded from custom domain');
    console.log(`   - Custom domain: ${customDomainCredentials.customDomain}`);
    console.log('   - Branded URL for professional appearance');

  } catch (error) {
    console.error('❌ CloudFlare R2 custom domain error:', error);
  } finally {
    await plugin.cleanup();
  }
}

// Example 6: CloudFlare R2 with Worker proxy
async function cloudflareR2WorkerProxyExample() {
  console.log('\n🔐 CloudFlare R2 Worker Proxy Example');
  
  const plugin = new ParquetHttpfsPlugin();
  await plugin.initialize(createMockContext());
  
  try {
    const workerProxyCredentials: CloudflareCredentials = {
      accountId: 'secure-account-id',
      accessKeyId: 'worker-proxy-token',
      secretAccessKey: 'worker-proxy-secret',
      workerEndpoint: 'https://secure-data-proxy.company.workers.dev',
    };

    console.log('📂 Loading file through CloudFlare Worker proxy...');
    const table = await plugin.loadFile('https://secure-data-proxy.company.workers.dev/sensitive/hr-data.parquet', {
      authentication: {
        provider: 'cloudflare',
        credentials: workerProxyCredentials,
      },
      alias: 'secure_hr_data',
    });

    console.log('✅ File loaded through Worker proxy');
    console.log(`   - Worker endpoint: ${workerProxyCredentials.workerEndpoint}`);
    console.log('   - Enhanced security through serverless proxy');

  } catch (error) {
    console.error('❌ CloudFlare Worker proxy error:', error);
  } finally {
    await plugin.cleanup();
  }
}

// Example 7: Cross-provider data integration
async function crossProviderExample() {
  console.log('\n🔐 Cross-Provider Data Integration Example');
  
  const plugin = new ParquetHttpfsPlugin();
  await plugin.initialize(createMockContext());
  
  try {
    // AWS credentials
    const awsCredentials: AWSCredentials = {
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      region: 'us-east-1',
    };

    // CloudFlare R2 credentials
    const r2Credentials: CloudflareCredentials = {
      accountId: 'r2-account-id',
      accessKeyId: 'r2-access-key',
      secretAccessKey: 'r2-secret-key',
      jurisdiction: 'auto',
    };

    console.log('📂 Loading historical data from AWS S3...');
    const historicalData = await plugin.loadFile('https://data-archive.s3.amazonaws.com/historical/2022-sales.parquet', {
      authentication: {
        provider: 'aws',
        credentials: awsCredentials,
      },
      alias: 'historical_sales',
    });

    console.log('📂 Loading recent data from CloudFlare R2...');
    const recentData = await plugin.loadFile('https://account.r2.cloudflarestorage.com/current/2023-sales.parquet', {
      authentication: {
        provider: 'cloudflare',
        credentials: r2Credentials,
      },
      alias: 'recent_sales',
    });

    console.log('🔍 Performing cross-provider analysis...');
    const crossProviderQuery = `
      SELECT 
        'Historical' as data_source,
        COUNT(*) as record_count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount
      FROM historical_sales
      
      UNION ALL
      
      SELECT 
        'Recent' as data_source,
        COUNT(*) as record_count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount
      FROM recent_sales
    `;

    const result = await plugin.query(crossProviderQuery, [historicalData, recentData]);
    
    console.log('✅ Cross-provider analysis completed');
    console.log(`   - Combined analysis of ${result.rowCount} data sources`);
    console.log('   - AWS S3 (historical) + CloudFlare R2 (recent)');

  } catch (error) {
    console.error('❌ Cross-provider integration error:', error);
  } finally {
    await plugin.cleanup();
  }
}

// Example 8: Authentication error handling
async function authErrorHandlingExample() {
  console.log('\n🔐 Authentication Error Handling Example');
  
  const plugin = new ParquetHttpfsPlugin();
  await plugin.initialize(createMockContext());
  
  try {
    // Example with invalid credentials
    const invalidCredentials: AWSCredentials = {
      accessKeyId: 'INVALID_KEY',
      secretAccessKey: 'INVALID_SECRET',
      region: 'us-east-1',
    };

    console.log('📂 Attempting to load file with invalid credentials...');
    
    try {
      await plugin.loadFile('https://private-bucket.s3.amazonaws.com/data.parquet', {
        authentication: {
          provider: 'aws',
          credentials: invalidCredentials,
        },
        alias: 'invalid_auth_test',
      });
    } catch (authError: any) {
      console.log('⚠️ Expected authentication error caught:');
      console.log(`   - Error type: ${authError.constructor.name}`);
      console.log(`   - Message: ${authError.message}`);
      
      // Handle different types of authentication errors
      if (authError.code === 'AUTHENTICATION_ERROR') {
        console.log('   - Action: Refresh credentials and retry');
      } else if (authError.code === 'VALIDATION_ERROR') {
        console.log('   - Action: Check file URL and format');
      } else {
        console.log('   - Action: Check network connectivity');
      }
    }

    // Example with credential refresh
    console.log('\n🔄 Credential refresh example...');
    
    const validCredentials: AWSCredentials = {
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      region: 'us-east-1',
    };

    // Set valid credentials
    plugin.setCredentials('aws', validCredentials);
    
    // Attempt refresh
    await plugin.refreshCredentials('aws');
    console.log('✅ Credentials refreshed successfully');

  } catch (error) {
    console.error('❌ Auth error handling example error:', error);
  } finally {
    await plugin.cleanup();
  }
}

// Run all authentication examples
async function runAllAuthExamples() {
  console.log('🎯 DataPrism Parquet HTTPFS Plugin - Authentication Examples\n');
  
  // Set up mock fetch for all examples
  setupMockFetch();
  
  await awsBasicAuthExample();
  await awsSTSAuthExample();
  await cloudflareR2BasicExample();
  await cloudflareR2EUExample();
  await cloudflareR2CustomDomainExample();
  await cloudflareR2WorkerProxyExample();
  await crossProviderExample();
  await authErrorHandlingExample();
  
  console.log('\n🎉 All authentication examples completed!');
  console.log('\n📝 Notes:');
  console.log('   - Replace example credentials with your actual credentials');
  console.log('   - Ensure proper CORS configuration on your buckets');
  console.log('   - Test with small files first before processing large datasets');
  console.log('   - Monitor authentication token expiration for STS credentials');
}

// Export for use in other examples or applications
export {
  awsBasicAuthExample,
  awsSTSAuthExample,
  cloudflareR2BasicExample,
  cloudflareR2EUExample,
  cloudflareR2CustomDomainExample,
  cloudflareR2WorkerProxyExample,
  crossProviderExample,
  authErrorHandlingExample,
  runAllAuthExamples
};

// Run if this file is executed directly
if (import.meta.url === new URL(import.meta.resolve('./authentication-examples.ts')).href) {
  runAllAuthExamples().catch(console.error);
}