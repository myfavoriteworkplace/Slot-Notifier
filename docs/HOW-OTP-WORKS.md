# How OTP Verification Works — BookMySlot

> **Created:** 01 Jun 2026  
> **Applies to:** Patient booking flow (`Book.tsx`), Clinic registration (`RegisterClinic.tsx`), Supplier listing request (`SmileDeals.tsx`)  
> **Table:** `email_otps` (PostgreSQL)

---

## 1. Overview

BookMySlot uses a 6-digit one-time passcode (OTP) sent by email to verify a patient's or registrant's identity before they can view appointment slots or submit a booking. The OTP system has three security layers:

| Layer | Mechanism | Limit |
|---|---|---|
| **Send rate** | Max 3 codes per email+purpose per 10 minutes | Blocks email spam / Resend quota abuse |
| **Per-send cooldown** | Min 60 seconds between consecutive sends | Prevents rapid resend clicks |
| **Verify rate** | Lock after 5 wrong guesses | Blocks brute-force attacks on 6-digit codes |

---

## 2. Database Schema — `email_otps`

| Column | Type | Purpose |
|---|---|---|
| `id` | serial PK | Row identity |
| `email` | varchar(255) | Recipient email (normalised to lowercase) |
| `otp_hash` | varchar(255) | bcrypt hash of the 6-digit code (never stored plaintext) |
| `expires_at` | timestamp | Code expires 5 minutes after issue |
| `verified` | boolean | `true` once the correct code is entered |
| `verified_token` | varchar(64) | Random hex token returned on success; frontend uses this to prove verification on subsequent API calls |
| `purpose` | varchar(50) | `'booking'` · `'clinic_registration'` · `'supplier-listing'` · `'doctor_password_reset'` · `'clinic_password_reset'` |
| `created_at` | timestamp | Time the current code was issued (used for 60-second cooldown) |
| `attempts` | integer | Number of wrong verify attempts on the current code (default 0) |
| `locked_until` | timestamp | If set and in the future, verify requests are rejected until this time |
| `send_count` | integer | Number of codes sent within the current 10-minute send window (default 1) |
| `send_window_start` | timestamp | Start of the current 10-minute send window |

---

## 3. Send Flow — `POST /api/public/otp/send`

```
Patient enters email → clicks "Send Code"
          │
          ▼
  Validate email format
  (400 if invalid)
          │
          ▼
  Look up existing unverified OTP row
  for this email + purpose
          │
     ┌────┴──────────────────────────────────────────┐
     │ Row exists                                     │ No row
     ▼                                                ▼
  Check send window                            Generate code
  ─────────────────                            Insert new row
  window = send_window_start                   send_count = 1
  expired? (>10 min ago)                       send email
     │                                         return 200
  Yes → reset count to 0
     │
  currentCount = expired ? 0 : send_count
     │
  currentCount >= 3 AND window not expired?
  → 429 "Too many codes sent.
         Try again in X min"
     │
  Last sent < 60 s ago?
  → 429 "Wait 60 seconds"
     │
  Issue new code:
  • Generate fresh 6-digit code
  • bcrypt hash it
  • UPDATE row: new hash, new expires_at,
    attempts = 0, locked_until = NULL,
    send_count++, created_at = NOW()
  • Send email
  • return 200
```

**Key behaviours:**
- A fresh OTP send **always resets `attempts = 0` and `locked_until = NULL`**. This is the self-service unlock mechanism — a locked-out patient can click "Resend" to get a brand new code with a clean attempt counter.
- The 10-minute send window is not reset by a resend; only by the window naturally expiring or the row being deleted (on verified/expired cleanup).
- The old code becomes invalid as soon as the new `otp_hash` is written.

---

## 4. Verify Flow — `POST /api/public/otp/verify`

```
Patient enters 6-digit code → clicks "Verify"
          │
          ▼
  Find unverified, non-expired OTP row
  for this email + purpose
          │
  Not found → 400 "No valid code found"
          │
          ▼
  Is locked_until set AND in the future?
  → 429 "Locked for X minutes.
         Request a new code to unlock immediately."
  (returns: locked=true, lockedUntilSeconds=N)
          │
          ▼
  bcrypt.compare(inputCode, otp_hash)
          │
     ┌────┴───────────────────────────────┐
     │ No match                           │ Match
     ▼                                    ▼
  attempts = attempts + 1           Mark verified = true
  attempts >= 5?                    Set verified_token (random hex)
  → Yes: set locked_until = NOW()   Clear: attempts=0, locked_until=NULL
         + 30 min                   Return 200 { verifiedToken }
         return 429 "Locked 30 min"
  → No:  return 400
         "X attempts remaining"
         (returns: attemptsLeft=N)
```

