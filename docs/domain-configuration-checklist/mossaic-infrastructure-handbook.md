# Mossaic Infrastructure Handbook

> **Version:** 1.1 (Reviewed against BookMySlot codebase)
>
> This handbook documents the infrastructure used by Mossaic for deploying applications on Render with GoDaddy DNS.
> Section "Cross-Check Against BookMySlot Codebase" (§15) was added after reviewing the actual CORS, session, and env-var configuration in `server/index.ts`. Read it before acting on any domain change.

## Table of Contents

1. Introduction
2. Architecture
3. DNS Fundamentals
4. GoDaddy DNS Configuration
5. Understanding Every Record in Our Zone File
6. Render Deployment Guide
7. Custom Domains
8. SSL Certificates
9. Adding a New Application
10. Environment Strategy
11. Verification Commands
12. Troubleshooting
13. Best Practices
14. Checklists
15. **Cross-Check Against BookMySlot Codebase** *(new)*

---

## 1. Introduction

This document is the master infrastructure guide for all Mossaic applications.

Current environments:

- Production
- Development

Current products:

- bookmyslot

Current vertical:

- dental

Current URLs:

- `https://bookmyslot.dental.mossaic.in` — production frontend
- `https://api.bookmyslot.dental.mossaic.in` — production backend
- `https://development.bookmyslot.dental.mossaic.in` — development frontend
- `https://development.api.bookmyslot.dental.mossaic.in` — development backend

> ⚠️ **Verified status (see §15):** only the two production domains and their `www` variant are currently wired into the BookMySlot backend's CORS allowlist. The two `development.*` domains are **not yet added** anywhere in code — see §15.2 for the exact fix needed before they'll work.

---

## 2. Architecture

```text
Browser
   │
DNS (GoDaddy)
   │
Render Custom Domain
   │
Cloudflare Edge
   │
Render Service
   │
Application
```

---

## 3. DNS Fundamentals

### A Record
Maps a hostname directly to an IPv4 address.

### CNAME Record
Maps one hostname to another hostname.

We use CNAME records for every Render application because Render manages the underlying IP addresses.

### TXT Record
Used for verification and email authentication (SPF, DKIM, DMARC).

### MX Record
Routes incoming email.

### NS Record
Defines the authoritative nameservers.

### SOA Record
Stores metadata for the DNS zone.

### CAA Record
Restricts which Certificate Authorities may issue SSL certificates.

---

## 4. GoDaddy Configuration

For each new application:

1. Deploy service on Render.
2. Obtain the `*.onrender.com` hostname.
3. Create a GoDaddy CNAME.
4. Wait for propagation.
5. Verify with `nslookup`.
6. Add the FULL hostname to Render.
7. Wait for SSL.
8. **(BookMySlot-specific — see §15.2)** Add the new hostname to the backend's CORS allowlist — either via the `EXTRA_CORS_ORIGINS` env var (no code change, redeploy only) or as a hardcoded entry in `server/index.ts` if it should always be allowed regardless of environment.

---

## 5. Current Zone File Explained

| Subdomain | Purpose |
|---|---|
| `bookmyslot.dental` | Production frontend |
| `api.bookmyslot.dental` | Production backend |
| `development.bookmyslot.dental` | Development frontend |
| `development.api.bookmyslot.dental` | Development backend |
| `www` | GitHub Pages website |
| TXT records | Email authentication (SPF/DKIM/DMARC) |
| CAA | Allows Let's Encrypt certificates |

---

## 6. Render

Each application consists of:

- Frontend (Static Site)
- Backend (Web Service)

Each has:

- Production
- Development

Always configure the custom domain **after** DNS is created.

**BookMySlot-specific:** the backend Web Service build/start commands and CORS/session config already assume a split frontend/backend deploy — see `replit.md` → "Render Build Commands" and §15 below for exact values already in use.

---

## 7. Important Discovery

Always enter the complete hostname in Render.

✅ Correct:
```
development.bookmyslot.dental.mossaic.in
```

❌ Incorrect:
```
development.bookmyslot.dental
```

