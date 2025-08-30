# Cloudflare Integration Test Guide

## Prerequisites
1. Create `.env.local` file with:
```bash
CLOUDFLARE_API_TOKEN=your_actual_token_here
CLOUDFLARE_JWT_TOKEN=tusiKCfuyXrwDPrsP77GHZtSSdMux6AqDZQKmySpBss=
```

## Test 1: Verify UI Components
1. Start the development server: `npm run dev`
2. Open the app in browser: `http://localhost:3000`
3. Go to Settings (gear icon)
4. Look for "Cloudflare Management" section
5. Verify both cards are clickable:
   - "New Worker" - should open setup wizard
   - "Manage Worker" - should open domain manager

## Test 2: Verify JWT Token Configuration
1. Check that the JWT token from `.env.local` is being used
2. Deploy a worker through the UI
3. Verify the worker uses the correct JWT token
4. Test authentication with curl:
```bash
# Get token using the worker
curl -X POST https://your-worker.workers.dev/token \
  -H "Content-Type: application/json" \
  -d '{"address":"test@yourdomain.com","password":"test"}'
```

## Test 3: Verify Existing Worker Connection
1. Click "Manage Worker" in Cloudflare Management
2. Enter your account ID and worker script name
3. Click "Load Status"
4. Verify it shows your worker details and domains

## Expected Results
- ✅ UI cards are clickable and open respective modals
- ✅ JWT token from environment is used (not randomly generated)
- ✅ Authentication works with existing Cloudflare worker
- ✅ Domain management shows correct status

## Troubleshooting
- If cards not clickable: Check browser console for errors
- If JWT mismatch: Verify CLOUDFLARE_JWT_TOKEN in `.env.local` matches wrangler.toml
- If worker not found: Ensure correct account ID and script name 