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

- **formula-engine**: Mathematical and statistical operations
- **file-connectors**: CSV, JSON, Parquet import/export
- **visualization**: Chart rendering and interaction
- **llm-providers**: OpenAI, Anthropic, local model integration
- **semantic-clustering**: Data clustering and analysis
- **performance-monitor**: System monitoring and metrics

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
