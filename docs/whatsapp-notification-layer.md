# WhatsApp Notification Layer — BookMySlot

## Purpose

This document covers how WhatsApp notifications work in BookMySlot, how to configure each provider, and exactly what steps to complete in the Twilio and Meta dashboards to make messages go through.

---

## 1. Architecture Overview

The WhatsApp layer is **provider-agnostic**. Routes in the application call three functions with fixed signatures. The abstraction layer decides at runtime which WhatsApp provider to use based on a single environment variable. No route code changes when you switch providers.

### File Map

| File | Role |
|---|---|
| `server/whatsapp.service.ts` | **Public interface** — the only file `routes.ts` imports. Reads `WHATSAPP_PROVIDER`, routes calls to the right provider, handles fallback. |
| `server/meta-whatsapp.service.ts` | **Meta Cloud API implementation** — sends template messages via `graph.facebook.com`. |
| `server/twilio.service.ts` | **Twilio implementation** — sends free-form text messages via Twilio SDK. Always the fallback. |

### The Three Functions

Every provider must implement these three functions with identical signatures:

```typescript
sendWhatsAppBookingNotification(toPhone, patientName, clinicName, appointmentTime)
sendWhatsAppConfirmationNotification(toPhone, patientName, clinicName, appointmentTime, doctorName?, clinicAddress?, clinicPhone?, mapsLink?, bookingRef?)
sendWhatsAppConsentLink(toPhone, patientName, clinicName, consentUrl)
```

### When Each Is Triggered

| Function | Trigger | Routes call site |
|---|---|---|
| `sendWhatsAppBookingNotification` | Patient submits a booking request | `routes.ts` lines ~1599, ~1721, ~2542 |
| `sendWhatsAppConfirmationNotification` | Clinic confirms a booking | `routes.ts` lines ~2878, ~3085 |
| `sendWhatsAppConsentLink` | Clinic sends digital consent request | `routes.ts` line ~3580 |

### Provider Selection & Fallback

```
WHATSAPP_PROVIDER=meta  AND  Meta credentials present
  → Send via Meta Cloud API
  → If Meta API returns an error → automatically retry via Twilio
  → If Twilio also unconfigured → log [WHATSAPP MOCK] and continue (booking never fails)

WHATSAPP_PROVIDER=twilio  (or WHATSAPP_PROVIDER not set — this is the default)
  → Send via Twilio
  → If Twilio unconfigured → log [WHATSAPP MOCK] and continue

Both providers unconfigured
  → Silently skipped with a log line. No error, booking succeeds normally.
```

### Adding a Future Provider

1. Create `server/yourprovider-whatsapp.service.ts` implementing the 3 functions above.
2. In `server/whatsapp.service.ts`, import your new functions and add a new `if (PROVIDER === "yourprovider")` branch inside each of the 3 exported functions, following the same `withFallback` pattern.
3. Set `WHATSAPP_PROVIDER=yourprovider` in Render.
4. No other files need to change.

### Webhook Routes (Meta only)

Two routes in `server/routes.ts` handle Meta's webhook protocol:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/whatsapp-webhook` | Meta calls this once when you register the webhook. Verifies `WHATSAPP_VERIFY_TOKEN` and responds with the challenge string. |
| `POST` | `/api/whatsapp-webhook` | Receives delivery receipts and read events from Meta. Currently logs them (no business logic). |

These are public routes (no session auth) — Meta requires this.

---

## 2. Environment Variables

All variables below are set on the **backend service** in Render (`Book-My-Slot-1` → Environment). None are frontend variables.

### Provider Switch

| Variable | Values | Default | Effect |
|---|---|---|---|
| `WHATSAPP_PROVIDER` | `twilio` or `meta` | `twilio` | Selects which provider is used as primary |

### Twilio Variables (existing)

| Variable | Required for Twilio | Description |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | Yes | Your Twilio Account SID — starts with `AC` |
| `TWILIO_AUTH_TOKEN` | Yes | Your Twilio Auth Token |
| `TWILIO_WHATSAPP_NUMBER` | Yes (production) | The WhatsApp-enabled number in E.164 format. Defaults to `+14155238886` (sandbox) if not set — **change this for production** |

### Meta Variables (new — only needed when `WHATSAPP_PROVIDER=meta`)

| Variable | Required | Description |
|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | Yes | Permanent system user access token with `whatsapp_business_messaging` permission |
| `WHATSAPP_PHONE_NUMBER_ID` | Yes | Meta's internal numeric ID for your WhatsApp number (not the phone number itself) |
| `WHATSAPP_VERIFY_TOKEN` | Yes | A secret string you invent (e.g. `bms_wh_2026`) — must match what you type in the Meta webhook portal |
| `WHATSAPP_BOOKING_TEMPLATE` | No | Name of approved "booking received" template. Defaults to `booking_received` |
| `WHATSAPP_CONFIRM_TEMPLATE` | No | Name of approved "booking confirmed" template. Defaults to `booking_confirmed` |
| `WHATSAPP_CONSENT_TEMPLATE` | No | Name of approved "consent link" template. Defaults to `consent_request` |

