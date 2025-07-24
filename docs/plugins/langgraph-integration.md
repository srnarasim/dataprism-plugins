# LangGraph Integration Plugin

The LangGraph Integration Plugin brings graph-based agentic analytics workflows to DataPrism, enabling sophisticated multi-agent coordination and intelligent data analysis orchestration.

## Overview

This plugin integrates LangGraph's workflow orchestration capabilities with DataPrism's analytical engine to create autonomous, intelligent data analysis workflows. It supports multi-agent systems, conditional branching, parallel execution, and comprehensive state management.

## Features

### 🔗 Graph-Based Workflows
- **Visual Workflow Design**: Define complex analytical workflows as directed graphs
- **Node Types**: Support for agent nodes, condition nodes, parallel execution, and data operations
- **Edge Definitions**: Conditional transitions between workflow steps
- **Entry Points**: Flexible workflow starting points

### 🤖 Multi-Agent System
- **Specialized Agents**: Agents optimized for specific analytical tasks
- **Agent Registry**: Dynamic agent registration and capability management
- **LLM Integration**: Support for multiple LLM providers (OpenAI, Anthropic, local models)
- **Tool Integration**: Agents can use DataPrism tools for data analysis

### 🔄 Workflow Orchestration
- **State Management**: Persistent workflow state across executions
- **Execution Control**: Start, pause, resume, and stop workflows
- **Error Handling**: Comprehensive error recovery and retry mechanisms
- **Performance Monitoring**: Real-time metrics and execution tracking

### 📊 DataPrism Integration
- **DuckDB Access**: Direct integration with DataPrism's analytical engine
- **Data Pipeline**: Seamless data loading and transformation
- **Query Optimization**: Optimized analytical queries for workflow operations
- **Memory Management**: Efficient memory usage with DataPrism's WASM optimization

## Installation

The LangGraph plugin is included in the DataPrism plugins collection:

```bash
npm install @dataprism/plugins
```

### Dependencies

The plugin requires the following dependencies:
- `@langchain/core`: Core LangChain functionality
- `@langchain/langgraph`: Graph workflow orchestration

## Quick Start

### 1. Initialize the Plugin

```typescript
import { LangGraphIntegrationPlugin } from '@dataprism/plugins/langgraph-integration';

const plugin = new LangGraphIntegrationPlugin();

// Initialize with DataPrism context
await plugin.initialize(context);
await plugin.activate();
```

### 2. Register Custom Agents

```typescript
// Register a custom analysis agent
const customAgent = {
  id: 'custom-analyzer',
  name: 'Custom Data Analyzer',
  specialization: 'statistical-analysis',
  capabilities: {
    statisticalAnalysis: true,
    visualization: true,
    reportGeneration: true
  },
  llmProvider: 'openai',
  model: 'gpt-4',
  systemPrompt: 'You are a statistical analysis expert...',
  tools: [
    {
      name: 'calculate_correlation',
      description: 'Calculate correlation between two variables',
      execute: async (params) => {
        // Implementation using DataPrism DuckDB
        return await context.engine.query(`
          SELECT corr(${params.var1}, ${params.var2}) as correlation
          FROM ${params.table}
        `);
      }
    }
  ]
};

await plugin.registerAgent(customAgent);
```

### 3. Create a Workflow

```typescript
const workflow = {
  id: 'data-analysis-pipeline',
  name: 'Comprehensive Data Analysis',
  description: 'Multi-step analytical workflow',
  version: '1.0.0',
  nodes: [
    {
      id: 'discovery',
      type: 'agent',
      name: 'Data Discovery',
      agentId: 'data-discovery-agent',
      configuration: {
        analysisDepth: 'comprehensive'
      }
    },
    {
      id: 'analysis',
      type: 'agent',
      name: 'Statistical Analysis',
      agentId: 'custom-analyzer',
      configuration: {
        methods: ['correlation', 'regression']
      }
    },
    {
      id: 'insights',
      type: 'agent',
      name: 'Insight Generation',
      agentId: 'insight-generation-agent',
      configuration: {
        focusAreas: ['trends', 'anomalies']
      }
    }
  ],
  edges: [
    { from: 'discovery', to: 'analysis' },
    { from: 'analysis', to: 'insights' }
  ],
  entryPoint: 'discovery'
};

await plugin.createWorkflow(workflow);
```

