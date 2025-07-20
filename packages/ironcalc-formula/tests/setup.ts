// Test setup for Vitest
import { vi } from 'vitest';

// Global test setup
beforeAll(() => {
  // Setup global mocks
});

afterAll(() => {
  // Cleanup global state
});

// Mock WebAssembly environment for testing
global.WebAssembly = {
  compile: vi.fn(),
  compileStreaming: vi.fn(),
  instantiate: vi.fn(),
  instantiateStreaming: vi.fn(),
  validate: vi.fn()
} as any;

// Mock performance API
global.performance = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByType: vi.fn(() => []),
  getEntriesByName: vi.fn(() => []),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn()
} as any;

// Mock console for cleaner test output
global.console = {
  ...console,
  debug: vi.fn(),
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
} as any;