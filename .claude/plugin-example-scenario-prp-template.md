# Plugin Example Scenario PRP Template

## Overview
This template provides a comprehensive framework for creating production-ready example scenarios for DataPrism plugins, incorporating all lessons learned from the Parquet HTTPFS plugin implementation.

---

# Product Requirements Prompt: {PLUGIN_NAME} Example Scenario

## 1. Executive Summary

### Objective
Create a comprehensive, production-ready example scenario for the **{PLUGIN_NAME}** plugin that demonstrates real-world usage through CDN deployment, interactive demos, and robust error handling.

### Success Criteria
- [ ] CDN-deployable example that works in any browser
- [ ] Real-world dataset integration (not mock data)
- [ ] Comprehensive error handling and fallback mechanisms
- [ ] Interactive UI with progress indicators and detailed logging
- [ ] Cross-browser compatibility and CORS handling
- [ ] Production-ready deployment via GitHub Pages
- [ ] Comprehensive documentation and user guidance

## 2. Plugin Context Analysis

### Plugin Information
- **Plugin Name**: {PLUGIN_NAME}
- **Plugin Type**: {PLUGIN_TYPE} (processing/integration/visualization/utility)
- **Primary Interface**: {INTERFACE_TYPE} (IDataProcessorPlugin/IIntegrationPlugin/etc.)
- **Key Dependencies**: {LIST_DEPENDENCIES}
- **Bundle Size**: ~{ESTIMATED_SIZE}KB

### Core Capabilities
List the plugin's main features:
- {CAPABILITY_1}
- {CAPABILITY_2}
- {CAPABILITY_3}

### Technical Requirements
- **DataPrism Core Integration**: {CORE_FEATURES_USED}
- **Browser Compatibility**: {BROWSER_REQUIREMENTS}
- **External Services**: {EXTERNAL_DEPENDENCIES}
- **Security Considerations**: {SECURITY_NOTES}

## 3. Example Scenario Design

### Real-World Use Case
**Scenario Description**: {DETAILED_SCENARIO_DESCRIPTION}

**Target Audience**: {PRIMARY_USERS}

**Business Value**: {VALUE_PROPOSITION}

### Dataset Requirements
- **Data Source**: {DATA_SOURCE_URL_OR_TYPE}
- **Data Format**: {FORMAT} 
- **Data Size**: ~{SIZE}
- **Update Frequency**: {FREQUENCY}
- **Access Method**: {ACCESS_PATTERN}
- **CORS Considerations**: {CORS_STATUS}

### Interactive Features
Define what users can do in the demo:
1. **{FEATURE_1}**: {DESCRIPTION}
2. **{FEATURE_2}**: {DESCRIPTION}
3. **{FEATURE_3}**: {DESCRIPTION}
4. **{FEATURE_4}**: {DESCRIPTION}

## 4. Technical Implementation Requirements

### CDN Integration Architecture
```
DataPrism Core (CDN) → Plugin Framework (CDN) → {PLUGIN_NAME} Plugin → External Data Source
                                    ↓
                            Interactive Web Interface
                                    ↓
                            Real-time Results Display
```

### Core Components Required

#### 4.1 Plugin Loading System
- **CDN Bundle Integration**: Load from `https://srnarasim.github.io/dataprism-plugins/cdn/`
- **Fallback Mechanisms**: Handle CDN failures gracefully
- **Version Compatibility**: Ensure DataPrism Core compatibility
- **Initialization Sequence**: Proper async loading order

#### 4.2 Data Source Integration
- **Primary Data Source**: {PRIMARY_SOURCE}
- **Backup Data Sources**: {BACKUP_SOURCES}
- **Authentication**: {AUTH_REQUIREMENTS}
- **Rate Limiting**: {RATE_LIMITS}
- **Error Recovery**: {ERROR_HANDLING_STRATEGY}

#### 4.3 User Interface Components
- **Loading States**: Progress bars with meaningful messages
- **Interactive Controls**: Buttons for different demo scenarios
- **Results Display**: Formatted output with visual hierarchy
- **Error Messages**: User-friendly error explanations
- **Debug Console**: Technical logging for developers

