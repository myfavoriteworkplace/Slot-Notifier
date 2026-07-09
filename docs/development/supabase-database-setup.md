# Supabase PostgreSQL Setup — BookMySlot Project

## A Complete Reference: Setup, SSL Troubleshooting, and Render Deployment

---

## 1. Why We Moved to Supabase

The original database was a PostgreSQL instance hosted on Render's free tier. Render's free PostgreSQL databases are **deleted after 90 days of inactivity**, which is unsuitable for a production app. Supabase provides a free-tier PostgreSQL database with no expiry, a web dashboard, and managed SSL — making it a better long-term home for the BookMySlot database.

---

## 2. Supabase Project Details

| Setting | Value |
|---|---|
| Platform | Supabase (managed PostgreSQL) |
| Project Name | `bookmyslot-db` |
| Region | Southeast Asia — Singapore (`ap-southeast-1`) |
| Reason for region | Closest AWS region to Kerala, India for low latency |
| Tier | NANO (Free Tier) |
| Storage | 500 MB |
| Bandwidth | 2 GB/month |
| Backups | Manual export only (no automatic backups on free tier) |
| Connection limit | ~20 direct connections; unlimited via connection pooler |

> **Note:** Consider upgrading to the Pro tier for automatic daily backups and higher connection limits once the app has real patient traffic.

---

## 3. Two Connection Endpoints — Understanding the Difference

Supabase provides two ways to connect to the database. They are **not interchangeable** — each is suited to a different use case.

### Direct Connection
```
Host: db.<project-ref>.supabase.co
Port: 5432
```

