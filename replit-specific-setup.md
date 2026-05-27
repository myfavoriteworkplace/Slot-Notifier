# Replit-Specific Setup

This document catalogues every part of the codebase that is specific to the Replit
platform. Use it as a reference when deploying or running the app outside Replit
(e.g. Render, Railway, VPS, or a split frontend/backend setup).

---

## 1. Vite Plugins — `vite.config.ts`

### What it does
Three Replit-only Vite plugins are loaded at dev time:

| Plugin | Purpose |
|---|---|
| `@replit/vite-plugin-runtime-error-modal` | Shows a runtime error overlay inside the Replit webview |
| `@replit/vite-plugin-cartographer` | Adds a code-navigation sidebar inside Replit |
| `@replit/vite-plugin-dev-banner` | Shows a dev banner in the Replit preview pane |

### Where in code
```ts
// vite.config.ts  lines 4, 9-20
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

plugins: [
  react(),
  runtimeErrorOverlay(),                          // always loaded (dev only)
  ...(process.env.NODE_ENV !== "production" &&
      process.env.REPL_ID !== undefined            // only on Replit
    ? [cartographer(), devBanner()]
    : []),
],
```

### Impact on external deployment
- `runtimeErrorOverlay` is a dev dependency and is not bundled into the production
  build — no action needed.
- `cartographer` and `devBanner` are guarded by `REPL_ID !== undefined`, so they
  never load outside Replit.
- The three packages (`@replit/vite-plugin-*`) are listed under `devDependencies`
  in `package.json` and are not included in the production bundle.

### Action required for Render
None. These plugins are inert outside Replit.

---

## 2. Vite HMR Configuration — `server/vite.ts`

### What it does
When the `REPLIT_DEV_DOMAIN` environment variable is present, the Vite dev server
routes its Hot Module Replacement (HMR) websocket through the Replit proxy domain
instead of the default localhost socket.

### Where in code
```ts
// server/vite.ts  lines 12-21
const replitDomain = process.env.REPLIT_DEV_DOMAIN;

const hmrConfig = replitDomain
  ? {
      server,
      host: replitDomain,   // e.g. abc123.pike.replit.dev
      clientPort: 443,
      protocol: "wss" as const,
    }
  : { server };             // standard fallback used on all other platforms
```

### Impact on external deployment
When `REPLIT_DEV_DOMAIN` is not set (i.e. on Render or any other host), the code
falls back to the standard HMR config `{ server }`. No breakage.

### Action required for Render
None. HMR is a dev-only feature and is not present in production builds.

---

## 3. CORS Allow-list — `server/index.ts`

### What it does
The CORS origin check includes a wildcard pass for any origin containing
`"replit.dev"` so that the Replit preview iframe can reach the API during
development.

### Where in code
```ts
// server/index.ts  line 69
if (!origin || FRONTEND_ORIGINS.includes(origin) || origin.includes("replit.dev")) {
  callback(null, true);
} else {
  callback(new Error(`CORS blocked for origin: ${origin}`));
}
```

The explicit allowed origins list (`FRONTEND_ORIGINS`) also includes:
- `http://localhost:5173` / `http://localhost:5000` (local dev)
- `https://book-my-slot-client.onrender.com` (Render frontend)
- `https://bookmyslot.dental.mossaic.in` (custom domain)
- Any URLs in the `FRONTEND_URL` environment variable (comma-separated)

### Impact on external deployment
The `replit.dev` wildcard is harmless on Render — no Replit origins will ever
appear in production traffic. All your Render and custom-domain origins are already
in the explicit list.

### Action required for Render
Set the `FRONTEND_URL` environment variable on your Render backend service to your
actual frontend URL(s), e.g.:

```
FRONTEND_URL=https://book-my-slot-client.onrender.com
```

For multiple frontend origins, use a comma-separated list:
```
FRONTEND_URL=https://book-my-slot-client.onrender.com,https://bookmyslot.dental.mossaic.in
```

---

## 4. Replit Platform Config — `.replit`

### What it does
The `.replit` file is read exclusively by the Replit platform. It configures:

| Setting | Value |
|---|---|
| Runtime modules | `nodejs-20`, `web`, `postgresql-16` |
| Dev command | `npm run dev` (port 5000) |
| Deployment target | `autoscale` |
| Production run | `npm start` → `node dist/index.cjs` |
| Production build | `npm run build` |
| Replit integration | `javascript_log_in_with_replit:2.0.0` (registered but not wired into routes) |

Shared environment variables defined here (non-secret, safe to duplicate on Render):

| Variable | Example value | Notes |
|---|---|---|
| `PORT` | `5000` | Set to Render's `PORT` or leave unset (Render injects it) |
| `NODE_ENV` | `development` | Set to `production` on Render |
| `FRONTEND_URL` | `http://localhost:5000` | Update to your Render frontend URL |
| `ADMIN_EMAIL` | `you@example.com` | Super-admin email |
| `VITE_RAZORPAY_KEY_ID` | `rzp_test_…` | Public Razorpay key (safe for frontend) |
| `RAZORPAY_KEY_ID` | `rzp_test_…` | Same key used server-side |
| `RAZORPAY_PLAN_ID_*` | `plan_…` | Your Razorpay plan IDs |
| `RAZORPAY_WEBHOOK_SECRET` | *(secret)* | Move to Render secret env var |
| `EMAIL_FROM` | `alerts@…` | Sender address for Resend emails |