#### 4.4 Error Handling Strategy
Based on Parquet HTTPFS lessons learned:

**Data Access Errors**:
- Network failures → Show retry mechanisms
- CORS issues → Automatic fallback strategies  
- Authentication errors → Clear user guidance
- Rate limiting → Graceful degradation

**Plugin Errors**:
- Load failures → CDN fallback options
- Initialization errors → Detailed error messages
- Runtime errors → Partial functionality maintenance
- Resource exhaustion → Memory/performance warnings

**User Experience Errors**:
- Browser compatibility → Feature detection
- Performance issues → Loading indicators
- UI responsiveness → Async operation handling
- Mobile compatibility → Responsive design

## 5. Data Format Handling

### Input Data Processing
Learn from DuckDB result format challenges:

**Expected Formats**:
- Array format: `[value1, value2, value3]`
- Object format: `{column1: value1, column2: value2}`
- Mixed formats: Handle both dynamically

**Robust Data Extraction**:
```typescript
// Template for handling multiple data formats
function extractValues(result: any): ProcessedData {
  if (!result?.data || result.data.length === 0) {
    return { error: 'No data available' };
  }
  
  const firstRow = result.data[0];
  
  if (Array.isArray(firstRow)) {
    // Handle array format
    return processArrayFormat(result.data);
  } else if (typeof firstRow === 'object' && firstRow !== null) {
    // Handle object format  
    return processObjectFormat(result.data);
  } else {
    // Handle edge cases
    return processFallbackFormat(result.data);
  }
}
```

### Schema Validation
- **Type Detection**: Automatic schema inference
- **Validation Rules**: Data quality checks
- **Error Reporting**: Clear validation messages
- **Fallback Handling**: Graceful schema mismatches

## 6. User Interface Specifications

### Layout Requirements
- **Header Section**: Plugin name, description, and key features
- **Control Panel**: Interactive buttons and configuration options
- **Progress Indicators**: Visual feedback for long operations
- **Results Section**: Formatted output with data visualization
- **Debug Section**: Collapsible technical information
- **Footer**: Links to documentation and source code

### Responsive Design
- **Desktop**: Full-featured experience
- **Tablet**: Condensed but functional layout
- **Mobile**: Essential features with touch-friendly controls

### Accessibility
- **Keyboard Navigation**: All functions accessible via keyboard
- **Screen Reader Support**: Proper ARIA labels and descriptions
- **Color Contrast**: WCAG AA compliance
- **Font Scaling**: Support for user font preferences

## 7. Testing Strategy

### Browser Compatibility Testing
- **Chrome**: Latest + 2 previous versions
- **Firefox**: Latest + 2 previous versions  
- **Safari**: Latest + 1 previous version
- **Edge**: Latest version

### Network Condition Testing
- **High-speed**: Optimal experience
- **3G**: Graceful degradation
- **Offline**: Clear offline messaging
- **Intermittent**: Retry mechanisms

### Data Source Testing
- **Primary Source**: Full functionality verification
- **Backup Sources**: Fallback mechanism testing
- **Error Conditions**: Comprehensive error handling
- **Edge Cases**: Boundary condition testing

### Performance Testing
- **Initial Load**: < 5 seconds on 3G
- **Data Processing**: Progress indicators for > 2 second operations
- **Memory Usage**: Monitor for memory leaks
- **CPU Usage**: Efficient processing algorithms

## 8. Documentation Requirements

### User Documentation
- **Getting Started**: Quick start guide
- **Feature Overview**: What the demo demonstrates
- **Troubleshooting**: Common issues and solutions
- **Browser Requirements**: Compatibility information

### Developer Documentation
- **Architecture**: How the example is structured
- **Integration**: How to adapt for other use cases
- **API Reference**: Plugin-specific methods and properties
- **Extension Guide**: How to build similar examples

### Code Documentation
- **Inline Comments**: Explain complex logic
- **Function Documentation**: JSDoc comments
- **Configuration**: Environment-specific settings
- **Deployment**: GitHub Pages setup instructions

## 9. Deployment Strategy

