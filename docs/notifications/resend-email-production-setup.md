# Resend Email — Sandbox to Production Setup
## BookMySlot — How We Upgraded from Test Emails to Real Patient Emails

---

## Quick Summary

| | Before (Sandbox) | After (Production) |
|---|---|---|
| Where emails went | One hardcoded test inbox | Actual patient / clinic / doctor email |
| Sender address | `onboarding@resend.dev` (Resend's shared address) | `noreply@bookmyslot.dental.mossaic.in` (our own domain) |
| Who controlled delivery | Resend's sandbox (restricted) | Our verified domain (full control) |
| Env variable `RESEND` | Not set (defaulted to DEV mode) | `PRODUCTION` |
| Env variable `EMAIL_FROM` | `BookMySlot <onboarding@resend.dev>` | `BookMySlot <noreply@bookmyslot.dental.mossaic.in>` |

---

## What Was the Sandbox Setup?

When the app was first built, Resend was integrated using their **free sandbox / test mode**. In this mode:

- Resend only allows sending emails to **one pre-approved test address** regardless of what email the patient or clinic provides.
- The test address hardcoded in the code was: `itsmyfavoriteworkplace@gmail.com`
- The sender name showed as `onboarding@resend.dev` — Resend's own shared domain, not ours.
- A single environment variable (`RESEND`) controlled this behaviour. If it was not set to `PRODUCTION`, all emails silently redirected to the test inbox — no real patient ever received anything.

This was intentional during development so that test bookings would not spam real people. But it needed to be switched off before going live.

---

## What We Changed — Step by Step

### Step 1 — Resend Console (Resend's Website)

1. Logged into [resend.com](https://resend.com) and opened **Domains**.
2. Clicked **Add Domain** and entered: `bookmyslot.dental.mossaic.in` (without `https://`).
3. Selected region: **Asia-Pacific** (closest to our India-based hosting for faster delivery).
4. Resend generated three DNS records that need to be added to our domain registrar:

| Record Type | Name | Value / Purpose |
|---|---|---|
| TXT (DKIM) | `resend._domainkey.bookmyslot.dental` | Proves emails are genuinely from us (anti-spoofing) |
| TXT (SPF) | `send.bookmyslot.dental` | `v=spf1 include:spf.resend.com ~all` — authorises Resend to send on our behalf |
| MX (optional) | `send.bookmyslot.dental` | Only needed if we want to receive replies — added as optional |

5. Waited for DNS propagation (can take up to 24 hours). Domain status changed to **Verified** in Resend.

---

### Step 2 — Domain Registrar (Mossaic.in DNS Panel)

1. Logged into the DNS management panel for `bookmyslot.dental.mossaic.in` at Mossaic.in.
2. Added the three records exactly as Resend instructed:

| Record | Name | Value | TTL |
|---|---|---|---|
| TXT (DKIM) | `resend._domainkey.bookmyslot.dental` | DKIM key provided by Resend | 3600 (1 hour) |
| TXT (SPF) | `send.bookmyslot.dental` | `v=spf1 include:spf.resend.com ~all` | 3600 (1 hour) |
| MX (optional) | `send.bookmyslot.dental` | Resend mail server, Priority: 10 | 3600 (1 hour) |

3. Saved all records and confirmed they were active.

> **What are DKIM and SPF?** — These are security records that tell email providers (Gmail, Outlook, etc.) that our emails are legitimate and not spam. Without them, emails either land in junk or get blocked entirely.

---

### Step 3 — Environment Variables (Render Dashboard)

No code changes were needed. Only two environment variables were updated in the **Render server settings**:

| Variable | Old Value | New Value | What it does |
|---|---|---|---|
| `RESEND` | *(not set)* | `PRODUCTION` | Switches email delivery from test inbox to real recipients |
| `EMAIL_FROM` | `BookMySlot <onboarding@resend.dev>` | `BookMySlot <noreply@bookmyslot.dental.mossaic.in>` | Sets the sender address to our verified domain |

**How to update on Render:**
1. Go to Render dashboard → open your backend service.
2. Click **Environment** in the left sidebar.
3. Add or edit the two variables above.
4. Click **Save Changes** — Render redeploys automatically.

---

## Plain-Language "5-Step" Summary

1. **Tell Resend your domain** — Add `bookmyslot.dental.mossaic.in` in their console and choose Asia-Pacific region.
2. **Add DNS records at your registrar** — Paste the DKIM and SPF records Resend gives you into Mossaic.in's DNS panel. This proves the domain belongs to you.
3. **Wait for verification** — DNS changes can take up to 24 hours. Once Resend shows the domain as Verified, you're clear.
4. **Switch to production mode** — Set `RESEND=PRODUCTION` in your Render environment settings.
5. **Use your domain as the sender** — Set `EMAIL_FROM` to `BookMySlot <noreply@bookmyslot.dental.mossaic.in>`.

That's it — appointment confirmations, cancellations, doctor assignments, and invite emails now reach real patients from our own domain.

---

## Emails Sent by the App

These are all the email notifications the app sends once in production mode:

| Trigger | Who receives it |
|---|---|
| Patient books a slot | Patient gets a "Booking Received" email; Clinic gets a "New Booking Request" alert |
| Clinic confirms a booking | Patient gets an "Appointment Confirmed" email |
| Booking is cancelled | Patient gets a cancellation notice |
| Doctor is assigned to a booking | Doctor gets an "Action Required" assignment email |
| Clinic admin confirms without doctor approval | Doctor gets an FYI notification |
| Doctor declines an assignment | Clinic admin gets a "Doctor Declined — Action Needed" alert |
| Clinic invites a new doctor | Doctor gets an invite link to set up their account |

---

## Next Steps

- **Monitor deliverability** — Check the Resend dashboard regularly to see open rates and any bounced emails.
- **Plan upgrade** — Resend's free tier has a sending limit. If patient volume grows, upgrade to their Pro plan (~$20/month for 50,000 emails/month).
- **Inbound replies** — If we ever want patients to be able to reply to booking emails and have those replies captured, enable the MX record properly and configure Resend's inbound webhook.
- **Unsubscribe handling** — For marketing-type emails (e.g., Smile Deals promotions), consider adding an unsubscribe link to stay compliant with email regulations.
