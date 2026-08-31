# Local Development Setup — BookMySlot

## The Complete Guide to Running the App on Your Own Machine

---

> **Database notice:** The app uses **Supabase PostgreSQL** (not a local database). You need a Supabase project and its connection URL before you can run the app. See [`docs/supabase-database-setup.md`](./supabase-database-setup.md) for the full setup.

---

## 1. Prerequisites

Before starting, make sure you have the following installed on your machine:

| Tool | Version | How to check |
|---|---|---|
| Node.js | v20 or higher | `node --version` |
| npm | v9 or higher | `npm --version` |
| Git | Any recent version | `git --version` |

You do **not** need a local PostgreSQL installation — the app connects to Supabase over the internet.

---

## 2. Clone the Repository and Install Dependencies

```bash
# Clone the project
git clone <your-repo-url>
cd Slot-Notifier

# Install all dependencies
npm install
```

---

## 3. Set Up Your Environment File

The app reads all its configuration from a file called `.env` in the project root. This file is never committed to git (it is gitignored).

```bash
# Copy the example template
cp .env.example .env
```

Then open `.env` in any text editor and fill in the real values. The table below explains every variable and where to find its value.

> For a pre-filled reference file with your own real values stored securely on your machine, see [`docs/local-env-values.md`](./local-env-values.md) — this file is also gitignored and never committed.

---

## 4. Environment Variables — What Each One Means

### Database

| Variable | Placeholder | Where to get it |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres` | Supabase → Project Settings → Database → Connection string → **Direct** tab (for local) |

> **Note:** For local development, the direct Supabase URL (port `5432`) works fine. The pooler URL is only required on Render. See [`docs/supabase-database-setup.md`](./supabase-database-setup.md) Section 4.
>
> If your password contains `@` or other special characters, encode them: `@` → `%40`.

---

### Server

| Variable | Example value | Notes |
|---|---|---|
| `APP_ENV` | `development` | Local development label; deployed Production uses `production` |
| `NODE_ENV` | `development` | Enables the normal Vite/HMR development workflow |
| `PORT` | `5001` | The port your local server listens on |
| `FRONTEND_URL` | `http://localhost:5173` | Used for CORS. Set to `http://localhost:5001` if running in simple mode (one URL) |
| `VITE_API_URL` | `http://localhost:5001` | Tells the frontend where the backend API is |
| `SESSION_SECRET` | *(generate one)* | Long random string used to encrypt login sessions. Generate with: `openssl rand -base64 32` |

---

### Admin Login

| Variable | Example value | Notes |
|---|---|---|
| `ADMIN_EMAIL` | `your@email.com` | The email you use to log into the `/admin` panel |
| `ADMIN_PASSWORD` | *(your password)* | The password for the admin panel |

---

### Email (Resend)