### GitHub Pages Integration
- **Workflow Integration**: Automatic deployment on push
- **CDN Synchronization**: Ensure examples match deployed plugins
- **Version Management**: Handle plugin version updates
- **Rollback Strategy**: Quick reversion for issues

### CDN Optimization
- **Bundle Analysis**: Monitor bundle size impact
- **Loading Performance**: Optimize for fast initial load
- **Caching Strategy**: Appropriate cache headers
- **Compression**: Gzip/Brotli optimization

## 10. Quality Assurance Checklist

### Pre-Deployment Verification
- [ ] All interactive features work correctly
- [ ] Error handling covers edge cases
- [ ] Performance is acceptable across devices
- [ ] Documentation is complete and accurate
- [ ] Cross-browser testing passes
- [ ] Data sources are accessible and stable
- [ ] CDN integration functions properly
- [ ] Mobile experience is usable

### Post-Deployment Monitoring
- [ ] Analytics show successful user engagement
- [ ] Error rates are within acceptable limits
- [ ] Performance metrics meet targets
- [ ] User feedback is positive
- [ ] Data sources remain accessible
- [ ] CDN availability is high

## 11. Success Metrics

### Technical Metrics
- **Load Time**: < 3 seconds initial load
- **Error Rate**: < 5% user-facing errors
- **Browser Support**: 95%+ compatibility
- **Uptime**: 99%+ availability

### User Engagement Metrics
- **Demo Completion Rate**: > 70%
- **Feature Usage**: All major features used
- **Return Visits**: Users exploring multiple scenarios
- **Developer Adoption**: Integration in other projects

## 12. Lessons Learned Integration

### From Parquet HTTPFS Experience

**Data Source Management**:
- Always verify data source URLs before deployment
- Have backup data sources ready
- Test CORS handling thoroughly
- Monitor data source availability

**Result Processing**:
- Handle multiple data format possibilities
- Add comprehensive debugging for data extraction
- Provide fallback values for missing data
- Log data structure details for troubleshooting

**Error Handling**:
- Distinguish between different error types
- Provide actionable error messages
- Implement graceful degradation
- Add retry mechanisms for transient failures

**User Experience**:
- Show progress for long operations
- Provide detailed logging in console
- Make debug information easily accessible
- Guide users through troubleshooting steps

**Deployment**:
- Test CDN deployment thoroughly
- Verify all links work after deployment
- Monitor for 404 errors on navigation
- Ensure consistent URL structure

## 13. Implementation Phases

### Phase 1: Core Example (Week 1)
- [ ] Basic plugin integration
- [ ] Primary data source connection
- [ ] Essential interactive features
- [ ] Basic error handling

### Phase 2: Enhanced Features (Week 2)
- [ ] Advanced interactive capabilities
- [ ] Comprehensive error handling
- [ ] Performance optimization
- [ ] Cross-browser testing

### Phase 3: Production Polish (Week 3)
- [ ] UI/UX refinement
- [ ] Comprehensive documentation
- [ ] Deployment automation
- [ ] Quality assurance testing

### Phase 4: Launch & Monitor (Week 4)
- [ ] Production deployment
- [ ] User feedback collection
- [ ] Performance monitoring
- [ ] Issue resolution

---

## Template Usage Instructions

1. **Copy this template** for each new plugin example scenario
2. **Replace all {PLACEHOLDER} values** with plugin-specific information
3. **Customize sections** based on plugin type and requirements
4. **Add plugin-specific technical details** in relevant sections
5. **Define success criteria** specific to the plugin's use case
6. **Create implementation timeline** based on complexity
7. **Review lessons learned** from previous plugin implementations

## Quality Gates

Before considering the PRP complete:
- [ ] All placeholders have been replaced with specific values
- [ ] Technical requirements are clearly defined
- [ ] Success criteria are measurable
- [ ] Implementation phases are realistic
- [ ] Error handling strategy is comprehensive
- [ ] Testing strategy covers all major scenarios
- [ ] Documentation requirements are complete

---

*This template incorporates lessons learned from the Parquet HTTPFS plugin implementation, including data source management, result processing challenges, CDN deployment complexities, and user experience optimization.*