# Deployment Environment Variables Inventory

This document transcribes the environment-variable names visible in the deployment configuration screenshot and explains where they belong.

> **Security warning:** The screenshot appears to show a real `WHATSAPP_ACCESS_TOKEN` value on a wrapped line below the variable name. Do not copy that value into documentation, source control, tickets, or chat. Treat it as compromised and revoke/rotate it in Meta immediately, then update the deployment secret.

## Backend environment

Set these in the backend Render Web Service environment. Never expose backend secrets in the frontend Static Site or in `VITE_*` variables.

| Variable | Purpose | Required |
|---|---|---|
| `ADMIN_EMAIL` | Super Admin login email | Yes for admin access |
| `ADMIN_PASSWORD` | Super Admin login password | Yes for admin access |
| `DATABASE_URL` | PostgreSQL/Supabase connection string | Yes; use the Supabase pooler URL in production |
| `EMAIL_FROM` | Sender name and address for outgoing email | Yes for production email deliverability |
| `EXTRA_CORS_ORIGINS` | Additional comma-separated frontend origins allowed by CORS | Only when additional origins are needed |
| `FRONTEND_URL` | Primary frontend origin; used for CORS and email dashboard links | Yes |
| `NODE_ENV` | Runtime mode; use `production` in deployment | Yes |
| `PORT` | Backend listening port | Render normally injects this automatically |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key | Required for R2 uploads |
| `R2_ACCOUNT_ID` | Cloudflare account identifier for R2 | Required for R2 uploads |
| `R2_BUCKET_NAME` | R2 bucket used for application files | Required for R2 uploads; defaults to `app-images` |
| `R2_PUBLIC_URL` | Public base URL for R2 objects | Required when public object URLs are used |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret access key | Required for R2 uploads |
| `RAZORPAY_KEY_ID` | Razorpay backend/public account identifier | Required only when payments are enabled |
| `RAZORPAY_KEY_SECRET` | Razorpay backend secret | Required only when payments are enabled; keep private |
| `RESEND` | General email mode; set `PRODUCTION` for real recipients | Yes for production email flows |
| `RESEND_API_KEY` | Resend API authentication key | Required for email delivery |
| `SESSION_SECRET` | Secret used to sign production sessions | Yes; generate a long random value |
| `SMS_NOTIFICATIONS_ENABLED` | Enables SMS booking notifications when set to `true` | Only when SMS is enabled |
| `TWILIO_ACCOUNT_SID` | Twilio account identifier | Required for Twilio SMS/WhatsApp |
| `TWILIO_AUTH_TOKEN` | Twilio authentication secret | Required for Twilio SMS/WhatsApp |
| `TWILIO_MESSAGING_SERVICE_SID` | Twilio Messaging Service used for SMS | Required when SMS is enabled |
| `TWILIO_WHATSAPP_NUMBER` | Twilio WhatsApp sender number | Required when Twilio WhatsApp is enabled |
| `WHATSAPP_ACCESS_TOKEN` | Meta WhatsApp Cloud API access token | Required when Meta WhatsApp is enabled; rotate the exposed value |
| `WHATSAPP_BOOKING_TEMPLATE` | Meta WhatsApp booking template name | Required when Meta WhatsApp is enabled |
| `WHATSAPP_CONFIRM_TEMPLATE` | Meta WhatsApp confirmation template name | Required when Meta WhatsApp is enabled |
| `WHATSAPP_CONSENT_TEMPLATE` | Meta WhatsApp consent template name | Required when Meta WhatsApp is enabled |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp phone number ID | Required when Meta WhatsApp is enabled |
| `WHATSAPP_PROVIDER` | WhatsApp provider selector: `twilio`, `meta`, or `zavu` | Optional; defaults to `twilio` |
| `WHATSAPP_VERIFY_TOKEN` | Meta WhatsApp webhook verification token | Required for Meta webhook verification |
| `ZAVUDEV_API_KEY` | Zavu WhatsApp API key | Required when Zavu is selected |

## Frontend environment

Set this in the frontend Render Static Site environment and rebuild the site after changing it:

