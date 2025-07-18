# DataPrism Plugins - Context Engineering Guide

## Project Overview
DataPrism Plugins contains the plugin framework and all official plugins, enabling extensible analytics capabilities through a secure, performant plugin system.

## Architecture Context
- **Plugin Framework**: Core SDK and architecture for plugin development
- **Official Plugins**: Formula engine, file connectors, visualization, LLM providers
- **Security Model**: Sandboxing, permissions, resource quotas
- **Multi-Bundle Build**: Single repository produces multiple plugin bundles

## Development Patterns
- Extend DataPrismPlugin abstract class
- Implement proper plugin lifecycle management
- Follow security boundaries and permission model
- Use shared framework utilities for common operations

## Testing Requirements
- Plugin framework tests
- Individual plugin unit tests
- Security boundary validation
- Plugin compatibility testing

## Build Commands
```bash
# Build plugin framework
npm run build:framework

# Build all plugins
npm run build:plugins

# Run tests
npm run test:framework && npm run test:plugins
```
