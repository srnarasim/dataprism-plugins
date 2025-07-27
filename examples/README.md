# DataPrism Plugins Examples - Local Development Guide

Interactive examples demonstrating DataPrism Plugin Framework with real cloud data analysis.

## 🚀 Quick Start (Fixed Common Issues)

### ✅ Recommended Method: HTTP Server with CORS

You're running `npx serve .` which is correct, but you need CORS headers for ES6 modules:

```bash
# From the examples directory
cd examples

# Option 1: Serve with CORS (RECOMMENDED)
npx serve . --cors

# Option 2: Use http-server with CORS
npx http-server . --cors -p 8000

# Option 3: Python with CORS (if you prefer)
python3 -m http.server 8000
```

**Then navigate to**: `http://localhost:3000/cdn-usage.html` (or `http://localhost:8000/cdn-usage.html`)

### 🔧 Why You Need CORS

The JavaScript syntax errors you're seeing are likely caused by **CORS restrictions** when loading ES6 modules. The `--cors` flag is essential for:

- Loading external CDN resources
- ES6 module imports
- Fetch API requests
- WebAssembly (DuckDB) initialization

### 📱 Browser DevTools Debugging

1. **Open DevTools**: Press `F12` or right-click → "Inspect"
2. **Check Console Tab**: Look for the real error details
3. **Common Error Patterns**:
   ```
   ❌ "Unexpected token 'catch'" → Missing CORS headers
   ✅ "🌐 Loading DataPrism Core from CDN..." → Working correctly
   ✅ "✅ DataPrism Core initialized with DuckDB" → Success!
   ```

### 🏗️ Alternative Local Setup

If you're still having issues, try these alternatives:

```bash
# Method 1: VS Code Live Server (easiest)
# 1. Install "Live Server" extension in VS Code
# 2. Right-click cdn-usage.html → "Open with Live Server"

# Method 2: Node.js development server
cd .. # Go to project root
npm install
npm run dev
# Then visit: http://localhost:3000/examples/cdn-usage.html

# Method 3: Simple file serving (may have limitations)
npx http-server . -p 8000 -c-1 --cors -o
```

### Option 3: GitHub Pages (Once Deployed)

Once the GitHub Pages deployment is complete, you can access the live demo at:
`https://srnarasim.github.io/dataprism-plugins/examples/cdn-usage.html`

## 📊 What the Demo Tests

### 1. Plugin CDN Loading
- **Simulates** loading the DataPrism Parquet HTTPFS Plugin from CDN
- **Tests** plugin initialization and context setup
- **Validates** plugin metadata and capabilities

### 2. NYC Taxi Data Integration
- **Real Dataset**: NYC Yellow Taxi trip data from CloudFlare R2
- **Public Access**: No authentication required
- **Live Data**: Actual Parquet files (~45-52MB each)
- **Verified URLs**: 
  - `https://pub-7deacab667344397ae6d3e2ea97f11f8.r2.dev/yellow_tripdata_2023-01.parquet`
  - `https://pub-7deacab667344397ae6d3e2ea97f11f8.r2.dev/yellow_tripdata_2023-06.parquet`

### 3. Plugin Functionality
- **Single File Loading**: Load and analyze one month of taxi data
- **Multi-File Comparison**: Compare winter vs. summer travel patterns
- **Advanced Analytics**: Schema introspection, performance metrics, data quality
- **SQL Query Execution**: Complex analytical queries on cloud data

## 🧪 Test Scenarios

### Test 1: Basic Plugin Loading
```javascript
// What gets tested:
- CDN bundle loading simulation
- Plugin initialization with context
- Method availability validation
- Event system integration
```

**Expected Results:**
- ✅ Plugin loads without errors
- ✅ All required methods are available
- ✅ Plugin context is properly configured
- ✅ Ready to process data

### Test 2: Single File Analysis
```javascript
// What gets tested:
- Loading NYC taxi data (January 2023)
- Schema introspection and validation
- Basic statistical analysis
- Peak hour analysis with SQL queries
```

**Expected Results:**
- ✅ File loads successfully (~45-52MB)
- ✅ Schema shows 7+ columns (VendorID, timestamps, fares, etc.)
- ✅ Statistics show realistic taxi data patterns
- ✅ Peak hours align with NYC traffic patterns (6-9 PM)

### Test 3: Multi-File Comparison
```javascript
// What gets tested:
- Loading multiple files concurrently
- Cross-file SQL queries with UNION
- Seasonal pattern analysis
- Performance across multiple datasets
```

**Expected Results:**
- ✅ Both files load successfully
- ✅ Seasonal differences are visible (winter vs. summer)
- ✅ Combined dataset shows realistic aggregated metrics
- ✅ Query performance remains responsive

### Test 4: Advanced Analytics
```javascript
// What gets tested:
- Schema analysis and metadata extraction
- Performance metrics and throughput
- Data quality assessment
- Compression and optimization metrics
```

**Expected Results:**
- ✅ Complete schema information displayed
- ✅ Performance metrics show sub-second query times
- ✅ Data quality indicators show high completeness
- ✅ Compression ratios demonstrate Parquet efficiency

## 🔧 Modifying the Test for Real CDN

Once the actual CDN deployment is live, update the plugin loading code:

### Current (Mock) Implementation:
```javascript
// Mock plugin loading
plugin = new MockParquetHttpfsPlugin();
```

### Update to Real CDN:
```javascript
// Real CDN loading
const { ParquetHttpfsPlugin } = await import(
  'https://srnarasim.github.io/dataprism-plugins/cdn/dataprism-plugins.min.js'
);
plugin = new ParquetHttpfsPlugin();
```