### 4. Execute the Workflow

```typescript
const result = await plugin.executeWorkflow('data-analysis-pipeline', {
  dataset: 'sales_data',
  parameters: {
    timeframe: 'last_quarter',
    includeForecasting: true
  }
});

console.log('Workflow completed:', result.status);
console.log('Analysis results:', result.output);
```

## Agent Specializations

The plugin supports several built-in agent specializations:

### Data Discovery Agents
- **Purpose**: Analyze dataset structure, quality, and characteristics
- **Capabilities**: Schema inference, data profiling, quality assessment
- **Tools**: Column distribution analysis, null value detection, data type inference

### Statistical Analysis Agents
- **Purpose**: Perform statistical analysis and correlation studies
- **Capabilities**: Descriptive statistics, correlation analysis, hypothesis testing
- **Tools**: Statistical calculations, distribution analysis, regression modeling

### Visualization Agents
- **Purpose**: Create visual representations of data and analysis results
- **Capabilities**: Chart generation, dashboard creation, interactive visualizations
- **Tools**: Chart configuration, data transformation for visualization

### Insight Generation Agents
- **Purpose**: Generate business insights from analytical results
- **Capabilities**: Pattern recognition, anomaly detection, trend analysis
- **Tools**: Insight extraction, recommendation generation, narrative creation

## Workflow Node Types

### Agent Nodes
Execute specific agents with configured parameters:

```typescript
{
  id: 'analysis-node',
  type: 'agent',
  name: 'Statistical Analysis',
  agentId: 'statistical-analysis-agent',
  configuration: {
    methods: ['descriptive', 'correlation'],
    confidence: 0.95
  },
  timeout: 60000,
  retryPolicy: {
    maxRetries: 3,
    retryDelay: 1000
  }
}
```

### Condition Nodes
Implement conditional branching logic:

```typescript
{
  id: 'quality-check',
  type: 'condition',
  name: 'Data Quality Gate',
  conditions: [
    {
      expression: 'input.qualityScore > 0.8',
      description: 'High quality data'
    }
  ],
  configuration: {
    condition: 'input.qualityScore > 0.8'
  }
}
```

### Parallel Nodes
Execute multiple operations in parallel:

```typescript
{
  id: 'parallel-analysis',
  type: 'parallel',
  name: 'Parallel Analysis',
  configuration: {
    branches: [
      { nodeId: 'statistical-analysis' },
      { nodeId: 'visualization-prep' },
      { nodeId: 'quality-assessment' }
    ]
  }
}
```

### Data Operation Nodes
Perform direct data operations:

```typescript
{
  id: 'data-transform',
  type: 'data-operation',
  name: 'Data Transformation',
  configuration: {
    sql: `
      SELECT 
        customer_id,
        SUM(order_value) as total_value,
        COUNT(*) as order_count
      FROM orders 
      WHERE order_date >= '2024-01-01'
      GROUP BY customer_id
    `
  }
}
```

## State Management

The plugin provides comprehensive state management for workflows:

### Workflow State
```typescript
interface WorkflowState {
  currentNode: string;
  nodeStates: Map<string, any>;
  sharedContext: any;
  executionHistory: ExecutionStep[];
  variables: Map<string, any>;
  metadata: {
    startTime: Date;
    lastUpdate: Date;
    executionCount: number;
  };
}
```

