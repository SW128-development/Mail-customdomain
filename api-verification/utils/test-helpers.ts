/**
 * Test Helper Utilities for API Verification
 * 
 * This module provides common utilities and helper functions for API testing,
 * including response validation, performance measurement, and test data management.
 */

import { Account, Message, MessageDetail, Domain } from '../../types'
import { testConfig, getFinalConfig } from '../config/test-config'

/**
 * Test execution context for tracking test state
 */
export interface TestContext {
  testId: string
  startTime: number
  createdAccounts: Account[]
  createdMessages: Message[]
  provider: string
}

/**
 * API Response validation result
 */
export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Performance measurement result
 */
export interface PerformanceMetrics {
  responseTime: number
  requestSize: number
  responseSize: number
  timestamp: number
}

/**
 * Create a new test context
 */
export const createTestContext = (provider: string = 'duckmail'): TestContext => {
  return {
    testId: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    startTime: Date.now(),
    createdAccounts: [],
    createdMessages: [],
    provider,
  }
}

/**
 * Generate a unique test email address
 */
export const generateTestEmail = (provider: string = 'duckmail', domain?: string): string => {
  const config = getFinalConfig()
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 5)
  const username = `${config.testData.emailPrefix}-${timestamp}-${random}`
  
  // Use provided domain or default based on provider
  const emailDomain = domain || getDefaultDomainForProvider(provider)
  return `${username}@${emailDomain}`
}

/**
 * Get default domain for a provider (for testing purposes)
 */
export const getDefaultDomainForProvider = (provider: string): string => {
  const domainMap: Record<string, string> = {
    duckmail: 'duckmail.sbs',
    mailtm: '1secmail.com',
  }
  return domainMap[provider] || 'duckmail.sbs'
}

/**
 * Validate API response structure and content
 */
export const validateApiResponse = (
  response: any,
  expectedType: 'account' | 'message' | 'messageDetail' | 'domain' | 'token'
): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  }

  if (!response) {
    result.isValid = false
    result.errors.push('Response is null or undefined')
    return result
  }

  switch (expectedType) {
    case 'account':
      validateAccountResponse(response, result)
      break
    case 'message':
      validateMessageResponse(response, result)
      break
    case 'messageDetail':
      validateMessageDetailResponse(response, result)
      break
    case 'domain':
      validateDomainResponse(response, result)
      break
    case 'token':
      validateTokenResponse(response, result)
      break
    default:
      result.errors.push(`Unknown response type: ${expectedType}`)
      result.isValid = false
  }

  return result
}

/**
 * Validate account response structure
 */
const validateAccountResponse = (account: any, result: ValidationResult): void => {
  const requiredFields = ['id', 'address', 'quota', 'used', 'isDisabled', 'isDeleted', 'createdAt', 'updatedAt']
  
  for (const field of requiredFields) {
    if (!(field in account)) {
      result.errors.push(`Missing required field: ${field}`)
      result.isValid = false
    }
  }

  // Validate field types
  if (typeof account.id !== 'string') {
    result.errors.push('Account ID must be a string')
    result.isValid = false
  }

  if (typeof account.address !== 'string' || !account.address.includes('@')) {
    result.errors.push('Account address must be a valid email string')
    result.isValid = false
  }

  if (typeof account.quota !== 'number' || account.quota < 0) {
    result.errors.push('Account quota must be a non-negative number')
    result.isValid = false
  }

  if (typeof account.used !== 'number' || account.used < 0) {
    result.errors.push('Account used space must be a non-negative number')
    result.isValid = false
  }
}

/**
 * Validate message response structure
 */
const validateMessageResponse = (message: any, result: ValidationResult): void => {
  const requiredFields = ['id', 'accountId', 'msgid', 'from', 'to', 'subject', 'intro', 'seen', 'createdAt']
  
  for (const field of requiredFields) {
    if (!(field in message)) {
      result.errors.push(`Missing required field: ${field}`)
      result.isValid = false
    }
  }

  // Validate from field structure
  if (message.from && (typeof message.from.address !== 'string' || !message.from.address.includes('@'))) {
    result.errors.push('Message from.address must be a valid email')
    result.isValid = false
  }

  // Validate to field structure
  if (message.to && (!Array.isArray(message.to) || message.to.length === 0)) {
    result.errors.push('Message to field must be a non-empty array')
    result.isValid = false
  }
}

/**
 * Validate message detail response structure
 */
