# Duckmail × Cloudflare Worker Integration Plan

## 1) Goal

Integrate a Cloudflare Worker–based temp‑mail backend (derived from **freemail-master**) into **Duckmail** as a new provider **without modifying** the original `freemail-master` folder. Copy the required modules into `src/cloudflare-provider`, add a thin Hydra‑compatible API layer, deploy to Cloudflare, and register it in Duckmail.

---

## 2) Architecture Overview

**Duckmail frontend expects a Mail.tm‑like Hydra API with Bearer auth:**

* `GET /domains`, `POST /accounts`, `POST /token`, `GET /me`
* `GET /messages`, `GET /messages/{id}`, `PATCH /messages/{id}`, `DELETE /messages/{id}`
* Optional: Mercure SSE (not required; polling fallback acceptable)

**freemail-master offers:**

* Cloudflare Workers + D1; inbound email via Email Routing (`email` event); storage in D1
* Cookie/JWT‑protected REST under `/api/*`
* Optional send via Resend

**Solution:**

* New Worker at `src/cloudflare-provider/` that reuses freemail core (DB schema, email parser, utils)
* Exposes **Hydra‑compatible REST** at root (no `/api/*`), **Bearer JWT** only
* Retains `/email` event handler for inbound mail (bind via Email Routing)

---

## 3) Files to Copy / Create

**Copy from `freemail-master` → `src/cloudflare-provider/`:**

* `src/commonUtils.js`
* `src/database.js`
* `src/emailParser.js`
* `src/emailForwarder.js` *(optional; only if using forwarding rules)*
* `src/authentication.js` *(reuse JWT helpers)*
* `src/emailSender.js` *(optional; only if using Resend)*

**Do **not** copy:**

* `src/apiHandlers.js` *(cookie‑oriented, not Hydra)*
* `public/`, `templates/`, UI assets
* Admin/user endpoints unless explicitly needed

**Create new:**

* `src/cloudflare-provider/worker.ts` *(Hydra endpoints + `email` event)*
* `src/cloudflare-provider/wrangler.toml` *(bindings & vars)*

---

## 4) Hydra API (Contract)

### 4.1 Domains

**GET `/domains`**

* Source domains from `env.MAIL_DOMAIN` (space or comma separated)
* **Response:**

```json
{
  "hydra:member": [
    { "id": "<domain>", "domain": "example.com", "isActive": true, "isPrivate": false }
  ],
  "hydra:totalItems": 1
}
```

### 4.2 Accounts & Auth

**POST `/accounts`**

* **Body:** `{ "address": "user@example.com", "password": "..." }`
* Validate local\@domain; domain must be allowed; upsert mailbox (D1)
* Store password hash against address (new `users_mailbox_auth` or reuse `users` with `username=address`, `role='user'`)
* **Return Account:** `{ id, address, quota:0, used:0, isDisabled:false, isDeleted:false, createdAt, updatedAt }`

**POST `/token`**

* **Body:** `{ "address": "...", "password": "..." }`
* Verify hash; **return** `{ token, id }` where `id` is mailbox id; JWT payload includes `address` and `mailboxId`

**GET `/me`** *(Bearer)*

* Decode token; return the Account for the mailbox

### 4.3 Messages

**GET `/messages?page=N`** *(Bearer)*

* Resolve mailbox by address from token; query D1:

```sql
SELECT id, sender, subject, received_at, is_read, content, html_content
FROM messages
WHERE mailbox_id = ?
ORDER BY received_at DESC
LIMIT 30 OFFSET (page-1)*30;
```

* **Map to Message:**

  * `id: string`
  * `from: { name: "", address: sender }`
  * `to: [{ name: "", address: <mailbox address> }]`
  * `subject`
  * `intro`: first 120 chars of `content` or `html_content`
  * `seen`: `is_read == 1`
  * `hasAttachments`: `false` *(unless implemented)*
  * `size`: approx length of `content`/`html_content`
  * `downloadUrl`: optional EML URL (omit if none)
  * `createdAt: received_at`
* **Response:** `{ "hydra:member": Message[], "hydra:totalItems": <count> }`

**GET `/messages/{id}`** *(Bearer)*

* Return a **MessageDetail** with:

  * `id`
  * `from`, `to[]`, `subject`, `createdAt`
  * `text`, `html` (array of strings or single string) from `html_content` if present; `cc`, `bcc` as `[]` unless parsed

**PATCH `/messages/{id}`** *(Bearer)*

* Body: `{ "seen": true }` → update `messages.is_read = 1`; **return** `{ "seen": true }`

**DELETE `/messages/{id}`** *(Bearer)*

* Delete from D1; return `204` (or `200` with confirmation object)

**DELETE `/accounts/{id}`** *(optional)*

* Unbind mailbox and optionally cascade delete messages

**POST `/receive`** *(optional HTTP inbound)*

* Accepts JSON; insert into D1 using existing `handleEmailReceive` as reference

**Email Event (preferred)**

* Implement `email(message, env, ctx)` reusing logic from `freemail-master/src/server.js`

---

## 5) Security Model

