# Render Environment Setup — BookMySlot

---

> ## ⚠️ NOTICE FOR AI AGENTS — READ THIS FIRST
>
> **This application is deployed on Render as two separate services.** This split-deployment architecture has critical implications for every new feature or API endpoint you add. Read this section before touching anything related to auth, sessions, file storage, environment variables, WebSockets, or CORS.
>
> ### Render Services
>
> | Service Name | Type | Runtime | Region |
> |---|---|---|---|
> | `Book-My-Slot-1` | Web Service (backend API) | Node | Oregon (US West) |
> | `Book-My-Slot-Client` | Static Site (frontend) | — | Global CDN |
>
> ### What This Means When You Write Code
>
> - The frontend (`Book-My-Slot-Client`) and backend (`Book-My-Slot-1`) are on **different domains** — they are never the same origin in production.
> - All frontend API calls must use the full backend URL, driven by `VITE_API_URL` (set as an env var on the Static Site service).
> - All `fetch` calls in the frontend **must** include `credentials: "include"` for session cookies to work cross-domain. The helpers `apiRequest` and `getQueryFn` in `client/src/lib/queryClient.ts` do this automatically — always use them, never raw `fetch`.
> - Cookies are configured with `sameSite: "none"; Secure` — this is **required** for cross-site sessions and means HTTPS is mandatory in production.
> - Any new env var needed in the browser must be prefixed with `VITE_` and added to the **frontend** service environment on Render — not the backend service.
> - The backend filesystem is **ephemeral** on Render. All user uploads go to Cloudflare R2 via signed URLs. Do not use `fs.writeFile` or local disk for any user content.
> - When adding a new domain or staging URL that needs to call the backend, add it to the `FRONTEND_URL` env var (comma-separated) — not hardcoded in `server/index.ts`.
> - WebSocket URLs are derived from `VITE_API_URL` by swapping `https://` → `wss://`. New WebSocket endpoints must follow the same pattern.
> - Database schema changes require running `npm run db:push` against the production `DATABASE_URL`. The production database is Supabase (connection pooler on port 6543, not 5432).
>
> ### Checklist — Every New Feature or API Endpoint
>
> - [ ] New route added to `server/routes.ts` and `shared/routes.ts`; logic kept in `server/storage.ts`
> - [ ] New frontend fetch goes through `apiRequest` or `getQueryFn` (auto-includes `credentials: "include"`)
> - [ ] New frontend env var: prefixed `VITE_`, set in **frontend** Render service environment
> - [ ] New backend env var: set in **backend** Render service environment, documented in this file
> - [ ] New allowed CORS origin: added to `FRONTEND_URL` env var — never hardcoded
> - [ ] File upload: uses R2 signed-URL flow — not multer to disk
> - [ ] Schema change: `shared/schema.ts` updated + `npm run db:push` run against production DB
> - [ ] WebSocket: derives `wss://` URL from `VITE_API_URL`, not `window.location`
>
> ### Local Dev vs Production — Quick Reference
>
> | Concern | Local (Replit / dev) | Production (Render) |
> |---|---|---|
> | Frontend served by | Vite dev server | Render Global CDN |
> | Same origin as backend? | Yes (or Vite proxy) | **No — always cross-origin** |
> | Cookie `sameSite` | `lax` | `none` |
> | Cookie `secure` | `false` | `true` (HTTPS required) |
> | `VITE_API_URL` | `""` (empty — relative URLs) | `https://book-my-slot-1.onrender.com` |
> | WebSocket URL | `ws://localhost:5000/ws/…` | `wss://book-my-slot-1.onrender.com/ws/…` |
> | Static files | Served by `server/static.ts` | Served by CDN (backend serves nothing) |
>
> ### Render-Specific Gotchas
>
> | Issue | Detail |
> |---|---|
> | **Cold starts** | Free/starter tier sleeps after 15 min of inactivity. First request after sleep can take 30–60 s. |
> | **PORT env var** | Render injects `PORT` automatically. Express listens on `process.env.PORT`. Never hardcode `5000`. |
> | **Ephemeral filesystem** | Every deploy/restart wipes the disk. Don't store uploads, PDFs, or any user data on disk. |
> | **Health check** | `GET /api/health` must return 200 quickly. Render uses it to verify the service is up. Don't add heavy logic to it. |
> | **SPA routing** | `client/public/_redirects` (`/* /index.html 200`) handles Wouter routes on the CDN. Do not remove it. |
> | **trust proxy** | `app.set("trust proxy", 1)` is already set — required for `req.secure` to work behind Render's load balancer. |

