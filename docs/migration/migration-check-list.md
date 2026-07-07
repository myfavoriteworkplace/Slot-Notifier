# BookMySlot — Environment Variables & Migration Checklist

Use this document when deploying to a new environment (Render, staging, custom domain, etc.).
It lists every configurable env var, what it does, and all hardcoded values that exist in code for awareness.

---

## Table 1 — Backend Environment Variables

Set these on your **backend** service (Render Web Service → Environment).

| Variable | Required? | Default | Used For |
|---|---|---|---|
| `DATABASE_URL` | ✅ Always | — | PostgreSQL connection string |
| `NODE_ENV` | ✅ Always | — | Controls dev/prod behaviour throughout the app |
| `SESSION_SECRET` | ✅ In prod | `book-my-slot-secret` *(dev only)* | Express session cookie encryption — must be a long random string |
| `PORT` | Optional | `5000` | Server listen port |
| `FRONTEND_URL` | ✅ In prod | `https://book-my-slot-client.onrender.com` | Primary frontend origin — added to CORS allowlist and used in all email login links |
| `EXTRA_CORS_ORIGINS` | Optional | *(empty)* | Additional frontend origins, comma-separated — merged into CORS allowlist at boot |
| `ADMIN_EMAIL` | ✅ In prod | `itsmyfavoriteworkplace@gmail.com` | Superuser login email for the admin panel |
| `ADMIN_PASSWORD` | ✅ In prod | — | Superuser login password |
| `ENCRYPTION_KEY` | ✅ In prod | — | AES encryption key for sensitive data at rest |

### Email (Resend)

| Variable | Required? | Default | Used For |
|---|---|---|---|
| `RESEND_API_KEY` | ✅ For email | — | Resend transactional email API key |
| `EMAIL_FROM` | Optional | `BookMySlot <onboarding@resend.dev>` | Sender address shown in all outgoing emails |
| `RESEND` | Optional | `DEV` | `DEV` — redirects all mail to `RESEND_TEST_EMAIL`; `PRODUCTION` — sends to real recipients |
| `RESEND_TEST_EMAIL` | Optional | `itsmyfavoriteworkplace@gmail.com` | All emails are redirected here when `RESEND=DEV` |

### Payments (Razorpay)

| Variable | Required? | Default | Used For |
|---|---|---|---|
| `RAZORPAY_KEY_ID` | ✅ For payments | — | Razorpay API key (public) |
| `RAZORPAY_KEY_SECRET` | ✅ For payments | — | Razorpay API secret |
| `RAZORPAY_WEBHOOK_SECRET` | ✅ For payments | — | Razorpay webhook signature verification |
| `RAZORPAY_PLAN_ID_STARTER_MONTHLY` | Optional | — | Razorpay subscription plan ID — Starter, monthly billing |
| `RAZORPAY_PLAN_ID_STARTER_ANNUAL` | Optional | — | Razorpay subscription plan ID — Starter, annual billing |
| `RAZORPAY_PLAN_ID_GROWTH_MONTHLY` | Optional | — | Razorpay subscription plan ID — Growth, monthly billing |
| `RAZORPAY_PLAN_ID_GROWTH_ANNUAL` | Optional | — | Razorpay subscription plan ID — Growth, annual billing |
| `RAZORPAY_PLAN_ID_PRO_MONTHLY` | Optional | — | Razorpay subscription plan ID — Pro, monthly billing |
| `RAZORPAY_PLAN_ID_PRO_ANNUAL` | Optional | — | Razorpay subscription plan ID — Pro, annual billing |

### WhatsApp

| Variable | Required? | Default | Used For |
|---|---|---|---|
| `WHATSAPP_PROVIDER` | Optional | `twilio` | Active provider: `twilio` / `meta` / `zavu` |
| `TWILIO_ACCOUNT_SID` | ✅ For Twilio | — | Twilio account identifier |
| `TWILIO_AUTH_TOKEN` | ✅ For Twilio | — | Twilio authentication token |
| `TWILIO_WHATSAPP_NUMBER` | Optional | `+14155238886` | Twilio WhatsApp sender number (sandbox default) |
| `WHATSAPP_ACCESS_TOKEN` | ✅ For Meta | — | Meta Cloud API bearer token |
| `WHATSAPP_PHONE_NUMBER_ID` | ✅ For Meta | — | Meta WhatsApp phone number ID |
| `WHATSAPP_VERIFY_TOKEN` | ✅ For Meta | — | Meta webhook verification token |
| `WHATSAPP_BOOKING_TEMPLATE` | Optional | `booking_received` | Meta message template name for new bookings |
| `WHATSAPP_CONFIRM_TEMPLATE` | Optional | `booking_confirmed` | Meta message template name for confirmations |
| `WHATSAPP_CONSENT_TEMPLATE` | Optional | `consent_request` | Meta message template name for consent requests |
| `ZAVUDEV_API_KEY` | ✅ For Zavu | — | Zavu WhatsApp API key |

### File Storage (Cloudflare R2)

| Variable | Required? | Default | Used For |
|---|---|---|---|
| `R2_ACCOUNT_ID` | ✅ For uploads | — | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | ✅ For uploads | — | Cloudflare R2 access key |
| `R2_SECRET_ACCESS_KEY` | ✅ For uploads | — | Cloudflare R2 secret key |
| `R2_BUCKET_NAME` | Optional | `app-images` | Cloudflare R2 bucket name |
| `R2_PUBLIC_URL` | ✅ For uploads | — | Public CDN URL for serving R2 images (e.g. `https://pub-xxx.r2.dev`) |

