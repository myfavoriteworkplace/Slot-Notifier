# Platform Ops Maintenance Schedule

> Internal reference — do not share. Review and action on the schedule below.
> Last updated: July 2026

---

## ⚠️ IMMEDIATE ACTION REQUIRED

If you are seeing email activity in Resend that you did not trigger, your `RESEND_API_KEY` is likely compromised. **Rotate it before anything else.** Steps are in Section 1 below.

---

## How to rotate a secret on Render

1. Open **Render → your backend Web Service → Environment**
2. Find the variable, paste the new value, click **Save Changes**
3. Render will automatically redeploy with the new value
4. Verify the old key is revoked in the provider's dashboard

---

## Section 1 — URGENT: Email provider (Resend)

| Item | `RESEND_API_KEY` |
|---|---|
| What it controls | Every outgoing email: booking confirmations, OTP codes, clinic activation, doctor assignment notifications |
| Why rotate now | Unauthorised send activity observed — key is likely leaked |
| How to get a new key | resend.com → API Keys → Create API Key → copy |
| Revoke the old key | resend.com → API Keys → delete the current key immediately |
| Side effect of rotation | Old key stops working the moment it is deleted — no data loss |
| Render variable name | `RESEND_API_KEY` |
| Frequency going forward | Every 90 days, or immediately if suspicious activity recurs |

**After rotating:** check resend.com → Logs and confirm no further sends from the old key within 10 minutes.

---

## Section 2 — High priority (rotate within 24 hours if breach suspected)

### 2a. Admin password
| Item | Detail |
|---|---|
| Variable | `ADMIN_PASSWORD` |
| What it controls | Superuser login at `/admin-login` — full platform access: approve/archive clinics, manage Smile Deals |
| How to rotate | Choose a new strong password (20+ chars, mixed) → update in Render → update `ADMIN_EMAIL` too if needed |
| Side effect | Any active superuser session is invalidated at next request |
| Frequency | Every 90 days or immediately if account shows unexpected activity |

### 2b. Session secret
| Item | Detail |
|---|---|
| Variable | `SESSION_SECRET` |
| What it controls | Signs all session cookies (clinic owner sessions, doctor sessions, admin sessions) |
| How to rotate | Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| Side effect | **All active sessions are immediately invalidated** — every logged-in user is signed out |
| Best time to rotate | Low-traffic window (e.g., night) |
| Frequency | Every 90 days |

