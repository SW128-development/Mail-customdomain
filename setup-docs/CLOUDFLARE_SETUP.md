# Cloudflare Integration Setup

This document explains how to set up the Cloudflare Worker integration for automated email management.

## Prerequisites

1. A Cloudflare account with at least one domain/zone
2. A Cloudflare API token with appropriate permissions

## Step 1: Create a Cloudflare API Token

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use the "Custom token" template
4. Set the following permissions:
   - **Zone:Read** - for all zones
   - **Zone:Edit** - for all zones (for email routing)
   - **Account:Read** - for all accounts
   - **Cloudflare Workers:Edit** - for all accounts
   - **D1:Edit** - for all accounts
5. Add zone resources (specific zones or all zones)
6. Copy the generated token

## Step 2: Configure Environment Variables

Create a `.env.local` file in your project root with the following variables:

```bash
# .env.local
# Required: Cloudflare API Token
CLOUDFLARE_API_TOKEN=your_actual_token_here

# Required for existing workers: JWT Token (must match your wrangler.toml)
# For new deployments, leave empty to auto-generate
CLOUDFLARE_JWT_TOKEN=""
```

**Important Notes:**
- The `CLOUDFLARE_JWT_TOKEN` must match the `JWT_TOKEN` in your `wrangler.toml` if you have an existing worker
- For new worker deployments through the UI, you can leave it empty and one will be generated
- Never commit your actual tokens to version control
- The `.env.local` file should be in your `.gitignore`

For production deployment (Vercel, Netlify, etc.), add these environment variables in your project settings.

## Step 3: Access Cloudflare Management

1. Open the app and go to Settings
2. Look for the "Cloudflare Management" section
3. Choose one of two options:
   - **New Worker**: Automatically deploy a new Cloudflare Worker
   - **Manage Worker**: Manage domains for an existing Worker

## Features

### Automated Worker Deployment (Mode A)
- Creates or reuses D1 database
- Deploys Worker script with email handling
- Configures email routing for selected domains
- Sets up catch-all rules
- Verifies deployment

### Worker Management (Mode B)
- Connect to existing Worker
- Add/remove domains
- Monitor email routing status
- Health checks

## API Endpoints

The integration adds several API endpoints:

- `POST /api/cf/setup-initial` - Deploy new Worker
- `POST /api/cf/add-domain` - Add domain to existing Worker
- `POST /api/cf/remove-domain` - Remove domain from Worker
- `GET /api/cf/status` - Check Worker and domain status
- `GET /api/cf/accounts` - List available accounts and zones

## Security

- API token is stored server-side only
- Never exposed to browser
- Admin-only access to management endpoints
- Validated permissions and scopes

## Troubleshooting

### Common Issues

1. **"Cloudflare API token not configured"**
   - Ensure `CLOUDFLARE_API_TOKEN` environment variable is set
   - Restart your application after setting the variable

2. **"Zone not found for domain"**
   - Verify the domain is added to your Cloudflare account
   - Check that the domain's nameservers point to Cloudflare

3. **"Worker deployment failed"**
   - Check API token permissions
   - Ensure you have available Worker allocations
   - Verify D1 database limits

4. **"Email routing not working"**
   - Confirm email routing is enabled for the zone
   - Check catch-all rules are created correctly
   - Verify MX records are configured properly

### Debug Mode

Enable debug logging by checking the browser console and server logs during setup and domain management operations.

## Next Steps

After successful setup:

1. The Worker URL will be provided
2. Add it as a custom provider in the settings
3. Test email creation and reception
4. Monitor domain health status

## Domain Management

Use the Domain Manager to:
- View current domain configuration
- Add new domains to existing Workers
- Remove domains that are no longer needed
- Check email routing and catch-all rule status
- Monitor Worker health

## Limitations

- Requires Cloudflare Pro plan or higher for some features
- D1 database has usage limits on free plans
- Worker invocations are subject to plan limits
- Email routing must be enabled per zone 