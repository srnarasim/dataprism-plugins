# Enhanced Generate Product Requirements Prompt (PRP) Template for DataPrism Plugins

You are an expert software architect and context engineer tasked with creating comprehensive Product Requirements Prompts (PRPs) for implementing plugins in the DataPrism ecosystem.

## Your Mission

Create a detailed PRP that an AI coding assistant can use to implement a plugin successfully, including complete documentation and deployment pipeline requirements.

## Research Phase

Before creating the PRP, research the codebase to understand:

1. **Architecture Patterns**: How existing plugins are structured and organized
2. **Plugin Interfaces**: Which interfaces (IDataProcessorPlugin, IVisualizationPlugin, etc.) apply
3. **Integration Points**: How plugins interact with DataPrism core, LLM providers, and each other
4. **Security Model**: Permission requirements and sandboxing patterns
5. **CDN Distribution**: How plugins are bundled and distributed via GitHub Pages
6. **Documentation Patterns**: Current documentation structure and examples

## Enhanced PRP Structure

### 1. Executive Summary
- Brief description of the plugin and its primary purpose
- Plugin type and category (processing, visualization, integration, utility)
- Key objectives and success criteria
- Integration scope (core engine, LangGraph workflows, external services)

### 2. Context and Background
- Current state of the DataPrism ecosystem
- Why this plugin is needed and how it fills a gap
- How it fits into the overall plugin architecture
- Dependencies on existing plugins or services

### 3. Technical Specifications
- **Plugin Type**: Specific interface implementations required
- **Dependencies**: External libraries, internal plugins, services
- **Performance Targets**: Memory, execution time, bundle size constraints
- **Browser Compatibility**: Target browser versions and feature requirements
- **Security Requirements**: Permissions, sandboxing, audit logging needs

### 4. Implementation Plan

Structure as phases with specific weeks and deliverables:

#### Phase 1: Core Infrastructure (Week 1-2)
- Plugin scaffolding and interface implementation
- Core functionality development
- Basic integration patterns

#### Phase 2: Integration Layer (Week 3-4)  
- DataPrism core integration
- LLM provider integration (if applicable)
- Event system integration
- Error handling and recovery

#### Phase 3: Advanced Features (Week 5-6)
- Advanced capabilities and optimizations
- UI components (if applicable)
- Performance optimizations
- Security enhancements

#### Phase 4: Documentation and Deployment (Week 7-8)
- **CRITICAL**: Comprehensive documentation creation
- CDN deployment integration
- Testing and validation
- Performance benchmarking

### 5. Code Examples and Patterns

Include comprehensive examples for:
```typescript
// Plugin class structure
export class [PluginName]Plugin implements I[Type]Plugin {
  getName(): string { return "[plugin-id]"; }
  getVersion(): string { return "1.0.0"; }
  // ... implementation
}

// Integration patterns
// DataPrism core access
const result = await this.context.engine.query(sql);

// Event system usage
this.context.eventBus.publish('plugin:event', data);
this.context.eventBus.subscribe('core:event', handler);

// LLM integration (if applicable)
const llmResult = await this.context.llm.generate(prompt, options);
```

### 6. **DOCUMENTATION REQUIREMENTS** ⭐

This section is critical and must be comprehensive:

#### 6.1 GitHub Pages Documentation
**Main Site Updates** (`docs/index.html`):
- Add plugin to the plugins showcase section
- Update plugin count in statistics
- Include plugin in CDN usage examples  
- Add plugin-specific use cases and benefits

**Dedicated Plugin Page** (`docs/plugins/[plugin-name].html`):
- Complete plugin overview and capabilities
- Installation and configuration guide
- API reference with detailed examples
- Integration patterns and workflows
- Performance characteristics and optimization tips
- Troubleshooting guide with common issues
- Interactive examples and demos

Template structure for plugin documentation page:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <title>[Plugin Name] - DataPrism Plugins</title>
    <meta name="description" content="[Plugin description for SEO]">
    <!-- Consistent styling with main site -->