---

> ### Database Migration Notice — May 2026
> The BookMySlot database was originally a **Render PostgreSQL** instance. In May 2026, it was migrated to **Supabase PostgreSQL** (free-tier, Singapore region) because Render's free PostgreSQL databases are permanently deleted after 90 days of inactivity.
>
> **What this means:**
> - `DATABASE_URL` now points to the **Supabase connection pooler** URL (port `6543`) — not a Render database URL.
> - Everything else (sessions, emails, Razorpay, Twilio, R2) is unchanged.
>
> For the full technical details see [`docs/supabase-database-setup.md`](./supabase-database-setup.md).

---

## What is an Environment Variable?

Think of environment variables like **settings on the back of a machine** — they tell the app how to behave without you having to open and rewrite the code every time.

For example:
- One setting tells the app "you're in production now, behave properly" (`NODE_ENV=production`)
- Another tells it "here's the database password" (`DATABASE_URL=...`)
- Another tells it "send emails to real people, not the test inbox" (`RESEND=PRODUCTION`)

These settings live **outside the code** — they are stored in your hosting platform (Render) and injected into the app when it starts. This is good because:
- You never have to put passwords inside your code files
- You can change a setting without redeploying new code
- Your development setup and live production setup can have different values safely

---

## Where to Set Them on Render

