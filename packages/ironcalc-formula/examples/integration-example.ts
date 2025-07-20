/**
 * Advanced IronCalc Plugin Integration Example
 * Demonstrates complex dataset processing and bulk operations
 */
import { IronCalcFormulaPlugin } from '../ts/ironcalc-plugin.js';
import type { Dataset, PluginContext } from '../ts/mock-plugins.js';

// Mock plugin context for standalone example
const mockContext: PluginContext = {
  pluginName: 'ironcalc-formula-engine',
  coreVersion: '1.0.0',
  services: {} as any,
  eventBus: {} as any,
  logger: {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error
  },
  config: {},
  resources: {
    maxMemoryMB: 512,
    maxCpuPercent: 80,
    maxExecutionTime: 30000
  }
};

async function demonstrateFormulaEvaluation() {
  console.log('=== Formula Evaluation Demo ===');
  
  const plugin = new IronCalcFormulaPlugin();
  await plugin.initialize(mockContext);
  await plugin.activate();

  try {
    // Basic arithmetic
    console.log('\\n1. Basic Arithmetic:');
    const arithmetic = await plugin.execute('evaluateFormula', {
      formula: '=1+2*3-4/2',
      sheet: 'Sheet1',
      row: 1,
      col: 1
    });
    console.log(`  =1+2*3-4/2 → ${arithmetic.value} (${arithmetic.execution_time_ms}ms)`);

    // Excel functions
    console.log('\\n2. Excel Functions:');
    const functions = [
      { formula: '=SUM(1,2,3,4,5)', expected: 'Sum of 1-5' },
      { formula: '=AVERAGE(10,20,30,40)', expected: 'Average of values' },
      { formula: '=MAX(15,7,23,11)', expected: 'Maximum value' },
      { formula: '=MIN(15,7,23,11)', expected: 'Minimum value' },
      { formula: '=IF(5>3,"Greater","Lesser")', expected: 'Conditional logic' }
    ];

    for (const { formula, expected } of functions) {
      const result = await plugin.execute('evaluateFormula', {
        formula,
        sheet: 'Sheet1',
        row: 1,
        col: 1
      });
      console.log(`  ${formula} → ${result.value} (${expected})`);
    }

    // Error handling
    console.log('\\n3. Error Handling:');
    const errorFormulas = [
      '=1/0',
      '=UNKNOWN_FUNC()',
      '=IF()'
    ];

    for (const formula of errorFormulas) {
      const result = await plugin.execute('evaluateFormula', {
        formula,
        sheet: 'Sheet1',
        row: 1,
        col: 1
      });
      console.log(`  ${formula} → ${result.error || result.value} (Error handling)`);
    }

  } catch (error) {
    console.error('Error in formula evaluation:', error);
  } finally {
    await plugin.cleanup();
  }
}

async function demonstrateBulkOperations() {
  console.log('\\n=== Bulk Operations Demo ===');
  
  const plugin = new IronCalcFormulaPlugin();
  await plugin.initialize(mockContext);
  await plugin.activate();

  try {
    // Prepare bulk formulas
    const bulkFormulas = [
      { formula: '=SUM(1,2,3)', sheet: 'Sheet1', row: 1, col: 1 },
      { formula: '=AVERAGE(4,5,6)', sheet: 'Sheet1', row: 2, col: 1 },
      { formula: '=MAX(7,8,9)', sheet: 'Sheet1', row: 3, col: 1 },
      { formula: '=MIN(10,11,12)', sheet: 'Sheet1', row: 4, col: 1 },
      { formula: '=IF(13>10,"High","Low")', sheet: 'Sheet1', row: 5, col: 1 }
    ];

    console.log(`\\nProcessing ${bulkFormulas.length} formulas in bulk...`);
    const startTime = performance.now();
    
    const results = await plugin.execute('bulkEvaluate', { formulas: bulkFormulas });
    
    const endTime = performance.now();
    console.log(`Bulk processing completed in ${(endTime - startTime).toFixed(2)}ms`);

    results.forEach((result: any, index: number) => {
      console.log(`  ${bulkFormulas[index].formula} → ${result.value} (${result.execution_time_ms}ms)`);
    });

    // Large scale bulk test
    console.log('\\n4. Large Scale Processing:');
    const largeBulk = Array.from({ length: 100 }, (_, i) => ({
      formula: `=SUM(${i},${i+1},${i+2})`,
      sheet: 'Sheet1',
      row: i + 1,
      col: 1
    }));

    const largeStartTime = performance.now();
    const largeResults = await plugin.execute('bulkEvaluate', { formulas: largeBulk });
    const largeEndTime = performance.now();

    console.log(`  Processed ${largeResults.length} formulas in ${(largeEndTime - largeStartTime).toFixed(2)}ms`);
    console.log(`  Average: ${((largeEndTime - largeStartTime) / largeResults.length).toFixed(2)}ms per formula`);

  } catch (error) {
    console.error('Error in bulk operations:', error);
  } finally {
    await plugin.cleanup();
  }
}

