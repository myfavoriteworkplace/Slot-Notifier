# Render Environment Setup Guide
## BookMySlot — Complete Guide to Environment Variables in Plain Language

---

## What is an Environment Variable?

Think of environment variables like **settings on the back of a machine** — they tell the app how to behave without you having to open and rewrite the code every time.

For example:
- One setting tells the app "you're in production now, behave properly" (`NODE_ENV=production`)
- Another tells it "here's the database password" (`DATABASE_URL=...`)
- Another tells it "send emails to real people, not the test inbox" (`RESEND=PRODUCTION`)

These settings live **outside the code** — they are stored in your hosting platform (Render, in our case) and injected into the app when it starts. This is good because:
- You never have to put passwords inside your code files
- You can change a setting without redeploying new code
- Your development setup (local machine) and live production setup can have different values safely

---

## Where to Set Them on Render

### For the Backend (your API / server):
1. Go to [render.com](https://render.com) and log in
2. Open your **Web Service** (the backend server)
3. Click **Environment** in the left sidebar
4. Click **Add Environment Variable** to add a new one, or click an existing one to edit it
5. Click **Save Changes** — Render will automatically restart and redeploy with the new values

### For the Frontend (the website patients see):
1. Go to [render.com](https://render.com) and log in
2. Open your **Static Site** (the frontend)
3. Click **Environment** in the left sidebar
4. Add or edit variables the same way
5. Click **Save Changes** — Render will rebuild the frontend automatically

> **Important:** Backend variables and frontend variables are set in two separate places on Render. They do not share settings with each other.

---

## Backend Environment Variables — Full Reference

These must all be set in your **Render Web Service (backend)** under Environment.

---

### DATABASE_URL
**Required — app will crash without this.**

This is the full address and password for your PostgreSQL database. Think of it like a complete home address — it tells the app exactly where the database lives and how to get in.

```
DATABASE_URL=postgresql://username:password@host.render.com:5432/database_name
```

Where to get it: Go to your Render **PostgreSQL** service → click **Connect** → copy the **External Database URL**.

What breaks if missing: The entire app fails to start. Nothing works.

---

### SESSION_SECRET
**Required — unsafe fallback exists, must be overridden in production.**

When a clinic admin or doctor logs in, the app needs to remember them as they move between pages. It does this by storing a small "session token" — a scrambled code — in the user's browser. The `SESSION_SECRET` is the key used to scramble (encrypt) that token.

If this is not set, the app falls back to using `"book-my-slot-secret"` — which is publicly visible in the code. Anyone who knows this fallback could potentially forge a login session.

**How to generate a strong, safe value:**
Run this in any terminal:
```
openssl rand -base64 32
```
It gives you something like: `K9mXvQ2rLpN8wYcTjAeZdHsBuFgIoM4n7pR1`

Copy that output and set it as your `SESSION_SECRET` on Render.

> **Important:** Once set, never change this value unless absolutely necessary. If you change it, every currently logged-in user (admins, doctors) will be instantly logged out and forced to log in again — their session tokens become invalid.

What breaks if missing: Sessions are insecure. Admin and doctor logins are vulnerable.

---

### NODE_ENV
**Required.**

Tells the app which "mode" it is running in. In production, the app enables security settings (like secure cookies over HTTPS) and hides technical error details from users.

```
NODE_ENV=production
```

What breaks if missing: Security settings (HTTPS-only cookies, CORS) may not work correctly.

---

### PORT
**Required.**

The network "door number" the server listens on. Render automatically assigns this — you typically set it to `10000` on Render.

```
PORT=10000
```

What breaks if missing: Render can't connect to your server — site goes offline.

---

### ADMIN_EMAIL
**Required.**

The email address used to log into the Super Admin panel at `/admin`. This is the master login that can manage all clinics.

```
ADMIN_EMAIL=your-admin@example.com
```

> **Note:** If this is not set, the app falls back to `itsmyfavoriteworkplace@gmail.com` (the developer's test email). Always set this to your real admin email in production.

What breaks if missing: You won't be able to log into the admin panel with your own email.

---

### ADMIN_PASSWORD
**Required.**

The password for the Super Admin login. Use something strong — at least 12 characters with a mix of letters, numbers, and symbols.

```
ADMIN_PASSWORD=YourStrongPasswordHere!
```

What breaks if missing: Nobody can log into the admin panel.

---

### FRONTEND_URL
**Required.**

The full public URL where your frontend (the patient-facing website) is hosted. The backend uses this in two ways:
1. To allow the frontend to talk to the backend (CORS security)
2. To build correct links in emails (like doctor invite links)

```
FRONTEND_URL=https://bookmyslot.dental.mossaic.in
```

> **Already set on Render** — confirmed done.

What breaks if missing: The frontend can't communicate with the backend. Doctor invite email links point to the wrong URL.

---

### RESEND_API_KEY
**Required for emails to work.**

This is your private key from the Resend platform. It's like a password that proves to Resend that you are authorised to send emails through your account.

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
```

Where to get it: Log in at [resend.com](https://resend.com) → **API Keys** → copy your key.

What breaks if missing: All email sending is silently disabled. No booking confirmations, no doctor invites, no cancellation emails — nothing.

---

### EMAIL_FROM
**Required for emails to look correct.**

The name and email address that patients and clinics see as the sender when they receive an email from the app.

```
EMAIL_FROM=BookMySlot <noreply@bookmyslot.dental.mossaic.in>
```

> **Already updated** — set to your verified custom domain.

If not set, the app falls back to `BookMySlot <onboarding@resend.dev>` — Resend's shared sandbox address, which looks unprofessional and may not work once you're on a paid plan with a custom domain.

What breaks if missing: Emails come from a generic Resend address, not your domain.

---

### RESEND
**Required to send emails to real people.**

This is the on/off switch between test mode and real delivery.

```
RESEND=PRODUCTION
```

| Value | What happens |
|---|---|
| Not set (or anything other than PRODUCTION) | Every email goes to the hardcoded test inbox (`itsmyfavoriteworkplace@gmail.com`) — no patient ever receives anything |
| `PRODUCTION` | Emails go to the actual patient, clinic, or doctor email address |

> **This was the root cause of the original issue** — all emails were going to one test inbox regardless of what email the patient entered.

What breaks if missing: Patients, clinics, and doctors never receive any emails.

---

### RAZORPAY_KEY_ID
**Optional — only needed if payments are enabled.**

The public identifier for your Razorpay payment gateway account. This is used both on the backend (to create payment orders) and passed to the frontend (to open the payment window).

```
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx
```

What breaks if missing: The payment flow is disabled. Patients cannot pay online.

---

### RAZORPAY_KEY_SECRET
**Optional — only needed if payments are enabled.**

The private key for Razorpay. Used on the backend only to verify that a payment actually went through and wasn't tampered with.

```
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

> **Never expose this on the frontend.** It must only ever be set as a backend environment variable.

What breaks if missing: Payment verification fails — the app cannot confirm whether a payment succeeded.

---

### TWILIO_ACCOUNT_SID
**Optional — only needed if WhatsApp notifications are enabled.**

Your Twilio account identifier. Twilio is the service used to send WhatsApp messages to patients and clinics.

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx
```

What breaks if missing: WhatsApp notifications are silently disabled. Bookings still work, just no WhatsApp messages.

---

### TWILIO_AUTH_TOKEN
**Optional — only needed if WhatsApp notifications are enabled.**

The secret key for your Twilio account. Works alongside the Account SID to authenticate your requests.

```
TWILIO_AUTH_TOKEN=your_twilio_auth_token
```

What breaks if missing: WhatsApp notifications are silently disabled.

---

### TWILIO_WHATSAPP_NUMBER
**Optional — but has a dangerous default.**

The WhatsApp number that messages are sent from. If this is not set, the app falls back to `+14155238886` — which is **Twilio's shared sandbox test number**, not a real production number.

```
TWILIO_WHATSAPP_NUMBER=+919xxxxxxxxx
```

> If you are sending real WhatsApp messages in production, this must be set to your actual approved Twilio WhatsApp number. Otherwise messages go out from Twilio's test number, which may fail or look wrong to recipients.

---

### R2_ACCOUNT_ID
**Optional — only needed if clinic logo / image uploads are enabled.**

Your Cloudflare account ID. Cloudflare R2 is the storage service used to store clinic profile images and other uploaded files.

```
R2_ACCOUNT_ID=your_cloudflare_account_id
```

What breaks if missing: Image uploads are disabled. Clinic logos cannot be uploaded or stored.

---

### R2_ACCESS_KEY_ID
**Optional — only needed if image uploads are enabled.**

The access key for your Cloudflare R2 storage bucket. Works like a username to authenticate file uploads.

```
R2_ACCESS_KEY_ID=your_r2_access_key
```

---

### R2_SECRET_ACCESS_KEY
**Optional — only needed if image uploads are enabled.**

The secret key for Cloudflare R2. Works like a password alongside the access key.

```
R2_SECRET_ACCESS_KEY=your_r2_secret_key
```

---

### R2_BUCKET_NAME
**Optional — has a safe default.**

The name of the storage "bucket" (folder) where images are stored inside Cloudflare R2.

```
R2_BUCKET_NAME=bookmyslot-images
```

Falls back to `app-images` if not set. Only needs to be set if your bucket has a different name.

---

### R2_PUBLIC_URL
**Optional — needed for images to display correctly.**

The public web address where uploaded images can be viewed. Without this, the app can upload files but cannot display them to users.

```
R2_PUBLIC_URL=https://pub-xxxxxxxxxxxxxxxx.r2.dev
```

Where to get it: Cloudflare dashboard → R2 → your bucket → **Settings** → copy the Public Bucket URL.

---

### FORCE_SEED
**Optional — for development/testing only.**

When set to `"true"`, this forces the app to re-create all demo data (demo clinic, demo doctor, test slots, sample bookings) every time the server restarts.

```
FORCE_SEED=true
```

> **Do not set this in production.** It will wipe and recreate demo data on every restart, which could interfere with real clinic data.

---

## Frontend Environment Variables — Full Reference

These must be set in your **Render Static Site (frontend)** under Environment.

---

### VITE_API_URL
**Required.**

This tells the frontend (the website) where the backend (the API server) lives. Without this, the frontend doesn't know where to send booking requests, login attempts, or any other data.

```
VITE_API_URL=https://bookmyslot-api.onrender.com
```

> **Currently set** in `client/.env.local` for local development. In production on Render, this must be set in the Static Site's Environment settings pointing to your live backend URL.

What breaks if missing: The entire frontend breaks — no data loads, no logins work, bookings fail.

---

### VITE_RAZORPAY_KEY_ID
**Optional — only needed if payments are enabled on the frontend.**

The public Razorpay key, used by the frontend to open the Razorpay payment popup. This is the same value as `RAZORPAY_KEY_ID` on the backend — it is safe to expose on the frontend because it's a public key (not a secret).

```
VITE_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx
```

If not set, the frontend falls back to using the key sent from the backend in the payment order response. This fallback works in most cases, but setting it explicitly is cleaner.

---

## Variables with Dangerous Hardcoded Fallbacks

These are variables where, if you forget to set them in Render, the app doesn't crash — it silently uses an unsafe or incorrect default. These are the most important ones to double-check.

| Variable | Dangerous Default | Risk |
|---|---|---|
| `SESSION_SECRET` | `"book-my-slot-secret"` (public in code) | Anyone could forge admin/doctor login sessions |
| `ADMIN_EMAIL` | `itsmyfavoriteworkplace@gmail.com` | Admin login goes to the wrong email |
| `RESEND` | `DEV` — all emails to test inbox | No patient ever receives a real email |
| `EMAIL_FROM` | `onboarding@resend.dev` | Emails look unprofessional, may not work with custom domain |
| `TWILIO_WHATSAPP_NUMBER` | `+14155238886` (Twilio sandbox number) | WhatsApp messages sent from wrong/test number |
| `FRONTEND_URL` | `https://book-my-slot-client.onrender.com` (old URL) | Doctor invite links point to wrong address |

---

## Production Go-Live Checklist

Use this before launching or after any major change. Tick each one off in your Render dashboard.

**Backend (Web Service → Environment):**
- [ ] `DATABASE_URL` — set to Render PostgreSQL external URL
- [ ] `SESSION_SECRET` — set to a strong random string (min 32 characters)
- [ ] `NODE_ENV` — set to `production`
- [ ] `PORT` — set to `10000`
- [ ] `ADMIN_EMAIL` — set to your real admin email
- [ ] `ADMIN_PASSWORD` — set to a strong password
- [ ] `FRONTEND_URL` — set to your live frontend URL
- [ ] `RESEND_API_KEY` — set to your Resend API key
- [ ] `EMAIL_FROM` — set to `BookMySlot <noreply@bookmyslot.dental.mossaic.in>`
- [ ] `RESEND` — set to `PRODUCTION`
- [ ] `RAZORPAY_KEY_ID` — set if payments are live
- [ ] `RAZORPAY_KEY_SECRET` — set if payments are live
- [ ] `TWILIO_ACCOUNT_SID` — set if WhatsApp is live
- [ ] `TWILIO_AUTH_TOKEN` — set if WhatsApp is live
- [ ] `TWILIO_WHATSAPP_NUMBER` — set to your real approved WhatsApp number
- [ ] `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` — set if image uploads are live

**Frontend (Static Site → Environment):**
- [ ] `VITE_API_URL` — set to your live backend URL
- [ ] `VITE_RAZORPAY_KEY_ID` — set if payments are live
