/**
 * Comprehensive example: NYC Taxi Data Analysis using CloudFlare R2
 * 
 * This example demonstrates how to use the Parquet HTTPFS Plugin to analyze
 * NYC Yellow Taxi trip data stored in CloudFlare R2 public storage.
 * 
 * Dataset: https://pub-7deacab667344397ae6d3e2ea97f11f8.r2.dev/
 * Format: yellow_tripdata_YYYY-MM.parquet
 */

import { ParquetHttpfsPlugin } from '../ParquetHttpfsPlugin.js';
import type { PartitionedDataset, QueryResult } from '../types/interfaces.js';

// Example plugin context (replace with actual DataPrism context)
const createMockContext = () => ({
  logger: {
    info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
    error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args),
    warn: (msg: string, ...args: any[]) => console.warn(`[WARN] ${msg}`, ...args),
    debug: (msg: string, ...args: any[]) => console.debug(`[DEBUG] ${msg}`, ...args)
  },
  eventBus: {
    publish: (event: string, data: any) => console.log(`[EVENT] ${event}:`, data),
    subscribe: (event: string, handler: Function) => {},
    unsubscribe: (event: string, handler: Function) => {}
  }
});

async function analyzeNYCTaxiData() {
  console.log('🚖 NYC Taxi Data Analysis with CloudFlare R2');
  console.log('===========================================');
  
  // Initialize the plugin
  const plugin = new ParquetHttpfsPlugin();
  const context = createMockContext();
  
  try {
    await plugin.initialize(context as any);
    console.log('✅ Plugin initialized successfully');
    
    // 1. Single File Analysis
    console.log('\n📊 Step 1: Single File Analysis');
    console.log('--------------------------------');
    
    const januaryFile = 'https://pub-7deacab667344397ae6d3e2ea97f11f8.r2.dev/yellow_tripdata_2023-01.parquet';
    
    // Load single file
    const januaryTable = await plugin.loadFile(januaryFile, {
      alias: 'january_2023'
    });
    
    console.log(`✅ Loaded: ${januaryTable.alias}`);
    console.log(`   File size: ${(januaryTable.schema.fileSize / 1024 / 1024).toFixed(1)}MB`);
    console.log(`   Columns: ${januaryTable.schema.columns.length}`);
    console.log(`   Schema: ${januaryTable.schema.columns.map(c => c.name).join(', ')}`);
    
    // Basic analysis query
    const monthlyStats = await plugin.query(`
      SELECT 
        COUNT(*) as total_trips,
        AVG(trip_distance) as avg_distance,
        AVG(fare_amount) as avg_fare,
        AVG(total_amount) as avg_total,
        MIN(tpep_pickup_datetime) as first_trip,
        MAX(tpep_pickup_datetime) as last_trip
      FROM january_2023
    `, [januaryTable]);
    
    console.log('📈 January 2023 Statistics:');
    console.log(`   Total trips: ${monthlyStats.data[0][0]?.toLocaleString()}`);
    console.log(`   Avg distance: ${monthlyStats.data[0][1]?.toFixed(2)} miles`);
    console.log(`   Avg fare: $${monthlyStats.data[0][2]?.toFixed(2)}`);
    console.log(`   Avg total: $${monthlyStats.data[0][3]?.toFixed(2)}`);
    
    // 2. Multiple File Analysis
    console.log('\n📊 Step 2: Multi-Month Comparison');
    console.log('----------------------------------');
    
    const multipleFiles = [
      'https://pub-7deacab667344397ae6d3e2ea97f11f8.r2.dev/yellow_tripdata_2023-01.parquet',
      'https://pub-7deacab667344397ae6d3e2ea97f11f8.r2.dev/yellow_tripdata_2023-06.parquet'
    ];
    
    const tables = await plugin.loadMultipleFiles(multipleFiles, {
      alias: 'monthly_data'
    });
    
    console.log(`✅ Loaded ${tables.length} monthly files`);
    
    // Comparative analysis
    const comparison = await plugin.query(`
      SELECT 
        'January' as month,
        COUNT(*) as trips,
        AVG(fare_amount) as avg_fare,
        SUM(total_amount) as total_revenue
      FROM monthly_data_0
      
      UNION ALL
      
      SELECT 
        'June' as month,
        COUNT(*) as trips,
        AVG(fare_amount) as avg_fare,
        SUM(total_amount) as total_revenue
      FROM monthly_data_1
      
      ORDER BY month
    `, tables);
    
    console.log('📈 Month-to-Month Comparison:');
    comparison.data.forEach(row => {
      console.log(`   ${row[0]}: ${row[1]?.toLocaleString()} trips, $${row[2]?.toFixed(2)} avg fare, $${row[3]?.toLocaleString()} total revenue`);
    });
    
    // 3. Advanced Analytics
    console.log('\n📊 Step 3: Advanced Analytics');
    console.log('------------------------------');
    
    // Peak hours analysis
    const peakHours = await plugin.query(`
      SELECT 
        EXTRACT(hour FROM tpep_pickup_datetime) as hour,
        COUNT(*) as trip_count,
        AVG(fare_amount) as avg_fare
      FROM january_2023
      WHERE tpep_pickup_datetime IS NOT NULL
      GROUP BY EXTRACT(hour FROM tpep_pickup_datetime)
      ORDER BY trip_count DESC
      LIMIT 5
    `, [januaryTable]);
    
    console.log('🕐 Peak Hours (January 2023):');
    peakHours.data.forEach((row, index) => {
      const hour = row[0];
      const count = row[1];
      const avgFare = row[2];
      console.log(`   ${index + 1}. ${hour}:00 - ${count?.toLocaleString()} trips ($${avgFare?.toFixed(2)} avg)`);
    });
    
    // Distance distribution
    const distanceAnalysis = await plugin.query(`
      SELECT 
        CASE 
          WHEN trip_distance < 1 THEN 'Short (< 1mi)'
          WHEN trip_distance < 3 THEN 'Medium (1-3mi)'
          WHEN trip_distance < 10 THEN 'Long (3-10mi)'
          ELSE 'Very Long (10+mi)'
        END as distance_category,
        COUNT(*) as trip_count,
        AVG(fare_amount) as avg_fare,
        AVG(total_amount) as avg_total
      FROM january_2023
      WHERE trip_distance > 0 AND trip_distance < 100
      GROUP BY distance_category
      ORDER BY trip_count DESC
    `, [januaryTable]);
    
    console.log('📏 Trip Distance Distribution:');
    distanceAnalysis.data.forEach(row => {
      console.log(`   ${row[0]}: ${row[1]?.toLocaleString()} trips ($${row[2]?.toFixed(2)} fare, $${row[3]?.toFixed(2)} total)`);
    });
    
    // 4. Performance Metrics
    console.log('\n📊 Step 4: Performance Analysis');
    console.log('--------------------------------');
    
    const performanceQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT DATE(tpep_pickup_datetime)) as unique_days,
        MIN(total_amount) as min_fare,
        MAX(total_amount) as max_fare,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_amount) as median_fare,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_amount) as p95_fare
      FROM january_2023
      WHERE total_amount > 0
    `;
    
    const startTime = performance.now();
    const performanceResults = await plugin.query(performanceQuery, [januaryTable]);
    const queryTime = performance.now() - startTime;
    
    console.log('⚡ Query Performance:');
    console.log(`   Execution time: ${queryTime.toFixed(2)}ms`);
    console.log(`   Records processed: ${performanceResults.data[0][0]?.toLocaleString()}`);
    console.log(`   Data coverage: ${performanceResults.data[0][1]} unique days`);
    console.log(`   Fare range: $${performanceResults.data[0][2]?.toFixed(2)} - $${performanceResults.data[0][3]?.toFixed(2)}`);
    console.log(`   Median fare: $${performanceResults.data[0][4]?.toFixed(2)}`);
    console.log(`   95th percentile: $${performanceResults.data[0][5]?.toFixed(2)}`);
    
    // 5. Data Quality Assessment
    console.log('\n📊 Step 5: Data Quality Assessment');
    console.log('-----------------------------------');
    
    const qualityCheck = await plugin.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN VendorID IS NULL THEN 1 END) as null_vendor,
        COUNT(CASE WHEN tpep_pickup_datetime IS NULL THEN 1 END) as null_pickup,
        COUNT(CASE WHEN tpep_dropoff_datetime IS NULL THEN 1 END) as null_dropoff,
        COUNT(CASE WHEN trip_distance <= 0 THEN 1 END) as invalid_distance,
        COUNT(CASE WHEN fare_amount <= 0 THEN 1 END) as invalid_fare,
        COUNT(CASE WHEN total_amount <= 0 THEN 1 END) as invalid_total
      FROM january_2023
    `, [januaryTable]);
    
    const total = qualityCheck.data[0][0];
    console.log('🔍 Data Quality Report:');
    console.log(`   Total records: ${total?.toLocaleString()}`);
    console.log(`   Null VendorID: ${qualityCheck.data[0][1]?.toLocaleString()} (${((qualityCheck.data[0][1] / total) * 100).toFixed(2)}%)`);
    console.log(`   Null pickup time: ${qualityCheck.data[0][2]?.toLocaleString()} (${((qualityCheck.data[0][2] / total) * 100).toFixed(2)}%)`);
    console.log(`   Invalid distance: ${qualityCheck.data[0][4]?.toLocaleString()} (${((qualityCheck.data[0][4] / total) * 100).toFixed(2)}%)`);
    console.log(`   Invalid fare: ${qualityCheck.data[0][5]?.toLocaleString()} (${((qualityCheck.data[0][5] / total) * 100).toFixed(2)}%)`);
    
    console.log('\n🎉 Analysis Complete!');
    console.log('=====================');
    console.log('✅ Successfully analyzed NYC Taxi data from CloudFlare R2');
    console.log('✅ Demonstrated single and multi-file processing');
    console.log('✅ Performed advanced analytics and aggregations');
    console.log('✅ Measured query performance and data quality');
    console.log('\n🚀 The Parquet HTTPFS Plugin is ready for production use with R2 data!');
    
    return true;
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    return false;
  } finally {
    await plugin.cleanup();
  }
}

// Progress monitoring example
function setupProgressMonitoring(plugin: ParquetHttpfsPlugin) {
  plugin.onProgress((progress) => {
    const percent = progress.percentComplete.toFixed(1);
    console.log(`📈 Loading ${progress.alias}: ${percent}% (${progress.phase})`);
    
    if (progress.bytesLoaded && progress.totalBytes) {
      const loaded = (progress.bytesLoaded / 1024 / 1024).toFixed(1);
      const total = (progress.totalBytes / 1024 / 1024).toFixed(1);
      console.log(`   Data: ${loaded}MB / ${total}MB`);
    }
    
    if (progress.error) {
      console.error(`   Error: ${progress.error}`);
    }
  });
}

// Export for use in other examples
export { analyzeNYCTaxiData, setupProgressMonitoring };

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeNYCTaxiData()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Example execution failed:', error);
      process.exit(1);
    });
}