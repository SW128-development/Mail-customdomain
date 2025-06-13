# DuckMail - Email API Testing and Operations System

A comprehensive email API testing and operations system built with Next.js, featuring automated testing, bulk operations, and multi-provider support.

## 🚀 Features

### Core Email System
- 🚀 Multi-provider support (DuckMail, Mail.tm, custom providers)
- 📧 Real-time email receiving and viewing
- 🔄 Automatic email list refresh
- 🎨 Modern, responsive user interface
- 🌙 Dark/light theme support
- 🔒 Secure email handling

### API Verification Module
- ✅ Comprehensive automated testing for all API endpoints
- 🔍 Performance monitoring and validation
- 🛡️ Error scenario testing and validation
- 📊 Multi-provider testing support
- 📈 Detailed test reporting and metrics

### Bulk Operations Module
- 📦 Mass account creation with batch processing
- 🔄 Bulk message retrieval and filtering
- 📤 Data export in multiple formats (CSV, JSON, XLSX)
- ⚡ Performance optimization for large datasets
- 🎯 Advanced filtering by themes, senders, and domains

### Documentation System
- 📚 Comprehensive architecture documentation
- 🔧 Setup and configuration guides
- 🧪 Testing procedures and best practices
- 🛠️ Troubleshooting and FAQ

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                           │
├─────────────────────────────────────────────────────────────┤
│  Next.js Application  │  React Components  │  UI Libraries  │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Gateway Layer                         │
├─────────────────────────────────────────────────────────────┤
│     API Proxy     │   Rate Limiting   │   Authentication    │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                  Business Logic Layer                       │
├─────────────────────────────────────────────────────────────┤
│  API Verification │ Bulk Operations │ Provider Management   │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI Components**: HeroUI, Radix UI
- **Styling**: Tailwind CSS
- **Testing**: Jest, Testing Library
- **State Management**: React Context
- **Real-time**: Server-Sent Events (SSE)
- **Data Processing**: Batch processing, streaming
- **Export Formats**: CSV, JSON, XLSX

## 📋 Prerequisites

- Node.js 18+
- npm or pnpm
- TypeScript knowledge
- Access to email API providers

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/AsukaKirara/DuckMail.git
cd DuckMail

# Install dependencies
npm install
# or
pnpm install
```

### 2. Environment Setup

Create `.env.local`:

```bash
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/mail
NODE_ENV=development

# Testing Configuration
TEST_API_BASE_URL=http://localhost:3000/api/mail
TEST_PROVIDERS=duckmail,mailtm
TEST_TIMEOUT=30000

# Bulk Operations Configuration
BULK_BATCH_SIZE=20
BULK_CONCURRENCY=3
BULK_REQUEST_DELAY=1000
```

### 3. Start Development Server

```bash
npm run dev
# or
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000)

### 4. Run Tests

```bash
# Run all tests
npm test

# Run API verification tests
npm run test:api-verification

# Run bulk operations tests
npm run test:bulk-operations

# Run with coverage
npm run test:coverage
```

## 📁 Project Structure

```
├── api-verification/          # API testing and verification
│   ├── tests/                # Test suites
│   ├── utils/                # Testing utilities
│   ├── config/               # Test configuration
│   └── README.md
├── bulk-operations/           # Bulk operations and processing
│   ├── src/                  # Core functionality
│   ├── types/                # Type definitions
│   ├── utils/                # Utility functions
│   └── README.md
├── docs/                     # Documentation
│   ├── architecture/         # System architecture
│   ├── api/                  # API documentation
│   ├── guides/               # Operational guides
│   └── README.md
├── app/                      # Next.js application
├── components/               # React components
├── lib/                      # Core API library
├── types/                    # TypeScript definitions
└── README.md
```

## 🧪 Testing

### API Verification Tests

```bash
# Run account creation tests
npm run test:api-verification -- --testNamePattern="Account Creation"

# Run message retrieval tests
npm run test:api-verification -- --testNamePattern="Message Retrieval"

# Run authentication tests
npm run test:api-verification -- --testNamePattern="Authentication"
```

### Bulk Operations Tests

```bash
# Test bulk account creation
npm run test:bulk-operations -- --testNamePattern="Account Manager"

# Test message processing
npm run test:bulk-operations -- --testNamePattern="Message Processor"
```

## 📊 Usage Examples

### API Verification

```typescript
import { TestApiClient } from './api-verification/utils/api-client'

const client = new TestApiClient('duckmail')

// Test account creation
const response = await client.createAccount('test@duckmail.sbs', 'password123')
console.log('Account created:', response.data)

// Test message retrieval
const messages = await client.getMessages(token)
console.log('Messages:', messages.data)
```

### Bulk Operations

```typescript
import { AccountManager } from './bulk-operations/src/account-manager'

const manager = new AccountManager({
  provider: 'duckmail',
  batchSize: 10,
  concurrency: 3
})

// Create 100 test accounts
const result = await manager.createBulkAccounts({
  count: 100,
  emailPrefix: 'bulk-test',
  domain: 'duckmail.sbs',
  password: 'SecurePassword123!'
})

console.log(`Created ${result.successful.length} accounts`)
```

## 🔧 Configuration

### Environment Variables

```bash
# Core API Settings
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/mail
NODE_ENV=development

# Provider Configuration
DEFAULT_PROVIDER=duckmail
ENABLED_PROVIDERS=duckmail,mailtm

# Testing Configuration
TEST_TIMEOUT=30000
TEST_RETRIES=3
TEST_MAX_ACCOUNTS=50

# Bulk Operations Configuration
BULK_BATCH_SIZE=20
BULK_CONCURRENCY=3
BULK_REQUEST_DELAY=1000
BULK_MAX_RETRIES=3

# Performance Configuration
PERFORMANCE_MAX_RESPONSE_TIME=5000
PERFORMANCE_MAX_ACCOUNT_CREATION_TIME=10000
```

### Provider Setup

Add custom providers through the UI or programmatically:

```typescript
const customProvider = {
  id: 'custom-provider',
  name: 'Custom Email Provider',
  baseUrl: 'https://api.custom-provider.com',
  mercureUrl: 'https://mercure.custom-provider.com/.well-known/mercure'
}
```

## 📚 Documentation

- **[Complete Documentation](docs/README.md)** - Full system documentation
- **[Architecture Overview](docs/architecture/overview.md)** - System architecture
- **[Setup Guide](docs/guides/setup.md)** - Detailed setup instructions
- **[API Verification Guide](api-verification/README.md)** - Testing module documentation
- **[Bulk Operations Guide](bulk-operations/README.md)** - Bulk operations documentation

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### Docker

```bash
# Build image
docker build -t duckmail .

# Run container
docker run -p 3000:3000 duckmail
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Update documentation
6. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🆘 Support

- **Documentation**: Check the [docs](docs/) directory
- **Issues**: Create an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions

---

**Built with ❤️ using Next.js, TypeScript, and modern web technologies**
