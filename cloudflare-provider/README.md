# Duckmail Cloudflare Provider

This is a Cloudflare Worker-based email provider for Duckmail that implements the Hydra API.

## Prerequisites

1. A Cloudflare account
2. A domain configured with Cloudflare
3. Node.js and npm/pnpm installed
4. Wrangler CLI (will be installed with dependencies)

## Setup Instructions

### 1. Install Dependencies

```bash
cd src/cloudflare-provider
npm install
# or
pnpm install
```

### 2. Create D1 Database

```bash
# Create a new D1 database
wrangler d1 create temp_mail_db

# Copy the database_id from the output and update wrangler.toml
```

### 3. Configure wrangler.toml

Update the `wrangler.toml` file with your configuration:

- Replace `<your-d1-database-id>` with the database ID from step 2
- Replace `yourdomain.com` with your actual domain(s)
- Generate a secure JWT secret and replace `<your-jwt-secret>`
- Optionally add your Resend API key if you want to enable email sending

### 4. Deploy the Worker

```bash
# Deploy to Cloudflare
wrangler deploy

# Note the worker URL from the output (e.g., https://duckmail-cloudflare-provider.your-subdomain.workers.dev)
```

### 5. Configure Email Routing

1. Go to Cloudflare Dashboard → Email → Email Routing
2. Add your domain if not already configured
3. Create a catch-all rule:
   - Match: `*@yourdomain.com`
   - Action: Send to Worker
   - Worker: Select `duckmail-cloudflare-provider`

### 6. Update Duckmail Configuration

Update the Cloudflare provider URL in `lib/api.ts`:

```typescript
{
  id: "cloudflare",
  name: "Cloudflare",
  baseUrl: "https://your-actual-worker-url.workers.dev", // Replace with your worker URL
  mercureUrl: "", // No SSE support initially
}
```

## Development

### Local Testing

```bash
# Run locally with Wrangler
wrangler dev

# The worker will be available at http://localhost:8787
```

### Database Initialization

The database schema is automatically initialized on the first request. The schema includes:

- `mailboxes`: Stores email addresses
- `messages`: Stores email messages
- `users`: Stores user authentication

### Testing the API

1. Get available domains:
   ```bash
   curl http://localhost:8787/domains
   ```

2. Create an account:
   ```bash
   curl -X POST http://localhost:8787/accounts \
     -H "Content-Type: application/json" \
     -d '{"address": "test@yourdomain.com", "password": "testpass"}'
   ```

3. Get auth token:
   ```bash
   curl -X POST http://localhost:8787/token \
     -H "Content-Type: application/json" \
     -d '{"address": "test@yourdomain.com", "password": "testpass"}'
   ```

4. Get messages (with Bearer token):
   ```bash
   curl http://localhost:8787/messages \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

## Environment Variables

- `MAIL_DOMAIN`: Space or comma-separated list of allowed domains
- `JWT_TOKEN` / `JWT_SECRET`: Secret key for JWT signing
- `RESEND_API_KEY`: (Optional) Resend API key for sending emails

## Troubleshooting

1. **Database not found**: Make sure you've created the D1 database and updated the database_id in wrangler.toml
2. **Email routing not working**: Verify your domain's Email Routing is properly configured in Cloudflare
3. **Authentication errors**: Check that your JWT secret is properly set and consistent

## Notes

- SSE/Mercure support is not implemented initially - Duckmail will use polling
- The worker implements bearer token authentication (no cookies)
- All Hydra API endpoints are implemented according to the Mail.tm spec 