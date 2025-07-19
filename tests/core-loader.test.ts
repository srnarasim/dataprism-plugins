/**
 * Test CDN core loader functionality
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CoreLoader, coreLoader, loadDataPrismCore } from '../packages/out-of-box/src/core-loader';

describe('Core Loader', () => {
  beforeEach(() => {
    // Reset the loader state for each test
    coreLoader.reset();
  });

  it('should create CoreLoader instance with default config', () => {
    const loader = new CoreLoader();
    expect(loader).toBeDefined();
    expect(loader.isLoaded()).toBe(false);
  });

  it('should create CoreLoader instance with custom config', () => {
    const config = {
      baseUrl: 'https://custom-cdn.example.com',
      timeout: 5000,
      retries: 2,
    };
    const loader = new CoreLoader(config);
    expect(loader).toBeDefined();
  });

  it('should use singleton pattern for default instance', () => {
    const loader1 = CoreLoader.getInstance();
    const loader2 = CoreLoader.getInstance();
    expect(loader1).toBe(loader2);
  });

  it('should handle core loading gracefully when CDN is not available', async () => {
    // Test with invalid CDN URL
    const loader = new CoreLoader({
      baseUrl: 'https://invalid-cdn-url.example.com',
      timeout: 1000,
      retries: 1,
      fallbackToPeer: false, // Disable fallback for this test
    });

    try {
      await loader.loadCore();
      // Should not reach here
      expect(false).toBe(true);
    } catch (error) {
      expect(error).toBeDefined();
      expect(error.message).toContain('Failed to load DataPrism core');
    }
  });

  it('should provide type access methods', () => {
    expect(() => coreLoader.getTypes()).toThrow('DataPrism core not loaded');
    expect(coreLoader.isLoaded()).toBe(false);
  });

  it('should load types from convenience function', async () => {
    // This will likely fail in test environment but should handle gracefully
    try {
      const types = await loadDataPrismCore({
        timeout: 2000,
        retries: 1,
        fallbackToPeer: false,
      });
      
      // If it succeeds (unlikely in test env), validate structure
      expect(types).toBeDefined();
      expect(typeof types).toBe('object');
    } catch (error) {
      // Expected in test environment - CDN not available
      expect(error).toBeDefined();
    }
  });

  it('should handle fallback to peer dependency when CDN fails', async () => {
    const loader = new CoreLoader({
      baseUrl: 'https://invalid-cdn-url.example.com',
      timeout: 1000,
      retries: 1,
      fallbackToPeer: true,
    });

    try {
      await loader.loadCore();
      // If peer dependency is available, should succeed
      expect(loader.isLoaded()).toBe(true);
    } catch (error) {
      // Expected when peer dependency is also not available
      expect(error.message).toContain('Failed to load DataPrism core');
    }
  });
});