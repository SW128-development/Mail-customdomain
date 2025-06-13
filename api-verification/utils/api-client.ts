/**
 * Dedicated API Client for Testing
 * 
 * This module provides a specialized API client for testing purposes,
 * with enhanced logging, error handling, and performance monitoring.
 */

import { Account, Message, MessageDetail, Domain } from '../../types'
import { getFinalConfig, providerConfigs } from '../config/test-config'
import { PerformanceMetrics, measurePerformance, wait } from './test-helpers'

/**
 * API Client configuration
 */
export interface ApiClientConfig {
  baseUrl: string
  provider: string
  timeout: number
  retries: number
  enableLogging: boolean
  enablePerformanceTracking: boolean
}

/**
 * API Request options
 */
export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: any
  timeout?: number
  retries?: number
}

/**
 * API Response wrapper
 */
export interface ApiResponse<T> {
  data: T
  status: number
  headers: Record<string, string>
  metrics: PerformanceMetrics
}

/**
 * Test API Client class
 */
export class TestApiClient {
  private config: ApiClientConfig
  private requestCount: number = 0
  private lastRequestTime: number = 0

  constructor(provider: string = 'duckmail', overrides: Partial<ApiClientConfig> = {}) {
    const testConfig = getFinalConfig()
    
    this.config = {
      baseUrl: testConfig.apiBaseUrl,
      provider,
      timeout: testConfig.timeout,
      retries: testConfig.retries,
      enableLogging: true,
      enablePerformanceTracking: true,
      ...overrides,
    }

    this.log(`🔧 Test API Client initialized for provider: ${provider}`)
  }

  /**
   * Make a raw API request with full control
   */
  async request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    await this.enforceRateLimit()
    
    const operation = async () => {
      const url = `${this.config.baseUrl}?endpoint=${encodeURIComponent(endpoint)}`
      const requestOptions: RequestInit = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Provider-Base-URL': this.getProviderBaseUrl(),
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(options.timeout || this.config.timeout),
      }

      this.log(`📡 ${requestOptions.method} ${endpoint}`, {
        provider: this.config.provider,
        headers: requestOptions.headers,
        body: options.body,
      })

      const response = await fetch(url, requestOptions)
      
      if (!response.ok) {
        const errorText = await response.text()
        this.log(`❌ Request failed: ${response.status} ${response.statusText}`, { errorText })
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      let data: T
      const contentType = response.headers.get('content-type')
      
      if (contentType?.includes('application/json')) {
        data = await response.json()
      } else if (response.status === 204) {
        data = null as T
      } else {
        data = await response.text() as T
      }

      this.log(`✅ Request successful: ${response.status}`, { 
        contentType,
        dataSize: JSON.stringify(data).length 
      })

      return {
        data,
        status: response.status,
        headers: responseHeaders,
      }
    }

