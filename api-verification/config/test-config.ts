/**
 * Test Configuration for API Verification Module
 * 
 * This file contains all configuration settings for running API verification tests.
 * Modify these settings based on your testing environment and requirements.
 */

export interface TestConfig {
  /** Base URL for the API under test */
  apiBaseUrl: string
  
  /** List of providers to test against */
  providers: string[]
  
  /** Default timeout for API requests (ms) */
  timeout: number
  
  /** Number of retries for failed requests */
  retries: number
  
  /** Test data configuration */
  testData: {
    /** Prefix for test email addresses */
    emailPrefix: string
    /** Default password for test accounts */
    defaultPassword: string
    /** Maximum number of test accounts to create */
    maxTestAccounts: number
  }
  
  /** Performance thresholds */
  performance: {
    /** Maximum acceptable response time for API calls (ms) */
    maxResponseTime: number
    /** Maximum acceptable time for account creation (ms) */
    maxAccountCreationTime: number
    /** Maximum acceptable time for message retrieval (ms) */
    maxMessageRetrievalTime: number
  }
  
  /** Rate limiting configuration */
  rateLimiting: {
    /** Delay between requests to avoid rate limiting (ms) */
    requestDelay: number
    /** Maximum requests per minute for testing */
    maxRequestsPerMinute: number
  }
  
  /** Cleanup configuration */
  cleanup: {
    /** Whether to automatically cleanup test data */
    autoCleanup: boolean
    /** How long to keep test data before cleanup (hours) */
    dataRetentionHours: number
  }
}

/**
 * Default test configuration
 */
export const testConfig: TestConfig = {
  apiBaseUrl: process.env.TEST_API_BASE_URL || 'http://localhost:3000/api/mail',
  
  providers: [
    'duckmail',
    'mailtm',
    // Add custom providers as needed
  ],
  
  timeout: 30000, // 30 seconds
  retries: 3,
  
  testData: {
    emailPrefix: 'test-api-verification',
    defaultPassword: 'TestPassword123!',
    maxTestAccounts: 50,
  },
  
  performance: {
    maxResponseTime: 5000, // 5 seconds
    maxAccountCreationTime: 10000, // 10 seconds
    maxMessageRetrievalTime: 3000, // 3 seconds
  },
  
  rateLimiting: {
    requestDelay: 1000, // 1 second between requests
    maxRequestsPerMinute: 30,
  },
  
  cleanup: {
    autoCleanup: true,
    dataRetentionHours: 24,
  },
}

/**
 * Provider-specific configurations
 */
export const providerConfigs = {
  duckmail: {
    baseUrl: 'https://api.duckmail.sbs',
    mercureUrl: 'https://mercure.duckmail.sbs/.well-known/mercure',
    supportedFeatures: ['accounts', 'messages', 'realtime'],
    rateLimits: {
      accountCreation: 10, // per minute
      messageRetrieval: 60, // per minute
    },
  },
  
  mailtm: {
    baseUrl: 'https://api.mail.tm',
    mercureUrl: 'https://mercure.mail.tm/.well-known/mercure',
    supportedFeatures: ['accounts', 'messages', 'realtime'],
    rateLimits: {
      accountCreation: 5, // per minute
      messageRetrieval: 30, // per minute
    },
  },
}

/**
 * Test environment detection
 */
export const getTestEnvironment = (): 'development' | 'staging' | 'production' => {
  const env = process.env.NODE_ENV || 'development'
  if (env === 'production') return 'production'
  if (env === 'staging') return 'staging'
  return 'development'
}

/**
 * Get configuration for specific test environment
 */
export const getEnvironmentConfig = (): Partial<TestConfig> => {
  const environment = getTestEnvironment()
  
  switch (environment) {
    case 'production':
      return {
        timeout: 60000, // Longer timeout for production
        retries: 5,
        rateLimiting: {
          requestDelay: 2000, // More conservative in production
          maxRequestsPerMinute: 15,
        },
      }
    
    case 'staging':
      return {
        timeout: 45000,
        retries: 4,
        rateLimiting: {
          requestDelay: 1500,
          maxRequestsPerMinute: 20,
        },
      }
    
    default: // development
      return {
        timeout: 30000,
        retries: 3,
        rateLimiting: {
          requestDelay: 500, // Faster in development
          maxRequestsPerMinute: 60,
        },
      }
  }
}

/**
 * Merge default config with environment-specific overrides
 */
export const getFinalConfig = (): TestConfig => {
  const envConfig = getEnvironmentConfig()
  return {
    ...testConfig,
    ...envConfig,
    testData: {
      ...testConfig.testData,
      ...envConfig.testData,
    },
    performance: {
      ...testConfig.performance,
      ...envConfig.performance,
    },
    rateLimiting: {
      ...testConfig.rateLimiting,
      ...envConfig.rateLimiting,
    },
    cleanup: {
      ...testConfig.cleanup,
      ...envConfig.cleanup,
    },
  }
}

/**
 * Validate configuration
 */
export const validateConfig = (config: TestConfig): void => {
  if (!config.apiBaseUrl) {
    throw new Error('API base URL is required')
  }
  
  if (config.providers.length === 0) {
    throw new Error('At least one provider must be configured')
  }
  
  if (config.timeout <= 0) {
    throw new Error('Timeout must be positive')
  }
  
  if (config.retries < 0) {
    throw new Error('Retries cannot be negative')
  }
  
  console.log('✅ Test configuration validated successfully')
}

// Validate configuration on import
validateConfig(getFinalConfig())