</head>
<body>
    <!-- Header with navigation -->
    <!-- Plugin hero section with key features -->
    <!-- Table of contents -->
    <!-- Overview and features -->
    <!-- Quick start guide -->
    <!-- API reference -->
    <!-- Examples and use cases -->
    <!-- Performance and troubleshooting -->
</body>
</html>
```

#### 6.2 CDN Distribution Updates
**Update GitHub Actions Workflow** (`.github/workflows/deploy-cdn.yml`):
```yaml
# Add to plugins manifest
"[plugin-id]": {
  "path": "./plugins/[plugin-id]/index.js",
  "description": "[plugin description]",
  "size": "~[size]KB",
  "dependencies": ["[dependency1]", "[dependency2]"]
}

# Add to HTML plugin showcase
<div class="plugin">
    <h3>[icon] [Plugin Name]</h3>
    <div class="size">~[size]KB</div>
    <div class="deps">Dependencies: [deps]</div>
    <p>[description]</p>
</div>
```

**Update Bundle Configuration**:
- Add plugin to `vite.config.bundle.ts` dependencies
- Update plugin count in deployment templates
- Include plugin in CDN manifest metadata

#### 6.3 Plugin Registry Updates
**Update Plugin Registry** (`packages/out-of-box/src/index.ts`):
```typescript
// Add to PLUGIN_REGISTRY
"[plugin-id]": () => import("./plugins/[category]/[plugin-id].js").then((m) => new m.[PluginClass]()),

// Add to PLUGIN_METADATA  
"[plugin-id]": {
  name: "[Plugin Name]",
  category: "[category]",
  description: "[description]",
  version: "1.0.0",
  tags: ["tag1", "tag2", "tag3"]
}
```

#### 6.4 API Documentation
- Complete TypeScript definitions with JSDoc comments
- Integration examples for common use cases
- Error handling patterns and troubleshooting
- Performance optimization guidelines

### 7. Testing Strategy

#### Unit Tests
```typescript
describe('[Plugin Name] Plugin', () => {
  test('should initialize correctly', async () => {
    const plugin = new [PluginName]Plugin();
    await plugin.initialize(mockContext);
    expect(plugin.getName()).toBe('[plugin-id]');
  });

  // Comprehensive test cases for all functionality
});
```

#### Integration Tests
- Plugin lifecycle management
- DataPrism core integration
- Event system interaction
- Error handling scenarios
- Performance under load

#### Documentation Tests
- Validate all documentation links work
- Test code examples in documentation
- Verify CDN bundle includes plugin
- Check GitHub Pages deployment

### 8. **CDN DEPLOYMENT VALIDATION** ⭐

Critical validation steps:

#### Build Validation
```bash
# Verify plugin builds correctly
npm run build:plugin -- [plugin-id]

# Check bundle includes plugin
npm run build:bundles
grep -r "[plugin-id]" dist/bundles/

# Validate CDN manifest
node -e "console.log(require('./dist/bundles/plugins-manifest.json').plugins['[plugin-id]'])"
```

#### Deployment Validation
```bash
# Test GitHub Pages deployment
curl -I https://srnarasim.github.io/dataprism-plugins/plugins/[plugin-id].html

# Verify CDN bundle accessibility  
curl -I https://srnarasim.github.io/dataprism-plugins/dataprism-plugins.min.js

# Test plugin loading from CDN
node -e "
import('https://srnarasim.github.io/dataprism-plugins/dataprism-plugins.min.js')
  .then(m => console.log('CDN bundle loaded:', Object.keys(m)))
