# DataPrism Plugins

DataPrism Plugins contains the plugin framework and all official plugins, enabling extensible analytics capabilities through a secure, performant plugin system.

## Features

- **Plugin Framework**: Secure, performant plugin architecture
- **Official Plugins**: Formula engine, file connectors, visualization, LLM providers
- **Multi-Bundle Build**: Single repository, multiple plugin bundles
- **Security Model**: Sandboxing, permissions, resource quotas
- **Hot Reloading**: Development-friendly plugin loading

## Installation

```bash
npm install @dataprism/plugins
```

## Quick Start

```typescript
import { PluginManager } from '@dataprism/plugins';
import { FormulaEnginePlugin } from '@dataprism/plugins/formula-engine';

const manager = new PluginManager();
await manager.loadPlugin(new FormulaEnginePlugin());

const result = await manager.executePlugin('formula-engine', {
  formula: 'SUM(A1:A10)'
});
```

## Available Plugins

- **ironcalc-formula**: Excel-compatible formula engine with 180+ functions powered by IronCalc WASM
- **langgraph-integration**: Graph-based agentic analytics workflows using LangGraph for multi-agent coordination
- **csv-importer**: High-performance CSV/TSV import with streaming and automatic type inference
- **observable-charts**: Interactive charts and visualizations built with Observable Framework and D3
- **semantic-clustering**: ML-powered data clustering with K-means/DBSCAN and embedding generation
- **performance-monitor**: Real-time system monitoring with FPS, memory, and query performance metrics

## Development

```bash
# Install dependencies
npm install

# Build framework and all plugins
npm run build

# Build specific plugin
npm run build:plugin -- formula-engine

# Run tests
npm test

# Test specific plugin
npm run test:plugin -- formula-engine
```

## Plugin Development

See the [Plugin Development Guide](./docs/plugin-development.md) for creating custom plugins.

## License

MIT