---

## 5. How the Lock is Released

There are **two** ways the lock clears — no admin action is ever needed:

### Option A — Wait it out
- `locked_until` is set to `NOW() + 30 minutes`.
- After 30 minutes the verify endpoint checks `locked_until > NOW()` — when this becomes false, attempts are allowed again automatically.
- The patient can try the same code again (if the 5-minute `expires_at` window hasn't also passed — if it has, they need a new code anyway).

### Option B — Request a new code (immediate self-unlock)
- Patient clicks **"Resend OTP"**.
- The send endpoint issues a fresh code and sets `attempts = 0`, `locked_until = NULL` on the existing row.
- The old locked state is gone instantly — the patient can verify immediately with the new code.
- The send endpoint still enforces its own limit (max 3 sends / 10 min), so an attacker cannot use "resend" as an infinite attempt-reset.

---

## 6. Security Properties

| Property | Value | Rationale |
|---|---|---|
| Code length | 6 digits | 1,000,000 combinations |
| Brute-force window | 5 guesses before lock | At 5 guesses: ~0.0005% chance of success per lock cycle |
| Lock duration | 30 minutes (auto-expiry) | Long enough to be painful for a bot, short enough for a real user |
| Self-unlock method | Resend a new code | Resets attempt counter; sends brand-new code; old code invalidated |
| Send cap | 3 per 10 minutes per email+purpose | Prevents Resend quota drain and email spam |
| Per-send cooldown | 60 seconds | Prevents rapid double-clicks / UI race conditions |
| Code storage | bcrypt hash only | Plaintext code never persisted; cannot be recovered from DB |
| Code lifetime | 5 minutes | Short enough to be useless after expiry |
| Verified token | 32-byte random hex | Proves verification to subsequent API endpoints without replaying the OTP |

---

## 7. Error Response Reference

### `POST /api/public/otp/send`

| HTTP | Body | When |
|---|---|---|
| 200 | `{ success: true, message: "..." }` | Code sent successfully |
| 400 | `{ message: "A valid email address is required" }` | Invalid email format |
| 429 | `{ message: "Too many codes sent...", retryAfterSeconds: N }` | 3 sends within 10-minute window |
| 429 | `{ message: "Please wait at least 60 seconds..." }` | Resend within 60-second cooldown |
| 500 | `{ message: "Failed to send verification code" }` | Resend API or DB error |

### `POST /api/public/otp/verify`

| HTTP | Body | When |
|---|---|---|
| 200 | `{ success: true, verifiedToken: "..." }` | Correct code |
| 400 | `{ message: "No valid code found..." }` | No matching unexpired unverified row |
| 400 | `{ message: "Incorrect code. N attempts remaining.", attemptsLeft: N }` | Wrong code, not yet locked |
| 429 | `{ message: "Locked for 30 minutes...", locked: true, lockedUntilSeconds: N }` | Wrong code, 5th attempt — newly locked |
| 429 | `{ message: "Too many incorrect attempts...", locked: true, lockedUntilSeconds: N }` | Already locked, trying again |
| 500 | `{ message: "Failed to verify code" }` | DB error |

---

## 8. Purpose Values

| Purpose string | Used by |
|---|---|
| `booking` | Patient booking flow (`Book.tsx`) |
| `clinic_registration` | Clinic self-registration (`RegisterClinic.tsx`) |
| `supplier-listing` | Supplier listing on Smile Deals page (`SmileDeals.tsx`) |
| `clinic_password_reset` | Clinic forgot-password flow |
| `doctor_password_reset` | Doctor forgot-password flow |

Each purpose is scoped independently — a lock on `booking` does not affect `clinic_registration` for the same email address.

---

## 9. Cleanup

OTP rows are cleaned up in two ways:
1. **On successful booking / registration** — the row is `DELETE`d after the `verifiedToken` is consumed.
2. **Naturally** — rows with `expires_at` in the past are skipped by all queries (they use `WHERE expires_at > NOW()`). A periodic DB maintenance job (or manual `DELETE FROM email_otps WHERE expires_at < NOW() - INTERVAL '1 day'`) can prune them.