### Saving and Loading State
```typescript
// Save workflow state
await plugin.saveWorkflowState(workflowId, state);

// Load workflow state
const state = await plugin.loadWorkflowState(workflowId);

// Clear workflow state
await plugin.clearWorkflowState(workflowId);
```

## Monitoring and Debugging

### Execution Metrics
```typescript
const metrics = await plugin.getWorkflowMetrics(workflowId);
console.log('Execution count:', metrics.executionCount);
console.log('Success rate:', metrics.successRate);
console.log('Average execution time:', metrics.averageExecutionTime);
```

### Execution Traces
```typescript
const trace = await plugin.getExecutionTrace(workflowId, executionId);
console.log('Execution steps:', trace.steps);
console.log('Agent calls:', trace.agentCalls);
console.log('Data operations:', trace.dataOperations);
```

### Real-time Monitoring
```typescript
// Subscribe to workflow events
context.eventBus.subscribe('workflow:progress', (event) => {
  console.log(`Workflow ${event.workflowId} progress:`, event.data);
});

context.eventBus.subscribe('workflow:completed', (event) => {
  console.log('Workflow completed:', event.result);
});

context.eventBus.subscribe('workflow:error', (event) => {
  console.error('Workflow error:', event.error);
});
```

## Advanced Features

### Custom Agent Tools

Agents can use custom tools for specialized operations:

```typescript
const customTool = {
  name: 'advanced_statistics',
  description: 'Perform advanced statistical analysis',
  execute: async (params, context) => {
    // Access DataPrism engine
    const result = await context.engine.query(`
      WITH stats AS (
        SELECT 
          AVG(${params.column}) as mean,
          STDDEV(${params.column}) as stddev,
          MIN(${params.column}) as min_val,
          MAX(${params.column}) as max_val,
          COUNT(*) as count
        FROM ${params.table}
      )
      SELECT 
        mean,
        stddev,
        min_val,
        max_val,
        count,
        (max_val - min_val) as range,
        stddev / mean as cv
      FROM stats
    `);
    
    return {
      statistics: result.data[0],
      summary: \`Analysis of \${params.column}: Mean=\${result.data[0].mean}\`
    };
  },
  schema: {
    type: 'object',
    properties: {
      table: { type: 'string' },
      column: { type: 'string' }
    }
  }
};
```

### Workflow Templates

Create reusable workflow templates:

```typescript
const templates = {
  dataQualityAssessment: {
    name: 'Data Quality Assessment',
    nodes: [
      { type: 'agent', agentId: 'data-discovery-agent' },
      { type: 'agent', agentId: 'quality-assessment-agent' },
      { type: 'condition', condition: 'input.qualityScore > 0.7' },
      { type: 'agent', agentId: 'quality-report-agent' }
    ]
  },
  
  comprehensiveAnalysis: {
    name: 'Comprehensive Data Analysis',
    nodes: [
      { type: 'agent', agentId: 'data-discovery-agent' },
      { type: 'parallel', branches: [
        { type: 'agent', agentId: 'statistical-analysis-agent' },
        { type: 'agent', agentId: 'visualization-agent' }
      ]},
      { type: 'agent', agentId: 'insight-generation-agent' },
      { type: 'agent', agentId: 'report-generation-agent' }
    ]
  }
};
```

## Error Handling

The plugin provides comprehensive error handling:

### Retry Policies
```typescript
const retryPolicy = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
  retryConditions: ['TIMEOUT', 'NETWORK_ERROR', 'RATE_LIMIT']
};
```

### Error Recovery
```typescript
// Handle workflow errors
context.eventBus.subscribe('workflow:error', async (event) => {
  if (event.error.recoverable) {
    // Attempt recovery
    await plugin.resumeWorkflow(event.workflowId);
  } else {
    // Log error and notify
    console.error('Unrecoverable workflow error:', event.error);
  }
});
```

## Performance Optimization

### Memory Management
- Workflow state is efficiently stored and managed
- Large datasets are processed in chunks
- Automatic garbage collection of completed workflows

