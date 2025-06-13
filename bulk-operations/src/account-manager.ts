/**
 * Account Manager for Bulk Operations
 * 
 * This module handles mass account creation, validation, and management
 * with optimized batch processing and error handling.
 */

import { Account } from '../../types'
import { 
  BulkOperationConfig, 
  BulkAccountCreationOptions, 
  BulkAccountResult,
  AccountValidationResult,
  BulkOperationFailure,
  BulkOperationMetrics,
  ProgressCallback,
  BulkOperationContext
} from '../types/bulk-types'
import { BatchProcessor } from '../utils/batch-processor'
import { createAccount, getToken } from '../../lib/api'

/**
 * Default configuration for account manager
 */
const DEFAULT_CONFIG: BulkOperationConfig = {
  provider: 'duckmail',
  batchSize: 20,
  concurrency: 3,
  requestDelay: 1000,
  maxRetries: 3,
  retryDelay: 2000,
  enableProgressTracking: true,
  enablePerformanceMetrics: true,
}

/**
 * Account Manager class for bulk account operations
 */
export class AccountManager {
  private config: BulkOperationConfig
  private batchProcessor: BatchProcessor
  private progressCallback?: ProgressCallback

  constructor(config: Partial<BulkOperationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.batchProcessor = new BatchProcessor(this.config)
  }

  /**
   * Set progress callback for tracking bulk operations
   */
  setProgressCallback(callback: ProgressCallback): void {
    this.progressCallback = callback
  }

