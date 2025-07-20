# IronCalc Formula Engine Plugin - API Reference

Complete API documentation for the IronCalc Formula Engine plugin for DataPrism.

## Table of Contents

- [Plugin Interface](#plugin-interface)
- [Core Operations](#core-operations)  
- [Data Processing](#data-processing)
- [Configuration](#configuration)
- [Error Types](#error-types)
- [Type Definitions](#type-definitions)
- [Examples](#examples)

## Plugin Interface

### IronCalcFormulaPlugin

Main plugin class implementing both `IDataProcessorPlugin` and `IIntegrationPlugin` interfaces.

```typescript
class IronCalcFormulaPlugin implements IDataProcessorPlugin, IIntegrationPlugin
```

#### Constructor

```typescript
constructor()
```

Creates a new plugin instance with default configuration.

#### Plugin Lifecycle Methods

```typescript
async initialize(context: PluginContext): Promise<void>
```
Initializes the plugin with the provided context and loads the WASM module.

```typescript
async activate(): Promise<void>
```
Activates the plugin for use.

```typescript
async deactivate(): Promise<void>
```
Deactivates the plugin and cleans up active operations.

```typescript
async cleanup(): Promise<void>
```
Performs cleanup, clears cache, and releases resources.

## Core Operations

### Formula Evaluation

#### evaluateFormula

```typescript
await plugin.execute('evaluateFormula', {
  formula: string,    // Excel formula (e.g., "=SUM(1,2,3)")
  sheet?: string,     // Sheet name (default: "Sheet1")
  row?: number,       // Row number (default: 1)
  col?: number        // Column number (default: 1)
}): Promise<FormulaResult>
```

**Returns:** `FormulaResult`
```typescript
interface FormulaResult {
  value: string;              // Calculated result
  error?: string;             // Error message if evaluation failed
  execution_time_ms: number;  // Execution time in milliseconds
  cell_address: string;       // Cell address (e.g., "A1")
  formula_type: string;       // Type of formula
}
```

**Example:**
```typescript
const result = await plugin.execute('evaluateFormula', {
  formula: '=SUM(1,2,3,4,5)',
  sheet: 'Sheet1',
  row: 1,
  col: 1
});
console.log(result.value); // "15"
```

#### bulkEvaluate

```typescript
await plugin.execute('bulkEvaluate', {
  formulas: BulkFormulaRequest[]
}): Promise<FormulaResult[]>

interface BulkFormulaRequest {
  formula: string;
  sheet: string;
  row: number;
  col: number;
}
```

**Example:**
```typescript
const results = await plugin.execute('bulkEvaluate', {
  formulas: [
    { formula: '=SUM(1,2,3)', sheet: 'Sheet1', row: 1, col: 1 },
    { formula: '=AVERAGE(4,5,6)', sheet: 'Sheet1', row: 2, col: 1 }
  ]
});
```

### Cell Operations

#### setCellValue

```typescript
await plugin.execute('setCellValue', {
  sheet: string,   // Sheet name
  row: number,     // Row number (1-based)
  col: number,     // Column number (1-based)  
  value: string    // Cell value
}): Promise<void>
```

#### getCellValue

```typescript
await plugin.execute('getCellValue', {
  sheet: string,   // Sheet name
  row: number,     // Row number
  col: number      // Column number
}): Promise<string>
```

#### createSheet

```typescript
await plugin.execute('createSheet', {
  name: string     // Sheet name (max 31 characters)
}): Promise<void>
```

### Cache Management

#### clearCache

```typescript
await plugin.execute('clearCache', {}): Promise<void>
```

Clears the formula result cache.

#### getMetrics

```typescript
await plugin.execute('getMetrics', {}): Promise<ProcessingMetrics>
```

Returns current performance metrics.

## Data Processing

### Dataset Processing

#### process

```typescript
async process(dataset: Dataset, options?: ProcessingOptions): Promise<Dataset>
```

Processes a dataset, evaluating any formula columns defined in the schema.

**Formula Column Definition:**
```typescript
{
  name: 'calculated_field',
  type: 'number',
  description: 'formula:=[column1]+[column2]*0.1'
}
```

**Example:**
```typescript
const dataset = {
  id: 'sales-data',
  schema: {
    fields: [
      { name: 'quantity', type: 'number' },
      { name: 'price', type: 'number' },
      { 
        name: 'total', 
        type: 'number', 
        description: 'formula:=[quantity]*[price]' 
      }
    ]
  },
  data: [
    { quantity: 5, price: 20 },
    { quantity: 3, price: 50 }
  ]
};

const processed = await plugin.process(dataset);
```

#### processDataset

```typescript
await plugin.execute('processDataset', {
  dataset: Dataset,
  formulaColumns: FormulaColumn[]
}): Promise<Dataset>

interface FormulaColumn {
  name: string;
  formula: string;
  dependencies?: string[];
  type?: 'number' | 'string' | 'boolean' | 'date';
}
```

### Validation

#### validate

```typescript
async validate(dataset: Dataset): Promise<ValidationResult>
```

Validates a dataset against plugin constraints and limits.

**Returns:**
```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  statistics: ValidationStatistics;
  summary: ValidationSummary;
}
```

### Batch Processing

#### batch

```typescript
async batch(datasets: Dataset[]): Promise<Dataset[]>
```

Processes multiple datasets in parallel.

### Stream Processing

#### stream

```typescript
async stream(dataStream: ReadableStream<Dataset>): Promise<ReadableStream<Dataset>>
```

Processes datasets from a stream.

## Configuration

### configure

```typescript
async configure(settings: Partial<IronCalcConfig>): Promise<void>

interface IronCalcConfig {
  maxCells: number;              // Maximum number of cells (default: 100000)
  enableCustomFunctions: boolean; // Enable custom functions (default: true)
  memoryLimitMB: number;         // Memory limit in MB (default: 512)
  calculationTimeout: number;     // Timeout in ms (default: 30000)
  autoRecalculation: boolean;     // Auto-recalc on changes (default: true)
  cacheSize: number;             // Cache size (default: 10000)
  logLevel: 'debug' | 'info' | 'warn' | 'error'; // Log level (default: 'info')
}
```

**Example:**
```typescript
await plugin.configure({
  maxCells: 50000,
  calculationTimeout: 15000,
  memoryLimitMB: 256
});
```

## Error Types

### IronCalcError

```typescript
class IronCalcError extends Error {
  constructor(
    public type: IronCalcErrorType,
    message: string,
    public context?: any,
    public cellAddress?: string
  )
}

enum IronCalcErrorType {
  FORMULA_SYNTAX = 'FORMULA_SYNTAX',
  CELL_REFERENCE = 'CELL_REFERENCE',
  CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE',
  FUNCTION_NOT_FOUND = 'FUNCTION_NOT_FOUND',
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  DIVISION_BY_ZERO = 'DIVISION_BY_ZERO',
  WASM_ERROR = 'WASM_ERROR',
  MEMORY_LIMIT = 'MEMORY_LIMIT',
  TIMEOUT = 'TIMEOUT',
  PLUGIN_NOT_INITIALIZED = 'PLUGIN_NOT_INITIALIZED'
}
```

### Excel Error Types

The plugin returns Excel-compatible error strings:

- `#DIV/0!` - Division by zero
- `#VALUE!` - Wrong argument type
- `#REF!` - Invalid cell reference  
- `#NAME?` - Unknown function name
- `#N/A` - Value not available
- `#NUM!` - Invalid number

## Type Definitions

### Dataset

```typescript
interface Dataset {
  id: string;
  name: string;
  schema: DataSchema;
  data: any[];
  metadata: DataMetadata;
}

interface DataSchema {
  fields: DataField[];
  primaryKey?: string[];
  indexes?: any[];
}

interface DataField {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;  // Use "formula:=EXPRESSION" for formula columns
  constraints?: any[];
}
```

### Performance Metrics

```typescript
interface ProcessingMetrics {
  averageProcessingTime: number; // Average time per operation (ms)
  throughput: number;            // Total operations processed
  memoryUsage: number;           // Current memory usage (bytes)
  cpuUsage: number;              // CPU usage percentage
  successRate: number;           // Success rate (0-1)
  lastUpdated: string;           // ISO timestamp
}
```

## Examples

### Basic Usage

```typescript
import { IronCalcFormulaPlugin } from '@dataprism/plugin-ironcalc-formula';

const plugin = new IronCalcFormulaPlugin();
await plugin.initialize(context);
await plugin.activate();

// Evaluate formula
const result = await plugin.execute('evaluateFormula', {
  formula: '=IF(SUM(1,2,3)>5,"High","Low")',
  sheet: 'Sheet1',
  row: 1,
  col: 1
});

console.log(result.value); // "High"
```

### Error Handling

```typescript
try {
  const result = await plugin.execute('evaluateFormula', {
    formula: '=1/0',
    sheet: 'Sheet1',
    row: 1,
    col: 1
  });
  
  if (result.error) {
    console.log('Formula error:', result.error); // "#DIV/0!"
  } else {
    console.log('Result:', result.value);
  }
} catch (error) {
  if (error instanceof IronCalcError) {
    console.log('Plugin error:', error.type, error.message);
  }
}
```

### Performance Monitoring

```typescript
// Execute some operations
await plugin.execute('evaluateFormula', { formula: '=SUM(1,2,3)' });

// Check performance
const metrics = plugin.getPerformanceMetrics();
console.log(`Average time: ${metrics.averageProcessingTime}ms`);
console.log(`Memory usage: ${Math.round(metrics.memoryUsage / 1024 / 1024)}MB`);

// Clear cache if needed
if (metrics.memoryUsage > 100 * 1024 * 1024) { // >100MB
  await plugin.execute('clearCache', {});
}
```

### Custom Dataset Processing

```typescript
const salesData = {
  id: 'quarterly-sales',
  schema: {
    fields: [
      { name: 'product', type: 'string' },
      { name: 'units', type: 'number' },
      { name: 'price', type: 'number' },
      { 
        name: 'revenue', 
        type: 'number',
        description: 'formula:=[units]*[price]'
      },
      {
        name: 'commission',
        type: 'number', 
        description: 'formula:=IF([revenue]>1000,[revenue]*0.15,[revenue]*0.10)'
      }
    ]
  },
  data: [
    { product: 'Widget A', units: 100, price: 15.50 },
    { product: 'Widget B', units: 75, price: 8.25 }
  ]
};

const processed = await plugin.process(salesData);
// Results include calculated revenue and commission columns
```