This was the root cause of the Cloudflare Error 1001 encountered during setup.

---

## 8. Adding a New Product

Example: `appointments.dental.mossaic.in`

Create four Render services:

- appointments frontend
- appointments API
- development frontend
- development API

Create matching GoDaddy CNAME records.

Verify using:

```bash
nslookup appointments.dental.mossaic.in
```

> **Reminder for BookMySlot-style apps:** every new frontend domain must also be added to the backend's CORS allowlist (`EXTRA_CORS_ORIGINS` env var is the fastest path — no code change or redeploy of code required, only an env var update + restart). See §15.2.

---

## 9. Troubleshooting

### NXDOMAIN
DNS record missing.

### Cloudflare Error 1001
Usually caused by an incorrect or unverified custom domain in Render.

### SSL Pending
Wait for DNS propagation and verification.

### CORS error in browser console (BookMySlot-specific)
If the domain resolves and SSL is active but the app shows `blocked by CORS policy` in the browser console, the domain has **not** been added to the backend's CORS allowlist. This is a separate step from DNS/SSL — see §15.2.

### OTP / verification emails not received (BookMySlot-specific)
Not a domain/DNS issue — this is controlled by the `RESEND` and `ADMIN_EMAIL`/`RESEND_TEST_EMAIL` env vars. See `docs/migration/migration-check-list.md`.

---

## 10. Environment Strategy

| Environment | Frontend domain | Backend domain | `NODE_ENV` | Notes |
|---|---|---|---|---|
| Production | `bookmyslot.dental.mossaic.in` | `api.bookmyslot.dental.mossaic.in` | `production` | Live traffic |
| Development | `development.bookmyslot.dental.mossaic.in` | `development.api.bookmyslot.dental.mossaic.in` | `production`* | Staging on Render, not local dev |

\* Render-hosted "development" environments still run with `NODE_ENV=production` in the app's own logic (Render doesn't run in Node's `development` mode) — the distinction between prod and dev here is purely which Render services / databases / domains are targeted, not the `NODE_ENV` value. Confirm this matches your intended setup before assuming otherwise.

---

## 11. Verification Commands

```bash
# Confirm DNS resolves to Render
nslookup bookmyslot.dental.mossaic.in
nslookup api.bookmyslot.dental.mossaic.in

# Confirm SSL certificate is active
curl -vI https://bookmyslot.dental.mossaic.in 2>&1 | grep -i "SSL certificate"

# Confirm backend is reachable and healthy
curl https://api.bookmyslot.dental.mossaic.in/api/health

# Confirm CORS allows the frontend origin (look for access-control-allow-origin in response headers)
curl -I -H "Origin: https://bookmyslot.dental.mossaic.in" https://api.bookmyslot.dental.mossaic.in/api/health
```

---

## 12. Troubleshooting (Extended)

| Symptom | Likely Cause | Fix |
|---|---|---|
| `NXDOMAIN` | CNAME missing or not propagated | Re-check GoDaddy DNS record, wait for propagation |
| Cloudflare Error 1001 | Domain not verified in Render, or incomplete hostname entered | Re-enter full hostname in Render custom domain settings |
| SSL stuck "Pending" | DNS not yet propagated to Render's edge | Wait, then re-verify in Render dashboard |
| Browser console CORS error | Domain not in backend CORS allowlist | Add to `EXTRA_CORS_ORIGINS` (§15.2) |
| App loads but API calls fail (network error, not CORS) | `VITE_API_URL` not set or wrong on frontend | Set `VITE_API_URL` to the backend's public URL, redeploy frontend |
| Session/login doesn't persist across domains | `sameSite`/`secure`/`trust proxy` misconfigured | Do not change these — see `replit.md`, they are required as-is for cross-origin Render |

---

## 13. Best Practices

