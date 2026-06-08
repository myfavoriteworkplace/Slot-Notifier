# BookMySlot Email Design System

All 17 transactional emails share a single design system defined in `server/routes.ts` (lines ~54–180).
This document explains the rules so new emails can be added consistently without guessing at styles.

---

## 1. Core concept — the shell + accent bar

Every email is built from one function:

```ts
emailShell(accentColor: string, body: string): string
```

This produces a white card (max 600 px, centered, `border-radius:14px`) with:
- A **4 px gradient accent bar** at the very top — the only element whose colour changes between emails
- The **body** HTML rows in the middle
- A **consistent footer** with `bookmyslot@mail.mossaic.in`

The accent bar is the single visual cue that tells the recipient what kind of email this is, at a glance, before they read a word.

---

## 2. Accent bar colour guide

| Accent colour | Gradient | Use for |
|---|---|---|
| Green | `#0f9b6e → #1dbe88` | Patient-positive: booking received, confirmed, password changed, OTP |
| Red | `#dc2626 → #ef4444` | Bad news: cancellation, admin doctor-decline |
| Amber | `#d97706 → #f59e0b` | Something changed: reschedule, password reset, admin-added to schedule |
| Violet | `#7c3aed → #a78bfa` | Doctor / staff: assignment, invite, welcome credentials |
| Blue | `#2563eb → #3b82f6` | Clinic admin, supplier: new booking (clinic side), supplier listing |
| Dark theme | `#0d2a1f` (bg, not a gradient) | Superadmin 2FA OTP — intentionally breaks from the white card to signal security-critical context |

**Rule:** Never use a colour not in this list without a clear reason. New email categories should pick the closest semantic match.

---

## 3. Logo block — always the same

```ts
logoBlock(onDark = false): string
```

Outputs the 34×34 px green icon badge + "bookMySlot DENTAL" text.
- Pass `onDark = true` when the logo sits on a dark/coloured background (hero bands, OTP dark theme).
- The logo must appear in **every email**, always as the first element after the accent bar (or inside the hero band).

---

## 4. Hero band — for celebratory emails only

```ts
heroBand(gradient: string, title: string, subtitle: string): string
```

A full-colour band that replaces the plain logo header. Use sparingly — only for:
- Appointment confirmed (green hero)
- Clinic approved (dark green hero)
- Doctor invite (violet hero)

The hero band already includes `logoBlock(true)` internally. Do not add a second logo row.

---

## 5. Detail card — 2-column layout

```ts
detailCard(
  fields: { label: string; value: string; strikethrough?: boolean }[],
  accentColor?: string,   // label colour, default: '#5a9070' (green-grey)
  cardBg?: string,        // default: '#f8fbf9'
  borderColor?: string,   // default: '#d4ebe0'
): string
```

Fields are rendered in **2 columns per row** (paired left-right). Always pass an even number of fields. If you have an odd number, add a trailing `{ label: '', value: '' }` spacer and filter it out with:

```ts
.filter(f => !(f.label === '' && f.value === ''))
```

Use `strikethrough: true` on date/time fields in cancellation and reschedule emails to visually communicate "this slot is gone".

Colour variants for different accent contexts:
- Green (default): patient-positive emails
- Red `('#c02020', '#fff5f5', '#fca5a5')`: cancellation, doctor-declined
- Amber `('#a16207', '#fefce8', '#fde68a')`: reschedule, admin-added
- Violet `('#6d3abf', '#faf5ff', '#e9d5ff')`: doctor assignment

---

## 6. Info banner

```ts
infoBanner(type: 'amber' | 'green' | 'red' | 'blue', html: string): string
```

A thin notice box above or below the detail card. Use for:
- `amber` — expiry warnings, awaiting-confirmation status, security notices about changing passwords
- `green` — "your account is secure", "how to rebook" suggestions
- `red` — urgent action notices, "didn't make this change?" warnings
- `blue` — next-steps instructions (supplier acknowledgement)

**Rule:** Every email should have at most **one** info banner. Two banners on one email (password changed) is the exception for security-critical content.

---

## 7. Buttons

### Single CTA
```ts
primaryButton(label: string, href: string, color?: string): string
```
Default colour is green (`#1a9e6f`). Always wrap in a centred `<table>` row:
```ts
`<table role="presentation" width="100%" ...><tr><td align="center">${primaryButton(...)}</td></tr></table>`
```

### Split CTA (Accept / Decline)
```ts
splitButtons(
  leftLabel: string, leftHref: string, leftColor: string,
  rightLabel: string, rightHref: string,
): string
```
Left button is solid-filled. Right button is always a white/red outline (decline style). Currently used for: doctor assignment email (future — once token-based accept/decline is implemented).

---

## 8. Subject line convention

All subjects follow this exact pattern:
```
BookMySlot – {Action phrase} · {Context}
```
- The em-dash (`–`) separates the brand prefix from the action.
- The middle dot (`·`) separates the action from the context (clinic name, patient name, etc.).
- Context is optional if the subject is already specific enough.
- Include expiry info in parentheses for time-sensitive links: `(expires in 30 min)`.

