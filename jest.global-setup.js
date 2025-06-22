// Global setup for Jest tests
// This runs once before all tests

module.exports = async () => {
  console.log('🚀 Setting up test environment...')
  
  // Set up global test configuration
  global.__TEST_CONFIG__ = {
    startTime: Date.now(),
    apiBaseUrl: process.env.TEST_API_BASE_URL || 'http://localhost:3000/api/mail',
    providers: (process.env.TEST_PROVIDERS || 'duckmail').split(','),
    timeout: parseInt(process.env.TEST_TIMEOUT || '30000'),
  }
  
  // Initialize test data cleanup tracking
  global.__TEST_CLEANUP__ = {
    createdAccounts: [],
    createdMessages: [],
    testContexts: []
  }
  
  console.log('✅ Test environment setup complete')
  console.log(`   API Base URL: ${global.__TEST_CONFIG__.apiBaseUrl}`)
  console.log(`   Providers: ${global.__TEST_CONFIG__.providers.join(', ')}`)
  console.log(`   Timeout: ${global.__TEST_CONFIG__.timeout}ms`)
}
