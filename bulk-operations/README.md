# Bulk Operations Module

This module provides comprehensive bulk operations capabilities for the DuckMail email system, including mass account creation, bulk message retrieval, and data export functionality.

## Features

- **Mass Account Creation**: Create hundreds of email accounts with batch processing
- **Bulk Message Retrieval**: Efficiently retrieve messages from multiple accounts
- **Advanced Filtering**: Filter messages by themes, topics, sender domains, and more
- **Multi-Format Export**: Export data in CSV, JSON, and other formats
- **Performance Optimization**: Optimized for handling large datasets
- **Progress Tracking**: Real-time progress monitoring for long-running operations
- **Error Recovery**: Robust error handling and retry mechanisms
- **Rate Limiting**: Built-in rate limiting to respect API constraints

## Directory Structure

```
bulk-operations/
├── src/                      # Core functionality
│   ├── account-manager.ts    # Mass account creation and management
│   ├── message-processor.ts  # Bulk message retrieval and processing
│   ├── export-manager.ts     # Data export in various formats
│   └── performance-optimizer.ts # Performance optimization utilities
├── types/                    # Type definitions
│   └── bulk-types.ts         # Interfaces for bulk operations
├── utils/                    # Utility functions
│   ├── batch-processor.ts    # Batch processing utilities
│   └── filter-engine.ts      # Message filtering logic
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- TypeScript
- Access to DuckMail API or compatible service

### Installation

```bash
# Install dependencies (from project root)
npm install

# Install additional bulk operation dependencies
npm install --save csv-writer xlsx papaparse
```

### Basic Usage

#### Mass Account Creation

```typescript
import { AccountManager } from './src/account-manager'

const accountManager = new AccountManager({
  provider: 'duckmail',
  batchSize: 10,
  concurrency: 3
})

// Create 100 accounts
const result = await accountManager.createBulkAccounts({
  count: 100,
  emailPrefix: 'bulk-test',
  domain: 'duckmail.sbs',
  password: 'SecurePassword123!'
})

console.log(`Created ${result.successful.length} accounts`)
```

#### Bulk Message Retrieval

```typescript
import { MessageProcessor } from './src/message-processor'

const processor = new MessageProcessor({
  concurrency: 5,
  batchSize: 20
})

// Retrieve messages from multiple accounts
const messages = await processor.retrieveMessagesFromAccounts(accounts, {
  filterBy: {
    theme: 'promotional',
    senderDomain: 'marketing.com'
  }
})
```

#### Data Export

```typescript
import { ExportManager } from './src/export-manager'

const exporter = new ExportManager()

// Export accounts to CSV
await exporter.exportAccounts(accounts, {
  format: 'csv',
  filename: 'bulk-accounts.csv',
  includeCredentials: true
})

