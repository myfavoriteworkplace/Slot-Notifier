# GoDaddy Domain Configuration — BookMySlot on mossaic.in

> **Purpose of this document**
> This is the single reference for every DNS record, subdomain mapping, and application-level domain setting for the BookMySlot platform. Any developer, DevOps engineer, or AI agent making changes that touch domains, email, CORS, or environment variables must read this first.

---

## 1. Domain Architecture Overview

The platform uses a single GoDaddy-managed root domain — **`mossaic.in`** — and builds all services as subdomains beneath it.

```
mossaic.in
│
├── @  (root)                   → GitHub Pages (mossaic.in company site)
├── www                         → GitHub Pages
│
├── bookmyslot.dental           → Render Static Site  (BookMySlot Frontend)
├── api.bookmyslot.dental       → Render Web Service  (BookMySlot Backend API)
│
├── mail                        → Improvmx → Zoho Mail forwarding
└── send.bookmyslot.dental      → Amazon SES via Resend (transactional email)
```

Full qualified domain names (GoDaddy host values are relative to `mossaic.in`):

| GoDaddy Host | Full FQDN | Service |
|---|---|---|
| `@` | `mossaic.in` | GitHub Pages — company website |
| `www` | `www.mossaic.in` | GitHub Pages — www alias |
| `bookmyslot.dental` | `bookmyslot.dental.mossaic.in` | BookMySlot **frontend** (Render Static Site) |
| `api.bookmyslot.dental` | `api.bookmyslot.dental.mossaic.in` | BookMySlot **backend API** (Render Web Service) |
| `mail` | `mail.mossaic.in` | Improvmx email forwarding → Zoho Mail |
| `send.bookmyslot.dental` | `send.bookmyslot.dental.mossaic.in` | Transactional email sending (Resend → SES) |

---

## 2. Complete DNS Records Reference

> **Source:** GoDaddy zone export for `mossaic.in` — last verified **2026-05-28 09:42:34 UTC**
> All records below are taken directly from the exported zone file. TTL values are in seconds.

---

### A Records — Root domain → GitHub Pages

| Type | Host | TTL | Value | Purpose |
|---|---|---|---|---|
| A | `@` | 600 | `185.199.108.153` | GitHub Pages IP #1 |
| A | `@` | 600 | `185.199.109.153` | GitHub Pages IP #2 |
| A | `@` | 600 | `185.199.110.153` | GitHub Pages IP #3 |
| A | `@` | 600 | `185.199.111.153` | GitHub Pages IP #4 |

> These serve `mossaic.in` as a static GitHub Pages site (the Mossaic company homepage). This is unrelated to the BookMySlot application. The short TTL (600 s = 10 min) means changes propagate quickly.

---

### CNAME Records — Subdomains → Hosting providers

| Type | Host | TTL | Value | Purpose |
|---|---|---|---|---|
| CNAME | `bookmyslot.dental` | 3600 | `book-my-slot-client.onrender.com` | **BookMySlot frontend** (Render Static Site) |
| CNAME | `api.bookmyslot.dental` | 3600 | `book-my-slot-1.onrender.com` | **BookMySlot backend API** (Render Web Service) |
| CNAME | `www` | 3600 | `myfavoriteworkplace.github.io` | GitHub Pages www alias |
| CNAME | `_domainconnect` | 3600 | `_domainconnect.gd.domaincontrol.com` | GoDaddy internal service |

> **Important for Render custom domain setup:** Both `bookmyslot.dental.mossaic.in` and `api.bookmyslot.dental.mossaic.in` must be added as custom domains inside the respective Render services (Static Site and Web Service) for Render to issue TLS certificates and route traffic correctly.

---

### MX Records — Email routing

| Type | Host | TTL | Priority | Value | Purpose |
|---|---|---|---|---|---|
| MX | `mail` | 3600 | 10 | `mx1.improvmx.com` | Improvmx primary — forwards `*@mail.mossaic.in` to Zoho |
| MX | `mail` | 3600 | 20 | `mx2.improvmx.com` | Improvmx fallback |
| MX | `send.bookmyslot.dental` | 3600 | 10 | `feedback-smtp.ap-northeast-1.amazonses.com` | SES bounce/complaint feedback loop for Resend |