  /**
   * Create multiple accounts in batches
   */
  async createBulkAccounts(options: BulkAccountCreationOptions): Promise<BulkAccountResult> {
    const context = this.createOperationContext('account-creation', options.count)
    
    try {
      this.emitProgress('started', context)
      
      // Generate email addresses
      const emailAddresses = this.generateEmailAddresses(options)
      
      // Create account creation tasks
      const tasks = emailAddresses.map(email => ({
        id: email,
        data: { email, password: options.password }
      }))

      // Process in batches
      const results = await this.batchProcessor.processBatches(
        tasks,
        this.createSingleAccount.bind(this),
        {
          batchSize: options.batchSize || this.config.batchSize,
          concurrency: options.concurrency || this.config.concurrency,
          onProgress: (progress) => this.updateProgress(context, progress)
        }
      )

      // Compile final results
      const successful: Account[] = []
      const failed: BulkOperationFailure[] = []

      for (const batch of results) {
        successful.push(...batch.successful)
        failed.push(...batch.failed)
      }

      const metrics = this.calculateMetrics(context, successful.length, failed.length)
      const summary = this.createSummary(options.count, successful.length, failed.length, metrics)

      const finalResult: BulkAccountResult = {
        successful,
        failed,
        metrics,
        summary
      }

      this.emitProgress('completed', context, finalResult)
      return finalResult

    } catch (error) {
      this.emitProgress('error', context, { error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  /**
   * Validate multiple accounts by attempting authentication
   */
  async validateBulkAccounts(accounts: Account[]): Promise<AccountValidationResult> {
    const context = this.createOperationContext('validation', accounts.length)
    
    try {
      this.emitProgress('started', context)

      const tasks = accounts.map(account => ({
        id: account.id,
        data: account
      }))

      const results = await this.batchProcessor.processBatches(
        tasks,
        this.validateSingleAccount.bind(this),
        {
          batchSize: this.config.batchSize,
          concurrency: this.config.concurrency,
          onProgress: (progress) => this.updateProgress(context, progress)
        }
      )

      const valid: Account[] = []
      const invalid: any[] = []

      for (const batch of results) {
        valid.push(...batch.successful)
        invalid.push(...batch.failed.map(f => ({
          account: accounts.find(a => a.id === f.item),
          reason: f.error,
          details: f.context?.details
        })))
      }

      const metrics = this.calculateMetrics(context, valid.length, invalid.length)
      
      const validationResult: AccountValidationResult = {
        valid,
        invalid,
        metrics,
        summary: {
          totalValidated: accounts.length,
          validCount: valid.length,
          invalidCount: invalid.length,
          validationRate: (valid.length / accounts.length) * 100
        }
      }

      this.emitProgress('completed', context, validationResult)
      return validationResult

    } catch (error) {
      this.emitProgress('error', context, { error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  /**
   * Generate test accounts for development/testing
   */
  async generateTestAccounts(count: number, prefix: string = 'test'): Promise<BulkAccountResult> {
    return this.createBulkAccounts({
      count,
      emailPrefix: prefix,
      domain: 'duckmail.sbs',
      password: 'TestPassword123!',
      metadata: {
        purpose: 'testing',
        createdAt: new Date().toISOString()
      }
    })
  }

  /**
   * Create accounts with custom email patterns
   */
  async createAccountsWithPattern(
    pattern: string, 
    count: number, 
    password: string
  ): Promise<BulkAccountResult> {
    const emails = []
    
    for (let i = 1; i <= count; i++) {
      const email = pattern
        .replace('{index}', i.toString())
        .replace('{timestamp}', Date.now().toString())
        .replace('{random}', Math.random().toString(36).substr(2, 5))
      
      emails.push(email)
    }

    const tasks = emails.map(email => ({
      id: email,
      data: { email, password }
    }))

    const context = this.createOperationContext('account-creation', count)
    
    const results = await this.batchProcessor.processBatches(
      tasks,
      this.createSingleAccount.bind(this),
      {
        batchSize: this.config.batchSize,
        concurrency: this.config.concurrency,
        onProgress: (progress) => this.updateProgress(context, progress)
      }
    )

    const successful: Account[] = []
    const failed: BulkOperationFailure[] = []

    for (const batch of results) {
      successful.push(...batch.successful)
      failed.push(...batch.failed)
    }

    const metrics = this.calculateMetrics(context, successful.length, failed.length)
    const summary = this.createSummary(count, successful.length, failed.length, metrics)

    return {
      successful,
      failed,
      metrics,
      summary
    }
  }

  /**
   * Get account statistics
   */
  getAccountStatistics(accounts: Account[]): {
    total: number
    active: number
    disabled: number
    deleted: number
    totalQuota: number
    totalUsed: number
    averageUsage: number
    providers: Record<string, number>
  } {
    const stats = {
      total: accounts.length,
      active: 0,
      disabled: 0,
      deleted: 0,
      totalQuota: 0,
      totalUsed: 0,
      averageUsage: 0,
      providers: {} as Record<string, number>
    }

    for (const account of accounts) {
      if (account.isDeleted) {
        stats.deleted++
      } else if (account.isDisabled) {
        stats.disabled++
      } else {
        stats.active++
      }

      stats.totalQuota += account.quota
      stats.totalUsed += account.used

      const provider = account.providerId || 'unknown'
      stats.providers[provider] = (stats.providers[provider] || 0) + 1
    }

    stats.averageUsage = stats.total > 0 ? stats.totalUsed / stats.total : 0

    return stats
  }

  /**
   * Create a single account (used by batch processor)
   */
  private async createSingleAccount(data: { email: string; password: string }): Promise<Account> {
    try {
      const account = await createAccount(data.email, data.password, this.config.provider)
      return account
    } catch (error) {
      throw new Error(`Failed to create account ${data.email}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Validate a single account (used by batch processor)
   */
  private async validateSingleAccount(account: Account): Promise<Account> {
    try {
      if (!account.password) {
        throw new Error('Account password not available for validation')
      }

      await getToken(account.address, account.password, account.providerId)
      return account
    } catch (error) {
      throw new Error(`Account validation failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Generate email addresses based on options
   */
  private generateEmailAddresses(options: BulkAccountCreationOptions): string[] {
    const emails: string[] = []
    const timestamp = Date.now()

    for (let i = 1; i <= options.count; i++) {
      let email: string

      if (options.emailPattern) {
        email = options.emailPattern
          .replace('{index}', i.toString())
          .replace('{timestamp}', timestamp.toString())
          .replace('{random}', Math.random().toString(36).substr(2, 5))
      } else {
        const username = `${options.emailPrefix}-${timestamp}-${i}`
        email = `${username}@${options.domain}`
      }

      emails.push(email)
    }

    return emails
  }

  /**
   * Create operation context for tracking
   */
  private createOperationContext(type: string, total: number): BulkOperationContext {
    return {
      operationId: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      operationType: type as any,
      startTime: new Date(),
      progress: {
        currentStep: 'initializing',
        completed: 0,
        total,
        percentage: 0,
        estimatedTimeRemaining: 0,
        currentRate: 0,
        errorCount: 0,
        startTime: new Date(),
        lastUpdate: new Date()
      },
      config: this.config,
      metrics: {
        totalTime: 0,
        apiTime: 0,
        processingTime: 0,
        averageResponseTime: 0,
        requestsPerSecond: 0,
        peakMemoryUsage: 0,
        totalRetries: 0,
        errorRate: 0
      },
      errors: [],
      cancelled: false
    }
  }

  /**
   * Update progress and emit events
   */
  private updateProgress(context: BulkOperationContext, update: any): void {
    context.progress = { ...context.progress, ...update, lastUpdate: new Date() }
    this.emitProgress('progress', context)
  }

  /**
   * Emit progress events
   */
  private emitProgress(type: string, context: BulkOperationContext, data?: any): void {
    if (this.progressCallback) {
      this.progressCallback({
        type: type as any,
        timestamp: new Date(),
        progress: context.progress,
        data
      })
    }
  }

  /**
   * Calculate operation metrics
   */
  private calculateMetrics(context: BulkOperationContext, successCount: number, failureCount: number): BulkOperationMetrics {
    const totalTime = Date.now() - context.startTime.getTime()
    const totalOperations = successCount + failureCount

    return {
      totalTime,
      apiTime: totalTime * 0.8, // Estimate
      processingTime: totalTime * 0.2, // Estimate
      averageResponseTime: totalOperations > 0 ? totalTime / totalOperations : 0,
      requestsPerSecond: totalOperations > 0 ? (totalOperations / totalTime) * 1000 : 0,
      peakMemoryUsage: process.memoryUsage().heapUsed,
      totalRetries: context.errors.reduce((sum, error) => sum + error.retryAttempts, 0),
      errorRate: totalOperations > 0 ? (failureCount / totalOperations) * 100 : 0
    }
  }

  /**
   * Create summary statistics
   */
  private createSummary(attempted: number, successful: number, failed: number, metrics: BulkOperationMetrics) {
    return {
      totalAttempted: attempted,
      successCount: successful,
      failureCount: failed,
      successRate: attempted > 0 ? (successful / attempted) * 100 : 0,
      totalTime: metrics.totalTime,
      averageTimePerAccount: attempted > 0 ? metrics.totalTime / attempted : 0
    }
  }
}
