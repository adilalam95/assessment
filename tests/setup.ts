// Global test setup
import { jest } from '@jest/globals';

// Set up environment variables for testing
process.env.NODE_ENV = 'test';

// Mock console.warn to reduce noise in tests
const originalWarn = console.warn;
beforeEach(() => {
  console.warn = jest.fn();
});

afterEach(() => {
  console.warn = originalWarn;
});

// Increase timeout for async operations
jest.setTimeout(30000);