// Export messages to JSON
await exporter.exportMessages(messages, {
  format: 'json',
  filename: 'filtered-messages.json',
  includeContent: true
})
```

## Configuration

Configure bulk operations in your application:

```typescript
export const bulkConfig = {
  // Batch processing
  defaultBatchSize: 20,
  maxConcurrency: 5,
  
  // Rate limiting
  requestDelay: 1000, // ms between requests
  burstLimit: 10,     // max requests in burst
  
  // Retry configuration
  maxRetries: 3,
  retryDelay: 2000,   // ms
  
  // Performance
  enableProgressTracking: true,
  enablePerformanceMetrics: true,
  
  // Export settings
  defaultExportFormat: 'csv',
  maxExportSize: 10000, // max records per export
}
```

## API Reference

### AccountManager

#### `createBulkAccounts(options: BulkAccountCreationOptions): Promise<BulkAccountResult>`

Creates multiple email accounts in batches.

**Options:**
- `count`: Number of accounts to create
- `emailPrefix`: Prefix for generated email addresses
- `domain`: Email domain to use
- `password`: Password for all accounts
- `batchSize`: Number of accounts per batch (optional)
- `concurrency`: Number of concurrent batches (optional)

**Returns:**
- `successful`: Array of successfully created accounts
- `failed`: Array of failed attempts with error details
- `metrics`: Performance and timing metrics

#### `validateBulkAccounts(accounts: Account[]): Promise<ValidationResult>`

Validates multiple accounts by attempting to authenticate.

### MessageProcessor

#### `retrieveMessagesFromAccounts(accounts: Account[], options?: MessageRetrievalOptions): Promise<Message[]>`

Retrieves messages from multiple accounts with optional filtering.

**Options:**
- `filterBy`: Filtering criteria (theme, sender, date range, etc.)
- `maxMessagesPerAccount`: Limit messages per account
- `includeContent`: Whether to fetch full message content
- `sortBy`: Sorting criteria

#### `filterMessagesByTheme(messages: Message[], theme: string): Message[]`

Filters messages by specific themes or topics.

#### `filterMessagesBySender(messages: Message[], criteria: SenderCriteria): Message[]`

Filters messages by sender email addresses or domains.

### ExportManager

#### `exportAccounts(accounts: Account[], options: ExportOptions): Promise<string>`

Exports account data to various formats.

#### `exportMessages(messages: Message[], options: ExportOptions): Promise<string>`

Exports message data to various formats.

#### `exportStatistics(data: any[], options: StatisticsExportOptions): Promise<string>`

Exports statistical analysis of bulk operations.

## Performance Optimization

### Batch Processing

The module uses intelligent batch processing to optimize performance:

- **Dynamic Batch Sizing**: Automatically adjusts batch size based on response times
- **Concurrent Processing**: Processes multiple batches simultaneously
- **Rate Limiting**: Respects API rate limits to avoid throttling
- **Error Recovery**: Retries failed operations with exponential backoff

### Memory Management

For large datasets:

- **Streaming Processing**: Processes data in streams to minimize memory usage
- **Garbage Collection**: Explicit cleanup of large objects
- **Progress Checkpoints**: Saves progress to allow resuming interrupted operations

### Performance Monitoring

Built-in performance monitoring provides:

- **Response Time Tracking**: Monitors API response times
- **Throughput Metrics**: Tracks operations per second
- **Error Rate Monitoring**: Monitors and reports error rates
- **Resource Usage**: Tracks memory and CPU usage

## Error Handling

The module provides comprehensive error handling:

### Retry Mechanisms

- **Exponential Backoff**: Increases delay between retries
- **Circuit Breaker**: Temporarily stops requests if error rate is too high
- **Selective Retry**: Only retries recoverable errors

### Error Categories

- **Rate Limiting**: Handles 429 responses with appropriate delays
- **Network Errors**: Retries network-related failures
- **Authentication**: Handles token expiration and renewal
- **Validation Errors**: Reports data validation issues

## Examples

### Example 1: Create 1000 Test Accounts

```typescript
import { AccountManager } from './src/account-manager'

async function createTestAccounts() {
  const manager = new AccountManager({
    provider: 'duckmail',
    batchSize: 25,
    concurrency: 4
  })

  const result = await manager.createBulkAccounts({
    count: 1000,
    emailPrefix: 'test-user',
    domain: 'duckmail.sbs',
    password: 'TestPassword123!'
  })

  console.log(`✅ Created: ${result.successful.length}`)
  console.log(`❌ Failed: ${result.failed.length}`)
  console.log(`⏱️ Total time: ${result.metrics.totalTime}ms`)
  
  return result.successful
}
```

### Example 2: Bulk Message Analysis

```typescript
import { MessageProcessor } from './src/message-processor'
import { ExportManager } from './src/export-manager'

async function analyzePromotionalEmails(accounts: Account[]) {
  const processor = new MessageProcessor()
  const exporter = new ExportManager()

  // Retrieve promotional messages
  const messages = await processor.retrieveMessagesFromAccounts(accounts, {
    filterBy: {
      theme: 'promotional',
      dateRange: {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31')
      }
    }
  })

  // Group by sender domain
  const byDomain = processor.groupMessagesBySenderDomain(messages)
  
  // Export analysis
  await exporter.exportStatistics(byDomain, {
    format: 'csv',
    filename: 'promotional-analysis.csv',
    includeCharts: true
  })

  return {
    totalMessages: messages.length,
    uniqueDomains: Object.keys(byDomain).length,
    topSenders: Object.entries(byDomain)
      .sort(([,a], [,b]) => b.length - a.length)
      .slice(0, 10)
  }
}
```

## Best Practices

1. **Start Small**: Begin with small batch sizes and increase gradually
2. **Monitor Performance**: Use built-in metrics to optimize settings
3. **Handle Errors Gracefully**: Always check for failed operations
4. **Respect Rate Limits**: Configure appropriate delays between requests
5. **Save Progress**: Use checkpoints for long-running operations
6. **Validate Data**: Always validate exported data
7. **Clean Up**: Remove test data when no longer needed

## Troubleshooting

### Common Issues

**High failure rate during bulk creation:**
- Reduce batch size and concurrency
- Increase delays between requests
- Check API provider status

**Memory issues with large datasets:**
- Enable streaming mode
- Reduce batch sizes
- Process data in chunks

**Slow performance:**
- Increase concurrency (within limits)
- Optimize batch sizes
- Check network connectivity

For more detailed troubleshooting, see the main documentation in `docs/guides/troubleshooting.md`.