* **Bearer‑only** for Hydra endpoints (no cookies)
* JWT secret via `env.JWT_TOKEN` / `env.JWT_SECRET`
* Email event unauthenticated (Cloudflare‑triggered)
* Optional: protect `POST /receive` with Bearer

---

## 6) Worker Design (Routing & Bootstrapping)

* Minimal router inside `worker.ts`:

  * Parse URL/method; route to Hydra handlers
  * For protected routes, `verifyBearer(Authorization)` using adapted `authentication.js`
  * Bind D1 as `env.TEMP_MAIL_DB`; perform schema init once per cold start
* Keep `/email` event handler wired to Email Routing

---

## 7) Cloudflare Deployment & Config

**`wrangler.toml` (example):**

```toml
name = "duckmail-cloudflare-provider"
main = "src/cloudflare-provider/worker.ts"
compatibility_date = "2024-12-01"

[[d1_databases]]
binding = "TEMP_MAIL_DB"
database_name = "temp_mail_db"
database_id = "<your-d1-id>"

[vars]
MAIL_DOMAIN = "yourdomain.com otherdomain.com"
JWT_TOKEN = "<secret>"
RESEND_API_KEY = "<optional>"
```

**Email Routing:** Point your domain’s catch‑all to this Worker.

---

## 8) Duckmail Project Changes

* **Provider entry** (via Settings UI or preset):

  * `id: "cloudflare"`, `name: "Cloudflare"`, `baseUrl: https://<worker-domain>`, `mercureUrl: ""`
* **SSE fallback:** If `mercureUrl` empty → `use-mercure-sse` marks `attempted=false`; `use-smart-mail-checker` will poll
* **Query param proxy:** Update `app/api/mail/route.ts` to forward all search params (including `page`) and `endpoint`

---

## 9) Data Mapping Reference (Duckmail UI)

**Message list** (expects `types/Message`):

* Uses: `from.address`, `subject`, `createdAt`, `seen`, `id`

**Message detail** (expects `types/MessageDetail`):

* Uses: `from.name/address`, `to[]`, `subject`, `createdAt`, `html` *(string\[])* **or** `text`, `id`

✅ Ensure mapping in `/messages` and `/messages/{id}` populates all fields above.

---

## 10) Execution Steps (Checklist)

1. **Create provider folder**

   * `src/cloudflare-provider/`
   * Copy: `commonUtils.js`, `database.js`, `emailParser.js`, `emailForwarder.js` *(opt)*, `authentication.js`, `emailSender.js` *(opt)*
   * Create: `worker.ts`, `wrangler.toml`
2. **Implement Hydra endpoints** in `worker.ts`

   * Reuse DB helpers; implement Bearer JWT utilities; map D1 rows → Hydra shapes
3. **Configure Cloudflare**

   * Create/bind D1; set `MAIL_DOMAIN`, `JWT_TOKEN`; optionally `RESEND_API_KEY`
   * Bind Email Routing → Worker
4. **Deploy**

   * `wrangler dev` (local test) → `wrangler deploy`
5. **Register provider in Duckmail**

   * Settings → Custom Provider (`id=cloudflare`, baseUrl=<worker URL>, `mercureUrl` empty)
   * Or add to `PRESET_PROVIDERS`
6. **Validate end‑to‑end** (see checklist below)

---

## 11) Validation Checklist

* [ ] `GET /domains` shows expected domains in selector
* [ ] `POST /accounts` creates/returns an account
* [ ] `POST /token` returns `{ token, id }`; `GET /me` returns account
* [ ] Inbound email via Email Routing inserts rows in D1
* [ ] `GET /messages` lists the email; pagination via `?page=` works
* [ ] `GET /messages/{id}` returns full detail (`html`/`text`)
* [ ] `PATCH /messages/{id}` sets `seen=true`
* [ ] `DELETE /messages/{id}` removes the message

---

## 12) Folder Structure (Proposed)

```
src/
  cloudflare-provider/
    worker.ts
    commonUtils.js
    database.js
    emailParser.js
    emailForwarder.js
    authentication.js
    emailSender.js   # optional
    wrangler.toml
```

---

## 13) Notes & Tradeoffs

* No changes to `freemail-master` (copy‑based reuse)
* Avoid cookie/session paths; **Bearer only**
* No SSE initially; Duckmail will poll. SSE can be added later (e.g., Durable Objects)
* Keep existing schema to leverage inserts from `email` event

---

## 14) Implementation Hints

* **JWT**: Include `address` and `mailboxId` claims; short TTLs recommended
* **Intro**: Prefer plain‑text `content`; fallback to `html_content` stripped → 120 chars
* **Size**: `length(content || html_content)` as approximation
* **Totals**: Use `SELECT COUNT(*)` for `hydra:totalItems`
* **Errors**: Return Hydra‑style problem details or minimal JSON stating `error`/`message`

---

## 15) Open Items / TODOs

* [ ] Decide on auth storage: dedicated `users_mailbox_auth` vs reuse `users`
* [ ] Confirm D1 schema columns match mappings (`sender`, `received_at`, etc.)
* [ ] Optional: implement attachments & EML `downloadUrl`
* [ ] Optional: `/accounts/{id}` deletion semantics
* [ ] Optional: enable sending via Resend (copy `emailSender.js`)