### Query Optimization
- SQL queries are optimized for DuckDB
- Results are cached to avoid redundant computations
- Parallel execution where possible

### Resource Limits
```typescript
const configuration = {
  maxConcurrentWorkflows: 10,
  workflowTimeout: 300000, // 5 minutes
  maxMemoryPerWorkflow: 512, // MB
  maxAgentExecutionTime: 60000 // 1 minute
};
```

## API Reference

### Core Methods

#### Workflow Management
- `createWorkflow(definition: WorkflowDefinition): Promise<Workflow>`
- `executeWorkflow(workflowId: string, input: any): Promise<WorkflowResult>`
- `pauseWorkflow(workflowId: string): Promise<void>`
- `resumeWorkflow(workflowId: string): Promise<void>`
- `stopWorkflow(workflowId: string): Promise<void>`
- `getWorkflow(workflowId: string): Promise<Workflow>`
- `listWorkflows(filter?: WorkflowFilter): Promise<Workflow[]>`

#### Agent Management
- `registerAgent(agent: AnalyticsAgent): Promise<string>`
- `getAgent(agentId: string): Promise<AnalyticsAgent>`
- `listAgents(filter?: AgentFilter): Promise<AnalyticsAgent[]>`
- `configureAgentCapabilities(agentId: string, capabilities: AgentCapabilities): Promise<void>`

#### State Management
- `saveWorkflowState(workflowId: string, state: WorkflowState): Promise<void>`
- `loadWorkflowState(workflowId: string): Promise<WorkflowState>`
- `clearWorkflowState(workflowId: string): Promise<void>`

#### Monitoring
- `getWorkflowMetrics(workflowId: string): Promise<WorkflowMetrics>`
- `getExecutionTrace(workflowId: string, executionId: string): Promise<ExecutionTrace>`

## Configuration

### Plugin Configuration
```typescript
{
  defaultLLMProvider: 'openai',
  maxConcurrentWorkflows: 10,
  workflowTimeout: 300000,
  enableDebugMode: false
}
```

### LLM Provider Configuration
```typescript
const llmConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
    temperature: 0.3
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-3-sonnet',
    temperature: 0.3
  }
};
```

## Security

### Permissions
The plugin requires the following permissions:
- `data:read` - Access to read datasets
- `network:read` - Access to call LLM APIs
- `storage:write` - Store workflow state
- `workers:execute` - Run parallel operations

### Sandboxing
- All agent code executes in a controlled environment
- Input validation for workflow definitions
- Output sanitization for generated content
- Resource limits for long-running workflows

## Troubleshooting

### Common Issues

#### Workflow Execution Timeouts
```typescript
// Increase timeout for long-running workflows
const options = {
  timeout: 600000 // 10 minutes
};
await plugin.executeWorkflow(workflowId, input, options);
```

#### Agent Registration Failures
```typescript
// Validate agent configuration
try {
  await plugin.registerAgent(agent);
} catch (error) {
  console.error('Agent registration failed:', error.message);
  // Check required fields: id, name, specialization, llmProvider, model
}
```

#### Memory Limit Exceeded
```typescript
// Configure memory limits
const config = {
  maxMemoryPerWorkflow: 1024, // Increase to 1GB
  enableMemoryOptimization: true
};
```

### Debug Mode
Enable debug mode for detailed execution traces:

```typescript
await plugin.configure({
  enableDebugMode: true
});
```

## Examples

See the [examples directory](../examples/) for complete working examples:
- [Basic Workflow](../examples/langgraph-workflow.html) - Interactive workflow demonstration
- [Custom Agents](../examples/custom-agents.ts) - Creating custom analytical agents
- [Advanced Workflows](../examples/advanced-workflows.ts) - Complex workflow patterns

## Contributing

To contribute to the LangGraph plugin:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT License - see the [LICENSE](../../LICENSE) file for details.