### For the Backend (Book-My-Slot-1):
1. Go to [render.com](https://render.com) and log in
2. Open your **Web Service** → `Book-My-Slot-1`
3. Click **Environment** in the left sidebar
4. Click **Add Environment Variable** to add a new one, or click an existing one to edit it
5. Click **Save Changes** — Render will automatically restart and redeploy with the new values

### For the Frontend (Book-My-Slot-Client):
1. Go to [render.com](https://render.com) and log in
2. Open your **Static Site** → `Book-My-Slot-Client`
3. Click **Environment** in the left sidebar
4. Add or edit variables the same way
5. Click **Save Changes** — Render will **rebuild the frontend automatically** (required for `VITE_*` vars to take effect)

> **Important:** Backend variables and frontend variables are set in two separate places on Render. They do not share settings with each other. A `VITE_*` variable set on the backend service is invisible to the browser.

---

## Backend Environment Variables — Full Reference

These must all be set in your **Render Web Service (`Book-My-Slot-1`)** under Environment.

---

### DATABASE_URL
**Required — app will crash without this.**

This is the full address and password for your PostgreSQL database.

> **Updated (May 2026):** The database has been migrated from Render PostgreSQL to **Supabase**. The value to use on Render is now the Supabase connection pooler URL — not a Render database URL. See full details in [`docs/supabase-database-setup.md`](./supabase-database-setup.md).

```
DATABASE_URL=postgresql://postgres.PROJECT_ID:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```

**Why the pooler URL and not the direct Supabase URL?**
Render's servers cannot make outbound IPv6 connections. Supabase's direct connection hostname resolves to an IPv6 address in the Singapore region, which causes an immediate `ENETUNREACH` error on Render. The pooler hostname always resolves to an IPv4 address that Render can reach.

Where to get it: Log into [supabase.com](https://supabase.com) → your project → **Project Settings → Database → Connection string** → select the **Connection pooler** tab → copy the **Transaction mode** URL (port `6543`).

> If your password contains special characters (e.g. `@`), encode them in the URL: `@` → `%40`. See `docs/supabase-database-setup.md` Section 4 for the full encoding table.

What breaks if missing: The entire app fails to start. Nothing works.

---

### SESSION_SECRET
**Required — unsafe fallback exists, must be overridden in production.**

When a clinic admin or doctor logs in, the app remembers them by storing a session token in the user's browser. The `SESSION_SECRET` is the key used to sign (encrypt) that token.

If this is not set, the app falls back to `"book-my-slot-secret"` — which is publicly visible in the code. Anyone who knows this fallback could potentially forge a login session.

**How to generate a strong, safe value:**
```
openssl rand -base64 32
```

> **Important:** Once set, never change this value unless absolutely necessary. Changing it instantly logs out every currently logged-in user (admins, doctors).

What breaks if missing: Sessions are insecure. Admin and doctor logins are vulnerable.

---

### NODE_ENV
**Required.**

Tells the app which "mode" it is running in. In production, the app enables security settings (secure cookies, HTTPS-only) and hides technical error details from users.

```
NODE_ENV=production
```

What breaks if missing: Security settings (HTTPS-only cookies, CORS) may not work correctly.

---

### PORT
**Required.**

The network port the server listens on. Render automatically assigns and injects this — set it to `10000` on Render.

```
PORT=10000
```

What breaks if missing: Render can't connect to your server — site goes offline.

---

### ADMIN_EMAIL
**Required.**

The email address used to log into the Super Admin panel at `/admin`.

```
ADMIN_EMAIL=your-admin@example.com
```

> **Note:** If not set, the app falls back to `itsmyfavoriteworkplace@gmail.com` (developer test email). Always set this to your real admin email in production.

---

### ADMIN_PASSWORD
**Required.**

The password for the Super Admin login. Use something strong — at least 12 characters.

```
ADMIN_PASSWORD=YourStrongPasswordHere!
```

---

### FRONTEND_URL
**Required.**

The full public URL(s) where your frontend is hosted. Accepts a **comma-separated list** of origins. The backend uses this for:
1. CORS — allowing the frontend to call the backend
2. Email links — building correct URLs in doctor invite emails

```
FRONTEND_URL=https://book-my-slot-client.onrender.com,https://bookmyslot.dental.mossaic.in
```

> When adding a new frontend domain, staging URL, or white-label domain, add it here (comma-separated) instead of hardcoding it in `server/index.ts`.

What breaks if missing: The frontend can't communicate with the backend. Doctor invite email links point to the wrong URL.

---

### RESEND_API_KEY
**Required for emails to work.**

Your private key from the Resend platform.

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
```

Where to get it: [resend.com](https://resend.com) → **API Keys** → copy your key.

What breaks if missing: All email sending is silently disabled. No booking confirmations, no doctor invites, no cancellation emails.

---

### EMAIL_FROM
**Required for emails to look correct.**

The name and email address patients see as the sender.

```
EMAIL_FROM=BookMySlot <noreply@bookmyslot.dental.mossaic.in>
```

If not set, falls back to `BookMySlot <onboarding@resend.dev>` — Resend's shared sandbox address, which looks unprofessional.

---

### RESEND
**Required to send emails to real people.**

On/off switch between test mode and real delivery.

```
RESEND=PRODUCTION
```

| Value | What happens |
|---|---|
| Not set (or anything other than `PRODUCTION`) | Every email goes to the hardcoded test inbox — no patient ever receives anything |
| `PRODUCTION` | Emails go to the actual patient, clinic, or doctor email address |

What breaks if missing: Patients, clinics, and doctors never receive any emails.

---

### RAZORPAY_KEY_ID
**Optional — only needed if payments are enabled.**

The public identifier for your Razorpay payment gateway account.

```
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx
```

What breaks if missing: The payment flow is disabled. Patients cannot pay online.

---

### RAZORPAY_KEY_SECRET
**Optional — only needed if payments are enabled.**

The private key for Razorpay. Used on the backend only to verify payments.

```
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

> **Never expose this on the frontend.** Backend env var only.

---

### TWILIO_ACCOUNT_SID
**Optional — only needed if WhatsApp notifications are enabled.**

Your Twilio account identifier for sending WhatsApp messages.

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx
```

What breaks if missing: WhatsApp notifications are silently disabled.

---

### TWILIO_AUTH_TOKEN
**Optional — only needed if WhatsApp notifications are enabled.**

The secret key for your Twilio account.

```
TWILIO_AUTH_TOKEN=your_twilio_auth_token
```

---

### TWILIO_WHATSAPP_NUMBER
**Optional — but has a dangerous default.**

The WhatsApp number that messages are sent from. If not set, falls back to `+14155238886` — Twilio's shared sandbox test number.

```
TWILIO_WHATSAPP_NUMBER=+919xxxxxxxxx
```

> If you are sending real WhatsApp messages in production, this must be set to your actual approved Twilio WhatsApp number.

---

### R2_ACCOUNT_ID
**Optional — only needed if clinic logo / image uploads are enabled.**

Your Cloudflare account ID. Cloudflare R2 is used to store clinic profile images and other uploaded files.

```
R2_ACCOUNT_ID=your_cloudflare_account_id
```

What breaks if missing: Image uploads are disabled.

---

### R2_ACCESS_KEY_ID
**Optional — only needed if image uploads are enabled.**

```
R2_ACCESS_KEY_ID=your_r2_access_key
```

---

### R2_SECRET_ACCESS_KEY
**Optional — only needed if image uploads are enabled.**

```
R2_SECRET_ACCESS_KEY=your_r2_secret_key
```

---

### R2_BUCKET_NAME
**Optional — has a safe default.**

The name of the storage bucket where images are stored.

```
R2_BUCKET_NAME=bookmyslot-images
```

Falls back to `app-images` if not set.

---

### R2_PUBLIC_URL
**Optional — needed for images to display correctly.**

The public web address where uploaded images can be viewed.

```
R2_PUBLIC_URL=https://pub-xxxxxxxxxxxxxxxx.r2.dev
```

Where to get it: Cloudflare dashboard → R2 → your bucket → **Settings** → copy the Public Bucket URL.

---

### FORCE_SEED
**Optional — for development/testing only.**

When set to `"true"`, forces the app to re-create demo data on every server restart.

```
FORCE_SEED=true
```

> **Do not set this in production.** It will wipe and recreate demo data on every restart.

---

## Frontend Environment Variables — Full Reference

These must be set in your **Render Static Site (`Book-My-Slot-Client`)** under Environment. After saving, Render automatically triggers a new build — the new values only take effect after the build completes.

---

### VITE_API_URL
**Required.**

Tells the frontend where the backend API server lives. Without this, the frontend doesn't know where to send booking requests, login attempts, or any other data.

```
VITE_API_URL=https://book-my-slot-1.onrender.com
```

> No trailing slash. Must be the full HTTPS URL of `Book-My-Slot-1`.

What breaks if missing: The entire frontend breaks — no data loads, no logins work, bookings fail.

---

### VITE_RAZORPAY_KEY_ID
**Optional — only needed if payments are enabled on the frontend.**

The public Razorpay key, used by the frontend to open the Razorpay payment popup. This is the same value as `RAZORPAY_KEY_ID` on the backend — it is safe to expose on the frontend (public key, not a secret).

```
VITE_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx
```

---

## Variables with Dangerous Hardcoded Fallbacks

These are variables where, if forgotten, the app doesn't crash — it silently uses an unsafe or incorrect default.

| Variable | Dangerous Default | Risk |
|---|---|---|
| `SESSION_SECRET` | `"book-my-slot-secret"` (public in code) | Anyone could forge admin/doctor login sessions |
| `ADMIN_EMAIL` | `itsmyfavoriteworkplace@gmail.com` | Admin login goes to wrong email |
| `RESEND` | `DEV` — all emails to test inbox | No patient ever receives a real email |
| `EMAIL_FROM` | `onboarding@resend.dev` | Emails look unprofessional, may not work with custom domain |
| `TWILIO_WHATSAPP_NUMBER` | `+14155238886` (Twilio sandbox) | WhatsApp messages sent from wrong/test number |
| `FRONTEND_URL` | `https://book-my-slot-client.onrender.com` | Doctor invite links may point to wrong address if domain changed |

---

## Production Go-Live Checklist

**Backend (Web Service `Book-My-Slot-1` → Environment):**
- [ ] `DATABASE_URL` — Supabase pooler URL (port `6543`) — see `docs/supabase-database-setup.md`
- [ ] `SESSION_SECRET` — strong random string (min 32 characters)
- [ ] `NODE_ENV` — `production`
- [ ] `PORT` — `10000`
- [ ] `ADMIN_EMAIL` — your real admin email
- [ ] `ADMIN_PASSWORD` — strong password
- [ ] `FRONTEND_URL` — all frontend origins, comma-separated
- [ ] `RESEND_API_KEY` — your Resend API key
- [ ] `EMAIL_FROM` — `BookMySlot <noreply@bookmyslot.dental.mossaic.in>`
- [ ] `RESEND` — `PRODUCTION`
- [ ] `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` — if payments are live
- [ ] `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` — if WhatsApp is live
- [ ] `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` — if image uploads are live

**Frontend (Static Site `Book-My-Slot-Client` → Environment):**
- [ ] `VITE_API_URL` — full HTTPS URL of `Book-My-Slot-1`, no trailing slash
- [ ] `VITE_RAZORPAY_KEY_ID` — if payments are live