- Always add the **full hostname** (including `mossaic.in`) in Render — partial hostnames cause Cloudflare Error 1001.
- Add new domains to DNS **before** configuring them in Render.
- After DNS + Render + SSL are verified, always take the additional BookMySlot-specific step of updating CORS (§15.2) — DNS/SSL success does **not** mean the app will accept requests from that domain.
- Prefer `EXTRA_CORS_ORIGINS` (env var) over hardcoding new domains in `server/index.ts` — it avoids a code change and redeploy for routine domain additions.
- Keep `FRONTEND_URL` pointed at your primary/canonical frontend domain; use `EXTRA_CORS_ORIGINS` for anything additional (staging domains, temporary domains, etc.).

---

## 14. Checklists

### Deployment Checklist

```
[ ] Render service deployed
[ ] CNAME created in GoDaddy
[ ] DNS propagated (nslookup successful)
[ ] Full hostname added to Render custom domain settings
[ ] SSL active
[ ] HTTPS working
[ ] Domain added to backend CORS allowlist (EXTRA_CORS_ORIGINS or hardcoded)
[ ] VITE_API_URL set on frontend if backend is on a different domain
[ ] curl /api/health returns 200 from the new domain
```

### New Product Checklist

```
[ ] Frontend Render service created (production)
[ ] Backend Render service created (production)
[ ] Frontend Render service created (development)
[ ] Backend Render service created (development)
[ ] 4x GoDaddy CNAME records created
[ ] All 4 domains verified via nslookup
[ ] All 4 domains added to Render with full hostname
[ ] CORS allowlist updated on both backend services (prod + dev)
[ ] Environment variables configured per docs/migration/migration-check-list.md
```

---

## 15. Cross-Check Against BookMySlot Codebase

This section documents what was verified by reading the actual running code, as opposed to the general infrastructure pattern described above.

### 15.1 What's already correctly wired up

In `server/index.ts`, the CORS allowlist (`FRONTEND_ORIGINS`) is hardcoded to include:

```
https://bookmyslot.dental.mossaic.in
https://www.bookmyslot.dental.mossaic.in
https://api.bookmyslot.dental.mossaic.in
https://book-my-slot-client.onrender.com   (Render fallback default)
http://localhost:5173, http://127.0.0.1:5173  (local dev)
http://localhost:5000, http://127.0.0.1:5000  (local dev)
```

Plus, dynamically at boot:
```
...FRONTEND_URL (env var, comma-separated, if set)
...EXTRA_CORS_ORIGINS (env var, comma-separated, if set)
```

Any Replit preview domain (`*.replit.dev`) is also allowed automatically via regex — this only matters in the Replit dev environment, not Render.

### 15.2 What is NOT yet wired up — action required

The **development subdomains** referenced throughout this handbook —
`development.bookmyslot.dental.mossaic.in` and `development.api.bookmyslot.dental.mossaic.in` — do **not** appear anywhere in the current CORS allowlist. If you deploy a development Render environment using these domains, requests from the development frontend to the development backend **will be blocked by CORS** until you take one of these steps:

**Option A (recommended, no code change):**
On the *development backend* Render service, set:
```
EXTRA_CORS_ORIGINS=https://development.bookmyslot.dental.mossaic.in
```
Restart the service. No redeploy of code needed — env var change is picked up on restart.

**Option B (hardcode, requires code change + redeploy):**
Add the domain directly to the `FRONTEND_ORIGINS` array in `server/index.ts` if you want it permanently allowed regardless of environment.

### 15.3 Related documentation

For every environment variable involved in this setup (`FRONTEND_URL`, `EXTRA_CORS_ORIGINS`, `VITE_API_URL`, etc.) with defaults and required/optional status, see:
**`docs/migration/migration-check-list.md`**

### 15.4 Confirmed session/cookie behavior

`server/index.ts` sets `sameSite: "none"`, `secure: true`, and `trust proxy: 1` for sessions — this is **required** for cross-origin cookies to work when frontend and backend are on different Render domains (which is the case here: `bookmyslot.dental.mossaic.in` vs `api.bookmyslot.dental.mossaic.in`). Do not change these values when configuring new domains — doing so will break login/session persistence.

---

## Roadmap

Future editions will include:

- Detailed GoDaddy screenshots
- Complete Render guide
- Mermaid diagrams
- Security
- Disaster recovery
- Scaling
- Multi-product architecture
- Email infrastructure
- CI/CD
