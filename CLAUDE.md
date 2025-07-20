# DataPrism Plugins - Context Engineering Guide

## Project Overview

DataPrism Plugins provides a comprehensive plugin framework for extending DataPrism functionality. It implements a sophisticated interface-based architecture with security sandboxing, resource management, and modular extensibility.

## Architecture Context

DataPrism Plugins implements an interface-based plugin system with comprehensive security and resource management:

### Core Architecture Patterns
- **Interface-Based Design**: IPlugin base interface with specialized extensions
- **Plugin Manager**: Central orchestrator for lifecycle and resource management
- **Security Manager**: Sandboxing, permissions, and quota enforcement
- **Event-Driven Communication**: Inter-plugin communication via EventBus

### Plugin Types
- **Data Processors**: IDataProcessorPlugin for data transformation
- **Visualizations**: IVisualizationPlugin for rendering and charts
- **Integrations**: IIntegrationPlugin for external service connections
- **Utilities**: IUtilityPlugin for monitoring and optimization

### Repository Structure
```
dataprism-plugins/
├── packages/
│   ├── src/                    # Plugin framework core
│   │   ├── interfaces/         # Plugin interface definitions
│   │   ├── manager/            # Plugin management
│   │   ├── security/           # Security and sandboxing
│   │   └── communication/      # Plugin communication
│   ├── out-of-box/            # Pre-built plugins
│   └── examples/              # Plugin development examples
├── dist/                      # Build outputs and CDN bundles
├── tests/                     # Comprehensive test suites
└── docs/                      # Plugin development documentation
```

## Core Technologies

- **Primary Language**: TypeScript for framework and plugin implementations
- **Security**: Permission-based sandboxing with resource quotas
- **Communication**: Event-driven architecture with EventBus
- **Build System**: Multi-format bundles (ES, UMD, IIFE) for CDN distribution
- **Testing**: Vitest for unit tests, integration testing for plugin framework

## Development Principles

### Plugin Interface Design

- All plugins implement IPlugin base interface
- Specialized interfaces for different plugin categories
- Consistent lifecycle management (initialize, activate, deactivate, cleanup)
- Configuration schema validation with type safety

### Security Architecture

- Permission-based access control for resources
- Resource quotas (memory, CPU, execution time)
- Sandboxed execution environments
- Secure service proxy for core API access

### Performance Guidelines

- Plugin initialization within 1 second
- Memory usage monitoring and enforcement
- Lazy loading and code splitting support
- Worker thread utilization for heavy computations

### Code Organization

- Clear separation between framework and plugins
- Modular plugin architecture with minimal dependencies
- Consistent error handling patterns
- Comprehensive documentation and examples

## Context Engineering Rules

### Plugin Development

- Always implement the appropriate specialized interface (IDataProcessorPlugin, IVisualizationPlugin, etc.)
- Follow the plugin lifecycle pattern: initialize → activate → execute → deactivate → cleanup
- Use the plugin context for secure access to core services
- Implement proper error handling and logging

### Security Considerations

- Never bypass the security manager or permission system
- Validate all inputs and sanitize outputs
- Respect resource quotas and limits
- Use secure communication patterns via EventBus

### Performance Patterns

- Implement lazy loading for non-critical functionality
- Use Web Workers for CPU-intensive operations
- Cache results appropriately to avoid redundant computation
- Monitor and report resource usage

## Common Patterns to Follow

### Basic Plugin Implementation

```typescript
export class ExamplePlugin implements IDataProcessorPlugin {
  private context: PluginContext | null = null;
  
  getName(): string { return 'example-plugin'; }
  getVersion(): string { return '1.0.0'; }
  getDescription(): string { return 'Example data processing plugin'; }
  getAuthor(): string { return 'DataPrism Team'; }
  getDependencies(): PluginDependency[] { return []; }
  
  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    // Plugin initialization logic
  }
  
  async activate(): Promise<void> {
    // Plugin activation logic
  }
  
  async process(data: Dataset): Promise<Dataset> {
    // Data processing implementation
    return processedData;
  }
  
  async deactivate(): Promise<void> {
    // Cleanup logic
  }
  
  async cleanup(): Promise<void> {
    this.context = null;
  }
}
```

### Configuration Schema

```typescript
const configSchema: PluginConfigSchema = {
  maxItems: {
    type: 'number',
    default: 1000,
    description: 'Maximum items to process',
    validation: [{ type: 'min', value: 1 }, { type: 'max', value: 100000 }]
  },
  enableCaching: {
    type: 'boolean',
    default: true,
    description: 'Enable result caching'
  }
};
```

### Secure Service Access

```typescript
// Access core services through secure proxy
const result = await this.context.services.call('duckdb', 'query', sql);

// Publish events for inter-plugin communication
this.context.eventBus.publish('data:processed', { dataset: processedData });

// Subscribe to configuration changes
this.context.eventBus.subscribe('config:changed', (config) => {
  this.configure(config);
});
```

## Build and Testing Context

```bash
# Build plugin framework only
npm run build:framework

# Build complete bundle (framework + all plugins)
npm run build:complete

# Build individual plugin
npm run build:plugin <plugin-name>

# Development with hot reload
npm run dev:plugin <plugin-name>

# Run tests
npm run test:framework      # Framework tests
npm run test:plugin <name>   # Individual plugin tests
npm run test:security        # Security validation tests
npm run validate:plugins     # Plugin compatibility validation
```

## CDN Distribution Strategy

- Framework-only bundle for minimal overhead
- Complete bundle with all official plugins
- Individual plugin bundles for selective loading
- Plugin registry manifest for discovery

## Security and Compliance

### Permission Model
- Resource-based permissions (read, write, execute)
- Scoped access control
- Runtime permission validation

### Resource Management
- Memory usage quotas and monitoring
- CPU usage limits and enforcement
- Execution time constraints
- Network request throttling

### Audit and Monitoring
- Plugin activity logging
- Resource usage tracking
- Security violation detection
- Performance metrics collection

## Communication Style

- Focus on plugin interface compliance and security
- Provide concrete plugin implementation examples
- Explain security implications and best practices
- Emphasize performance considerations and resource management
