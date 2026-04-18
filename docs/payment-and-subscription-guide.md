# BookMySlot — Payment & Subscription Guide

> **Who is this for?**
> Anyone managing or operating the BookMySlot platform — the person who runs the admin panel, sets up Razorpay, approves clinics, or troubleshoots payment issues. No technical knowledge required to follow this guide.

---

## Table of Contents

1. [The Pricing Model](#1-the-pricing-model)
2. [Clinic Registration — What the Clinic Fills In](#2-clinic-registration--what-the-clinic-fills-in)
3. [What Happens After Registration (Behind the Scenes)](#3-what-happens-after-registration-behind-the-scenes)
4. [Admin Approval — What You Do](#4-admin-approval--what-you-do)
5. [What Happens When You Click Approve (Behind the Scenes)](#5-what-happens-when-you-click-approve-behind-the-scenes)
6. [The Approval Email the Clinic Receives](#6-the-approval-email-the-clinic-receives)
7. [The Activation Page — Clinic Completes Payment](#7-the-activation-page--clinic-completes-payment)
8. [How Payment Success is Detected Automatically](#8-how-payment-success-is-detected-automatically)
9. [Manual Override — Mark as Paid](#9-manual-override--mark-as-paid)
10. [The "Payment Pending" Banner on the Clinic Dashboard](#10-the-payment-pending-banner-on-the-clinic-dashboard)
11. [Subscription States — What Each Status Means](#11-subscription-states--what-each-status-means)
12. [All Environment Variables Reference](#12-all-environment-variables-reference)
13. [How to Go Live with Razorpay — Step by Step](#13-how-to-go-live-with-razorpay--step-by-step)
14. [Testing the Flow Without Real Money](#14-testing-the-flow-without-real-money)

---

## 1. The Pricing Model

BookMySlot charges clinics a monthly or annual subscription fee to use the platform. There are three plans:

### Plan Comparison

| Feature | Starter | Growth | Pro |
|---|---|---|---|
| **Monthly price** | ₹999 / month | ₹1,599 / month | ₹2,999 / month |
| **Annual price** | ₹9,990 / year | ₹15,990 / year | ₹29,990 / year |
| **Annual savings** | Save ₹2 months | Save ₹2 months | Save ₹6,000 |
| **Effective monthly (annual)** | ₹833 / mo | ₹1,333 / mo | ₹2,499 / mo |
| **Monthly bookings allowed** | Up to 30 | Up to 150 | Unlimited |
| **Transaction fee per booking** | 5% | 3% | 1.5% |
| **Doctors on roster** | 1 doctor | Up to 3 doctors | Unlimited |
| **Smile Deal posts** | 1 post | 3 posts | Unlimited |
| **WhatsApp booking alerts** | No | Yes | Yes |
| **Analytics dashboard** | Basic | Advanced | Full |
| **Verified Premium badge** | No | No | Yes |
| **Featured on Smile Deals** | No | No | Yes |
| **Support** | None | Email | Email + Phone |

### Why Razorpay Subscriptions?

The decision was made to use **Razorpay Subscriptions** (not one-time payments) because:

- Clinics are billed **automatically** every month or year — no manual invoice collection
- Razorpay handles retries if a payment fails
- The clinic authorises once; all future charges happen without any action from either side
- The admin gets notified via webhook whenever a payment succeeds or fails

---

## 2. Clinic Registration — What the Clinic Fills In

Clinics register at the page: `/register-clinic`

**Fields the clinic fills in:**

| Field | Required? | Notes |
|---|---|---|
| Clinic name | Yes | |
| Address | Yes | |
| City | Yes | |
| Pincode | Yes | |
| Email address | Yes | Must be verified via OTP before submission |
| Phone number | Yes | Must be a valid 10-digit Indian mobile number |
| Website | Optional | |
| Doctor name, specialisation, degree | Optional | |
| Google Business URL | Optional | Boosts trust score |
| GST number | Optional | Boosts trust score |
| Medical licence (document upload) | Optional | Boosts trust score |
| Clinic registration certificate (upload) | Optional | Boosts trust score |
| **Plan selection** | Yes | Starter / Growth / Pro |
| **Billing cycle** | Yes | Monthly / Annual |

**Important:** The clinic's email must be verified with a one-time password (OTP) before the form can be submitted. This prevents fake registrations.

**The clinic does NOT set a password at registration.** The username and password are generated automatically when the admin approves them.

---

## 3. What Happens After Registration (Behind the Scenes)

When the clinic clicks Submit, the system:

1. **Verifies the OTP token** — confirms the email was genuinely verified
2. **Calculates a Trust Score** (0–100) based on what was provided:
   - Clinic name provided → +7 points
   - Address or city provided → +7 points
   - Pincode provided → +6 points
   - Valid 10-digit phone → +30 points
   - Professional email (non-Gmail/Yahoo) → +15 points; free email → +10 points
   - Medical licence uploaded → +15 points
   - Clinic registration certificate uploaded → +10 points
   - Google Business URL provided → +15 points
   - GST number provided → +10 points
3. **Saves the clinic** in the database with:
   - `status = "pending"` — it goes into the admin's approval queue
   - `subscriptionStatus = "unpaid"` — not yet subscribed
   - The plan and billing cycle the clinic selected
   - No username or password yet (generated later at approval)
4. **Deletes the OTP token** — it can only be used once

The clinic now waits for admin approval. They will not receive any email yet.

---

## 4. Admin Approval — What You Do

Log in at `/admin` and go to the **Pending Registrations** tab.

Each pending clinic shows a card with:
- Clinic name, location, email, phone
- A **"Verification Review"** section that shows the Trust Score, which checks passed, and any alerts (e.g. duplicate phone, free email, missing documents)
- A **Plan selector** — defaulting to what the clinic chose but you can change it
- A **Billing cycle selector** — Monthly or Annual
- Three action buttons: **Approve**, **Flag for Review**, **Reject**

### What each action does:

| Action | What it does |
|---|---|
| **Approve** | Runs the full activation flow (see Section 5) |
| **Flag for Review** | Shows a note — no system action, just a reminder for yourself |
| **Reject** | Sets the clinic status to "rejected", removes them from the queue |

### The Plan Override

When you approve, you can change the plan or billing cycle from what the clinic originally selected. The plan shown in the dropdown defaults to what the clinic picked during registration. You only need to change it if you want to offer them a different deal.

---

## 5. What Happens When You Click Approve (Behind the Scenes)

This is the most important step. Here is exactly what happens, in order:

### Step 1 — Username & Password Generated

A username is automatically created from the clinic name. For example, "Smile Dental Clinic" becomes `smile_dental_clinic`. If that username already exists, it becomes `smile_dental_clinic_2`, and so on.

A temporary password is also auto-generated. It follows a readable format like `Bright4821@` — easy to read out loud if needed. The password is stored securely (hashed, not in plain text).

### Step 2 — Razorpay Subscription Created

The system calls Razorpay's API and creates a **Subscription** using:
- The plan ID matching the clinic's plan + billing cycle (e.g. `RAZORPAY_PLAN_ID_GROWTH_MONTHLY`)
- `total_count = 12` for monthly plans (12 billing cycles in a year), `1` for annual
- `customer_notify = 0` — Razorpay does NOT send its own email; our system handles the email

Razorpay returns a `subscription_id` (e.g. `sub_AbC123XyZ`) and a `short_url` (a Razorpay-hosted payment link). Both are saved.

> **If Razorpay is not configured** (missing API keys or plan IDs), this step is skipped silently. The clinic still gets approved and credentials — they just won't have a Razorpay subscription linked. You can use "Mark as Paid" manually in this case.

### Step 3 — Activation Token Generated

A unique one-time link is created and saved in the database. It:
- Is a random UUID (looks like `a3f9c2d1-...`)
- Is valid for **7 days**
- Can only be used **once**
- Links the clinic, their plan, billing cycle, and Razorpay subscription ID

The full activation URL looks like:
```
https://yourdomain.com/activate/a3f9c2d1-b4e5-4f12-9abc-123456789012
```

### Step 4 — Clinic Record Updated

The clinic in the database is updated:
- `status` → `"approved"`
- `plan` → whatever was chosen at approval
- `billingCycle` → monthly or annual
- `subscriptionStatus` → `"unpaid"` (remains unpaid until they pay)
- `razorpaySubscriptionId` → the ID from Razorpay

### Step 5 — Approval Email Sent

An email is sent to the clinic's registered email address containing:
- A congratulations message
- Their **username** and **temporary password** in a credentials box
- A prominent **"Activate Now & Pay"** button linking to their unique activation URL
- A reminder that the link expires in 7 days
- A secondary button to go directly to the clinic login page

---

## 6. The Approval Email the Clinic Receives

The clinic receives an email with the subject:
> **Your clinic "[Clinic Name]" has been approved on BookMySlot**

The email contains:

1. A congratulations header
2. A credentials box showing their username and temporary password
3. A highlighted payment section:
   - Plan name and billing cycle (e.g. "Growth — Monthly")
   - An "Activate Now & Pay →" button
   - A note that the link expires in 7 days
4. A "Go to Clinic Dashboard →" button for after payment is done

> **Note on email delivery in development mode:**
> When `RESEND` environment variable is set to `DEV` (not `PRODUCTION`), all emails are redirected to the admin's test email address instead of the clinic's real email. This is for safety during testing. Change it to `PRODUCTION` when you go live.

---

## 7. The Activation Page — Clinic Completes Payment

When the clinic clicks the activation link in their email, they land on the page `/activate/<token>`.

**What the page does:**

1. **Validates the token** — checks it exists, hasn't been used, and hasn't expired
2. **Shows the plan summary** — clinic name and selected plan
3. **"Pay & Activate" button** — when clicked, opens the Razorpay payment popup directly on the page (no redirect to another website)
4. **After payment succeeds** — shows a green confirmation and a button to go to the clinic login

**Error states handled:**
- Token not found → "Activation link not found"
- Token already used → "This activation link has already been used"
- Token expired (7 days passed) → "This activation link has expired"
- Razorpay script fails to load → "Failed to load payment gateway. Please refresh and try again."

Once they pay, the clinic is ready to log in and use the dashboard. The automatic status update happens via webhook (Section 8) or you can manually mark as paid (Section 9).

---

## 8. How Payment Success is Detected Automatically

When the clinic pays, Razorpay sends an automatic notification to your server called a **webhook**. This happens within seconds of a successful payment.

**Webhook URL:** `POST /api/webhooks/razorpay-subscription`

This endpoint is public — Razorpay calls it directly. You need to register this URL in your Razorpay dashboard (see Section 13).

**What the webhook does:**

1. **Verifies the signature** — confirms the request genuinely came from Razorpay and was not tampered with (uses `RAZORPAY_WEBHOOK_SECRET`)
2. **Checks the event type** — only acts on `subscription.charged` or `subscription.activated`
3. **Finds the clinic** using the `subscriptionId` in the webhook payload
4. **Updates the clinic's status** → `subscriptionStatus = "active"`
5. **Marks the activation token as used** — so the link can't be reused

After this, the clinic's dashboard will show no payment banner, and they have full access.

---

## 9. Manual Override — Mark as Paid

Sometimes you may need to activate a clinic manually — for example:
- The clinic paid by cash or bank transfer
- You're testing without real Razorpay credentials
- The webhook didn't fire for some reason

**How to use it:**

1. Go to the Admin panel → **Active Clinics** tab
2. Find the clinic (they need to be approved first)
3. If they are not yet subscribed, you'll see a **"Mark Paid"** button next to their name
4. Click it — the clinic's subscription status immediately changes to `"active"`

This button is only visible if the clinic's subscription is not already active. It disappears once they're subscribed.

---

## 10. The "Payment Pending" Banner on the Clinic Dashboard

When a clinic logs into their dashboard before completing payment, they see an amber warning banner at the top:

> **"Subscription payment pending"**
> Your clinic is approved but your subscription is not yet active. Check your email for an activation link to complete payment, or contact support.

There is also a **"Contact support"** link that opens an email to `support@bookmyslot.in`.

This banner disappears automatically once the clinic's `subscriptionStatus` changes to `"active"` (either via webhook or Mark as Paid).

The clinic can still access their dashboard while the banner is showing — they are not blocked out. This is a "soft gate" — inform them without locking them out.

---

## 11. Subscription States — What Each Status Means

The `subscriptionStatus` field on each clinic record can be one of three values:

| Status | Meaning | What the clinic sees |
|---|---|---|
| `unpaid` | Approved but payment not yet completed | Amber warning banner on dashboard |
| `active` | Payment received, subscription running | No banner, full access |
| `expired` | Subscription has lapsed (not yet implemented) | Reserved for future use |

The Admin panel shows a badge next to each active clinic's name:
- **Blue "Subscribed" badge** → `subscriptionStatus = "active"`
- **Amber "Payment Pending" badge** → `subscriptionStatus = "unpaid"` or `"pending_payment"`
- **Grey plan badge** → shows which plan (Starter / Growth / Pro)

---

## 12. All Environment Variables Reference

These are all the environment variables the payment and subscription system uses. They are set in the Replit **Secrets** tab (not in any code file).

### Razorpay Credentials (Required for live payments)

| Variable | What it's for | Where to get it | Current value |
|---|---|---|---|
| `RAZORPAY_KEY_ID` | Your Razorpay API public key | Razorpay Dashboard → Settings → API Keys | Must be set |
| `RAZORPAY_KEY_SECRET` | Your Razorpay API secret key | Razorpay Dashboard → Settings → API Keys | Must be set |

### Razorpay Plan IDs (Required — one per plan+cycle combination)

These are IDs you create inside your Razorpay Dashboard under **Subscriptions → Plans**. Each plan needs its own ID.

| Variable | Plan it maps to | Price to set in Razorpay | Current value |
|---|---|---|---|
| `RAZORPAY_PLAN_ID_STARTER_MONTHLY` | Starter, billed monthly | ₹999 (99900 paise) | Placeholder |
| `RAZORPAY_PLAN_ID_STARTER_ANNUAL` | Starter, billed annually | ₹9,990 (999000 paise) | Placeholder |
| `RAZORPAY_PLAN_ID_GROWTH_MONTHLY` | Growth, billed monthly | ₹1,599 (159900 paise) | Placeholder |
| `RAZORPAY_PLAN_ID_GROWTH_ANNUAL` | Growth, billed annually | ₹15,990 (1599000 paise) | Placeholder |
| `RAZORPAY_PLAN_ID_PRO_MONTHLY` | Pro, billed monthly | ₹2,999 (299900 paise) | Placeholder |
| `RAZORPAY_PLAN_ID_PRO_ANNUAL` | Pro, billed annually | ₹29,990 (2999000 paise) | Placeholder |

> **Paise note:** Razorpay uses paise (1 rupee = 100 paise). Always multiply your rupee amount by 100 when creating plans.

### Webhook Secret (Required for security)

| Variable | What it's for | Where to get it | Current value |
|---|---|---|---|
| `RAZORPAY_WEBHOOK_SECRET` | Verifies that webhook calls genuinely came from Razorpay | Razorpay Dashboard → Webhooks → (set your own secret) | Placeholder |

### Email & Frontend Variables (Already configured)

| Variable | What it's for | Current value |
|---|---|---|
| `RESEND_API_KEY` | Sends approval emails via Resend | Set |
| `EMAIL_FROM` | The "from" address in emails | `onboarding@resend.dev` |
| `RESEND` | `DEV` = redirect all emails to admin; `PRODUCTION` = send to real clinic email | `DEV` — change to `PRODUCTION` when live |
| `FRONTEND_URL` | Base URL used to build the activation link in emails | Set |

---

## 13. How to Go Live with Razorpay — Step by Step

### Step A — Create a Razorpay Account

1. Go to [https://razorpay.com](https://razorpay.com) and sign up
2. Complete KYC verification (required to accept real payments)
3. You can use **Test Mode** for testing before going live

### Step B — Get Your API Keys

1. Log in to Razorpay Dashboard
2. Go to **Settings → API Keys**
3. Click **Generate Test Key** (for testing) or **Generate Live Key** (for production)
4. Copy both the **Key ID** (starts with `rzp_test_` or `rzp_live_`) and the **Key Secret**
5. Add them to Replit Secrets:
   - `RAZORPAY_KEY_ID` = your Key ID
   - `RAZORPAY_KEY_SECRET` = your Key Secret

### Step C — Create the 6 Plans in Razorpay

1. In Razorpay Dashboard, go to **Subscriptions → Plans**
2. Click **Create Plan** for each of the 6 combinations below:

| Plan name to use | Interval | Amount (in paise) |
|---|---|---|
| BookMySlot Starter Monthly | 1 month | 99900 |
| BookMySlot Starter Annual | 1 year | 999000 |
| BookMySlot Growth Monthly | 1 month | 159900 |
| BookMySlot Growth Annual | 1 year | 1599000 |
| BookMySlot Pro Monthly | 1 month | 299900 |
| BookMySlot Pro Annual | 1 year | 2999000 |

3. After creating each plan, Razorpay shows you a **Plan ID** (looks like `plan_AbCd1234XyZ`)
4. Copy each Plan ID and add it to Replit Secrets using the variable names from Section 12

### Step D — Set Up the Webhook

1. In Razorpay Dashboard, go to **Webhooks**
2. Click **Add New Webhook**
3. **Webhook URL:** `https://your-app-domain.com/api/webhooks/razorpay-subscription`
   - Replace `your-app-domain.com` with your actual deployed domain (from Replit Deployments)
4. **Secret:** Type any strong secret string (e.g. `bms_webhook_2026_xYz9`)
5. **Events to enable:** Check both:
   - `subscription.activated`
   - `subscription.charged`
6. Save the webhook
7. Copy the secret you typed and add it to Replit Secrets as `RAZORPAY_WEBHOOK_SECRET`

### Step E — Switch Email to Production Mode

Update the `RESEND` environment variable from `DEV` to `PRODUCTION` in Replit Secrets.

This ensures approval emails go to the clinic's actual email address instead of your test address.

### Step F — Restart the Application

After setting all secrets, restart the app from Replit. The new values are picked up on restart.

### Step G — Test the Full Flow

1. Register a test clinic using a real email you can check
2. Approve it from the admin panel
3. Check the email arrives with the activation link
4. Click the link and complete payment using Razorpay's test card (in test mode)
5. Verify the clinic's status changes to "active" automatically

---

## 14. Testing the Flow Without Real Money

Razorpay provides a **Test Mode** where no real money moves. To test:

1. Make sure your `RAZORPAY_KEY_ID` starts with `rzp_test_` (test mode key)
2. When the Razorpay checkout opens, use these test card details:
   - Card number: `4111 1111 1111 1111`
   - Expiry: any future date
   - CVV: any 3 digits
   - OTP (if asked): `1234`
3. The payment succeeds and the webhook fires to your server

### If the webhook doesn't fire locally (in development):

Razorpay cannot send webhooks to `localhost`. During development, you can use **ngrok** to expose your local server, or simply use the **"Mark as Paid"** button in the admin panel to simulate a successful payment without going through the full webhook flow.

---

*Last updated: April 2026*
*This document covers the payment changes introduced in the BookMySlot subscription implementation.*
