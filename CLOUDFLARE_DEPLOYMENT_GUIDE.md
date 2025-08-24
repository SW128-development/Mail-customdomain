# Cloudflare Provider Deployment Guide for Duckmail

This guide walks you through deploying and integrating the Cloudflare Worker email provider with Duckmail.

## 🚀 Quick Start

### Step 1: Prepare Cloudflare Worker

1. Navigate to the Cloudflare provider directory:
   ```bash
   cd cloudflare-provider
   ```

2. Install dependencies (if not already done):
   ```bash
   npm install
   ```

3. Create a D1 database:
   ```bash
   wrangler d1 create temp_mail_db
   ```
   
   Copy the `database_id` from the output.

### Step 2: Configure the Worker

1. Edit `cloudflare-provider/wrangler.toml`:
   - Replace the `database_id` with the database ID from Step 1 (currently set to `"70bece35-d5bf-487b-9730-c7546f0266c3"`)
   - Replace `"10xco.de"` with your actual domain(s)
   - Generate a secure JWT secret (e.g., using `openssl rand -base64 32`)
   - Replace the `JWT_TOKEN` value with your generated secret2. Example configuration:
   ```toml
   [vars]
   MAIL_DOMAIN = "example.com anotherdomain.com"
   JWT_TOKEN = "your-secure-jwt-secret-here"
   ```

### Step 3: Deploy to Cloudflare

1. Deploy the worker:
   ```bash
   wrangler deploy
   ```

2. Note the deployment URL (e.g., `https://duckmail-cloudflare-provider.username.workers.dev`)

### Step 4: Configure Email Routing

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain
3. Navigate to **Email** → **Email Routing**
4. Enable Email Routing if not already enabled
5. Create a catch-all rule:
   - **Match**: `*` (catches all emails)
   - **Action**: Send to Worker
   - **Worker**: Select `duckmail-cloudflare-provider`

### Step 5: Update Duckmail Configuration

1. Edit `lib/api.ts` in the main Duckmail project
2. Find the Cloudflare provider configuration (around line 89)
3. Update the `baseUrl` with your worker URL:
   ```typescript
   {
     id: "cloudflare",
     name: "Cloudflare",
     baseUrl: "https://duckmail-cloudflare-provider.username.workers.dev",
     mercureUrl: "", // No SSE support initially
   }
   ```

### Step 6: Test the Integration

1. Start Duckmail locally:
   ```bash
   npm run dev
   ```

2. Go to Settings → Providers in Duckmail
3. Select "Cloudflare" as your provider
4. Create a new account using your domain
5. Send a test email to your new address
6. Check if the email appears in Duckmail

## 🔧 Local Development

### Testing Locally

1. Run the worker locally:
   ```bash
   cd cloudflare-provider
   wrangler dev
   ```

2. Run the test script:
   ```bash
   bash test-local.sh
   ```

### Manual API Testing

Test individual endpoints:

```bash
# Get domains
curl http://localhost:8787/domains

# Create account
curl -X POST http://localhost:8787/accounts \
  -H "Content-Type: application/json" \
  -d '{"address": "test@test.local", "password": "password123"}'

# Get token
curl -X POST http://localhost:8787/token \
  -H "Content-Type: application/json" \
  -d '{"address": "test@test.local", "password": "password123"}'
```

## 📋 Validation Checklist

- [T] D1 database created and configured in `wrangler.toml`
- [T] JWT secret generated and set
- [T] Domain(s) configured in `MAIL_DOMAIN`
- [T] Worker deployed successfully
- [T] Email routing configured in Cloudflare
- [T] Worker URL updated in `lib/api.ts`
- [T] Can see Cloudflare provider in Duckmail settings
- [T] Can create accounts with your domain
- [T] Can receive emails (test by sending to your address)
- [T] Can view received emails in Duckmail
- [T] Can mark emails as read
- [T] Can delete emails

## 🐛 Troubleshooting

### Common Issues

1. **"Invalid domain" error when creating account**
   - Check that your domain is listed in `MAIL_DOMAIN` in `wrangler.toml`
   - Domains should be space or comma-separated

2. **Emails not being received**
   - Verify Email Routing is enabled for your domain
   - Check that the catch-all rule points to your worker
   - Look at worker logs: `wrangler tail`

3. **Authentication errors**
   - Ensure JWT secret is the same in all environments
   - Check that the token is being passed with "Bearer " prefix

4. **Database errors**
   - Verify the D1 database ID is correct in `wrangler.toml`
   - Check worker logs for initialization errors

### Viewing Logs

```bash
# View real-time logs
wrangler tail

# View logs for a specific worker
wrangler tail duckmail-cloudflare-provider
```

## 🔒 Security Considerations

1. **JWT Secret**: Use a strong, randomly generated secret
2. **CORS**: Currently allows all origins (`*`). Consider restricting in production
3. **Rate Limiting**: Consider implementing rate limits for account creation
4. **Domain Validation**: Only allow account creation for configured domains

## 📚 Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare Email Routing](https://developers.cloudflare.com/email-routing/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)