> `mail.mossaic.in` is a **forwarding-only** subdomain — all emails to `*@mail.mossaic.in` are forwarded to the Zoho Mail inbox. This is where `bookmyslot@mail.mossaic.in` (the app's support address) lands.
>
> `send.bookmyslot.dental.mossaic.in` is the **sending** subdomain used by Resend. It is not a receiving inbox — the MX record here is only for bounce/complaint feedback to Amazon SES.
>
> ⚠️ **The root domain `@mossaic.in` has NO MX records.** Emails sent directly to `someone@mossaic.in` are undeliverable. See Section 6 for the Meta verification implication.

---

### TXT Records — Email authentication

| Type | Host | TTL | Value | Purpose |
|---|---|---|---|---|
| TXT | `send.bookmyslot.dental` | 3600 | `v=spf1 include:amazonses.com ~all` | SPF — authorises SES to send from this subdomain |
| TXT | `resend._domainkey.bookmyslot.dental` | 3600 | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC1YAyVzB79jim/Q8cmb0YFSwvurq9b7YS8jTyoRCU4kBxe62sdb0ujItzH/OyJMZ63dg+iIq6aFBj5vO07iv32uI9svrrZ3yYKa5O2KCnZ+Wa1wTSKipjxBTIWZSJHgGvrHISwaQcSS4vOG5kw9wkhaHABsI6SOpszTWJwQPA4JwIDAQAB` | DKIM public key for Resend/SES |
| TXT | `_dmarc` | 3600 | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` | DMARC — quarantine suspicious mail, send reports to onsecureserver.net |

> The DKIM key is scoped to `bookmyslot.dental.mossaic.in` via the `resend._domainkey.bookmyslot.dental` selector. This means **all transactional emails must be sent from an address under `@bookmyslot.dental.mossaic.in`** for DKIM to pass. Sending from `@mossaic.in` directly will fail DKIM.
>
> ⚠️ **SPF for `mail.mossaic.in` is not present in the exported zone file.** If Improvmx requires `v=spf1 include:spf.improvmx.com ~all` on the `mail` host for forwarding to work correctly, this record may need to be added in GoDaddy. Verify in the Improvmx dashboard under domain settings.

---

### NS Records — GoDaddy nameservers

| Type | Host | TTL | Value | Purpose |
|---|---|---|---|---|
| NS | `@` | 3600 | `ns17.domaincontrol.com` | GoDaddy primary nameserver |
| NS | `@` | 3600 | `ns18.domaincontrol.com` | GoDaddy secondary nameserver |

> GoDaddy default nameservers. These must remain unchanged as long as DNS is managed inside GoDaddy. Replacing these with another provider's NS records (e.g. Cloudflare) would move DNS management out of GoDaddy entirely.

---

### SOA Record — Zone authority

| Type | Host | TTL | Primary NS | Admin email | Serial | Refresh | Retry | Expire | Min TTL |
|---|---|---|---|---|---|---|---|---|---|
| SOA | `@` | 3600 | `ns17.domaincontrol.com` | `dns.jomax.net` | 2026050900 | 28800 | 7200 | 604800 | 3600 |

> **Serial** `2026050900` — increments on every zone change (format: YYYYMMDDNN). **Refresh** 28800 s (8 h) — how often secondary nameservers check for updates. **Retry** 7200 s (2 h) — how long before retrying a failed refresh. **Expire** 604800 s (7 days) — how long secondaries serve the zone if primary is unreachable. **Min TTL** 3600 s (1 h) — negative caching TTL.

---

## 3. How the Application Uses These Domains

### 3a. Frontend URL — `bookmyslot.dental.mossaic.in`

The frontend React app is built by Vite and served as a static site from Render's CDN.

**Render Static Site service:** `Book-My-Slot-Client`
**Custom domain set in Render:** `bookmyslot.dental.mossaic.in`

The frontend calls the backend via the `VITE_API_URL` environment variable (set on the Render Static Site service):

```
VITE_API_URL=https://api.bookmyslot.dental.mossaic.in
```

In `client/src/lib/queryClient.ts`:
```ts
export const API_BASE_URL = import.meta.env.VITE_API_URL || "";
```

If `VITE_API_URL` is empty (dev mode), all requests are relative (same origin). In production, it must point to the backend custom domain.

> **SPA routing:** The file `client/public/_redirects` contains `/* /index.html 200` so Render's CDN correctly serves the Wouter SPA on all paths. Do not remove this file.

---

### 3b. Backend API URL — `api.bookmyslot.dental.mossaic.in`

The backend Express server runs on Render's Web Service.

**Render Web Service:** `Book-My-Slot-1`
**Custom domain set in Render:** `api.bookmyslot.dental.mossaic.in`

---

### 3c. CORS — Which origins the backend allows

Defined in `server/index.ts`. The whitelist is a hardcoded base list **plus** anything from the `FRONTEND_URL` env var:

```ts
const FRONTEND_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "https://bookmyslot.dental.mossaic.in",        // ← custom domain frontend
  "https://www.bookmyslot.dental.mossaic.in",     // ← www variant
  "https://api.bookmyslot.dental.mossaic.in",     // ← backend own origin
  "https://book-my-slot-client.onrender.com",     // ← Render default domain fallback
  ...FRONTEND_URL_RAW.split(",")...               // ← from FRONTEND_URL env var
];
```

Additionally, any origin containing `replit.dev` is automatically allowed for development.

**`FRONTEND_URL` env var on Render backend (`Book-My-Slot-1`):**
```
FRONTEND_URL=https://bookmyslot.dental.mossaic.in
```

If you add a new domain (e.g. a white-label clinic portal), add it comma-separated to `FRONTEND_URL` rather than hardcoding it in `server/index.ts`.

---

### 3d. Email sending — `send.bookmyslot.dental.mossaic.in`

All transactional emails (booking confirmations, OTPs, doctor invites, cancellations) go through **Resend**, which uses Amazon SES under the hood and sends from the verified `send.bookmyslot.dental.mossaic.in` subdomain.

**Relevant env vars on Render backend:**

| Var | Value in production |
|---|---|
| `RESEND_API_KEY` | Your Resend API key |
| `EMAIL_FROM` | `BookMySlot <noreply@bookmyslot.dental.mossaic.in>` |
| `RESEND` | `PRODUCTION` |

**Default fallback in code** (`server/routes.ts` line 19):
```ts
const EMAIL_FROM = process.env.EMAIL_FROM || 'BookMySlot <onboarding@resend.dev>';
```

If `EMAIL_FROM` is not set on Render, emails come from Resend's shared sandbox address, which looks unprofessional and may fail DKIM.

**Email link base URL fallback** (used in doctor invite links, clinic login links, consent form links):
```ts
process.env.FRONTEND_URL || 'https://bookmyslot.dental.mossaic.in'
```

If `FRONTEND_URL` is not set, all email links correctly fall back to the custom domain.

---

### 3e. Email forwarding — `mail.mossaic.in` → Zoho

This is independent of the BookMySlot application. Improvmx forwards `*@mail.mossaic.in` to the Zoho Mail inbox. The application never sends or receives mail via this route — it is used for business communication only.

---

## 4. Environment Variable → Domain Mapping

| Env Var | Service | Required value in production |
|---|---|---|
| `VITE_API_URL` | Render Static Site (frontend) | `https://api.bookmyslot.dental.mossaic.in` |
| `FRONTEND_URL` | Render Web Service (backend) | `https://bookmyslot.dental.mossaic.in` |
| `EMAIL_FROM` | Render Web Service (backend) | `BookMySlot <noreply@bookmyslot.dental.mossaic.in>` |

---

## 5. Hardcoded Domain References in Source Code

These are places in the codebase where a domain is baked in as a fallback. They work correctly because they all point to the custom domain — but if the domain ever changes, each of these must be updated.

| File | Line(s) | Hardcoded value | Purpose |
|---|---|---|---|
| `server/index.ts` | 32–35 | `bookmyslot.dental.mossaic.in`, `book-my-slot-client.onrender.com` | CORS whitelist |
| `server/index.ts` | 24 | `https://book-my-slot-client.onrender.com` | Default `FRONTEND_URL` in production |
| `server/routes.ts` | 255, 459, 507, 558, 617, 750, 1087, 1198, 2310, 2339, 3576 | `https://bookmyslot.dental.mossaic.in` | Fallback for email link base URL |
| `server/routes.ts` | 101 | `bookmyslot@mail.mossaic.in` | Email footer support address |

> All support contact links now use `bookmyslot@mail.mossaic.in`, which is covered by the Improvmx MX records on `mail.mossaic.in` and forwards to the Zoho Mail inbox.

---

## 6. Known Issues and Notes

### 6a. Root domain email gap (`@mossaic.in` receives nothing)

The Improvmx MX records are on the `mail` host — meaning they cover `*@mail.mossaic.in` only. The root domain `@mossaic.in` has no MX records, so **emails sent directly to `someone@mossaic.in` are undeliverable**.

This affects:

- **Meta Business Verification**: Meta requires an email at the root domain (e.g. `admin@mossaic.in`) for the domain verification step. Since there are no MX records at root, the verification email cannot be received.

  **Options to resolve:**
  1. Temporarily add Improvmx MX records at `@` (root), complete verification, then remove them.
  2. Use Meta's document-based verification instead (avoids any DNS changes).

- **Any system that tries to email `@mossaic.in` directly** will get a bounce.

---

### 6b. DKIM only covers `bookmyslot.dental.mossaic.in`

The DKIM selector `resend._domainkey.bookmyslot.dental` only authenticates mail from `@bookmyslot.dental.mossaic.in` addresses. Do not configure `EMAIL_FROM` to use `@mossaic.in` directly — it will fail DKIM and likely land in spam.

---

### 6c. Render custom domain TLS provisioning

Render automatically provisions Let's Encrypt TLS certificates for custom domains, but only after:
1. The CNAME record in GoDaddy has propagated (usually < 5 minutes, up to 24h).
2. The custom domain has been added in the Render service dashboard.

If the certificate shows "pending", check that the CNAME value in GoDaddy exactly matches what Render requires.

---

### 6d. `api.bookmyslot.dental.mossaic.in` in CORS whitelist

The backend's own API domain (`api.bookmyslot.dental.mossaic.in`) is listed as an allowed CORS origin in `server/index.ts`. This is harmless — it means requests originating from the API domain itself (e.g. a direct browser hit to the API root) are not CORS-blocked. It does not grant any elevated access.

---

## 7. Adding a New Domain or Subdomain

If a new domain is needed (e.g. a white-label clinic URL, a staging environment, a new service):

1. **Add a DNS record in GoDaddy** — A or CNAME pointing to the relevant Render service.
2. **Add the custom domain in the Render service** — Render won't route or issue a cert without this.
3. **Add the new origin to `FRONTEND_URL`** on the Render backend env var (comma-separated). You do not need to touch `server/index.ts`.
4. **Update `VITE_API_URL`** on the new frontend service if it is a separate Render Static Site.
5. **Add a new DKIM/SPF TXT record** if the new domain needs to send email independently (requires Resend domain verification for that new domain).

---

## 8. Render Custom Domain Checklist

Before a new subdomain goes live, verify all of these:

**GoDaddy DNS:**
- [ ] CNAME record created with correct host and target value
- [ ] CNAME has propagated (check with `dig CNAME <subdomain> +short` or [dnschecker.org](https://dnschecker.org))

**Render service:**
- [ ] Custom domain added in service dashboard → Custom Domains
- [ ] TLS certificate status shows "Verified" (not "Pending")

**Environment variables:**
- [ ] `FRONTEND_URL` on backend includes the new origin
- [ ] `VITE_API_URL` on frontend points to correct API domain
- [ ] `EMAIL_FROM` uses an address under `@bookmyslot.dental.mossaic.in`

**Application:**
- [ ] No new hardcoded domain references added to source code — all via env vars

---

## 9. Quick Reference — Live URLs

| What | URL |
|---|---|
| BookMySlot app (patient booking) | `https://bookmyslot.dental.mossaic.in` |
| BookMySlot backend API root | `https://api.bookmyslot.dental.mossaic.in` |
| Backend health check | `https://api.bookmyslot.dental.mossaic.in/api/health` |
| Clinic login | `https://bookmyslot.dental.mossaic.in/clinic-login` |
| Smile Deals public page | `https://bookmyslot.dental.mossaic.in/deals` |
| Company site | `https://mossaic.in` |
| Render backend service | `https://book-my-slot-1.onrender.com` (fallback) |
| Render frontend service | `https://book-my-slot-client.onrender.com` (fallback) |