const validateMessageDetailResponse = (messageDetail: any, result: ValidationResult): void => {
  // First validate as regular message
  validateMessageResponse(messageDetail, result)
  
  // Then validate additional fields
  const additionalFields = ['text', 'html']
  
  for (const field of additionalFields) {
    if (!(field in messageDetail)) {
      result.warnings.push(`Missing optional field: ${field}`)
    }
  }

  if (messageDetail.html && !Array.isArray(messageDetail.html)) {
    result.errors.push('Message html field must be an array')
    result.isValid = false
  }
}

/**
 * Validate domain response structure
 */
const validateDomainResponse = (domain: any, result: ValidationResult): void => {
  const requiredFields = ['id', 'domain', 'isActive']
  
  for (const field of requiredFields) {
    if (!(field in domain)) {
      result.errors.push(`Missing required field: ${field}`)
      result.isValid = false
    }
  }

  if (typeof domain.domain !== 'string' || !domain.domain.includes('.')) {
    result.errors.push('Domain must be a valid domain string')
    result.isValid = false
  }
}

/**
 * Validate token response structure
 */
const validateTokenResponse = (tokenResponse: any, result: ValidationResult): void => {
  const requiredFields = ['token', 'id']
  
  for (const field of requiredFields) {
    if (!(field in tokenResponse)) {
      result.errors.push(`Missing required field: ${field}`)
      result.isValid = false
    }
  }

  if (typeof tokenResponse.token !== 'string' || tokenResponse.token.length < 10) {
    result.errors.push('Token must be a string with at least 10 characters')
    result.isValid = false
  }
}

/**
 * Measure API call performance
 */
export const measurePerformance = async <T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<{ result: T; metrics: PerformanceMetrics }> => {
  const startTime = performance.now()
  const startTimestamp = Date.now()
  
  try {
    const result = await operation()
    const endTime = performance.now()
    
    const metrics: PerformanceMetrics = {
      responseTime: endTime - startTime,
      requestSize: 0, // Would need to be calculated based on request
      responseSize: JSON.stringify(result).length,
      timestamp: startTimestamp,
    }

    // Log performance if it exceeds thresholds
    const config = getFinalConfig()
    if (metrics.responseTime > config.performance.maxResponseTime) {
      console.warn(`⚠️ Performance warning: ${operationName} took ${metrics.responseTime.toFixed(2)}ms (threshold: ${config.performance.maxResponseTime}ms)`)
    }

    return { result, metrics }
  } catch (error) {
    const endTime = performance.now()
    console.error(`❌ Performance measurement failed for ${operationName}: ${error}`)
    throw error
  }
}

/**
 * Wait for a specified amount of time (for rate limiting)
 */
export const wait = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Cleanup test data
 */
export const cleanupTestContext = async (context: TestContext): Promise<void> => {
  const config = getFinalConfig()
  
  if (!config.cleanup.autoCleanup) {
    console.log('🔧 Auto-cleanup disabled, skipping cleanup')
    return
  }

  console.log(`🧹 Cleaning up test context ${context.testId}`)
  
  // Note: Actual cleanup implementation would depend on having delete APIs available
  // For now, we'll just log what would be cleaned up
  
  if (context.createdAccounts.length > 0) {
    console.log(`📧 Would cleanup ${context.createdAccounts.length} test accounts`)
    // TODO: Implement account deletion when API supports it
  }

  console.log(`✅ Cleanup completed for test context ${context.testId}`)
}

/**
 * Assert that a condition is true, with detailed error message
 */
export const assertCondition = (condition: boolean, message: string, context?: any): void => {
  if (!condition) {
    const errorMessage = context 
      ? `Assertion failed: ${message}\nContext: ${JSON.stringify(context, null, 2)}`
      : `Assertion failed: ${message}`
    throw new Error(errorMessage)
  }
}

/**
 * Assert that response time is within acceptable limits
 */
export const assertPerformance = (metrics: PerformanceMetrics, operation: string): void => {
  const config = getFinalConfig()
  const threshold = config.performance.maxResponseTime
  
  assertCondition(
    metrics.responseTime <= threshold,
    `${operation} response time (${metrics.responseTime.toFixed(2)}ms) exceeds threshold (${threshold}ms)`,
    { metrics, operation }
  )
}

/**
 * Generate random string for testing
 */
export const generateRandomString = (length: number = 8): string => {
  return Math.random().toString(36).substr(2, length)
}

/**
 * Log test step with formatting
 */
export const logTestStep = (step: string, details?: any): void => {
  const timestamp = new Date().toISOString()
  console.log(`🔍 [${timestamp}] ${step}`)
  if (details) {
    console.log(`   Details: ${JSON.stringify(details, null, 2)}`)
  }
}
