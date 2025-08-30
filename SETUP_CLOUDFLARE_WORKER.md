# Cloudflare Worker Setup Guide

## Quick Fix for Domain Visibility

To make your existing domain `10xco.de` visible in the app, follow one of these methods:

### Method 1: Auto-Detect Existing Worker (Recommended)

1. **Update your environment variables** (`.env.local` or `.env`):
```env
# Your actual Cloudflare API token (optional for auto-detect)
CLOUDFLARE_API_TOKEN=your_actual_cloudflare_api_token_here

# JWT Token (MUST match your wrangler.toml)
CLOUDFLARE_JWT_TOKEN=tusiKCfuyXrwDPrsP77GHZtSSdMux6AqDZQKmySpBss=

# Existing Worker Configuration
CLOUDFLARE_DEFAULT_WORKER_NAME=duckmail-cloudflare-provider
CLOUDFLARE_DEFAULT_D1_NAME=temp_mail_db
CLOUDFLARE_D1_ID=70bece35-d5bf-487b-9730-c7546f0266c3
MAIL_DOMAIN=10xco.de
```

2. **Restart your Next.js application** to load the new environment variables

3. **Use the Auto-Detect feature**:
   - Open Settings → Cloudflare Integration
   - Click "Detect Existing"
   - The app will automatically find your worker configuration
   - Click "Add as Provider" to add it to your mail providers

### Method 2: Manual Provider Addition

If your worker is already deployed and accessible, you can add it manually:

1. **Find your Worker URL**:
   - If deployed with wrangler: `https://duckmail-cloudflare-provider.<account-subdomain>.workers.dev`
   - Or check your Cloudflare dashboard for the actual URL

2. **Add as Custom Provider**:
   - Open Settings → API Providers
   - Click "Add Custom Provider"
   - Enter:
     - Name: `Cloudflare Worker`
     - Base URL: Your worker URL (e.g., `https://duckmail-cloudflare-provider.workers.dev`)
     - Mercure URL: Leave empty
   - Click "Add"

### Method 3: New Setup with UI API Token Input

If you want to set up a new worker or reconfigure:

1. **Open Settings → Cloudflare Integration**
2. **Click "New Worker"**
3. **Enter your Cloudflare API Token** directly in the UI (no env var needed)
4. **Follow the setup wizard** to deploy and configure your worker

## Troubleshooting

### Domain Not Showing Up

If the domain `10xco.de` is still not visible:

1. **Check Worker Accessibility**:
   ```bash
   curl https://your-worker-url/domains
   ```
   Should return: `[{"domain":"10xco.de","isActive":true,"isPrivate":false}]`

2. **Verify Provider is Enabled**:
   - Go to Settings → API Providers
   - Ensure your Cloudflare provider is not disabled
   - Check localStorage in browser console:
     ```javascript
     localStorage.getItem('custom-api-providers')
     localStorage.getItem('disabled-api-providers')
     ```

3. **Clear Cache**:
   - Clear browser cache
   - Remove and re-add the provider

## Configuration Options

### Mode A: New Worker Setup
- User inputs Cloudflare API token via UI
- Automatically deploys worker, creates D1 database
- Sets up email routing for selected domains

### Mode B: Existing Worker Detection
- Reads configuration from environment variables
- Automatically detects worker URL and domains
- One-click addition as provider

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `CLOUDFLARE_API_TOKEN` | Your Cloudflare API token | `abc123...` |
| `CLOUDFLARE_JWT_TOKEN` | JWT secret for worker auth | `tusiKCfuyXrwDPrsP77GHZtSSdMux6AqDZQKmySpBss=` |
| `CLOUDFLARE_DEFAULT_WORKER_NAME` | Worker script name | `duckmail-cloudflare-provider` |
| `CLOUDFLARE_DEFAULT_D1_NAME` | D1 database name | `temp_mail_db` |
| `CLOUDFLARE_D1_ID` | D1 database UUID | `70bece35-d5bf-487b-9730-c7546f0266c3` |
| `MAIL_DOMAIN` | Configured email domains | `10xco.de` or `10xco.de,example.com` | 