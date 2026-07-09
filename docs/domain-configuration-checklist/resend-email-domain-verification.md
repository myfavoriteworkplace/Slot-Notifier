# Resend Email Domain Verification — BookMySlot

> **Purpose of this document**
> This explains why production OTP/notification emails were silently failing to deliver, and the exact steps to verify a sending domain in Resend and wire the matching DNS records into GoDaddy. Read this alongside `godaddy-domain-configuration.md` (the master DNS reference) before changing anything related to email sending.

---

## 1. The Issue That Was Diagnosed

On the production instance, `RESEND_API_KEY` and `RESEND=PRODUCTION` were both set correctly, and `ADMIN_EMAIL` was correct — yet admin OTP emails never arrived, with **no error logged** on the server.

Root cause: `EMAIL_FROM` was left at Resend's shared sandbox address:

```
EMAIL_FROM=onboarding@resend.dev
```

`onboarding@resend.dev` is a **testing-only** address provided by Resend. Resend restricts what it can deliver to (in practice, only the account owner's own inbox in many cases), and it is never suitable for real production traffic. Because the send call did not throw, the app had no way to detect or log this — it looked like a successful send with a missing email.

When attempting to fix this by adding a custom domain in Resend, the domain entered was:

```
bookmyslot.dental.mossaic.in
```

Resend rejected/flagged this because that exact hostname is **already claimed by a different Resend team** (see `godaddy-domain-configuration.md` §2 — DKIM selector `resend._domainkey.bookmyslot.dental` and SPF/MX records for `send.bookmyslot.dental` already exist in the GoDaddy zone from an earlier setup, under a different Resend account). Two problems collided here, not one:

1. `bookmyslot.dental.mossaic.in` is also the **frontend's** custom domain (Render Static Site, see §3a of the GoDaddy doc). It should never be used as an email-sending domain — mixing app hosting and mail sending on the exact same host risks CNAME/record conflicts and is not what was originally documented.
2. The correct, previously-documented convention is to use a **dedicated subdomain for sending only** — `send.bookmyslot.dental.mossaic.in` — which is what the existing SPF/DKIM/MX records in the GoDaddy zone already point to (added under a prior Resend account).

---

## 2. Correct Domain to Use for Resend

Per the existing documented architecture (`godaddy-domain-configuration.md`), the sending subdomain is:

```
send.bookmyslot.dental.mossaic.in
```

Do **not** add the bare `bookmyslot.dental.mossaic.in` or `api.bookmyslot.dental.mossaic.in` hosts to Resend — those are reserved for the frontend and backend respectively.

If records for `send.bookmyslot.dental` already exist in the GoDaddy zone (they do, as of the last zone export — see §2 of the GoDaddy doc) but were created under a **different Resend account/team**, you have two options:

- **Reclaim it under the current Resend account** — add `send.bookmyslot.dental.mossaic.in` in the current Resend project, and when it flags "in use by another team," click **"I've added the records"** after confirming the DNS TXT ownership record. This transfers the domain to the current account and revokes the old team's access (same flow shown when attempting to claim `bookmyslot.dental.mossaic.in`).
- **Recover access to the original Resend account** that already owns these verified records, if it's still under your control (e.g. an earlier `bookmyslot.1.1@...` or team account) — this avoids re-verifying DNS at all.

If starting fresh and neither of the above applies, any unused subdomain works — e.g. `mail-send.bookmyslot.dental.mossaic.in` — as long as it doesn't collide with the frontend/backend hosts.

---

## 3. Records Resend Will Ask You to Add

When you add a domain in Resend, it generates three record types. Example (values are placeholders — always use the exact values Resend shows you for your domain):

| Purpose | Type | Host (relative to root domain) | Value | Notes |
|---|---|---|---|---|
| Domain ownership / DKIM | TXT | `resend._domainkey.<subdomain>` | `p=MIGfMA0GCSq...` (long RSA public key) | Proves you control the domain; enables DKIM signing |
| SPF | TXT | `send.<subdomain>` | `v=spf1 include:amazonses.com ~all` | Authorizes Amazon SES (Resend's backing provider) to send as this domain |
| Bounce/complaint feedback | MX | `send.<subdomain>` | `feedback-smtp.<region>.amazonses.com` (priority 10) | Routes bounce/complaint notifications back to SES — this is not an inbox |

This matches the existing pattern already in the GoDaddy zone for `send.bookmyslot.dental`:

```
MX   send.bookmyslot.dental   10   feedback-smtp.ap-northeast-1.amazonses.com
TXT  send.bookmyslot.dental        v=spf1 include:amazonses.com ~all
TXT  resend._domainkey.bookmyslot.dental   p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCB...
```

> ⚠️ The AWS SES region in the MX value (e.g. `ap-northeast-1`) is assigned by Resend per-domain — always copy it exactly from the Resend dashboard rather than reusing a value from a different domain/account.

---

## 4. Step-by-Step: Adding and Verifying the Domain

1. **In Resend** → Domains → Add Domain → enter `send.bookmyslot.dental.mossaic.in` (or your chosen sending subdomain — never the frontend/backend host).
2. Resend shows the DKIM TXT, SPF TXT, and MX records (see §3 above). Click **"How to add records"** if unsure which DNS host names map to GoDaddy's "Host" field (Resend's full hostnames need the root domain stripped, since GoDaddy hosts are relative — see the Host column convention in `godaddy-domain-configuration.md` §2).
3. **In GoDaddy** → DNS management for `mossaic.in` → Add each record exactly as shown:
   - TXT record for the DKIM selector
   - TXT record for SPF on the `send.*` host
   - MX record for bounce/complaint feedback on the `send.*` host
4. If Resend flags the domain as **"in use by another team"**, this means the DNS records already exist from a prior setup. Click **"I've added the records"** (or the equivalent ownership-verification action) to transfer the domain to the current Resend account. This is safe — it does not delete DNS records, it only changes which Resend account can send through them.
5. Wait for DNS propagation (GoDaddy TTLs here are short — under 1 hour) and confirm all three records show **verified** in Resend.
6. Click **"Enable Sending"** once verification completes.

---

## 5. After Verification — Update the App

Once the domain shows verified in Resend:

1. Set the `EMAIL_FROM` environment variable on the **Render backend service** (`Book-My-Slot-1`) to an address under the verified domain, e.g.:
   ```
   EMAIL_FROM=BookMySlot <bookmyslot@send.bookmyslot.dental.mossaic.in>
   ```
   Never leave this as `onboarding@resend.dev` in production — see §1.
2. Confirm `RESEND=PRODUCTION` and `RESEND_API_KEY` are set on the same service.
3. Redeploy/restart the backend so the new `EMAIL_FROM` is picked up (it is read once at process start in `server/routes.ts`).
4. Test by triggering the admin login OTP flow (`POST /api/auth/admin/login`) and confirming the email lands in the real `ADMIN_EMAIL` inbox, not a test address.

---

## 6. Common Pitfalls

- **Using the frontend or backend custom domain as the sending domain.** Keep email sending on its own dedicated subdomain (`send.*`) — this avoids DNS record collisions with Render's CNAME setup and keeps DKIM/SPF scoped correctly.
- **Leaving `EMAIL_FROM` on `onboarding@resend.dev` in production.** This fails silently — no error is thrown, but delivery is restricted. Always confirm `EMAIL_FROM` matches a verified domain before assuming the RESEND_MODE/API key fix alone resolves delivery.
- **DKIM scope mismatch.** The DKIM selector is tied to the exact subdomain it was issued for (e.g. `resend._domainkey.bookmyslot.dental`). Sending from a different host than the one DKIM was verified for will fail authentication even if SPF passes.
- **Assuming "in use by another team" is an error to work around by picking a different domain.** It usually means you (or a prior developer) already set this domain up under a different Resend account — reclaiming it is normal and expected in that case.