- Connects directly to the PostgreSQL server.
- Supports full PostgreSQL protocol including `psql` terminal queries.
- DNS may resolve to an **IPv6 address** on some regions.
- Good for: manual inspection, `psql` terminal, one-off admin queries.
- **Do not use for the Express app on Render** (Render's servers cannot reach IPv6 addresses — see Section 6).

### Connection Pooler (Supavisor)
```
Host: aws-1-ap-southeast-1.pooler.supabase.com
Port: 6543  (Transaction mode)
Port: 5432  (Session mode)
```

- Routes connections through Supabase's pooler (Supavisor), which multiplexes many app connections into fewer real DB connections.
- Always resolves to an **IPv4 address** — works on all hosting platforms including Render.
- Requires **SNI (Server Name Indication)** — standard in all modern HTTP clients and ORMs, but `psql` does not send SNI so `psql` will fail against this endpoint.
- Good for: the Express app, Drizzle ORM, any Node.js production server.

### Transaction vs Session Mode

| Mode | Port | Prepared Statements | Best For |
|---|---|---|---|
| Transaction mode | `6543` | Not supported | Most ORMs including Drizzle |
| Session mode | `5432` | Supported | Apps that use prepared statements |

> Drizzle ORM works correctly with Transaction mode (port `6543`). We use this for Render.

---

## 4. Environment Variables — Where to Use Each URL

Never hardcode database credentials in code. Set them as environment variables in each environment separately.

### Local Development (`.env` file on your machine)
```env
# Used by the Express app and Drizzle ORM locally
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres

# Optional: use for manual psql queries and testing only
DATABASE_URL_DIRECT=postgresql://postgres:YOUR_PASSWORD@db.<project-ref>.supabase.co:5432/postgres
```

### Render Production (set in Render → Web Service → Environment)
```env
# Must use the POOLER URL on Render — the direct URL resolves to IPv6 which Render cannot reach
DATABASE_URL=postgresql://postgres.PROJECT_ID:YOUR_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```

### Password Encoding Rule

If your Supabase password contains special characters (e.g. `@`, `#`, `!`), they must be **percent-encoded** in the URL or the connection will silently fail with a parse error.

Common encodings:

| Character | Encoded As |
|---|---|
| `@` | `%40` |
| `#` | `%23` |
| `!` | `%21` |
| `$` | `%24` |
| `&` | `%26` |
| `+` | `%2B` |
| Space | `%20` |

Example: if your password is `MyPass@2024!`, the URL becomes:
```
postgresql://postgres:MyPass%402024%21@...
```

---

## 5. SSL Troubleshooting — Full Root Cause Analysis

Connecting to Supabase from Node.js involves SSL. This caused several errors during the migration. Here is a full account of each issue, what caused it, and exactly how it was fixed.

---

### Issue 1 — `SELF_SIGNED_CERT_IN_CHAIN` (Local Development)

**Error message:**
```
Error: self-signed certificate in certificate chain
code: 'SELF_SIGNED_CERT_IN_CHAIN'
```

**What it means:** Node.js attempted an SSL handshake with Supabase's database server, but rejected one of the certificates in the chain because it could not verify the chain back to a trusted root authority.

**Root cause (the subtle part):** The original `server/db.ts` code was:
```typescript
ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
```

The intention was to disable cert verification in production. But there was a **silent conflict**:

The connection string also contained `?sslmode=require`. In **pg v8+** (the Node.js PostgreSQL driver), when `sslmode=require` is present in the connection string, the driver internally sets `rejectUnauthorized: true` at the TLS level. This **overrides** the `{ rejectUnauthorized: false }` set in the Pool config — silently, with no warning.

The result: cert verification was always enabled regardless of what the Pool config said.

**The fix applied to `server/db.ts`:**

Strip `sslmode` from the connection string entirely, and let the Pool's `ssl` option be the single source of truth:

```typescript
// Strip sslmode from the connection string to prevent pg v8+ from
// overriding the Pool ssl config. The Pool ssl object below is the
// single source of truth for SSL behaviour.
const connectionString = process.env.DATABASE_URL
  .replace(/([?&])sslmode=[^&]*/g, "$1")  // remove sslmode=... param
  .replace(/[?&]$/, "");                   // clean up trailing ? or &

// Enable SSL without cert verification for any remote database.
// Local Postgres (localhost / 127.0.0.1) does not need SSL.
const isLocalDb =
  connectionString.includes("localhost") ||
  connectionString.includes("127.0.0.1");

export const pool = new Pool({
  connectionString,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
});
```

This approach:
- Works on local machine (Supabase), Render (Supabase pooler), and any other remote PostgreSQL host.
- Does not interfere with local Postgres (no SSL applied).
- Survives any `sslmode=` value in the incoming `DATABASE_URL` (it is stripped before passing to pg).

---

### Issue 2 — `ENOIDENTIFIER` when using `psql` with the pooler

**Error message:**
```
psql: error: connection to server ... failed: FATAL: ENOIDENTIFIER
```

**What it means:** The pooler requires SNI (Server Name Indication) so it knows which Supabase project you are connecting to. The `psql` terminal client does not send SNI.

**Fix:** Use the **direct DB host** for `psql`:
```bash
psql "postgresql://postgres:YOUR_PASSWORD@db.<project-ref>.supabase.co:5432/postgres"
```
The pooler is only needed for the Express app and ORM. Use the direct host for all terminal / manual inspection work.

---

### Issue 3 — Running Drizzle migrations against Supabase

When running `npm run db:push` locally, you may get the same `SELF_SIGNED_CERT_IN_CHAIN` error because Drizzle Kit opens its own pg connection (separate from the app's pool) and does not pick up the Pool SSL config.

**Fix for running migrations locally:**
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run db:push
```

This disables TLS cert rejection for the duration of that one command only. It is safe for a one-time CLI operation.

> Do **not** add `NODE_TLS_REJECT_UNAUTHORIZED=0` permanently to your `.env` or server code — it disables TLS verification for all outbound connections in the process (Resend API, Twilio, etc.), not just the database.

---

## 6. Render IPv6 Issue — `ENETUNREACH`

**Error message (seen in Render logs):**
```
connect ENETUNREACH 2406:da18:1f7e:b102:62c9:8782:283d:ef5c:5432
```

**What it means:** Render's server infrastructure does **not support outbound IPv6 connections**. When the Direct Connection URL (`db.<project-ref>.supabase.co:5432`) is used, DNS resolves it to an IPv6 address in the Singapore region. Render's server immediately fails because it cannot route IPv6 traffic.

**This is not an SSL problem — it is a network routing problem.** No code change can fix it.

**Fix:** Use the **Pooler URL** as `DATABASE_URL` in Render's environment variables. The pooler hostname (`aws-1-ap-southeast-1.pooler.supabase.com`) always resolves to an IPv4 address, which Render's infrastructure can reach without issue.

| Environment | URL to use | Why |
|---|---|---|
| Local machine | Either URL works | Your machine supports IPv6 |
| Render deployment | Pooler URL only | Render has no IPv6 egress |

---

## 7. Drizzle Config

`drizzle.config.ts` uses `DATABASE_URL` directly. Since the Pool code in `server/db.ts` strips `sslmode` at runtime, and Drizzle Kit is a separate CLI tool, make sure you use `NODE_TLS_REJECT_UNAUTHORIZED=0` when pushing schema changes:

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

Migration command:
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run db:push
```

---

## 8. Best Practices Checklist

- [x] Use the **pooler URL** for Drizzle ORM and the Express app — not the direct URL.
- [x] Use the **direct URL** only for `psql` terminal access and one-off queries.
- [x] **Percent-encode** any special characters in the database password inside the URL.
- [x] Strip `sslmode=` from the connection string in app code and set `ssl: { rejectUnauthorized: false }` in the Pool config — do not do both at the same time (pg v8+ conflict).
- [x] Use `NODE_TLS_REJECT_UNAUTHORIZED=0` only for CLI migration commands, never in server code.
- [x] Store credentials only in `.env` (local) and Render environment variables (production) — never in source code.
- [x] Rotate your database password if it was ever shared or exposed (e.g. pasted in a chat or committed to git).
- [ ] Upgrade to Supabase Pro for automatic daily backups once the app has live patient data.
- [ ] Monitor **Connections** in the Supabase dashboard — the free tier has a limited connection pool.

---

## 9. Quick Reference — Connection String Formats

```
# Direct connection (local psql testing only)
postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres

# Pooler — Transaction mode (app / Drizzle / Render)
postgresql://postgres.PROJECT_ID:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres

# Pooler — Session mode (if prepared statements are needed)
postgresql://postgres.PROJECT_ID:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

Replace `PASSWORD` with your percent-encoded password, `PROJECT_REF` with your Supabase project reference ID (shown in Project Settings), and `PROJECT_ID` with your project ID (shown in the pooler connection string in the Supabase dashboard).

---

## 10. Summary

| Problem | Root Cause | Fix |
|---|---|---|
| `SELF_SIGNED_CERT_IN_CHAIN` on local | `sslmode=require` in URL overrides `rejectUnauthorized: false` in pg v8+ | Strip `sslmode` from URL; use Pool `ssl` object only |
| `SELF_SIGNED_CERT_IN_CHAIN` during migrations | Drizzle Kit opens its own connection outside Pool config | Run migrations with `NODE_TLS_REJECT_UNAUTHORIZED=0` |
| `ENOIDENTIFIER` with psql on pooler | psql does not send SNI required by Supabase pooler | Use direct DB host for psql |
| `ENETUNREACH` on Render | Direct DB URL resolves to IPv6; Render cannot route IPv6 | Use pooler URL on Render |