### Action required for Render
Recreate the relevant environment variables in Render's dashboard. See Section 6
for the full secrets checklist.

---

## 5. Replit Auth Integration

### What it does
The `.replit` file registers the `javascript_log_in_with_replit:2.0.0` integration
at the platform level. This enables Replit's built-in OIDC login.

### Current status in code
The integration is **registered but not actively used in any API routes**. The app
uses its own session-based authentication:
- **Clinic admins / Doctors** — username + password via `express-session` backed by
  PostgreSQL (`connect-pg-simple`).
- **Super admin** — `ADMIN_EMAIL` + `ADMIN_PASSWORD` environment variables.
- `openid-client` and `passport` are present in `package.json` but the Replit OIDC
  flow is not wired into `server/routes.ts`.

### Action required for Render
None. The existing session-based auth works identically on Render. Just ensure
`SESSION_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` are set as secrets.

---

## 6. Environment Variables & Secrets Checklist for Render

Use this checklist when setting up Render environment variables.

### Backend service (Node/Express)

| Variable | Type | Notes |
|---|---|---|
| `NODE_ENV` | env var | Set to `production` |
| `PORT` | env var | Render injects this automatically |
| `DATABASE_URL` | secret | PostgreSQL connection string (Render managed DB or external) |
| `SESSION_SECRET` | secret | Random long string — never use the default |
| `ADMIN_EMAIL` | env var | Super-admin login email |
| `ADMIN_PASSWORD` | secret | Super-admin login password |
| `FRONTEND_URL` | env var | Comma-separated list of allowed frontend origins |
| `RESEND_API_KEY` | secret | From resend.com — required for booking emails |
| `RAZORPAY_KEY_ID` | env var | Public Razorpay key |
| `RAZORPAY_KEY_SECRET` | secret | Private Razorpay key |
| `RAZORPAY_WEBHOOK_SECRET` | secret | From Razorpay dashboard |
| `RAZORPAY_PLAN_ID_STARTER_MONTHLY` | env var | Razorpay plan ID |
| `RAZORPAY_PLAN_ID_STARTER_ANNUAL` | env var | Razorpay plan ID |
| `RAZORPAY_PLAN_ID_GROWTH_MONTHLY` | env var | Razorpay plan ID |
| `RAZORPAY_PLAN_ID_GROWTH_ANNUAL` | env var | Razorpay plan ID |
| `RAZORPAY_PLAN_ID_PRO_MONTHLY` | env var | Razorpay plan ID |
| `RAZORPAY_PLAN_ID_PRO_ANNUAL` | env var | Razorpay plan ID |
| `EMAIL_FROM` | env var | Sender email address for Resend |
| `R2_ACCESS_KEY_ID` | secret | Cloudflare R2 — only if using image uploads |
| `R2_SECRET_ACCESS_KEY` | secret | Cloudflare R2 — only if using image uploads |
| `R2_BUCKET_NAME` | env var | Cloudflare R2 bucket name |
| `R2_ENDPOINT` | env var | Cloudflare R2 endpoint URL |
| `R2_PUBLIC_URL` | env var | Public base URL for R2-hosted images |
| `TWILIO_ACCOUNT_SID` | secret | Only if WhatsApp notifications are enabled |
| `TWILIO_AUTH_TOKEN` | secret | Only if WhatsApp notifications are enabled |
| `TWILIO_WHATSAPP_FROM` | env var | Only if WhatsApp notifications are enabled |

### Frontend service (Vite static build)

| Variable | Notes |
|---|---|
| `VITE_API_URL` | Full URL of your backend API, e.g. `https://api.bookmyslot.dental.mossaic.in` |
| `VITE_RAZORPAY_KEY_ID` | Public Razorpay key — safe to expose to the browser |

---

## 7. `package.json` — Replit devDependencies

These three packages are Replit-specific and only used during local Replit
development. They are `devDependencies` and are not included in production builds.

```json
"@replit/vite-plugin-cartographer": "^0.4.4",
"@replit/vite-plugin-dev-banner": "^0.1.1",
"@replit/vite-plugin-runtime-error-modal": "^0.0.3"
```

They are safe to leave in `package.json` — they simply won't activate outside
Replit. If you want a fully clean external repo, they can be removed along with
their references in `vite.config.ts`.

---

## 8. Summary — What Needs Attention on Render

| Item | Action |
|---|---|
| Vite plugins | Nothing — inert outside Replit |
| HMR config | Nothing — falls back to standard automatically |
| CORS | Set `FRONTEND_URL` to your frontend domain(s) |
| `.replit` file | Ignored by Render — no action |
| Replit Auth | Not in use — session auth works as-is |
| Environment variables | Recreate all secrets from Section 6 in Render dashboard |
| `npm install` | `.npmrc` sets `legacy-peer-deps=true` — no extra flags needed |