async function demonstrateDatasetProcessing() {
  console.log('\\n=== Dataset Processing Demo ===');
  
  const plugin = new IronCalcFormulaPlugin();
  await plugin.initialize(mockContext);
  await plugin.activate();

  try {
    // Sample sales dataset with formula columns
    const salesDataset: Dataset = {
      id: 'sales-analysis',
      name: 'Q4 Sales Analysis',
      schema: {
        fields: [
          { name: 'product', type: 'string', nullable: false },
          { name: 'quantity', type: 'number', nullable: false },
          { name: 'unit_price', type: 'number', nullable: false },
          { name: 'tax_rate', type: 'number', nullable: false },
          { 
            name: 'subtotal', 
            type: 'number', 
            nullable: false,
            description: 'formula:=[quantity]*[unit_price]'
          },
          { 
            name: 'tax_amount', 
            type: 'number', 
            nullable: false,
            description: 'formula:=[subtotal]*[tax_rate]'
          },
          { 
            name: 'total', 
            type: 'number', 
            nullable: false,
            description: 'formula:=[subtotal]+[tax_amount]'
          },
          {
            name: 'discount',
            type: 'number',
            nullable: false,
            description: 'formula:=IF([total]>1000,[total]*0.1,IF([total]>500,[total]*0.05,0))'
          },
          {
            name: 'final_amount',
            type: 'number',
            nullable: false,
            description: 'formula:=[total]-[discount]'
          }
        ]
      },
      data: [
        { product: 'Laptop', quantity: 2, unit_price: 1200, tax_rate: 0.08 },
        { product: 'Mouse', quantity: 10, unit_price: 25, tax_rate: 0.08 },
        { product: 'Keyboard', quantity: 5, unit_price: 80, tax_rate: 0.08 },
        { product: 'Monitor', quantity: 3, unit_price: 350, tax_rate: 0.08 },
        { product: 'Webcam', quantity: 1, unit_price: 150, tax_rate: 0.08 }
      ],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        size: 5
      }
    };

    console.log('\\nProcessing sales dataset with formula columns...');
    console.log('Input data:', JSON.stringify(salesDataset.data, null, 2));

    const startTime = performance.now();
    const processedDataset = await plugin.process(salesDataset);
    const endTime = performance.now();

    console.log(`\\nDataset processed in ${(endTime - startTime).toFixed(2)}ms`);
    console.log('Processed data:', JSON.stringify(processedDataset.data, null, 2));

    // Validate processing
    const validation = await plugin.validate(salesDataset);
    console.log('\\nValidation Results:');
    console.log(`  Valid: ${validation.isValid}`);
    console.log(`  Errors: ${validation.errors.length}`);
    console.log(`  Warnings: ${validation.warnings.length}`);
    console.log(`  Data Quality: ${validation.summary.dataQuality}`);

  } catch (error) {
    console.error('Error in dataset processing:', error);
  } finally {
    await plugin.cleanup();
  }
}

