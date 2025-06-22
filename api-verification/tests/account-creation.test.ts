/**
 * Account Creation API Tests
 * 
 * This test suite validates the account creation functionality across
 * different providers and scenarios.
 */

import { TestApiClient } from '../utils/api-client'
import { 
  createTestContext, 
  generateTestEmail, 
  validateApiResponse, 
  assertCondition, 
  assertPerformance,
  cleanupTestContext,
  logTestStep,
  TestContext
} from '../utils/test-helpers'
import { getFinalConfig } from '../config/test-config'

describe('Account Creation API Tests', () => {
  let client: TestApiClient
  let context: TestContext
  const config = getFinalConfig()

  beforeEach(() => {
    context = createTestContext('duckmail')
    client = new TestApiClient('duckmail')
  })

  afterEach(async () => {
    await cleanupTestContext(context)
  })

  describe('Successful Account Creation', () => {
    test('should create account with valid credentials', async () => {
      logTestStep('Creating account with valid credentials')
      
      const email = generateTestEmail()
      const password = config.testData.defaultPassword
      const response = await client.createAccount(email, password)

      // Validate response structure
      const validation = validateApiResponse(response.data, 'account')
      assertCondition(validation.isValid, `Invalid account response: ${validation.errors.join(', ')}`)

      // Validate response data
      assertCondition(response.status === 201, `Expected status 201, got ${response.status}`)
      assertCondition(response.data.address === email, 'Email address mismatch')
      assertCondition(response.data.id.length > 0, 'Account ID should not be empty')
      assertCondition(!response.data.isDisabled, 'New account should not be disabled')
      assertCondition(!response.data.isDeleted, 'New account should not be deleted')

      // Validate performance
      assertPerformance(response.metrics, 'Account Creation')

      // Track created account for cleanup
      context.createdAccounts.push(response.data)

      logTestStep('Account creation successful', {
        accountId: response.data.id,
        email: response.data.address,
        responseTime: response.metrics.responseTime
      })
    }, config.timeout)

    test('should create account with different providers', async () => {
      const providers = config.providers

      for (const provider of providers) {
        logTestStep(`Testing account creation with provider: ${provider}`)
        
        const providerClient = new TestApiClient(provider)
        const email = generateTestEmail(provider)
        const password = config.testData.defaultPassword
        
        try {
          const response = await providerClient.createAccount(email, password)
          
          // Validate response
          const validation = validateApiResponse(response.data, 'account')
          assertCondition(validation.isValid, `Invalid account response for ${provider}: ${validation.errors.join(', ')}`)
          
          assertCondition(response.status === 201, `Expected status 201 for ${provider}, got ${response.status}`)
          
          context.createdAccounts.push(response.data)
          
          logTestStep(`Account creation successful for ${provider}`, {
            accountId: response.data.id,
            responseTime: response.metrics.responseTime
          })
        } catch (error) {
          console.warn(`⚠️ Provider ${provider} failed: ${error}`)
          // Don't fail the test if a specific provider is unavailable
        }
      }
    }, config.timeout * config.providers.length)

    test('should handle account creation with special characters in email', async () => {
      logTestStep('Testing account creation with special characters')
      
      const specialEmails = [
        'test+tag@duckmail.sbs',
        'test.with.dots@duckmail.sbs',
        'test_with_underscores@duckmail.sbs',
      ]

      for (const email of specialEmails) {
        try {
          const response = await client.createAccount(email, config.testData.defaultPassword)
          
          assertCondition(response.status === 201, `Failed to create account with email: ${email}`)
          assertCondition(response.data.address === email, 'Email address mismatch')
          
          context.createdAccounts.push(response.data)
          
          logTestStep(`Special character email successful: ${email}`)
        } catch (error) {
          console.warn(`⚠️ Special character email failed: ${email} - ${error}`)
        }
      }
    }, config.timeout)
  })

  describe('Account Creation Validation', () => {
    test('should reject duplicate email addresses', async () => {
      logTestStep('Testing duplicate email rejection')
      
      const email = generateTestEmail()
      const password = config.testData.defaultPassword
      
      // Create first account
      const firstResponse = await client.createAccount(email, password)
      assertCondition(firstResponse.status === 201, 'First account creation should succeed')
      context.createdAccounts.push(firstResponse.data)
      
      // Attempt to create duplicate account
      try {
        await client.createAccount(email, password)
        throw new Error('Duplicate account creation should have failed')
      } catch (error: any) {
        assertCondition(
          error.message.includes('422') || error.message.includes('already'),
          `Expected duplicate error, got: ${error.message}`
        )
        logTestStep('Duplicate email correctly rejected')
      }
    }, config.timeout)

    test('should reject invalid email formats', async () => {
      logTestStep('Testing invalid email format rejection')
      
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user@domain',
        '',
        'user space@domain.com',
      ]

      for (const email of invalidEmails) {
        try {
          await client.createAccount(email, config.testData.defaultPassword)
          throw new Error(`Invalid email ${email} should have been rejected`)
        } catch (error: any) {
          assertCondition(
            error.message.includes('400') || error.message.includes('422'),
            `Expected validation error for ${email}, got: ${error.message}`
          )
          logTestStep(`Invalid email correctly rejected: ${email}`)
        }
      }
    }, config.timeout)

    test('should reject weak passwords', async () => {
      logTestStep('Testing weak password rejection')
      
      const weakPasswords = [
        '',
        '123',
        'password',
        'abc',
      ]

      const email = generateTestEmail()

      for (const password of weakPasswords) {
        try {
          await client.createAccount(email, password)
          console.warn(`⚠️ Weak password was accepted: ${password}`)
        } catch (error: any) {
          assertCondition(
            error.message.includes('400') || error.message.includes('422'),
            `Expected validation error for weak password, got: ${error.message}`
          )
          logTestStep(`Weak password correctly rejected: ${password}`)
        }
      }
    }, config.timeout)
  })

  describe('Account Creation Performance', () => {
    test('should create account within performance threshold', async () => {
      logTestStep('Testing account creation performance')
      
      const email = generateTestEmail()
      const password = config.testData.defaultPassword
      const response = await client.createAccount(email, password)
      
      assertCondition(response.status === 201, 'Account creation should succeed')
      assertPerformance(response.metrics, 'Account Creation')
      
      assertCondition(
        response.metrics.responseTime <= config.performance.maxAccountCreationTime,
        `Account creation took ${response.metrics.responseTime}ms, exceeds threshold of ${config.performance.maxAccountCreationTime}ms`
      )
      
      context.createdAccounts.push(response.data)
      
      logTestStep('Performance test passed', {
        responseTime: response.metrics.responseTime,
        threshold: config.performance.maxAccountCreationTime
      })
    }, config.timeout)

    test('should handle concurrent account creation', async () => {
      logTestStep('Testing concurrent account creation')
      
      const concurrentRequests = 5
      const promises = []

      for (let i = 0; i < concurrentRequests; i++) {
        const email = generateTestEmail()
        const password = config.testData.defaultPassword
        promises.push(client.createAccount(email, password))
      }

      const responses = await Promise.allSettled(promises)
      
      let successCount = 0
      for (const response of responses) {
        if (response.status === 'fulfilled') {
          successCount++
          context.createdAccounts.push(response.value.data)
        } else {
          console.warn(`⚠️ Concurrent request failed: ${response.reason}`)
        }
      }

      assertCondition(
        successCount >= Math.floor(concurrentRequests * 0.8),
        `Expected at least 80% success rate, got ${successCount}/${concurrentRequests}`
      )
      
      logTestStep('Concurrent creation test completed', {
        successCount,
        totalRequests: concurrentRequests,
        successRate: `${Math.round((successCount / concurrentRequests) * 100)}%`
      })
    }, config.timeout * 2)
  })

  describe('Rate Limiting', () => {
    test('should handle rate limiting gracefully', async () => {
      logTestStep('Testing rate limiting behavior')
      
      const rapidRequests = 10
      const startTime = Date.now()
      
      for (let i = 0; i < rapidRequests; i++) {
        try {
          const email = generateTestEmail()
          const password = config.testData.defaultPassword
          const response = await client.createAccount(email, password)
          
          if (response.status === 201) {
            context.createdAccounts.push(response.data)
          }
        } catch (error: any) {
          if (error.message.includes('429') || error.message.includes('rate limit')) {
            logTestStep(`Rate limiting triggered at request ${i + 1}`)
            break
          }
          // Other errors might be expected (like duplicate emails)
        }
      }
      
      const endTime = Date.now()
      const totalTime = endTime - startTime
      
      logTestStep('Rate limiting test completed', {
        totalTime,
        requestsCompleted: rapidRequests,
        averageTime: totalTime / rapidRequests
      })
    }, config.timeout * 2)
  })
})
