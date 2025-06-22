/**
 * Type Definitions for Bulk Operations
 * 
 * This module contains all TypeScript interfaces and types used
 * throughout the bulk operations system.
 */

import { Account, Message, MessageDetail } from '../../types'

/**
 * Configuration for bulk operations
 */
export interface BulkOperationConfig {
  /** API provider to use */
  provider: string
  
  /** Number of items to process in each batch */
  batchSize: number
  
  /** Number of concurrent batches to process */
  concurrency: number
  
  /** Delay between requests (ms) */
  requestDelay: number
  
  /** Maximum number of retries for failed operations */
  maxRetries: number
  
  /** Delay between retries (ms) */
  retryDelay: number
  
  /** Enable progress tracking */
  enableProgressTracking: boolean
  
  /** Enable performance metrics collection */
  enablePerformanceMetrics: boolean
}

/**
 * Options for bulk account creation
 */
export interface BulkAccountCreationOptions {
  /** Number of accounts to create */
  count: number
  
  /** Prefix for generated email addresses */
  emailPrefix: string
  
  /** Email domain to use */
  domain: string
  
  /** Password for all accounts */
  password: string
  
  /** Custom batch size (overrides config) */
  batchSize?: number
  
  /** Custom concurrency (overrides config) */
  concurrency?: number
  
  /** Custom email generation pattern */
  emailPattern?: string
  
  /** Additional metadata to store with accounts */
  metadata?: Record<string, any>
}

/**
 * Result of bulk account creation
 */
export interface BulkAccountResult {
  /** Successfully created accounts */
  successful: Account[]
  
  /** Failed account creation attempts */
  failed: BulkOperationFailure[]
  
  /** Performance and timing metrics */
  metrics: BulkOperationMetrics
  
  /** Summary statistics */
  summary: {
    totalAttempted: number
    successCount: number
    failureCount: number
    successRate: number
    totalTime: number
    averageTimePerAccount: number
  }
}

/**
 * Information about a failed bulk operation
 */
export interface BulkOperationFailure {
  /** Item that failed (email, account ID, etc.) */
  item: string
  
  /** Error message */
  error: string
  
  /** HTTP status code if applicable */
  statusCode?: number
  
  /** Timestamp of failure */
  timestamp: Date
  
  /** Number of retry attempts made */
  retryAttempts: number
  
  /** Additional context about the failure */
  context?: Record<string, any>
}

/**
 * Performance metrics for bulk operations
 */
export interface BulkOperationMetrics {
  /** Total operation time (ms) */
  totalTime: number
  
  /** Time spent on actual API requests (ms) */
  apiTime: number
  
  /** Time spent on processing/overhead (ms) */
  processingTime: number
  
  /** Average response time per request (ms) */
  averageResponseTime: number
  
  /** Requests per second */
  requestsPerSecond: number
  
  /** Peak memory usage (bytes) */
  peakMemoryUsage: number
  
  /** Number of retries performed */
  totalRetries: number
  
  /** Error rate (percentage) */
  errorRate: number
}

/**
 * Progress tracking information
 */
export interface BulkOperationProgress {
  /** Current step/phase */
  currentStep: string
  
  /** Items completed */
  completed: number
  
  /** Total items to process */
  total: number
  
  /** Progress percentage (0-100) */
  percentage: number
  
  /** Estimated time remaining (ms) */
  estimatedTimeRemaining: number
  
  /** Current processing rate (items/second) */
  currentRate: number
  
  /** Errors encountered so far */
  errorCount: number
  
  /** Start time */
  startTime: Date
  
  /** Last update time */
  lastUpdate: Date
}

/**
 * Options for message retrieval
 */
export interface MessageRetrievalOptions {
  /** Filtering criteria */
  filterBy?: MessageFilterCriteria
  
  /** Maximum messages to retrieve per account */
  maxMessagesPerAccount?: number
  
  /** Whether to include full message content */
  includeContent?: boolean
  
  /** Sorting criteria */
  sortBy?: MessageSortCriteria
  
  /** Date range for message retrieval */
  dateRange?: DateRange
  
  /** Custom batch size for this operation */
  batchSize?: number
}

/**
 * Message filtering criteria
 */
export interface MessageFilterCriteria {
  /** Filter by theme/topic */
  theme?: string | string[]
  
  /** Filter by sender email address */
  senderEmail?: string | string[]
  
  /** Filter by sender domain */
  senderDomain?: string | string[]
  
  /** Filter by subject keywords */
  subjectKeywords?: string[]
  
  /** Filter by message content keywords */
  contentKeywords?: string[]
  
  /** Filter by read/unread status */
  isRead?: boolean
  
  /** Filter by attachment presence */
  hasAttachments?: boolean
  
  /** Minimum message size (bytes) */
  minSize?: number
  