| Variable | Purpose | Required |
|---|---|---|
| `VITE_RAZORPAY_KEY_ID` | Razorpay browser-side key used by the payment UI | Only when payments are enabled |

The reminder dashboard also requires the frontend API URL:

```text
VITE_API_URL=https://<backend-host>
```

`VITE_API_URL` is required by the application in production, but it is not visible in the supplied screenshot. Add it to the frontend service. Do not put backend secrets in the frontend environment.

## Reminder-specific additions

The screenshot does not contain all variables needed for the automated reminder digest. Add this backend variable:

```text
REMINDER_JOB_SECRET=<strong-random-secret>
```

The external scheduler must send the same value when calling:

```http
POST https://<backend-host>/api/internal/reminders/digest
x-reminder-job-secret: <REMINDER_JOB_SECRET>
```

The scheduler is external because this repository does not run an internal cron timer. See [reminder-deployment-configuration.md](reminder-deployment-configuration.md) for the complete setup, Supabase schema requirements, Resend DNS verification, and scheduler configuration.

## Variables not visible in the screenshot but used by the application

The application also reads these variables in code:

| Variable | Purpose |
|---|---|
| `AI_SERVICE_URL` | Optional external X-ray analysis service URL |
| `ENCRYPTION_KEY` | Encryption key used by the server for protected data |
| `PGSSLMODE` | Optional PostgreSQL SSL override; `disable` is intended for local development |
| `RESEND_TEST_EMAIL` | Test recipient used by non-production/general email flows |
| `RAZORPAY_PLAN_ID_STARTER_MONTHLY` | Razorpay Starter monthly plan |
| `RAZORPAY_PLAN_ID_STARTER_ANNUAL` | Razorpay Starter annual plan |
| `RAZORPAY_PLAN_ID_GROWTH_MONTHLY` | Razorpay Growth monthly plan |
| `RAZORPAY_PLAN_ID_GROWTH_ANNUAL` | Razorpay Growth annual plan |
| `RAZORPAY_PLAN_ID_PRO_MONTHLY` | Razorpay Pro monthly plan |
| `RAZORPAY_PLAN_ID_PRO_ANNUAL` | Razorpay Pro annual plan |
| `REPLIT_DEV_DOMAIN` | Replit development-domain integration |
| `FORCE_SEED` | Explicitly enables test-clinic seeding when set to `true` |

Set only the variables needed by the enabled application features. Keep all secrets in the hosting provider's secret/environment store, not in `.env` files committed to git.

## Example deployment values

Use placeholders only. Never commit real values:

```dotenv
# Backend
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<strong-password>
DATABASE_URL=postgresql://postgres.<project-id>:<password>@<supabase-pooler-host>:6543/postgres
EMAIL_FROM=BookMySlot <noreply@verified-domain.example>
EXTRA_CORS_ORIGINS=https://staging.example.com
FRONTEND_URL=https://app.example.com
NODE_ENV=production
# PORT is injected by Render
R2_ACCESS_KEY_ID=<r2-access-key>
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_BUCKET_NAME=app-images
R2_PUBLIC_URL=https://files.example.com
R2_SECRET_ACCESS_KEY=<r2-secret-key>
RAZORPAY_KEY_ID=<razorpay-key>
RAZORPAY_KEY_SECRET=<razorpay-secret>
RESEND=PRODUCTION
RESEND_API_KEY=<resend-api-key>
REMINDER_JOB_SECRET=<scheduler-secret>
SESSION_SECRET=<long-random-session-secret>
SMS_NOTIFICATIONS_ENABLED=false

# Frontend Static Site
VITE_API_URL=https://api.example.com
VITE_RAZORPAY_KEY_ID=<razorpay-public-key>
```

## Secret rotation checklist

1. Revoke the exposed Meta WhatsApp token in Meta Business Manager.
2. Create a replacement permanent/system-user token with the minimum required permissions.
3. Update `WHATSAPP_ACCESS_TOKEN` in the backend deployment environment.
4. Restart or redeploy the backend.
5. Review Meta and application logs for unauthorized activity.
6. Confirm that no real secret has been added to this document or git history.
7. Rotate any other credential that was visible in the original screenshot.