async function demonstratePerformanceMonitoring() {
  console.log('\\n=== Performance Monitoring Demo ===');
  
  const plugin = new IronCalcFormulaPlugin();
  await plugin.initialize(mockContext);
  await plugin.activate();

  try {
    // Perform various operations to generate metrics
    console.log('\\nExecuting operations for performance analysis...');
    
    for (let i = 0; i < 50; i++) {
      await plugin.execute('evaluateFormula', {
        formula: `=SUM(${i},${i+1},${i+2},${i+3})`,
        sheet: 'Sheet1',
        row: i + 1,
        col: 1
      });
    }

    // Get performance metrics
    const metrics = plugin.getPerformanceMetrics();
    
    console.log('\\nPerformance Metrics:');
    console.log(`  Average Processing Time: ${metrics.averageProcessingTime.toFixed(2)}ms`);
    console.log(`  Total Operations: ${metrics.throughput}`);
    console.log(`  Memory Usage: ${Math.round(metrics.memoryUsage / 1024 / 1024)}MB`);
    console.log(`  Success Rate: ${(metrics.successRate * 100).toFixed(1)}%`);
    console.log(`  Last Updated: ${metrics.lastUpdated}`);

    // Test memory management
    console.log('\\n6. Cache Management:');
    console.log('Clearing cache...');
    await plugin.execute('clearCache', {});
    console.log('Cache cleared successfully');

  } catch (error) {
    console.error('Error in performance monitoring:', error);
  } finally {
    await plugin.cleanup();
  }
}

async function demonstrateAdvancedFeatures() {
  console.log('\\n=== Advanced Features Demo ===');
  
  const plugin = new IronCalcFormulaPlugin();
  await plugin.initialize(mockContext);
  await plugin.activate();

  try {
    // Sheet management
    console.log('\\n7. Sheet Operations:');
    await plugin.execute('createSheet', { name: 'AdvancedSheet' });
    console.log('Created new sheet: AdvancedSheet');

    // Cell operations
    await plugin.execute('setCellValue', {
      sheet: 'AdvancedSheet',
      row: 1,
      col: 1,
      value: '100'
    });

    const cellValue = await plugin.execute('getCellValue', {
      sheet: 'AdvancedSheet',
      row: 1,
      col: 1
    });
    console.log(`Cell A1 value: ${cellValue}`);

    // Configuration changes
    console.log('\\n8. Dynamic Configuration:');
    await plugin.configure({
      calculationTimeout: 15000,
      maxCells: 50000,
      logLevel: 'debug'
    });
    console.log('Plugin reconfigured with new settings');

    // Plugin capabilities
    console.log('\\n9. Plugin Capabilities:');
    const capabilities = plugin.getCapabilities();
    capabilities.forEach(cap => {
      console.log(`  - ${cap.name}: ${cap.description}`);
    });

  } catch (error) {
    console.error('Error in advanced features:', error);
  } finally {
    await plugin.cleanup();
  }
}

// Main execution
async function runAllDemos() {
  console.log('🧮 IronCalc Formula Engine Plugin - Integration Demo');
  console.log('==================================================');

  try {
    await demonstrateFormulaEvaluation();
    await demonstrateBulkOperations();
    await demonstrateDatasetProcessing();
    await demonstratePerformanceMonitoring();
    await demonstrateAdvancedFeatures();

    console.log('\\n✅ All demos completed successfully!');
    console.log('\\nThe IronCalc plugin demonstrates:');
    console.log('  - Excel-compatible formula evaluation');
    console.log('  - High-performance bulk processing');  
    console.log('  - Intelligent dataset processing');
    console.log('  - Comprehensive error handling');
    console.log('  - Performance monitoring and optimization');
    console.log('  - Advanced sheet and cell operations');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Export for module usage or run directly
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    demonstrateFormulaEvaluation,
    demonstrateBulkOperations,
    demonstrateDatasetProcessing,
    demonstratePerformanceMonitoring,
    demonstrateAdvancedFeatures,
    runAllDemos
  };
} else {
  // Run demos if executed directly
  runAllDemos().catch(console.error);
}