---

## 3. Twilio Setup — Step by Step

Twilio is the default provider and the permanent fallback. Here is what to configure.

### 3.1 Create a Twilio Account

1. Go to [twilio.com](https://www.twilio.com) and sign up or log in.
2. From the Console Dashboard, copy:
   - **Account SID** → this is your `TWILIO_ACCOUNT_SID`
   - **Auth Token** → this is your `TWILIO_AUTH_TOKEN`

### 3.2 Enable WhatsApp — Sandbox (for testing)

The sandbox lets you test without a verified business number.

1. In the Twilio Console, go to **Messaging → Try it out → Send a WhatsApp message**.
2. Follow the instructions to join the sandbox: each tester must send the join code (e.g. `join <word>-<word>`) from their WhatsApp to `+14155238886`.
3. Set `TWILIO_WHATSAPP_NUMBER=+14155238886` in Render (or leave unset — this is the default).
4. Messages will only go to numbers that have joined the sandbox.

### 3.3 Enable WhatsApp — Production (live business number)

1. In the Twilio Console, go to **Messaging → Senders → WhatsApp Senders**.
2. Click **Add New Sender** and follow the steps to connect your WhatsApp Business number.
3. Twilio will guide you through Meta Business verification.
4. Once approved, your number appears in the list. Copy it in E.164 format (e.g. `+919xxxxxxxxx`).
5. Set `TWILIO_WHATSAPP_NUMBER=+919xxxxxxxxx` in Render.

### 3.4 Twilio Message Templates (production requirement)

For production outbound messages (first contact with a patient), Twilio also requires WhatsApp-approved templates — the same Meta template approval process applies even through Twilio.

For the Twilio sandbox, free-form text works without templates (useful for testing).

### 3.5 Verify It's Working

Check your Render logs for:
```
[WHATSAPP] Twilio client initialized successfully.
[WHATSAPP] (booking-received) Sent. SID: SM... → +91...
```

If you see:
```
[WHATSAPP] Twilio credentials missing — WhatsApp notifications disabled.
```
— the SID or Auth Token is missing or wrong in Render.

---

## 4. Meta Cloud API Setup — Step by Step

Meta is the optional primary provider. Complete all steps below before setting `WHATSAPP_PROVIDER=meta`.

### 4.1 Create a Meta Developer App

1. Go to [developers.facebook.com](https://developers.facebook.com) and log in with a Facebook account that has access to your Meta Business Manager.
2. Click **My Apps → Create App**.
3. Select **Business** as the app type. Click Next.
4. Enter an app name (e.g. `BookMySlot WhatsApp`). Select your Business account. Click **Create App**.

### 4.2 Add the WhatsApp Product

1. On the App Dashboard, click **Add Product** (bottom of the left sidebar).
2. Find **WhatsApp** and click **Set Up**.
3. You are now on the **WhatsApp → Getting Started** page.

### 4.3 Add Your WhatsApp Business Number

1. In **WhatsApp → API Setup**, scroll to **Step 1: Select a phone number**.
2. If you have a WhatsApp Business number already, click **Add phone number** and follow the verification steps (you'll receive a code via SMS or voice call).
3. If you don't have a number, you can test with the free test number Meta provides — but it can only send to up to 5 pre-registered recipient numbers.
4. Once your number appears in the dropdown, select it.
5. Copy the **Phone Number ID** shown below the dropdown → this is your `WHATSAPP_PHONE_NUMBER_ID`.

### 4.4 Generate a Permanent Access Token

> **Important:** The temporary token on the Getting Started page expires in 24 hours. You need a permanent system user token.

1. Go to [business.facebook.com](https://business.facebook.com) → **Settings → System Users**.
2. Click **Add** to create a new System User (or use an existing one). Give it **Admin** role.
3. Click the system user → **Generate New Token**.
4. Select your app (`BookMySlot WhatsApp`).
5. Under permissions, enable: `whatsapp_business_messaging` and `whatsapp_business_management`.
6. Click **Generate Token**. Copy the token immediately — it won't be shown again.
7. This token is your `WHATSAPP_ACCESS_TOKEN`.

### 4.5 Create and Submit Message Templates

Meta requires pre-approved templates for all outbound first-contact messages. You need three templates — one per notification type.

Go to **Meta Developer Portal → Your App → WhatsApp → Message Templates → Create Template**.

For each template:
- **Category**: select `UTILITY`
- **Language**: `English`

---

**Template 1 — `booking_received`**

- **Template name**: `booking_received`
- **Body text** (paste exactly):

```
Hello {{1}}! 👋

Your appointment request at *{{2}}* has been received.

📅 Date: {{3}}
🕐 Time: {{4}}

We will send you another message once the clinic confirms your slot. Please wait for the confirmation before visiting.

— BookMySlot 🦷
```

- **Variable samples** (Meta requires example values):
  - `{{1}}` → `Rahul Kumar`
  - `{{2}}` → `Sunrise Dental Clinic`
  - `{{3}}` → `Monday, 2 June 2026`
  - `{{4}}` → `10:30 AM`

---

**Template 2 — `booking_confirmed`**

- **Template name**: `booking_confirmed`
- **Body text**:

```
Hello {{1}}! ✅

Great news — your appointment at *{{2}}* has been *confirmed*.

📅 Date: {{3}}
🕐 Time: {{4}}

Please arrive 10 minutes early. Reply to this message if you need to reschedule.

— BookMySlot 🦷
```

- **Variable samples**:
  - `{{1}}` → `Rahul Kumar`
  - `{{2}}` → `Sunrise Dental Clinic`
  - `{{3}}` → `Monday, 2 June 2026`
  - `{{4}}` → `10:30 AM`

---

**Template 3 — `consent_request`**

- **Template name**: `consent_request`
- **Body text**:

```
Hello {{1}}! 📋

*{{2}}* has sent you a digital consent form for your upcoming dental appointment.

Please review and sign using this link:
🔗 {{3}}

This link is valid for 72 hours. Please do not share it with others.

— BookMySlot 🦷
```

- **Variable samples**:
  - `{{1}}` → `Rahul Kumar`
  - `{{2}}` → `Sunrise Dental Clinic`
  - `{{3}}` → `https://bookmyslot.dental.mossaic.in/consent/abc123token`

---

Submit each template. Approval is usually within a few minutes to a few hours. You cannot send Meta messages until all three are approved.

### 4.6 Set Up the Webhook

Meta sends delivery receipts and read events to your backend. This is optional but recommended.

1. In the Meta Developer Portal, go to **WhatsApp → Configuration → Webhook**.
2. Click **Edit**.
3. Set **Callback URL** to:
   ```
   https://api.bookmyslot.dental.mossaic.in/api/whatsapp-webhook
   ```
4. Set **Verify Token** to the same value you'll set as `WHATSAPP_VERIFY_TOKEN` in Render (e.g. `bms_wh_2026`).
5. Click **Verify and Save**. Meta will call `GET /api/whatsapp-webhook` immediately — the server must be live for this to work.
6. After saving, subscribe to the **`messages`** field under Webhook Fields.

### 4.7 Set the Environment Variables in Render

Add all of the following to `Book-My-Slot-1` → Environment:

```
WHATSAPP_PROVIDER=meta
WHATSAPP_ACCESS_TOKEN=<your permanent system user token>
WHATSAPP_PHONE_NUMBER_ID=<numeric ID from API Setup page>
WHATSAPP_VERIFY_TOKEN=bms_wh_2026
WHATSAPP_BOOKING_TEMPLATE=booking_received
WHATSAPP_CONFIRM_TEMPLATE=booking_confirmed
WHATSAPP_CONSENT_TEMPLATE=consent_request
```

Save and Render will restart the backend automatically.

### 4.8 Verify It's Working

Check your Render logs for:
```
[WHATSAPP-META] Meta Cloud API client ready.
[WHATSAPP] Active provider: meta
[WHATSAPP-META] (booking-received) Sending template "booking_received" to +91...
[WHATSAPP-META] (booking-received) Sent. Message ID: wamid... → +91...
```

If you see a fallback message:
```
[WHATSAPP] Primary provider failed for "booking-received": <error>. Falling back to Twilio.
```
— check that your templates are approved and `WHATSAPP_PHONE_NUMBER_ID` is correct.

---

## 5. Switching Between Providers

| Goal | Action |
|---|---|
| Use Twilio only | Set `WHATSAPP_PROVIDER=twilio` (or delete the variable) |
| Use Meta with Twilio fallback | Set `WHATSAPP_PROVIDER=meta` and all `WHATSAPP_*` Meta vars |
| Disable WhatsApp entirely | Remove both Twilio and Meta credentials — messages are silently skipped |

Changing `WHATSAPP_PROVIDER` takes effect on the next Render deploy/restart. No code changes required.

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `[WHATSAPP MOCK] Twilio not configured` | `TWILIO_ACCOUNT_SID` or `TWILIO_AUTH_TOKEN` missing | Add them in Render backend environment |
| `[WHATSAPP-META] Meta credentials not set` | `WHATSAPP_ACCESS_TOKEN` or `WHATSAPP_PHONE_NUMBER_ID` missing | Add them in Render backend environment |
| Meta message fails, Twilio fallback activates | Template not approved yet, or wrong template name | Wait for Meta approval; verify template name matches exactly |
| Twilio SID returned but patient gets no message | Phone not joined to Twilio sandbox (test mode) | Patient must send join code to `+14155238886` first |
| Webhook verify fails (Render log: 403) | `WHATSAPP_VERIFY_TOKEN` in Render doesn't match what you entered in Meta portal | Make both values identical |
| `Meta API error (401)` | Access token expired or wrong | Regenerate system user token in Meta Business Manager |

---

*Last updated: May 2026*
