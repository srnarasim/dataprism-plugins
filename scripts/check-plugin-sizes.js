#!/usr/bin/env node
/**
 * Plugin Bundle Size Checker
 * Validates that plugin bundles are within acceptable size limits
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MAX_PLUGIN_SIZE = 1024 * 1024; // 1MB limit per plugin
const DIST_PATHS = [
  path.join(__dirname, '..', 'dist'),
  path.join(__dirname, '..', 'packages', 'out-of-box', 'dist'),
  path.join(__dirname, '..', 'packages', 'dist')
];

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (err) {
    return 0;
  }
}

function checkPluginSizes() {
  console.log('🔍 Checking plugin bundle sizes...');
  
  // Find which dist path exists
  let distPath = null;
  for (const testPath of DIST_PATHS) {
    if (fs.existsSync(testPath)) {
      distPath = testPath;
      console.log(`📁 Found dist directory: ${distPath}`);
      break;
    }
  }
  
  if (!distPath) {
    console.log('✅ No dist directory found - builds not generated yet');
    return true;
  }

  // Check for actual build artifacts based on current build structure
  const artifacts = [
    'index.js',    // Main plugin bundle
    'index.cjs'    // CommonJS bundle
  ];

  let allPassed = true;
  let foundAnyArtifact = false;

  artifacts.forEach(artifact => {
    const artifactPath = path.join(distPath, artifact);
    const size = getFileSize(artifactPath);
    
    if (size === 0) {
      console.log(`⚠️  ${artifact}: No bundle found`);
      return;
    }

    foundAnyArtifact = true;
    const sizeMB = (size / (1024 * 1024)).toFixed(2);
    const sizeKB = (size / 1024).toFixed(2);
    
    // Use more reasonable size limits for combined bundles
    const limit = artifact.includes('.cjs') ? 512 * 1024 : MAX_PLUGIN_SIZE; // 512KB for CJS, 1MB for ESM
    const status = size <= limit ? '✅' : '❌';
    
    console.log(`${status} ${artifact}: ${sizeMB}MB (${sizeKB}KB)`);
    
    if (size > limit) {
      allPassed = false;
      console.log(`    ❌ Size exceeds limit of ${(limit / (1024 * 1024)).toFixed(2)}MB`);
    }
  });

  // Also check workers if they exist
  const workersPath = path.join(distPath, 'workers');
  if (fs.existsSync(workersPath)) {
    const workerFiles = fs.readdirSync(workersPath).filter(f => f.endsWith('.js'));
    workerFiles.forEach(worker => {
      const workerPath = path.join(workersPath, worker);
      const size = getFileSize(workerPath);
      if (size > 0) {
        foundAnyArtifact = true;
        const sizeMB = (size / (1024 * 1024)).toFixed(2);
        const sizeKB = (size / 1024).toFixed(2);
        const workerLimit = 256 * 1024; // 256KB for workers
        const status = size <= workerLimit ? '✅' : '❌';
        console.log(`${status} workers/${worker}: ${sizeMB}MB (${sizeKB}KB)`);
        
        if (size > workerLimit) {
          allPassed = false;
        }
      }
    });
  }

  if (!foundAnyArtifact) {
    console.log('⚠️  No build artifacts found in dist directory');
  }

  return allPassed;
}

const passed = checkPluginSizes();
process.exit(passed ? 0 : 1);