### 2c. Encryption key
| Item | Detail |
|---|---|
| Variable | `ENCRYPTION_KEY` |
| What it controls | AES-256-GCM encryption of doctor notes, consent signatures, clinical prescriptions stored in the database |
| How to rotate | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` — must be exactly 32 bytes base64-encoded |
| **Critical warning** | Rotating this key means existing encrypted rows in the database **cannot be decrypted** with the new key. You must run a migration script to re-encrypt all rows before switching. Do not rotate without a migration plan unless the database is empty. |
| Frequency | Only rotate if key is confirmed leaked — treat as a migration event, not a routine rotation |

---

## Section 3 — Payment provider (Razorpay)

| Variable | What it controls | How to get new value | Frequency |
|---|---|---|---|
| `RAZORPAY_KEY_SECRET` | Server-side API calls to create and manage subscriptions | Razorpay Dashboard → Settings → API Keys → Regenerate | Every 6 months |
| `RAZORPAY_WEBHOOK_SECRET` | Validates that incoming payment webhook calls are genuinely from Razorpay | Razorpay Dashboard → Settings → Webhooks → regenerate secret | Every 6 months |
| `VITE_RAZORPAY_KEY_ID` | Public-facing key shown to the browser for the payment popup — **not secret**, but update if `KEY_SECRET` is changed | Matches `RAZORPAY_KEY_ID` — copy from same Razorpay keys page | Same time as KEY_SECRET |
| `RAZORPAY_KEY_ID` | Server copy of the public key | Same as above | Same time as KEY_SECRET |

**Note:** Razorpay plan IDs (`RAZORPAY_PLAN_ID_*`) are not secrets — they are identifiers, not credentials. No rotation needed.

**After rotating Razorpay keys:** test one full subscription checkout flow in Razorpay test mode before going live.

---

## Section 4 — WhatsApp / messaging providers

### 4a. Twilio (WhatsApp sender)
| Variable | What it controls | How to rotate | Frequency |
|---|---|---|---|
| `TWILIO_AUTH_TOKEN` | Authenticates all Twilio API calls (WhatsApp booking/consent messages) | Twilio Console → Account Info → rotate Auth Token | Every 6 months |
| `TWILIO_ACCOUNT_SID` | Not a secret — identifies the account, pairs with AUTH_TOKEN | No rotation needed | — |
| `TWILIO_WHATSAPP_NUMBER` | Sender number — not a secret | No rotation needed | — |

### 4b. Meta WhatsApp Business API
| Variable | What it controls | How to rotate | Frequency |
|---|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | System user token for Meta's WhatsApp Business API | Meta Business Suite → System Users → generate new token | Every 60 days (Meta tokens expire) |
| `WHATSAPP_VERIFY_TOKEN` | Secret token used by Meta to verify your webhook endpoint at `/api/webhooks/whatsapp` | Any random string — change in Render AND in Meta App → Webhooks → Edit | Only if webhook is compromised |
| `WHATSAPP_PHONE_NUMBER_ID` | Identifies the WhatsApp phone number — not a secret | No rotation needed | — |
| `WHATSAPP_BOOKING_TEMPLATE` | Template name — not a secret | No rotation needed | — |
| `WHATSAPP_CONFIRM_TEMPLATE` | Template name — not a secret | No rotation needed | — |
| `WHATSAPP_CONSENT_TEMPLATE` | Template name — not a secret | No rotation needed | — |

### 4c. Zavu (alternative WhatsApp provider)
| Variable | What it controls | How to rotate | Frequency |
|---|---|---|---|
| `ZAVUDEV_API_KEY` | Authenticates calls to the Zavu WhatsApp gateway | Zavu developer portal → regenerate API key | Every 6 months |

---

## Section 5 — Storage (Cloudflare R2)

| Variable | What it controls | How to rotate | Frequency |
|---|---|---|---|
| `R2_ACCESS_KEY_ID` | Identifies the R2 API token — pair with SECRET | Cloudflare Dashboard → R2 → API Tokens → Create new token → delete old | Every 6 months |
| `R2_SECRET_ACCESS_KEY` | Signs all R2 operations: clinic logo upload, doctor photo upload, X-ray upload | Same as above (new token gives both ID and secret together) | Every 6 months |
| `R2_ACCOUNT_ID` | Cloudflare account identifier — not a secret | No rotation needed | — |
| `R2_BUCKET_NAME` | Bucket name — not a secret | No rotation needed | — |
| `R2_PUBLIC_URL` | Public base URL for serving images — not a secret | No rotation needed | — |

**After rotating R2 credentials:** verify that clinic logo images and doctor profile photos still load in the browser.

---

## Section 6 — Database

| Variable | What it controls | How to rotate | Frequency |
|---|---|---|---|
| `DATABASE_URL` | Full PostgreSQL connection string including host, port, database name, username, and password | Render Postgres → Connections → rotate credentials (Render auto-updates internal services) OR change the DB user password in psql → update the URL manually | Every 6 months, or immediately if leaked |

**Critical:** if you rotate the database password, the `DATABASE_URL` variable must be updated in Render **before** the old password is revoked, or the app will go down.

---

## Section 7 — Non-rotating items (reference only)

These are identifiers or configuration values — not credentials — and do not need rotation:

| Variable | Description |
|---|---|
| `FRONTEND_URL` | CORS allowlist — your production frontend domain |
| `EMAIL_FROM` | Display name and from-address for outgoing emails |
| `RESEND` | Mode flag: `PRODUCTION` or `DEV` — not a secret |
| `WHATSAPP_PROVIDER` | Active provider selection (`twilio`, `meta`, `zavu`) — not a secret |
| `NODE_ENV` | Runtime environment flag |
| `PORT` | Server listen port |
| `AI_SERVICE_URL` | Internal service URL |
| `REPLIT_DEV_DOMAIN` | Auto-set by Replit — not configurable |
| `FORCE_SEED` | Seeding flag — not a secret |

---

## Rotation schedule summary

| Credential | Urgency | Frequency |
|---|---|---|
| `RESEND_API_KEY` | **Rotate NOW** | 90 days |
| `ADMIN_PASSWORD` | High | 90 days |
| `SESSION_SECRET` | High | 90 days |
| `WHATSAPP_ACCESS_TOKEN` | Medium (Meta tokens expire ~60 days) | 60 days |
| `RAZORPAY_KEY_SECRET` + `RAZORPAY_WEBHOOK_SECRET` | Medium | 6 months |
| `TWILIO_AUTH_TOKEN` | Medium | 6 months |
| `ZAVUDEV_API_KEY` | Medium | 6 months |
| `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` | Medium | 6 months |
| `DATABASE_URL` (password) | Medium | 6 months |
| `ENCRYPTION_KEY` | **Only if leaked** — requires data migration | — |
| `WHATSAPP_VERIFY_TOKEN` | Only if webhook is compromised | — |

---

## After any rotation — verification checklist

- [ ] Old key/token revoked in provider dashboard
- [ ] New value set in Render → Environment and saved
- [ ] Render redeployed successfully (green status)
- [ ] Test the specific feature the credential powers (send a test email / make a test payment / load an image)
- [ ] No errors in Render logs for 5 minutes after deploy
- [ ] For `SESSION_SECRET`: confirm re-login works for clinic owner and admin
