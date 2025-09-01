# Cloudflare Multi‑Domain Setup – UI Integration Plan

## Goals
- Support multi‑domain setup for the Cloudflare Worker provider from within the app.
- Two flows:
  Mode A: Fully automated initial deploy (see “Mode A – Fully Automated Initial Deploy (UI)” below).
  Mode B: Attach an existing Worker (see “Mode B – Attach Existing Worker (UI)” below).
- Keep Cloudflare API tokens server‑side only.

---

## Architecture Overview
- A secure backend (Next.js API routes or an internal control‑plane) orchestrates Cloudflare API calls:
  1) Verify zone/domain exists and is active
  2) Ensure D1 exists (create if missing)
  3) Deploy or update Worker with bindings/vars (TEMP_MAIL_DB, MAIL_DOMAIN, JWT_TOKEN)
  4) Enable Email Routing for the zone
  5) Create a catch‑all rule to the Worker
  6) Update MAIL_DOMAIN when adding/removing domains
- Frontend provides Setup Wizard and Domain Manager screens using existing UI components.

---

## Backend Endpoints (server‑side)
- POST `/api/cf/setup-initial`
  - Input: `accountId`, optional `scriptName`, desired `domains[]`, `d1Name` (or reuse), optional `jwtSecret` (or auto‑generate)
  - Actions: create/reuse D1 → deploy Worker with D1 binding and vars → enable Email Routing per zone → create catch‑all rules
  - Output: `{ workerUrl, scriptName, d1: { name, databaseId }, domains: string[] }`

- POST `/api/cf/add-domain`
  - Input: `domain`
  - Actions: resolve zone → enable Email Routing → create catch‑all → append domain to `MAIL_DOMAIN` → update Worker vars
  - Output: updated `domains[]`

- POST `/api/cf/remove-domain`
  - Input: `domain`
  - Actions: resolve zone → remove catch‑all → remove domain from `MAIL_DOMAIN` → update Worker vars
  - Output: updated `domains[]`

- GET `/api/cf/status`
  - Output: worker health, `MAIL_DOMAIN`, D1 binding status, per‑zone routing status, script metadata

- Security: Cloudflare API token stored as server env var; endpoints restricted to admins.

---

## Mode A – Fully Automated Initial Deploy (UI)

### Setup Wizard (Modal/Page)
- Step 1: Connect Cloudflare
  - Fields: reference label (e.g., "Production").
  - Backend validates env‑stored token scopes; lists available accounts/zones.
  - UI components: `components/ui/dialog`, `components/ui/form`, `components/ui/select`, `components/ui/button`, `components/ui/alert`.

- Step 2: Select Account and Zones (Domains)
  - Multi‑select zones to manage.
  - UI: `Select` (multi), `Badge` for chosen items, `Card` grouping.

- Step 3: Database
  - Create or reuse D1 name; show resulting `database_id` after creation/check.
  - UI: `Input`, `Button`, `Progress` during API work, `Alert` on errors.

- Step 4: Worker Deployment
  - Fields: Worker script name, optional JWT secret (or auto‑generate), confirm bindings (TEMP_MAIL_DB), and initial `MAIL_DOMAIN` (derived from selected zones).
  - Backend deploys Worker (script upload) and sets vars/bindings; returns `workerUrl`.
  - UI: `Card` summary with `workerUrl` and status indicators.

- Step 5: Email Routing
  - Backend enables Email Routing per zone and creates catch‑all "Send to Worker" rules.
  - UI: routing checklist per domain with `Checkbox` and `Status` indicators.

- Step 6: Verification
  - Backend runs preflight: GET `/domains`, test `POST /accounts`, `POST /token` (synthetic account), confirm routing.
  - UI: `Alert` success; offer to add this Worker as a provider entry.

### Post‑Setup – Provider Registration
- Store `workerUrl` as a provider in the app (uses existing custom provider mechanism).
- Reference existing components:
  - `components/settings-panel.tsx` provider list (toggle enable/disable, add custom provider)
  - `components/domain-selector.tsx` already aggregates `/domains` across providers

---

## Mode B – Attach Existing Worker (UI)

### Attach Worker Dialog
- Inputs: Worker URL (or script name), accountId (select), confirm D1 name.
- Backend validates:
  - Worker reachable and returns `/domains`
  - D1 binding exists under `TEMP_MAIL_DB`
  - Reads current `MAIL_DOMAIN`
- On success: save as a provider (custom) with `baseUrl = workerUrl`.
- UI: `Dialog`, `Input`, `Select`, `Button`, `Alert`.

### Domain Manager (shared for Mode A/B)
- Table of managed domains with status per provider/zone:
  - Columns: Domain, Provider, Zone, Routing (Enabled/Disabled), Catch‑all (OK/Missing), Actions.
  - UI: `components/ui/table`, `Badge`, `Button`, `DropdownMenu` (actions), `Skeleton` while loading.