### Other

| Variable | Required? | Default | Used For |
|---|---|---|---|
| `AI_SERVICE_URL` | Optional | `https://itsmyfavoriteworkplace-bookmyslot-ai-service.hf.space` | X-ray AI analysis service endpoint |
| `FORCE_SEED` | Optional | — | Set to `true` to force-reseed demo clinic and doctor data on boot |

---

## Table 2 — Frontend Environment Variables

Set these on your **frontend** service (Render Static Site → Environment, or `.env` file).
All frontend vars must be prefixed with `VITE_` — Vite strips any non-prefixed vars at build time.

| Variable | Required? | Default | Used For |
|---|---|---|---|
| `VITE_API_URL` | ✅ In prod | `""` *(same-origin)* | Backend API base URL — required when frontend and backend are on different domains (Render split deploy). Example: `https://book-my-slot-api.onrender.com` |
| `VITE_RAZORPAY_KEY_ID` | ✅ For payments | — | Razorpay public key used to initialise the checkout widget on the frontend |

---

## Table 3 — Hardcoded Values

These values are baked into the code. They work as-is but are documented here so you know how to override them without touching code.

| Hardcoded Value | File | What it is | How to override |
|---|---|---|---|
| `https://bookmyslot.dental.mossaic.in` | `server/index.ts` | Custom domain always present in CORS allowlist | Always allowed — add new domains via `EXTRA_CORS_ORIGINS` |
| `https://www.bookmyslot.dental.mossaic.in` | `server/index.ts` | www variant always in CORS allowlist | Same as above |
| `https://api.bookmyslot.dental.mossaic.in` | `server/index.ts` | API subdomain always in CORS allowlist | Same as above |
| `https://book-my-slot-client.onrender.com` | `server/index.ts` | Render default frontend URL always in CORS allowlist | Set `FRONTEND_URL` to your actual URL; this remains as a safe fallback |
| `http://localhost:5173`, `http://localhost:5000` | `server/index.ts` | Local dev origins — intentionally hardcoded | Not configurable — dev-only, harmless in prod (never sent by browsers over HTTPS) |
| `+14155238886` | `server/twilio.service.ts` | Twilio WhatsApp sandbox number fallback | Set `TWILIO_WHATSAPP_NUMBER` to your production number |
| `BookMySlot <onboarding@resend.dev>` | `server/routes.ts` | Email sender address fallback | Set `EMAIL_FROM` to your verified Resend sender |
| `book-my-slot-secret` | `server/index.ts` | Session secret dev fallback | Set `SESSION_SECRET` — required and enforced in prod |
| `app-images` | `server/r2Client.ts` | R2 bucket name fallback | Set `R2_BUCKET_NAME` |
| `https://itsmyfavoriteworkplace-bookmyslot-ai-service.hf.space` | `server/aiService.ts` | AI X-ray service URL fallback | Set `AI_SERVICE_URL` |

---

## Render Deployment Checklist

### Backend Web Service

```
[ ] DATABASE_URL
[ ] NODE_ENV=production
[ ] SESSION_SECRET          (long random string)
[ ] FRONTEND_URL            (your frontend Render URL or custom domain)
[ ] ADMIN_EMAIL
[ ] ADMIN_PASSWORD
[ ] ENCRYPTION_KEY
[ ] RESEND_API_KEY
[ ] RESEND=PRODUCTION
[ ] EMAIL_FROM
[ ] RESEND_TEST_EMAIL       (optional — only needed for DEV mode)
[ ] RAZORPAY_KEY_ID
[ ] RAZORPAY_KEY_SECRET
[ ] RAZORPAY_WEBHOOK_SECRET
[ ] RAZORPAY_PLAN_ID_*      (6 plan IDs if subscriptions are active)
[ ] WHATSAPP_PROVIDER       (twilio / meta / zavu)
[ ] TWILIO_ACCOUNT_SID      (if using Twilio)
[ ] TWILIO_AUTH_TOKEN       (if using Twilio)
[ ] TWILIO_WHATSAPP_NUMBER  (if using Twilio)
[ ] WHATSAPP_ACCESS_TOKEN   (if using Meta)
[ ] WHATSAPP_PHONE_NUMBER_ID (if using Meta)
[ ] WHATSAPP_VERIFY_TOKEN   (if using Meta)
[ ] ZAVUDEV_API_KEY         (if using Zavu)
[ ] R2_ACCOUNT_ID
[ ] R2_ACCESS_KEY_ID
[ ] R2_SECRET_ACCESS_KEY
[ ] R2_PUBLIC_URL
[ ] R2_BUCKET_NAME          (optional — defaults to app-images)
[ ] AI_SERVICE_URL          (optional — only if hosting your own AI service)
[ ] EXTRA_CORS_ORIGINS      (optional — comma-separated extra frontend domains)
```

### Frontend Static Site

```
[ ] VITE_API_URL            (your backend Render URL, e.g. https://book-my-slot-api.onrender.com)
[ ] VITE_RAZORPAY_KEY_ID   (Razorpay public key)
```

---

## Notes

- **Only one WhatsApp provider needs to be configured** — set `WHATSAPP_PROVIDER` to the one you use and only supply credentials for that provider.
- **`RESEND=DEV` is the safe default** — no real emails are sent until you explicitly set `RESEND=PRODUCTION`.
- **`EXTRA_CORS_ORIGINS` is additive** — it never removes existing origins, only adds new ones. Safe to leave empty.
- **Frontend env vars are baked at build time** — changing `VITE_*` vars requires a redeploy of the frontend static site.