    if (this.config.enablePerformanceTracking) {
      const { result, metrics } = await measurePerformance(operation, `${options.method || 'GET'} ${endpoint}`)
      return { ...result, metrics }
    } else {
      const result = await operation()
      return { 
        ...result, 
        metrics: { responseTime: 0, requestSize: 0, responseSize: 0, timestamp: Date.now() }
      }
    }
  }

  /**
   * Create a new account
   */
  async createAccount(address: string, password: string): Promise<ApiResponse<Account>> {
    return this.request<Account>('/accounts', {
      method: 'POST',
      body: { address, password },
    })
  }

  /**
   * Get authentication token
   */
  async getToken(address: string, password: string): Promise<ApiResponse<{ token: string; id: string }>> {
    return this.request<{ token: string; id: string }>('/token', {
      method: 'POST',
      body: { address, password },
    })
  }

  /**
   * Get account information
   */
  async getAccount(token: string): Promise<ApiResponse<Account>> {
    return this.request<Account>('/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
  }

  /**
   * Get messages with pagination
   */
  async getMessages(token: string, page: number = 1): Promise<ApiResponse<{ 'hydra:member': Message[]; 'hydra:totalItems': number }>> {
    return this.request<{ 'hydra:member': Message[]; 'hydra:totalItems': number }>(`/messages?page=${page}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  }

  /**
   * Get a specific message
   */
  async getMessage(token: string, messageId: string): Promise<ApiResponse<MessageDetail>> {
    return this.request<MessageDetail>(`/messages/${messageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(token: string, messageId: string): Promise<ApiResponse<{ seen: boolean }>> {
    return this.request<{ seen: boolean }>(`/messages/${messageId}`, {
      method: 'PATCH',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/merge-patch+json',
      },
      body: { seen: true },
    })
  }

  /**
   * Delete a message
   */
  async deleteMessage(token: string, messageId: string): Promise<ApiResponse<null>> {
    return this.request<null>(`/messages/${messageId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  }

  /**
   * Delete an account
   */
  async deleteAccount(token: string, accountId: string): Promise<ApiResponse<null>> {
    return this.request<null>(`/accounts/${accountId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  }

  /**
   * Get available domains
   */
  async getDomains(): Promise<ApiResponse<{ 'hydra:member': Domain[] }>> {
    return this.request<{ 'hydra:member': Domain[] }>('/domains')
  }

  /**
   * Perform a complete account workflow (create, authenticate, get info)
   */
  async performAccountWorkflow(address: string, password: string): Promise<{
    account: Account
    token: string
    accountInfo: Account
    metrics: {
      accountCreation: PerformanceMetrics
      authentication: PerformanceMetrics
      accountRetrieval: PerformanceMetrics
      total: PerformanceMetrics
    }
  }> {
    const startTime = performance.now()

    // Create account
    const accountResponse = await this.createAccount(address, password)
    
    // Get token
    const tokenResponse = await this.getToken(address, password)
    
    // Get account info
    const accountInfoResponse = await this.getAccount(tokenResponse.data.token)

    const endTime = performance.now()

    return {
      account: accountResponse.data,
      token: tokenResponse.data.token,
      accountInfo: accountInfoResponse.data,
      metrics: {
        accountCreation: accountResponse.metrics,
        authentication: tokenResponse.metrics,
        accountRetrieval: accountInfoResponse.metrics,
        total: {
          responseTime: endTime - startTime,
          requestSize: 0,
          responseSize: 0,
          timestamp: Date.now(),
        },
      },
    }
  }

  /**
   * Test message retrieval with pagination
   */
  async testMessagePagination(token: string, maxPages: number = 5): Promise<{
    totalMessages: number
    pages: number
    averageResponseTime: number
    messages: Message[]
  }> {
    const messages: Message[] = []
    const responseTimes: number[] = []
    let page = 1
    let hasMore = true

    while (hasMore && page <= maxPages) {
      const response = await this.getMessages(token, page)
      const pageMessages = response.data['hydra:member']
      
      messages.push(...pageMessages)
      responseTimes.push(response.metrics.responseTime)
      
      // Check if there are more pages (assuming 30 messages per page)
      hasMore = pageMessages.length === 30
      page++
    }

    return {
      totalMessages: messages.length,
      pages: page - 1,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      messages,
    }
  }

  /**
   * Get provider base URL
   */
  private getProviderBaseUrl(): string {
    const provider = providerConfigs[this.config.provider as keyof typeof providerConfigs]
    return provider?.baseUrl || 'https://api.duckmail.sbs'
  }

  /**
   * Enforce rate limiting
   */
  private async enforceRateLimit(): Promise<void> {
    const config = getFinalConfig()
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < config.rateLimiting.requestDelay) {
      const waitTime = config.rateLimiting.requestDelay - timeSinceLastRequest
      this.log(`⏱️ Rate limiting: waiting ${waitTime}ms`)
      await wait(waitTime)
    }

    this.lastRequestTime = Date.now()
    this.requestCount++
  }

  /**
   * Log messages with formatting
   */
  private log(message: string, details?: any): void {
    if (!this.config.enableLogging) return

    const timestamp = new Date().toISOString()
    console.log(`🔍 [${timestamp}] [${this.config.provider}] ${message}`)
    
    if (details) {
      console.log(`   Details:`, details)
    }
  }

  /**
   * Get client statistics
   */
  getStats(): {
    requestCount: number
    provider: string
    config: ApiClientConfig
  } {
    return {
      requestCount: this.requestCount,
      provider: this.config.provider,
      config: this.config,
    }
  }

  /**
   * Reset client state
   */
  reset(): void {
    this.requestCount = 0
    this.lastRequestTime = 0
    this.log('🔄 Client state reset')
  }
}
