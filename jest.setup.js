// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock fetch for testing
global.fetch = jest.fn()

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeEach(() => {
  // Reset fetch mock before each test
  fetch.mockClear()
  
  // Mock console.error to suppress expected error messages in tests
  console.error = jest.fn((message) => {
    // Only suppress specific expected errors, log others
    if (typeof message === 'string' && (
      message.includes('Warning:') ||
      message.includes('Expected') ||
      message.includes('Test error')
    )) {
      return
    }
    originalConsoleError(message)
  })
  
  // Mock console.warn to suppress expected warnings
  console.warn = jest.fn((message) => {
    // Only suppress specific expected warnings
    if (typeof message === 'string' && (
      message.includes('⚠️') ||
      message.includes('Provider') ||
      message.includes('Test warning')
    )) {
      return
    }
    originalConsoleWarn(message)
  })
})

afterEach(() => {
  // Restore console methods
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})

// Global test utilities
global.testUtils = {
  // Utility to wait for async operations
  waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Utility to create mock responses
  createMockResponse: (data, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Map([['content-type', 'application/json']])
  }),
  
  // Utility to create mock fetch responses
  mockFetchResponse: (data, status = 200) => {
    fetch.mockResolvedValueOnce(global.testUtils.createMockResponse(data, status))
  },
  
  // Utility to create mock fetch error
  mockFetchError: (error) => {
    fetch.mockRejectedValueOnce(new Error(error))
  }
}

// Set up environment variables for testing
process.env.NODE_ENV = 'test'
process.env.TEST_API_BASE_URL = 'http://localhost:3000/api/mail'
process.env.TEST_PROVIDERS = 'duckmail,mailtm'
process.env.TEST_TIMEOUT = '30000'