| Variable | Example value | Notes |
|---|---|---|
| `RESEND_API_KEY` | `re_xxxxxxxxxxxxxxxxxxxx` | From [resend.com](https://resend.com) → API Keys |
| `EMAIL_FROM` | `onboarding@resend.dev` | Sender address. Use `onboarding@resend.dev` for local testing |
| `RESEND` | `dev` | Keep as `dev` locally — emails go to test inbox, not real patients |
| `REMINDER_JOB_SECRET` | *(optional)* | Required only to invoke the internal digest job; local execution remains dry-run |

---

### Cloudflare R2 (Image Uploads)

| Variable | Example value | Notes |
|---|---|---|
| `R2_ACCOUNT_ID` | `your-cloudflare-account-id` | Cloudflare dashboard → top-right account ID |
| `R2_ACCESS_KEY_ID` | `your-r2-access-key` | R2 → Manage R2 API Tokens |
| `R2_SECRET_ACCESS_KEY` | `your-r2-secret` | Shown once when creating the API token |
| `R2_BUCKET_NAME` | `app-images` | The name of your R2 bucket |
| `R2_PUBLIC_URL` | `https://pub-xxxx.r2.dev` | R2 bucket → Settings → Public Bucket URL |

> If R2 variables are not set, image uploads are disabled but the rest of the app works normally.

---

### WhatsApp Notifications (Twilio)

| Variable | Example value | Notes |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | `ACxxxxxxxxxxxxxxxxxxxxxxxx` | [console.twilio.com](https://console.twilio.com) → Account Info |
| `TWILIO_AUTH_TOKEN` | `your-auth-token` | Same page as Account SID |
| `TWILIO_WHATSAPP_NUMBER` | `+14155238886` | Twilio sandbox number for local testing |

> If Twilio variables are not set, WhatsApp notifications are silently disabled.

---

### Payments (Razorpay)

| Variable | Example value | Notes |
|---|---|---|
| `RAZORPAY_KEY_ID` | `rzp_test_xxxxxxxxxxxx` | [dashboard.razorpay.com](https://dashboard.razorpay.com) → Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | `your-razorpay-secret` | Same page — shown once |
| `VITE_RAZORPAY_KEY_ID` | Same as `RAZORPAY_KEY_ID` | The frontend needs this to open the payment popup |

> Use `rzp_test_` keys for local testing — no real money is charged.

---

## 5. Sync the Database Schema

Before running the app for the first time (or after any schema change), push the schema to Supabase:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run db:push
```

> The `NODE_TLS_REJECT_UNAUTHORIZED=0` prefix is required because Drizzle Kit opens its own database connection that bypasses the app's SSL configuration. It is safe to use for this one-off CLI command.

---

## 6. Two Ways to Run the App Locally

### Mode A — Development Mode (recommended for active development)

Runs the Vite dev server (frontend) and Express backend together with hot reload. Changes to code reflect immediately without rebuilding.

```bash
npm run dev
```

- App available at: `http://localhost:5000` (or whichever port Vite picks)
- Set `FRONTEND_URL=http://localhost:5000` in your `.env`
- Set `VITE_API_URL=http://localhost:5000` in your `.env`

---

### Mode B — Production Simulation (for testing the compiled build)

This replicates exactly what runs on Render. Compiles the full app and runs the compiled bundle.

```bash
# Step 1 — Build
npm run build

# Step 2 — Run
node dist/index.cjs
```

Or use the helper script which does both in sequence:

```bash
chmod +x run-local.sh
./run-local.sh
```

- App available at: `http://localhost:5001` (or the `PORT` set in your `.env`)
- Set `APP_ENV=development` and `NODE_ENV=production` for this compiled
  Render-style smoke test. The normal `npm run dev` workflow uses
  `APP_ENV=development` and `NODE_ENV=development`.
- Set `FRONTEND_URL=http://localhost:5001` in your `.env`
- Set `VITE_API_URL=http://localhost:5001` in your `.env`

---

### Split Mode — Frontend and Backend on separate ports

This mirrors the Render production setup where frontend and backend have different URLs.

**Terminal 1 — Backend:**
```bash
npm run build
node dist/index.cjs
# Backend runs at http://localhost:5001
```

Set in your `.env`:
```
PORT=5001
FRONTEND_URL=http://localhost:5173
```

**Terminal 2 — Frontend:**
```bash
npx vite
# Frontend runs at http://localhost:5173
```

Ensure `client/.env.local` contains:
```
VITE_API_URL=http://localhost:5001
```

---

## 7. Verify the App is Running

Once started, open these URLs in your browser to confirm everything is working:

| Check | URL | Expected response |
|---|---|---|
| Backend alive | `http://localhost:5001/api/health/backend` | `{"status":"ok"}` |
| Database connected | `http://localhost:5001/api/health/database` | `{"status":"ok","database":true}` |
| Full health | `http://localhost:5001/api/health` | `{"status":"ok","backend":true,"database":true}` |
| App loads | `http://localhost:5001` | BookMySlot landing page |

---

## 8. Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| `DATABASE_URL must be set` | `.env` file missing or not in root | Make sure `.env` exists in the project root (not inside `client/`) |
| `SELF_SIGNED_CERT_IN_CHAIN` during `db:push` | Drizzle Kit SSL conflict | Run with `NODE_TLS_REJECT_UNAUTHORIZED=0 npm run db:push` |
| `ENETUNREACH` connecting to Supabase | Using pooler URL locally with IPv6 DNS | Switch to the direct Supabase URL (port `5432`) locally |
| CORS error in browser | `FRONTEND_URL` mismatch | Make sure `FRONTEND_URL` in `.env` matches the exact URL you open in the browser |
| Port already in use | Another process on the same port | Change `PORT` in `.env` to a different number (e.g. `5002`) |
| `Cannot find dist/index.cjs` | Build not run yet | Run `npm run build` first |
| Admin login fails | Wrong email/password | Check `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` |
| Images not uploading | R2 credentials missing | Add R2 variables to `.env` or accept that uploads are disabled locally |

---

## 9. Useful Commands Reference

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile frontend + backend into `dist/` |
| `node dist/index.cjs` | Run the compiled production server |
| `./run-local.sh` | Build and run in one step |
| `NODE_TLS_REJECT_UNAUTHORIZED=0 npm run db:push` | Push schema changes to Supabase |
| `npm run db:studio` | Open Drizzle Studio (visual database browser) |

---

## 10. Related Documents

| Document | What it covers |
|---|---|
| [`docs/supabase-database-setup.md`](./supabase-database-setup.md) | Supabase project setup, SSL configuration, connection pooler details |
| [`docs/render-environment-setup.md`](./render-environment-setup.md) | All environment variables for Render production deployment |
| [`docs/domain-migration.md`](./domain-migration.md) | Custom domain setup, DNS, CORS |
| [`docs/local-env-values.md`](./local-env-values.md) | Your personal reference file with real values (gitignored) |