- Actions
  - Add Domain: open dialog → select zone → backend `/api/cf/add-domain` → optimistic update
  - Remove Domain: confirm dialog → backend `/api/cf/remove-domain`
  - Re‑check Status: calls `/api/cf/status`

- Health Panel
  - Preflight button runs `/api/cf/status` and displays:
    - Worker live (GET `/domains` ok)
    - D1 bound (TEMP_MAIL_DB)
    - MAIL_DOMAIN matches list
    - Routing and catch‑all per domain
  - UI: `Alert`, `Card`, `Progress`, `Tooltip` for details

---

## UX Notes & Existing Components
- Use `components/ui/dialog` for wizard steps and confirmation modals.
- Use `components/ui/form`, `input.tsx`, `select.tsx`, `button.tsx` for forms.
- Use `components/ui/table` for domain lists with actions.
- Use `components/ui/alert` and `sonner.tsx` for success/error toasts.
- For navigation, integrate a link from the existing Settings panel to the new Setup Wizard and Domain Manager.

---

## Validation & Troubleshooting (mirrors guide)
- Preflight checks after any change:
  - `/domains` returns all configured domains
  - `POST /accounts` + `POST /token` success on synthetic address
  - Email Routing enabled and catch‑all to Worker
  - D1 binding present; no init errors in `wrangler tail`
- Common issues:
  - Invalid domain in `MAIL_DOMAIN`
  - Missing routing or wrong target Worker
  - D1 binding name/id mismatch

---

## Security & Permissions
- Keep Cloudflare API token in server env only; never expose to browser.
- Token scopes: Workers Scripts (write), D1 (write), Zones (read), Email Routing (edit).
- Admin‑only access to all CF orchestration endpoints.

---

## Rollout Plan
- ✅ Phase 1: Implement backend endpoints with idempotency.
- ✅ Phase 2: Mode B UI (Attach Worker + Domain Manager + Preflight).
- ✅ Phase 3: Mode A Setup Wizard (initial deploy automation).
- ✅ Phase 4: JWT token configuration and UI fixes.
- 🔄 Phase 5: Nightly reconcile job to detect drift and offer one‑click fixes.

## Implementation Status

### ✅ Completed
- Backend API endpoints (`/api/cf/*`)
- Setup wizard component with full workflow
- Domain manager component for existing workers
- Integration with settings panel with clickable cards
- Worker script generation and deployment
- Email routing configuration
- D1 database management
- Status monitoring and health checks
- JWT token configuration via Worker Secret (JWT_TOKEN) and server-side app env
- UI component fixes for proper interaction

Security note: JWT secrets must be set as Cloudflare Worker Secrets (wrangler secret) and as server-only app env vars.
They must never live in wrangler.toml, client bundles, or NEXT_PUBLIC_* variables.

### 📋 Available Features- **Automated Worker Deployment**: Complete setup wizard for new deployments
- **Domain Management**: Add/remove domains from existing workers
- **Health Monitoring**: Check worker status and email routing configuration
- **Provider Integration**: Automatically add workers as custom providers
- **Multi-account Support**: Work with multiple Cloudflare accounts and zones
- **JWT Token Management**: Support for existing worker JWT tokens via environment variables
### 🔧 Usage
1. Set environment variables in `.env.local`:
   - `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token
   - `CLOUDFLARE_JWT_TOKEN` - JWT secret (server-only; do not prefix with NEXT_PUBLIC)
   - Then set the Worker-side secret:
     - `wrangler secret put JWT_TOKEN`  (for each deployed environment)
2. Open Settings → Cloudflare Management
3. Choose "New Worker" for automated deployment or "Manage Worker" for existing workers
4. Follow the guided setup process
5. Add the deployed worker as a provider
### 🔑 Important Configuration
- Use Worker Secrets for JWTs:
  - Set `JWT_TOKEN` via `wrangler secret put JWT_TOKEN` (never store secrets in `wrangler.toml`).
  - App side: set `CLOUDFLARE_JWT_TOKEN` in server-only env (no `NEXT_PUBLIC_*`).
- For existing Workers, ensure the app’s `CLOUDFLARE_JWT_TOKEN` matches the Worker’s `JWT_TOKEN` secret.
- For new deployments, the JWT can be auto-generated or specified; persist it only as secrets.
- The JWT authenticates app→Worker API calls (Authorization: Bearer …); the browser must not call the Worker with this JWT.

Flows:
- Mode A: Fully automated initial deploy via UI (backend drives Cloudflare APIs).
- Mode B: Attach an existing manually deployed Worker, then manage domains via UI.