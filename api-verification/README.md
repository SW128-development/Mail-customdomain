# API Verification Module

This module provides comprehensive testing and verification capabilities for the DuckMail email API system. It includes automated test suites, utilities, and tools for validating API functionality across multiple providers.

## Features

- **Comprehensive Test Coverage**: Tests for all major API endpoints
- **Multi-Provider Support**: Tests work with DuckMail, Mail.tm, and custom providers
- **Error Handling Validation**: Comprehensive error scenario testing
- **Performance Testing**: Response time and load testing capabilities
- **Automated Assertions**: Built-in validation for API responses
- **Detailed Logging**: Comprehensive test execution logging

## Directory Structure

```
api-verification/
├── tests/                    # Test suites
│   ├── account-creation.test.ts
│   ├── message-retrieval.test.ts
│   ├── authentication.test.ts
│   └── error-handling.test.ts
├── utils/                    # Testing utilities
│   ├── test-helpers.ts
│   ├── mock-data.ts
│   └── api-client.ts
├── config/                   # Configuration
│   └── test-config.ts
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

# Install additional testing dependencies
npm install --save-dev jest @types/jest ts-jest
```

### Running Tests

```bash
# Run all verification tests
npm run test:api-verification

# Run specific test suite
npm run test:api-verification -- --testNamePattern="Account Creation"

# Run tests with coverage
npm run test:api-verification -- --coverage
```

### Configuration

Configure test settings in `config/test-config.ts`:

```typescript
export const testConfig = {
  apiBaseUrl: process.env.TEST_API_BASE_URL || 'http://localhost:3000/api/mail',
  providers: ['duckmail', 'mailtm'],
  timeout: 30000,
  retries: 3
}
```

## Test Suites

### Account Creation Tests (`tests/account-creation.test.ts`)
- Account creation with valid credentials
- Duplicate account handling
- Invalid input validation
- Provider-specific account creation
- Rate limiting tests

### Message Retrieval Tests (`tests/message-retrieval.test.ts`)
- Message listing with pagination
- Individual message retrieval
- Message filtering and search
- Performance with large datasets
- Real-time message updates

### Authentication Tests (`tests/authentication.test.ts`)
- Token generation and validation
- Token expiration handling
- Invalid credential handling
- Multi-provider authentication
- Session management

### Error Handling Tests (`tests/error-handling.test.ts`)
- HTTP error code validation
- Network failure scenarios
- Malformed request handling
- Provider unavailability
- Timeout scenarios

## Utilities

### Test Helpers (`utils/test-helpers.ts`)
Common utilities for test execution:
- API response validation
- Test data cleanup
- Assertion helpers
- Performance measurement
- Provider switching

### Mock Data (`utils/mock-data.ts`)
Generators for test data:
- Random email addresses
- Mock message content
- Test account credentials
- Provider configurations

### API Client (`utils/api-client.ts`)
Dedicated test client with:
- Enhanced error handling
- Request/response logging
- Performance metrics
- Provider management
- Retry logic

## Best Practices

1. **Test Isolation**: Each test should be independent and not rely on others
2. **Data Cleanup**: Always clean up test data after test completion
3. **Provider Testing**: Test against multiple providers when possible
4. **Error Scenarios**: Include both positive and negative test cases
5. **Performance**: Monitor API response times and set reasonable thresholds

## Contributing

When adding new tests:

1. Follow the existing naming conventions
2. Include both positive and negative test cases
3. Add appropriate documentation
4. Ensure tests are provider-agnostic when possible
5. Include performance assertions where relevant

## Troubleshooting

### Common Issues

**Tests failing with timeout errors:**
- Increase timeout in test configuration
- Check network connectivity to API providers
- Verify API provider status

**Authentication failures:**
- Verify test credentials are valid
- Check if test accounts need to be recreated
- Ensure provider-specific authentication is configured

**Provider-specific failures:**
- Check if specific providers are available
- Verify provider configuration in test setup
- Review provider-specific error handling

For more detailed troubleshooting, see the main documentation in `docs/guides/troubleshooting.md`.