  /** Maximum message size (bytes) */
  maxSize?: number
}

/**
 * Message sorting criteria
 */
export interface MessageSortCriteria {
  /** Field to sort by */
  field: 'createdAt' | 'updatedAt' | 'size' | 'subject' | 'from'
  
  /** Sort direction */
  direction: 'asc' | 'desc'
}

/**
 * Date range specification
 */
export interface DateRange {
  /** Start date (inclusive) */
  start: Date
  
  /** End date (inclusive) */
  end: Date
}

/**
 * Export options
 */
export interface ExportOptions {
  /** Export format */
  format: 'csv' | 'json' | 'xlsx' | 'xml'
  
  /** Output filename */
  filename: string
  
  /** Whether to include sensitive data */
  includeSensitiveData?: boolean
  
  /** Custom field selection */
  fields?: string[]
  
  /** Maximum records per file */
  maxRecordsPerFile?: number
  
  /** Compression options */
  compression?: {
    enabled: boolean
    format: 'gzip' | 'zip'
  }
}

/**
 * Account export options
 */
export interface AccountExportOptions extends ExportOptions {
  /** Include account credentials */
  includeCredentials?: boolean
  
  /** Include account statistics */
  includeStatistics?: boolean
  
  /** Include provider information */
  includeProviderInfo?: boolean
}

/**
 * Message export options
 */
export interface MessageExportOptions extends ExportOptions {
  /** Include full message content */
  includeContent?: boolean
  
  /** Include message attachments info */
  includeAttachments?: boolean
  
  /** Include sender details */
  includeSenderDetails?: boolean
  
  /** Export format for message content */
  contentFormat?: 'text' | 'html' | 'both'
}

/**
 * Statistics export options
 */
export interface StatisticsExportOptions extends ExportOptions {
  /** Include charts/visualizations */
  includeCharts?: boolean
  
  /** Chart types to include */
  chartTypes?: ('bar' | 'pie' | 'line' | 'scatter')[]
  
  /** Statistical measures to include */
  measures?: ('count' | 'average' | 'median' | 'percentiles')[]
}

/**
 * Account validation result
 */
export interface AccountValidationResult {
  /** Valid accounts */
  valid: Account[]
  
  /** Invalid accounts with reasons */
  invalid: AccountValidationFailure[]
  
  /** Validation metrics */
  metrics: BulkOperationMetrics
  
  /** Summary statistics */
  summary: {
    totalValidated: number
    validCount: number
    invalidCount: number
    validationRate: number
  }
}

/**
 * Account validation failure
 */
export interface AccountValidationFailure {
  /** Account that failed validation */
  account: Account
  
  /** Validation error reason */
  reason: string
  
  /** Error details */
  details?: string
  
  /** Suggested fix */
  suggestedFix?: string
}

/**
 * Batch processing result
 */
export interface BatchResult<T> {
  /** Successfully processed items */
  successful: T[]
  
  /** Failed items */
  failed: BulkOperationFailure[]
  
  /** Batch metrics */
  metrics: {
    batchSize: number
    processingTime: number
    successRate: number
  }
}

/**
 * Message grouping result
 */
export interface MessageGrouping {
  /** Grouping key (domain, theme, etc.) */
  key: string
  
  /** Messages in this group */
  messages: Message[]
  
  /** Group statistics */
  statistics: {
    count: number
    totalSize: number
    averageSize: number
    dateRange: DateRange
    readPercentage: number
  }
}

/**
 * Bulk operation event for progress tracking
 */
export interface BulkOperationEvent {
  /** Event type */
  type: 'started' | 'progress' | 'completed' | 'error' | 'cancelled'
  
  /** Event timestamp */
  timestamp: Date
  
  /** Progress information */
  progress?: BulkOperationProgress
  
  /** Error information (for error events) */
  error?: string
  
  /** Additional event data */
  data?: Record<string, any>
}

/**
 * Callback function for progress updates
 */
export type ProgressCallback = (event: BulkOperationEvent) => void

/**
 * Filter function for custom message filtering
 */
export type MessageFilterFunction = (message: Message) => boolean

/**
 * Transform function for data processing
 */
export type DataTransformFunction<T, U> = (item: T) => U

/**
 * Bulk operation context for tracking state
 */
export interface BulkOperationContext {
  /** Unique operation ID */
  operationId: string
  
  /** Operation type */
  operationType: 'account-creation' | 'message-retrieval' | 'validation' | 'export'
  
  /** Start time */
  startTime: Date
  
  /** Current progress */
  progress: BulkOperationProgress
  
  /** Configuration used */
  config: BulkOperationConfig
  
  /** Accumulated metrics */
  metrics: BulkOperationMetrics
  
  /** Error log */
  errors: BulkOperationFailure[]
  
  /** Cancellation token */
  cancelled: boolean
}
