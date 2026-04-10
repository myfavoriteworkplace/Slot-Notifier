# Domain Migration Guide
## BookMySlot — Moving from Render URLs to Custom Domain

---

## Quick Reference

| Service | Live URL |
|---|---|
| Frontend (patient-facing app) | https://bookmyslot.dental.mossaic.in |
| Backend (API) | https://api.bookmyslot.dental.mossaic.in |

---

## What This Document Covers

This document records every change made when migrating BookMySlot from its original Render-generated URLs to the custom domain `bookmyslot.dental.mossaic.in`. It covers DNS setup, hosting configuration, code changes, and how to verify everything is working.

---

## 1. DNS Changes

DNS records tell the internet where to find your website. Two CNAME records were added at the domain registrar, pointing the new subdomains to the existing Render services.

| Subdomain | Points To | Purpose |
|---|---|---|
| `bookmyslot.dental.mossaic.in` | `book-my-slot-client.onrender.com` | Frontend (the app users see) |
| `api.bookmyslot.dental.mossaic.in` | `book-my-slot-1.onrender.com` | Backend (the API) |

**Additional notes:**
- Both `www.bookmyslot.dental.mossaic.in` and the non-www version were initially set up. The non-www version was chosen as primary. The `www` version redirects to the non-www.
- TTL (how long DNS is cached) was set to 300–600 seconds during the migration to allow fast updates, then raised to 3600 seconds once everything was stable.

---

## 2. Render Configuration

Changes made inside the Render hosting dashboard for each service.

### Frontend Service

**Custom domain added:** `bookmyslot.dental.mossaic.in`  
SSL certificate was automatically provisioned by Render (HTTPS enabled).

| Environment Variable | Old Value | New Value |
|---|---|---|
| `VITE_API_URL` | `https://book-my-slot-1.onrender.com` | `https://api.bookmyslot.dental.mossaic.in` |

> **Important:** No trailing slash at the end of the URL. A trailing slash causes broken API paths.

---

### Backend Service

**Custom domain added:** `api.bookmyslot.dental.mossaic.in`  
SSL certificate was automatically provisioned by Render (HTTPS enabled).

| Environment Variable | Old Value | New Value |
|---|---|---|
| `FRONTEND_URL` | `https://book-my-slot-client.onrender.com` | `https://bookmyslot.dental.mossaic.in` |

> **Tip:** `FRONTEND_URL` now supports comma-separated values if you ever need to allow multiple origins (e.g. `https://bookmyslot.dental.mossaic.in,https://www.bookmyslot.dental.mossaic.in`).

---

## 3. Code Changes

### `server/index.ts` — CORS Configuration

**What is CORS?**  
CORS (Cross-Origin Resource Sharing) is a browser security rule that controls which websites are allowed to talk to your backend API. If your frontend domain is not on the allowed list, the browser blocks the request — which was causing the 500 errors seen before this migration.

**What changed:**  
The allowed origins list was updated to explicitly include the new custom domains:

- `https://bookmyslot.dental.mossaic.in`
- `https://www.bookmyslot.dental.mossaic.in`
- `https://api.bookmyslot.dental.mossaic.in`

The original Render URLs were kept in the list as a safety fallback.

The logic was also improved so the `FRONTEND_URL` environment variable can now accept a comma-separated list of domains, making it easier to manage allowed origins without changing code.

---

### `server/routes.ts` — Email Links

**What was checked:**  
The backend generates links that are sent to patients in emails (e.g. consent form links). These links use the `FRONTEND_URL` environment variable to build the URL.

**Result:**  
No code change was needed here — once `FRONTEND_URL` was updated to the new domain on Render, all email links automatically started pointing to `https://bookmyslot.dental.mossaic.in`.

---

## 4. Verification Checklist

Use this checklist after any future redeployment or domain change to confirm everything is working.

- [ ] **Backend health check** — Open `https://api.bookmyslot.dental.mossaic.in/api/health/backend` in a browser. You should see `{"status":"ok"}`.
- [ ] **Database health check** — Open `https://api.bookmyslot.dental.mossaic.in/api/health/database` in a browser. You should see `{"status":"ok"}`.
- [ ] **Frontend loads** — Open `https://bookmyslot.dental.mossaic.in` in a browser. The BookMySlot landing page should appear.
- [ ] **SSL active** — Both URLs should show a padlock icon in the browser (HTTPS).
- [ ] **Login works** — Try logging in as a clinic or admin. A CORS or session error here means the environment variables may not have been saved or the service not redeployed.
- [ ] **www redirect** — Opening `https://www.bookmyslot.dental.mossaic.in` should redirect to `https://bookmyslot.dental.mossaic.in`.

---

## 5. Root Cause of the Original 500 Errors

For reference, here is what caused the 500 errors before this migration was completed:

1. The frontend was sending requests from `https://bookmyslot.dental.mossaic.in`.
2. The backend's CORS allowed list did not include this domain — only the old Render URL was allowed.
3. When the browser sent an API request, the backend rejected it with a CORS error.
4. Because the CORS error had no HTTP status code attached, Express defaulted to returning a **500** instead of a more descriptive CORS error.
5. Fix: adding the new domain to the allowed origins list and redeploying the backend.

---

## 6. Final Setup Summary

| What | Detail |
|---|---|
| Frontend URL | `https://bookmyslot.dental.mossaic.in` |
| Backend API URL | `https://api.bookmyslot.dental.mossaic.in` |
| SSL | Auto-provisioned by Render, HTTPS enforced |
| DNS | Stable CNAME records, TTL 3600 seconds |
| CORS | Configured in `server/index.ts`, controlled via `FRONTEND_URL` env var |
| Email links | Controlled via `FRONTEND_URL` env var on the backend Render service |