| Scenario | Subject |
|---|---|
| Booking received (patient) | `BookMySlot – Booking Received · {clinic}` |
| Booking received (clinic) | `BookMySlot – New Booking Request · {patient}` |
| Confirmed | `BookMySlot – Appointment Confirmed · {clinic}` |
| Cancelled | `BookMySlot – Appointment Cancelled · {clinic}` |
| Rescheduled | `BookMySlot – Appointment Rescheduled · {clinic}` |
| Doctor assigned | `BookMySlot – New Appointment Assigned (action needed)` |
| Admin added to schedule | `BookMySlot – Added to Your Schedule · {clinic}` |
| Admin doctor declined | `BookMySlot – Action Needed: Doctor Declined · {patient}` |
| Doctor invite | `BookMySlot – You're Invited to Join {clinic}` |
| Doctor credentials | `BookMySlot – Your Login Credentials · {clinic}` |
| Clinic approved | `BookMySlot – Your Clinic is Approved` |
| Password reset | `BookMySlot – Reset Your Password (expires in 30 min)` |
| Password changed | `BookMySlot – Password Changed Successfully` |
| Admin OTP | `BookMySlot – Admin Login Code (expires in 10 min)` |
| Supplier admin | `BookMySlot – New Supplier Submission · {company}` |
| Supplier ack | `BookMySlot – We've Received Your Submission` |
| OTP (patient) | `BookMySlot – Verify Your Email (expires in 5 min)` |

---

## 9. Body structure — the standard row sequence

Every email body (the string passed to `emailShell`) follows this order:

```
1. Logo row        — <tr><td align="center" style="padding:28px 40px 0;">{logoBlock()}</td></tr>
   OR hero band    — {heroBand(...)}

2. Content row     — <tr><td style="padding:24px 40px 0;">
     a. Title h2   — <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0d1f1a;...">
     b. Subtitle   — <p style="margin:0 0 24px;font-size:15px;color:#5a7a6a;...">
     c. detailCard (if data)
     d. infoBanner (if status notice)
     e. Button(s)
     f. Closing note (font-size:13px;color:#8fa89a)
   </td></tr>

3. Footer          — auto-appended by emailShell — do NOT add another footer
```

---

## 10. Typography rules

| Element | Size | Weight | Colour |
|---|---|---|---|
| Email title | 22 px | 700 | `#0d1f1a` |
| Subtitle / greeting | 15 px | 400 | `#5a7a6a` |
| Detail card labels | 10 px | 600 | Accent colour (varies) |
| Detail card values | 14 px | 600 | `#0d1f1a` |
| Banner text | 13 px | 400 | Banner-specific |
| Closing note | 13 px | 400 | `#8fa89a` |
| Footer | 11 px | 400 | `#a8b8b0` |
| Credential display | 18 px | 700 | Accent colour |
| OTP code | 52 px | 700 | Green / teal |

Font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif`
OTP / credentials: `'Courier New', Courier, monospace`

---

## 11. Colour palette reference

| Token | Hex | Used for |
|---|---|---|
| Brand green | `#0f9b6e` / `#1a9e6f` | Logo bg, icon, primary buttons, green accent bar |
| Dark green | `#085041` | Hero band starts, heading tint |
| Accent teal | `#1dbe88` | Gradient ends |
| Ink | `#0d1f1a` | Body text, headings |
| Sub-ink | `#5a7a6a` | Subtitle / greeting text |
| Muted | `#8fa89a` | Closing notes |
| Footer | `#a8b8b0` | Footer line |
| Divider | `#edf2ef` | Footer border |
| Card bg | `#f8fbf9` | Default detail card background |
| Card border | `#d4ebe0` | Default detail card border |
| Page bg | `#f0f5f2` | Email outer background |

---

## 12. Adding a new email — checklist

1. **Pick an accent colour** from the table in §2.
2. **Write the function** using `emailShell(accentColor, body)`.
3. **Add a logo row** (or hero band for celebratory emails).
4. **Title + subtitle** — sentence case, plain English.
5. **Detail card** — even number of fields, 2 per row.
6. **Info banner** — at most one. Choose `amber/green/red/blue`.
7. **Button** — one primary CTA, wrapped in a centred table row.
8. **Closing note** — one sentence, muted colour.
9. **Subject** — follow `BookMySlot – {Action} · {Context}` pattern.
10. **No footer** — `emailShell` adds it automatically.
11. **Export/call** — fire-and-forget with `.catch()` at the call site.

---

## 13. Dev / test mode

Emails are gated by `RESEND_MODE`:
- `PRODUCTION` → sends to actual recipient addresses
- anything else → redirects all mail to `TEST_EMAIL` (set in environment)

When `resend` client is not configured (no `RESEND_API_KEY`), every email function logs a `[EMAIL MOCK]` line to the console instead of sending.

---

## 14. Future work (Phase 2 / Phase 3)

| Feature | What's needed |
|---|---|
| Doctor accept/decline links in email | Generate a short-lived token on assignment, two GET routes (`/api/doctor/accept/:token`, `/api/doctor/decline/:token`), wire into `splitButtons()` in `sendDoctorAssignmentEmail` |
| Chief complaint in booking emails | Add `chiefComplaint` field to booking form UI + DB schema, pass to `sendBookingEmails` and `sendDoctorAssignmentEmail` |
| Patient name in OTP email | `sendOtpEmail` already accepts optional `recipientName` — just pass it from the booking OTP route |
| Admin name in clinic approved email | Available from clinic record; add as optional param to `sendClinicApprovalEmail` |
