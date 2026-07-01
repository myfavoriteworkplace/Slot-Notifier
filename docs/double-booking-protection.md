# Double-Booking Protection — Public Booking Routes

## Problem

When a patient books a slot through the public OTP flow, two concurrent race conditions can produce duplicate bookings for the same time slot:

| Race | Description |
|---|---|
| **Race A** — Two patients, same slot | Patient A and Patient B both verify OTPs, both call `POST /api/public/bookings` at the same moment. Both read `countVerifiedBookingsForClinicTime = 0`, both pass the capacity check, both insert a booking. Slot is over-booked. |
| **Race B** — Same patient, duplicate submission | The patient double-taps the submit button or the browser retries the request. The same `verifiedToken` is sent twice. Before the fix, the token was deleted **after** the booking was created, so both requests pass the token validation and create two identical bookings. |

---

## Implemented Fix (Option A) — DB Transaction with atomic OTP consumption

Both public booking routes now wrap the critical section in a single `db.transaction()`:

```
POST /api/public/bookings            (free / clinic-approval path)
POST /api/public/razorpay/verify-payment   (paid / Razorpay path)
```

### What happens inside the transaction

```
BEGIN;
  1. DELETE FROM email_otps WHERE id = $otpRowId RETURNING id
     → If 0 rows returned: throw TOKEN_USED  (Race B protection)

  2. SELECT bookings + slots WHERE slot.startTime ≈ requestedStart
     → Filter to this clinic, exclude cancelled/pending
     → Sum slot_cost to get txUsed
     → If txUsed + 1 > pubMax: throw SLOT_FULL  (Race A protection)

  3. INSERT INTO slots  (startTime, endTime, clinicId, isBooked=true)
  4. INSERT INTO bookings (slotId, customer…, verificationStatus='email_verified')
COMMIT;  ← all four operations succeed or all roll back together
```

### Error handling

| Thrown code | HTTP status | Message shown to patient |
|---|---|---|
| `TOKEN_USED` | 409 | "Your booking session is already in progress. Please wait a moment and try again." |
| `SLOT_FULL` | 400 | "This time slot is fully booked. Please choose another time." |

### Why the OTP is consumed first

Consuming the OTP **before** the slot/booking insert (step 1) eliminates Race B entirely: the second concurrent request tries to delete the same `email_otps` row but gets 0 rows back from `RETURNING`. It throws `TOKEN_USED` and is rejected with HTTP 409 before any slot or booking is created.

If the capacity check or insert later fails (step 2–4), the transaction rolls back — the OTP deletion is also rolled back, so the patient can retry.

### Why the capacity re-check is inside the transaction

PostgreSQL's default isolation level (Read Committed) means that within a transaction, each statement sees the latest committed data. Two concurrent transactions will both try to delete the same `email_otps` row, but only one will get a row back from `RETURNING`. The loser is rejected at step 1 before it ever reads the capacity count. This serialises the two requests without a separate lock table.

---

## Files changed

| File | Change |
|---|---|
| `server/routes.ts` — `POST /api/public/bookings` | Replaced non-atomic `countVerifiedBookingsForClinicTime → createSlot → createPublicBooking → delete(emailOtps)` with a single `db.transaction()` block. OTP deletion moved to step 1 inside the transaction. |
| `server/routes.ts` — `POST /api/public/razorpay/verify-payment` | Same transaction pattern added. Also adds a capacity re-check (was absent before — the prior check only lived in `create-order`, leaving a window between payment and booking insert). |

---

## What this does NOT cover

- **Admin-created bookings** (`POST /api/auth/clinic/bookings`) — clinic admins are authenticated and trusted; they see real-time counts in the dashboard. Double-submission via this route would require two simultaneous human actions. No transaction wrapping was added here.
- **Razorpay `create-order`** — the capacity check there is a soft pre-payment check only. It is not binding. The binding check is now in `verify-payment` inside the transaction.

---

## Future improvement — Option B: Slot Hold

Option A fixes the data-integrity problem but gives patients no advance warning that a slot was taken; they only find out at the moment they click "Book".

Option B adds a user-visible **slot hold** mechanism:

### How it would work

1. After OTP verification, the frontend immediately calls `POST /api/public/slots/hold`.
2. Server checks availability, creates a `slot_holds` row (2-minute TTL), returns `holdId`.
3. If the slot is already held or full → patient sees **"Slot just taken — please pick another"** before filling the form.
4. Patient fills the form; the booking form shows a **2:00 countdown timer**.
5. `POST /api/public/bookings` validates `holdId` + `verifiedToken` together, creates booking, deletes hold.
6. Expired holds are treated as absent during the availability count (cleanup on read).

### New table needed

```sql
CREATE TABLE slot_holds (
  id          SERIAL PRIMARY KEY,
  clinic_id   INTEGER      NOT NULL,
  start_time  TIMESTAMP    NOT NULL,
  email       VARCHAR(255) NOT NULL,
  verified_token VARCHAR(255) NOT NULL UNIQUE,
  expires_at  TIMESTAMP    NOT NULL,
  created_at  TIMESTAMP    DEFAULT NOW()
);
CREATE INDEX ON slot_holds (clinic_id, start_time, expires_at);
```

### Trade-offs

| | Option A (current) | Option B (future) |
|---|---|---|
| Data integrity | Full protection | Full protection |
| Patient UX | Slot taken error at submit | Slot held countdown shown upfront |
| Code complexity | Low (20 lines changed) | Medium (new table, new API endpoint, frontend state + countdown) |
| Schema migration | None | 1 new table on Render DB |
| Risk of "slot squatting" | None | Low (2-min TTL auto-expires) |

Option B is recommended as a follow-up once patient booking volume is high enough to make real-time slot competition visible to users.