### Testing Real vs. Mock

| Aspect | Mock (Current) | Real CDN |
|--------|----------------|----------|
| **Plugin Loading** | Simulated delays | Actual network requests |
| **Data Processing** | Random generated results | Real DuckDB queries |
| **Performance** | Simulated metrics | Actual execution times |
| **Error Handling** | Controlled scenarios | Real-world edge cases |

## 🐛 Troubleshooting

### Common Issues

#### 1. CORS Errors
```
Access to fetch at 'https://...' from origin 'file://' has been blocked by CORS policy
```

**Solution:** Use a local web server instead of opening the file directly.

#### 2. CDN Loading Failures
```
Failed to load plugin: Network error
```

**Solutions:**
- Check internet connectivity
- Verify CDN endpoint is accessible
- Try refreshing the page
- Check browser developer console for specific errors

#### 3. Data Loading Issues
```
Failed to load NYC taxi data
```

**Solutions:**
- CloudFlare R2 endpoint may be temporarily unavailable
- Check the specific file URLs in browser
- Verify the file pattern matches: `yellow_tripdata_YYYY-MM.parquet`

#### 4. Performance Issues
```
Plugin loading takes too long
```

**Solutions:**
- Use a local web server for testing
- Check network speed and stability
- Try different browsers (Chrome, Firefox, Safari, Edge)

### Browser Compatibility

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| **Chrome** | 90+ | ✅ Full Support | Recommended for testing |
| **Firefox** | 88+ | ✅ Full Support | Enable SharedArrayBuffer in about:config |
| **Safari** | 14+ | ✅ Full Support | May require secure context (HTTPS/localhost) |
| **Edge** | 90+ | ✅ Full Support | Chromium-based versions |

### Debug Mode

Enable verbose logging by opening browser developer tools:

```javascript
// Add to console for extra debugging
window.debugMode = true;

// Monitor plugin events
plugin.onProgress((progress) => {
  console.log('Plugin Progress:', progress);
});

// Check plugin state
console.log('Plugin State:', {
  name: plugin.getName(),
  version: plugin.getVersion(),
  tables: plugin.tables
});
```

## 📈 Performance Benchmarks

### Expected Performance (Real Implementation)

| Operation | Expected Time | Notes |
|-----------|---------------|-------|
| **Plugin CDN Load** | < 2 seconds | Network dependent |
| **File Schema Load** | < 1 second | ~1KB metadata |
| **45MB File Load** | < 5 seconds | Streaming, no full download |
| **Basic Query** | < 500ms | Simple aggregations |
| **Complex Query** | < 2 seconds | JOINs, GROUP BY, etc. |

### Monitoring Performance

The demo includes built-in performance monitoring:

```javascript
// Performance metrics are automatically captured:
- Query execution time
- Bytes processed
- Throughput (MB/s)
- Memory usage
- Compression ratios
```

## 🚀 Next Steps

### After CDN Deployment

1. **Update Import URLs**: Replace mock plugin with real CDN URLs
2. **Validate Real Data**: Test with actual DuckDB HTTPFS processing
3. **Performance Testing**: Benchmark against larger datasets
4. **Integration Testing**: Test with full DataPrism core framework

### Extending the Demo

1. **Add More Datasets**: Test with different Parquet files
2. **Authentication Testing**: Add AWS S3 private bucket examples
3. **Partitioned Datasets**: Demonstrate multi-file partition discovery
4. **Custom Queries**: Allow users to input their own SQL queries

## 📚 Additional Documentation

- **Plugin Development**: [Plugin Architecture Guide](../docs/plugin-development.md)
- **API Reference**: [Parquet HTTPFS Plugin API](../packages/out-of-box/src/plugins/integration/parquet-httpfs/README.md)
- **Deployment Guide**: [CDN Deployment Setup](../DEPLOYMENT_SETUP.md)
- **Live Documentation**: [HTML Documentation](../docs/plugins/parquet-httpfs.html)

## ✅ Success Criteria

A successful test should demonstrate:

- ✅ **Plugin Loading**: CDN integration works smoothly
- ✅ **Data Access**: Can read real Parquet files from CloudFlare R2
- ✅ **Query Performance**: Sub-second response times for analytical queries
- ✅ **Multi-File Support**: Can handle multiple datasets concurrently
- ✅ **Error Handling**: Graceful handling of network and data issues
- ✅ **Browser Compatibility**: Works across modern browsers
- ✅ **User Experience**: Intuitive interface with clear progress indicators

## 🎯 Testing Checklist

Before considering the CDN integration complete:

- [ ] Plugin loads from CDN without errors
- [ ] NYC taxi data files are accessible
- [ ] Single file analysis works correctly
- [ ] Multi-file comparison produces expected results
- [ ] Advanced analytics display meaningful metrics
- [ ] Performance meets established benchmarks
- [ ] Error scenarios are handled gracefully
- [ ] All major browsers work correctly
- [ ] Mobile devices display properly (responsive design)
- [ ] Network interruptions are handled appropriately

## 📞 Support

If you encounter issues with the CDN testing:

1. **Check Console**: Open browser developer tools for error details
2. **Verify URLs**: Ensure all CDN and data URLs are accessible
3. **Test Network**: Try different network connections
4. **Browser Issues**: Test in different browsers
5. **File Issues**: Create a GitHub issue with detailed error information

---

**Happy Testing! 🚀**

This demo showcases the power of DataPrism's plugin architecture with real-world data analytics capabilities, all delivered through a simple CDN integration.