"
```

### 9. Performance Targets

#### Memory and Size Constraints
- Plugin bundle size: <[size]MB compressed for CDN
- Runtime memory: <[memory]MB per plugin instance  
- Initialization time: <[time]s for plugin loading
- Operation latency: <[time]ms for typical operations

#### Scalability Requirements
- Support [number] concurrent operations
- Handle [data size] datasets efficiently
- Maintain performance with [number] active plugin instances

### 10. Security Considerations

#### Plugin Permissions
```typescript
permissions: [
  { resource: "data", access: "read" },
  { resource: "network", access: "write" }, // If external APIs needed
  { resource: "storage", access: "write" }, // If persistence needed
  // ... other permissions
]
```

#### Security Validation
- Input validation and sanitization
- Output validation and security scanning
- Resource quota enforcement
- Audit logging for sensitive operations

### 11. Success Criteria

#### Functional Requirements ✅
- [ ] Plugin implements all required interfaces correctly
- [ ] Core functionality works as specified
- [ ] Integration with DataPrism core is seamless
- [ ] Error handling is comprehensive and graceful

#### Documentation Requirements ✅ **CRITICAL**
- [ ] Main GitHub Pages site updated with plugin information
- [ ] Dedicated plugin documentation page created
- [ ] Plugin included in CDN manifest and deployment workflow
- [ ] Interactive examples and configuration guides provided
- [ ] API documentation is complete with examples
- [ ] Troubleshooting guide addresses common issues

#### Deployment Requirements ✅ **CRITICAL**
- [ ] Plugin registry updated to include new plugin
- [ ] CDN workflow updated to bundle and deploy plugin
- [ ] GitHub Pages deployment includes plugin documentation
- [ ] Plugin accessible via CDN bundles
- [ ] Bundle size and dependencies properly documented

#### Performance Requirements ✅
- [ ] All performance targets met
- [ ] Bundle size within constraints
- [ ] Memory usage optimized
- [ ] Initialization and operation latency acceptable

#### Quality Requirements ✅
- [ ] >90% test coverage including edge cases
- [ ] All security validations pass
- [ ] Performance benchmarks meet targets
- [ ] Code review approval received

### 12. Validation Commands

#### Complete Validation Suite
```bash
# Build and test plugin
npm run build:plugin -- [plugin-id]
npm run test:plugin -- [plugin-id]
npm run test:integration -- [plugin-id]
npm run test:security -- [plugin-id]

# Validate CDN integration
npm run build:bundles
npm run validate:cdn-bundle -- [plugin-id]

# Test documentation
npm run validate:docs -- [plugin-id]
npm run test:examples -- [plugin-id]

# Deploy and verify
git add . && git commit -m "Add [plugin-name] plugin with documentation"
git push origin main
# Wait for GitHub Actions to complete
curl -f https://srnarasim.github.io/dataprism-plugins/plugins/[plugin-id].html
```

## **CRITICAL DOCUMENTATION CHECKLIST** ⭐

Before considering the plugin complete, ensure:

- [ ] **GitHub Pages Updated**: Main site shows new plugin in showcase
- [ ] **Plugin Page Created**: Comprehensive documentation at `/docs/plugins/[plugin-id].html`
- [ ] **CDN Workflow Updated**: `.github/workflows/deploy-cdn.yml` includes plugin
- [ ] **Plugin Registry Updated**: `packages/out-of-box/src/index.ts` includes plugin  
- [ ] **Bundle Configuration Updated**: `vite.config.bundle.ts` includes dependencies
- [ ] **Examples Work**: All code examples in documentation are tested and functional
- [ ] **CDN Accessible**: Plugin available via https://srnarasim.github.io/dataprism-plugins/
- [ ] **Manifest Updated**: Plugin included in `plugins-manifest.json` with correct metadata

## Quality Assurance

The final PRP must include:
- Clear, actionable implementation steps
- Comprehensive documentation and deployment requirements  
- Specific validation criteria with commands
- Complete testing strategy including documentation tests
- Security review checklist
- Performance benchmarks and targets

## Output Format

Save the PRP as `PRPs/[plugin-name].md` following this enhanced template structure.

## Final Validation

Before completing, ensure the PRP:
1. ✅ Addresses all requirements from the feature request
2. ✅ Includes comprehensive documentation and deployment steps
3. ✅ Provides clear validation criteria and commands
4. ✅ Follows DataPrism plugin architecture patterns
5. ✅ Includes complete CDN integration requirements
6. ✅ Specifies GitHub Pages documentation updates
7. ✅ Contains working code examples and patterns

**Remember**: Documentation and deployment are not optional - they are critical requirements for every plugin implementation!