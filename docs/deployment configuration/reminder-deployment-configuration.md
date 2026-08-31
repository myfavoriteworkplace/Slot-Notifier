# Reminder Deployment Configuration

This guide covers the external configuration required for the BookMySlot reminder features to work after deployment.

It covers both reminder surfaces:

1. **Live in-app reminders** for authenticated clinic staff and doctors.
2. **The daily staff digest email** sent by an external scheduler through Resend.

The manual patient WhatsApp reminder and booking SMS notifications are separate features. They are documented near the end of this guide and are not prerequisites for the in-app reminder panel or daily digest.

## Required Reminder Environment Variable

| Environment variable | Set where | Use | Required value |
|---|---|---|---|
| `REMINDER_JOB_SECRET` | Render backend and the external scheduler's secret store | Authenticates the scheduler when it calls `POST /api/internal/reminders/digest` | One strong, identical secret in both places |

The reminder also relies on the application's general environment, including the database, session, frontend URL, production mode, and email settings. Those variables are already maintained in [environment-variables-inventory.md](environment-variables-inventory.md); they are not repeated in this reminder-specific guide.

## 1. How reminders work

The server is the source of truth. It reads current bookings, slots, clinics, and doctors from PostgreSQL and applies the rules in `server/reminder-policy.ts`.

```text
Clinic/doctor dashboard
        |
        | authenticated request with session cookie
        v
GET /api/auth/clinic/reminders
GET /api/doctor/reminders
        |
        v
PostgreSQL -> server-side eligibility and timezone calculation
        |
        v
Live reminder panel

External scheduler
        |
        | POST + x-reminder-job-secret
        v
POST /api/internal/reminders/digest
        |
        v
PostgreSQL claim log -> Resend -> clinic/doctor email
```

There is no in-process timer, worker, `setInterval`, `node-cron` job, or scheduler manifest in this repository. The digest will never run repeatedly until an external scheduler is created.

## 2. Required external services

| Service | Required for | Required configuration |
|---|---|---|
| PostgreSQL, preferably Supabase | All reminder queries, sessions, and digest idempotency | Production connection pooler URL, schema, reminder log table, valid data |
| Render Web Service | Backend API and digest endpoint | Production environment variables, HTTPS public URL, health check |
| Render Static Site | Dashboard reminder panel | Backend API URL exposed as a build-time frontend variable |
| Resend | Daily digest email delivery | API key, verified sending domain, DNS records, sender address |
| External scheduler | Running the daily digest | HTTPS request to the protected digest endpoint and shared secret |

## 3. Decide the production URLs first

Before entering variables, record these values:

```text
BACKEND_URL=https://<backend-host>
FRONTEND_URL=https://<frontend-host>
```

For the current custom-domain pattern these may be:

```text
BACKEND_URL=https://api.bookmyslot.dental.mossaic.in
FRONTEND_URL=https://bookmyslot.dental.mossaic.in
```

Use the actual URLs assigned to the deployment. Both must be HTTPS. Production sessions use `sameSite=none` and `Secure`, so an HTTP frontend or backend will prevent the login cookie from working correctly.

If more than one frontend origin is used, place every origin in the backend `FRONTEND_URL`, separated by commas. Do not include paths or trailing route fragments:

```text
FRONTEND_URL=https://bookmyslot.dental.mossaic.in,https://www.bookmyslot.dental.mossaic.in
```

## 4. Configure the Supabase production database

### 4.1 Create or select the database

1. Open the production Supabase project.
2. Ensure the project is running and reachable from Render.
3. Open **Project Settings -> Database -> Connection string**.
4. Select the **Connection pooler** connection, preferably **Transaction mode** on port `6543`.
5. Copy the PostgreSQL URL and URL-encode special characters in the database password. For example, `@` becomes `%40`.
6. Keep the direct connection string for local administration only. Render should use the pooler hostname and port `6543`.

Set this on the Render backend only:

```text
DATABASE_URL=postgresql://postgres.<PROJECT_ID>:<PASSWORD>@<POOLER_HOST>:6543/postgres
```

The frontend must never receive `DATABASE_URL`.

### 4.2 Apply the application schema

From a trusted environment with the production `DATABASE_URL` loaded:

```bash
npm install
npm run db:push
```

Confirm that the database contains:

- `clinics`
- `doctors`
- `slots`
- `bookings`
- `session`
- `reminder_digest_logs`

The reminder digest table is defined by `migrations/0001_reminder_digest_logs.sql`. It contains a unique index on `(recipient_email, local_digest_date)`, which prevents duplicate sends for the same recipient and local date.

Do not skip this schema step. The live reminder queries need the booking/slot/clinic relationships, authenticated dashboards need the PostgreSQL session table, and the digest needs `reminder_digest_logs` for idempotency.

### 4.3 Load valid reminder data

The application can be technically configured and still show no reminders if its data does not satisfy the policy.

For clinic reminders, each appointment must have:

- A valid slot joined to the clinic.
- A slot that is not cancelled.
- A clinic-local appointment date from today through six days ahead.
- A confirmed booking state accepted by `isConfirmedBooking()`.
- No cancelled, no-show, terminal, completed, or `patient_left_early` visit state.

For doctor reminders, each appointment must additionally have:

- `bookings.assigned_doctor_email` matching the doctor's email.
- `doctor_approval_status` equal to `approved` or `admin_confirmed`.

For daily clinic digest recipients, the clinic must have:

- `status = approved`.
- `is_archived = false`.
- `subscription_status = active`.
- A non-empty, valid clinic email.

Doctors receive a digest only when they have at least one eligible appointment. Their recipient address comes from `doctors.email`.

### 4.4 Set clinic timezones

Set `clinics.timezone` to a valid IANA timezone, such as:

```text
Asia/Kolkata
America/New_York
Europe/London
```

The reminder window is seven **clinic-local calendar dates**:

- `nextThreeDays`: today, tomorrow, and the following day.
- `comingWeek`: local dates three through six.
- Local date seven is excluded.

The browser timezone and the Render server timezone do not control eligibility. Doctors assigned to clinics in different timezones are evaluated per clinic.

## 5. Configure the Render backend service

Open the Render Web Service for the backend, then **Environment**, and add the following variables.

### 5.1 Mandatory backend variables

```text
NODE_ENV=production
DATABASE_URL=<Supabase transaction-mode pooler URL>
SESSION_SECRET=<strong random value>
FRONTEND_URL=<one or more HTTPS frontend origins>
ADMIN_EMAIL=<production administrator email>
ADMIN_PASSWORD=<strong production administrator password>
```

Generate secrets outside source control:

```bash
openssl rand -base64 32
openssl rand -hex 32
```

`SESSION_SECRET` is required at production startup. Changing it logs out all existing users.

`PORT` is injected by Render. Do not hardcode a port in the application or rely on a local `5000` value.

### 5.2 Email and digest variables

Add these to the backend service:

```text
RESEND_API_KEY=re_...
EMAIL_FROM=BookMySlot <noreply@your-verified-sending-domain>
REMINDER_JOB_SECRET=<strong random value>
```

`RESEND_API_KEY` is required for real digest delivery. The digest code enters dry-run mode when `NODE_ENV` is not `production` or this key is absent.

`EMAIL_FROM` should use an address on the domain verified in Resend. The code has a fallback to `onboarding@resend.dev`, but that shared sandbox sender is not suitable for production delivery.

`REMINDER_JOB_SECRET` activates the digest endpoint. Keep it out of the frontend, git, logs, and scheduler URL query strings. The scheduler must send the same value in either of these forms:

```http
x-reminder-job-secret: <REMINDER_JOB_SECRET>
```

or:

```http
Authorization: Bearer <REMINDER_JOB_SECRET>
```

The endpoint returns:

- `200` with job results when authenticated.
- `401` for a wrong or missing secret.
- `503` when `REMINDER_JOB_SECRET` is not configured on the backend.
- `500` when the job encounters an unexpected failure.

### 5.3 `RESEND=PRODUCTION` clarification

Set this backend variable as well:

```text
RESEND=PRODUCTION
```

This is required for the general email flows in `server/routes.ts`, because those flows use it to decide whether recipients are real users or the test inbox.

The daily reminder digest itself currently decides dry-run behavior using `NODE_ENV` and `RESEND_API_KEY`; it does not check `RESEND`. Keeping `RESEND=PRODUCTION` is therefore necessary for the complete application email configuration, but it is not the digest's direct production gate.

## 6. Configure the Render frontend service

Open the Render Static Site for the frontend, then **Environment**, and add:

```text
VITE_API_URL=https://<backend-host>
```

Use the backend origin only, with no API path suffix. Example:

```text
VITE_API_URL=https://api.bookmyslot.dental.mossaic.in
```

This is a build-time variable. After changing it, trigger a new frontend build/deploy. A backend restart alone cannot update the value already compiled into the browser bundle.

The frontend reminder requests use `credentials: "include"`. The backend must therefore:

- Allow the exact frontend origin through `FRONTEND_URL`.
- Serve HTTPS.
- Keep credentialed CORS enabled.
- Keep the production session cookie settings intact.

Do not set `DATABASE_URL`, `SESSION_SECRET`, `RESEND_API_KEY`, or `REMINDER_JOB_SECRET` on the frontend.

## 7. Verify the Resend sending domain

A Resend API key alone is not enough for reliable production email.

1. Create or open the Resend account used by this deployment.
2. Go to **Domains** and add the dedicated sending domain or subdomain.
3. Copy the DNS records Resend provides. These normally include SPF, DKIM, and sometimes a custom return-path/MX record.
4. Add those records at the authoritative DNS provider.
5. Do not create duplicate SPF records for the same host. Merge SPF mechanisms when the DNS provider requires a single TXT record.
6. Wait for DNS propagation and click **Verify** in Resend.
7. Confirm the domain is shown as verified before setting `EMAIL_FROM` to an address under it.
8. Send a test message to an address outside the Resend account and inspect the Resend event log.

For the existing custom-domain convention, review `docs/domain-configuration-checklist/resend-email-domain-verification.md` and `docs/domain-configuration-checklist/godaddy-domain-configuration.md` before changing DNS. The frontend domain and backend API domain are not the email sending domain.

Use a sender such as:

```text
EMAIL_FROM=BookMySlot <noreply@send.example.com>
```

The exact address must match the verified Resend domain policy. Do not use `onboarding@resend.dev` for production recipients.

## 8. Create the external digest scheduler in Supabase

Use Supabase `pg_cron` to schedule the job and `pg_net` to make the HTTPS request to Render. Do not add an in-process timer to the Render Web Service. The database scheduler is independent of Render cold starts and continues to invoke the endpoint when the web service is available.

The complete setup has four parts:

1. Configure the application secret on Render.
2. Enable Supabase extensions.
3. Store the scheduler secret in Supabase Vault.
4. Create and verify the recurring `pg_cron` job.

### 8.1 Configure the application on Render first

In the Render backend Web Service, open **Environment** and add:

```text
REMINDER_JOB_SECRET=<strong-random-secret>
```

Generate the value locally, for example:

```bash
openssl rand -hex 32
```

Copy the same value into Supabase Vault in the next step. Do not put the secret in the frontend, source control, SQL migration files, a URL query parameter, or an unprotected cron command.

The digest also needs the general application configuration already documented in [environment-variables-inventory.md](environment-variables-inventory.md): production mode, database connection, Resend API key, and verified `EMAIL_FROM`. The application-side reminder-specific addition is only `REMINDER_JOB_SECRET`.

After saving the Render variable, restart or redeploy the backend. Until the backend has restarted, the endpoint returns `503` because it has not loaded the secret.

### 8.2 Confirm the backend URL and endpoint

Use the public HTTPS origin of the Render backend, without a trailing slash:

```text
https://<backend-host>
```

The scheduler calls this endpoint:

```http
POST https://<backend-host>/api/internal/reminders/digest
x-reminder-job-secret: <REMINDER_JOB_SECRET>
Content-Type: application/json

{}
```

The endpoint is intentionally not session-authenticated. It accepts the scheduler secret in `x-reminder-job-secret` or as a Bearer token. Use the custom backend domain if one exists, and confirm it resolves to Render over HTTPS.

### 8.3 Enable `pg_cron`, `pg_net`, and Vault

1. Open the Supabase project that owns the production database.
2. Go to **Database -> Extensions**.
3. Enable `pg_cron`.
4. Enable `pg_net`.
5. Confirm Vault is available for the project. Supabase Vault stores encrypted secrets and exposes them to database functions through `vault.decrypted_secrets`.

If an extension is already enabled, leave it enabled. Do not run extension setup against a local database while intending to configure production.

You can also verify the extensions from the Supabase SQL Editor:

```sql
select extname
from pg_extension
where extname in ('pg_cron', 'pg_net', 'supabase_vault')
order by extname;
```

The exact Vault extension name can vary by Supabase project version. The important requirement is that the `vault.create_secret` function and `vault.decrypted_secrets` view are available. If Vault is unavailable on the selected plan, use another Supabase-managed secret mechanism approved for the project; never commit the secret to this repository.

### 8.4 Store `REMINDER_JOB_SECRET` in Supabase Vault

Run this in the Supabase SQL Editor. Replace the placeholder with the same secret saved on Render. Do not save this SQL in the repository or paste the real value into screenshots or tickets.

```sql
select vault.create_secret(
  '<REMINDER_JOB_SECRET>',
  'bookmyslot-reminder-job-secret',
  'Authenticates Supabase pg_cron requests to the Render reminder digest endpoint'
);
```

Check that the named secret exists without selecting the secret value:

```sql
select name, description, created_at, updated_at
from vault.decrypted_secrets
where name = 'bookmyslot-reminder-job-secret';
```

If the secret already exists and must be rotated, create the replacement with a new name, update the cron command to use that new name, test it, and then remove the old Vault secret. Avoid displaying `decrypted_secret` in query results.

### 8.5 Choose the cron time

`pg_cron` uses the database timezone, normally UTC. The application itself calculates each recipient's local date using `clinics.timezone`, but the endpoint does not have a morning-window filter. One invocation processes all eligible recipients in the seven-day window.

Choose a UTC time that is morning for the primary clinic region. For example, `30 3 * * *` runs daily at 03:30 UTC, which is 09:00 in India during standard time. Record the chosen time and review it if the deployment expands to other timezones.

Repeated calls are protected by the database unique index on `(recipient_email, local_digest_date)`, but only the first successful call claims a recipient's digest for that local date. Do not create multiple overlapping schedules until their timezone purpose is understood.

### 8.6 Create the recurring Supabase cron job

First remove a previous job with the same name, if one exists. This makes the setup repeatable and avoids accidentally creating duplicate schedules:

```sql
select cron.unschedule(jobid)
from cron.job
where jobname = 'bookmyslot-reminder-digest';
```

Create the daily job. Replace `<backend-host>` with the real backend hostname and choose the cron expression for the required UTC delivery time:

```sql
select cron.schedule(
  'bookmyslot-reminder-digest',
  '30 3 * * *',
  $$
  select net.http_post(
    url := 'https://<backend-host>/api/internal/reminders/digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reminder-job-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'bookmyslot-reminder-job-secret'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
```

The `cron.schedule` call returns a job ID. Store that ID in the deployment runbook, but do not store the secret with it.

Inspect the saved schedule:

```sql
select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'bookmyslot-reminder-digest';
```

The SQL shown in `cron.job.command` contains the Vault lookup, not the plaintext secret. Confirm that `active` is `true`.

### 8.7 Run a one-time manual scheduler test

Before waiting for the next cron time, call the endpoint manually from a secure terminal. This proves that Render has the application configuration and the secret is correct:

```bash
export REMINDER_JOB_SECRET='<same-value-as-Render-and-Vault>'
curl --fail-with-body --silent --show-error \
  -X POST "https://<backend-host>/api/internal/reminders/digest" \
  -H "Content-Type: application/json" \
  -H "x-reminder-job-secret: ${REMINDER_JOB_SECRET}" \
  --data '{}'
```

Expected result:

```json
{
  "dryRun": false,
  "claimed": 0,
  "sent": 0,
  "skipped": 0,
  "failed": 0
}
```

The counts depend on current eligible clinics, doctors, and bookings. `dryRun` must be `false`. If it is `true`, check `NODE_ENV` and `RESEND_API_KEY` in the Render backend environment using [environment-variables-inventory.md](environment-variables-inventory.md).

### 8.8 Verify Supabase cron execution

After the scheduled time, inspect recent cron and HTTP request results:

```sql
select jobid, status, return_message, start_time, end_time
from cron.job_run_details
where jobid = (
  select jobid
  from cron.job
  where jobname = 'bookmyslot-reminder-digest'
)
order by start_time desc
limit 10;
```

`pg_cron` records whether the SQL command ran. `pg_net` records the HTTP request and response separately. Query recent requests where supported by the project:

```sql
select id, status_code, error_msg, timed_out, created, updated
from net._http_response
order by created desc
limit 10;
```

Do not expose request headers or secret values while investigating. A successful request should have an HTTP `200` response from the digest endpoint. Then check the Render logs for `[REMINDER DIGEST]` activity and the Resend event log for delivered messages.

### 8.9 Test failure and duplicate protection

Run these checks once during setup:

1. Call the endpoint without a secret. It must return `401` after `REMINDER_JOB_SECRET` is configured on Render.
2. Call it with an incorrect secret. It must return `401`.
3. Call it with the correct secret. It must return `200` and `dryRun: false`.
4. Invoke it again for the same local date. Existing recipient claims should be reported as skipped rather than sending duplicate messages.
5. Temporarily disable the cron job with `cron.unschedule(jobid)` only if you need to stop delivery; re-create it with the SQL in section 8.6 when ready.

If a request returns `401`, compare the Render value and Vault value exactly. If it returns `503`, the Render backend does not have `REMINDER_JOB_SECRET` loaded. If it returns `500`, inspect Render logs and the database/Resend configuration.

## 8.10 Final activation checklist

Complete these steps in order after the Vault secret has been created.

### Step 1: Find the real Render backend URL

1. Open the Render dashboard.
2. Select the backend **Web Service**, not the frontend Static Site.
3. Copy the service's public URL from the service overview.
4. Confirm the URL opens with `https://` and identifies the backend API service.
5. If a custom API domain is configured, use that domain instead of the default `onrender.com` hostname.

The URL must be the origin only. Do not add `/api`, `/api/internal`, a trailing slash, or a frontend route. For example:

```text
https://book-my-slot-1.onrender.com
```

### Step 2: Replace `<backend-host>` in the scheduler SQL

In the `cron.schedule` query in section 8.6, replace:

```text
https://<backend-host>/api/internal/reminders/digest
```

with the actual backend endpoint. For example:

```text
https://book-my-slot-1.onrender.com/api/internal/reminders/digest
```

Do not replace `<backend-host>` with the frontend URL. Do not include angle brackets after replacement. Keep the Vault lookup unchanged:

```sql
select cron.schedule(
  'bookmyslot-reminder-digest',
  '30 3 * * *',
  $$
  select net.http_post(
    url := 'https://book-my-slot-1.onrender.com/api/internal/reminders/digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reminder-job-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'bookmyslot-reminder-job-secret'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
```

The hostname above is an example only. Use the hostname copied from your Render service.

### Step 3: Create or replace the recurring job

In the Supabase **SQL Editor**, connected to the production project:

1. Run the following cleanup query. It removes only an existing job with this exact name, so repeated setup does not create duplicate schedules:

```sql
select cron.unschedule(jobid)
from cron.job
where jobname = 'bookmyslot-reminder-digest';
```

2. Run the completed `cron.schedule` query from section 8.6 after replacing the backend hostname.
3. Record the returned `jobid` in your private deployment runbook.
4. Confirm that the job is active:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'bookmyslot-reminder-digest';
```

Expected result: exactly one row with `active = true`.

The example schedule `30 3 * * *` means every day at 03:30 UTC. For clinics in India, this is 09:00 IST. Change the cron expression before creating the job if your primary clinic region needs a different delivery time.

### Step 4: Run the manual `curl` test

Use a secure local terminal. Do not paste the secret into the document or shell history if your environment records commands.

1. Confirm that the value in Render and the value in Vault are identical.
2. Export the secret for this terminal session:

```bash
export REMINDER_JOB_SECRET='<same-secret-configured-in-Render-and-Vault>'
```

3. Call the real backend URL:

```bash
curl --fail-with-body --silent --show-error \
  -X POST "https://book-my-slot-1.onrender.com/api/internal/reminders/digest" \
  -H "Content-Type: application/json" \
  -H "x-reminder-job-secret: ${REMINDER_JOB_SECRET}" \
  --data '{}'
```

Replace `book-my-slot-1.onrender.com` with the actual Render backend hostname. Do not use the frontend hostname.

Expected response:

```json
{
  "dryRun": false,
  "claimed": 0,
  "sent": 0,
  "skipped": 0,
  "failed": 0
}
```

The numbers change when eligible clinics, doctors, and appointments exist. The important checks are:

- HTTP status is `200`.
- `dryRun` is `false`.
- `failed` is `0`.
- `sent` increases when a new eligible recipient has not already been claimed for that local date.

Failure meanings:

| Result | Meaning | Action |
|---|---|---|
| `401` | Secret mismatch or missing header | Compare the Render secret with the Vault secret and header name |
| `503` | Backend did not load `REMINDER_JOB_SECRET` | Save the variable and restart/redeploy the Render backend |
| `500` | Database, Resend, or application failure | Inspect Render logs and the response/error details |
| `dryRun: true` | Backend is not in production mode or lacks `RESEND_API_KEY` | Check the shared variables in `environment-variables-inventory.md` |

### Step 5: Verify the Supabase cron execution

Wait until the configured cron time, then run this in the Supabase SQL Editor:

```sql
select jobid, status, return_message, start_time, end_time
from cron.job_run_details
where jobid = (
  select jobid
  from cron.job
  where jobname = 'bookmyslot-reminder-digest'
)
order by start_time desc
limit 10;
```

Confirm that:

- A recent row exists.
- The status indicates the cron command completed successfully.
- `return_message` does not report a SQL or Vault error.

Then inspect the asynchronous HTTP response recorded by `pg_net`:

```sql
select id, status_code, error_msg, timed_out, created, updated
from net._http_response
order by created desc
limit 10;
```

The latest request for the reminder endpoint should have `status_code = 200`, `error_msg` empty, and `timed_out = false`. If the endpoint is not the latest request, use the `created` timestamp together with Render logs to identify the matching execution. Do not query or export request headers containing the secret.

Also check the Render service logs for the digest request and confirm there is no `[REMINDER DIGEST] Job failed` error.

### Step 6: Verify Resend delivery

1. In Resend, open **Emails** or **Logs**.
2. Find the message sent at the same time as the manual or cron request.
3. Confirm the sender matches the verified `EMAIL_FROM` domain.
4. Confirm the recipient is the expected eligible clinic or doctor.
5. Confirm the event status is **Delivered** rather than rejected, bounced, or suppressed.
6. Check the recipient inbox, including spam/junk, for the subject `Your upcoming BookMySlot appointments`.
7. In Supabase, confirm the corresponding digest claim was recorded:

```sql
select recipient_email, role, local_digest_date, status,
       attempted_at, sent_at, failure_reason
from reminder_digest_logs
order by attempted_at desc
limit 20;
```

For a successful delivery, `status` should be `sent`, `sent_at` should be populated, and `failure_reason` should be empty.

### Step 7: Confirm duplicate protection

Run the manual `curl` request again for the same local date. The endpoint should return `200`, but recipients already claimed by `reminder_digest_logs` should be counted as `skipped` and should not receive a second email.

If the first request had a delivery failure, note that the current unique recipient/date index still prevents another claim for that same date. Follow the failure investigation procedure in the troubleshooting section before making any database correction.

### Option B: Render Cron Job

Create a Render Cron Job that runs once per day and calls the backend endpoint. The job must have access to the same secret, for example through a protected environment variable, and execute a request equivalent to:

```bash
curl --fail-with-body --silent --show-error \
  -X POST "https://<backend-host>/api/internal/reminders/digest" \
  -H "Content-Type: application/json" \
  -H "x-reminder-job-secret: ${REMINDER_JOB_SECRET}" \
  --data '{}'
```

Set the cron job's `REMINDER_JOB_SECRET` to exactly the backend value. Do not put the secret directly in the command if the platform exposes command history or logs.

### Scheduler timing

The endpoint does not implement a morning-window filter. It processes the complete seven-day reminder window whenever it is called. Schedule it at a deliberate UTC time and document that choice for the clinic timezones in scope.

## 9. Deploy and verify in order

1. Set the backend variables in Render.
2. Set the frontend `VITE_API_URL` in Render.
3. Apply the production database schema with `npm run db:push`.
4. Deploy or restart the backend.
5. Build and deploy the frontend so `VITE_API_URL` is compiled into the bundle.
6. Confirm the backend health check:

```bash
curl --fail https://<backend-host>/api/health
```

7. Confirm the protected digest endpoint rejects unauthenticated requests:

```bash
curl -i -X POST https://<backend-host>/api/internal/reminders/digest
```

Expected result: `503` if the backend secret is not set, or `401` when it is set.

8. Run one authenticated scheduler test with the real header:

```bash
curl --fail-with-body --silent --show-error \
  -X POST "https://<backend-host>/api/internal/reminders/digest" \
  -H "x-reminder-job-secret: ${REMINDER_JOB_SECRET}" \
  -H "Content-Type: application/json" \
  --data '{}'
```

Expected response shape:

```json
{
  "dryRun": false,
  "claimed": 0,
  "sent": 0,
  "skipped": 0,
  "failed": 0
}
```

The counts depend on current eligible data. `dryRun` must be `false` in production.

9. Log in as a clinic user and verify the reminder panel calls `/api/auth/clinic/reminders`.
10. Log in as a doctor and verify the reminder panel calls `/api/doctor/reminders`.
11. Create or identify a test appointment inside the next seven clinic-local dates and verify its role-specific visibility.
12. Check the Resend event log and the recipient inbox.
13. Run the scheduler a second time for the same local date. It should not send a duplicate for a recipient already claimed by `reminder_digest_logs`.

## 10. Troubleshooting checklist

### Panel is missing or requests fail

- Confirm the user is authenticated as a clinic owner or doctor; superuser sessions intentionally do not have a reminder scope.
- Confirm `VITE_API_URL` is set on the Static Site, not the backend.
- Redeploy the frontend after changing `VITE_API_URL`.
- Confirm the exact frontend origin appears in backend `FRONTEND_URL`.
- Confirm both URLs use HTTPS so the cross-site session cookie is accepted.
- Inspect the browser network request for `401`, `403`, CORS, or a wrong API hostname.

### Panel is empty

- Confirm the appointment is within local dates 0 through 6, not UTC dates.
- Confirm the slot and clinic joins exist and the slot is not cancelled.
- Confirm the clinic booking confirmation state or doctor approval state required for that role.
- Confirm the booking is not terminal, completed, no-show, cancelled, or `patient_left_early`.
- Confirm `clinics.timezone` is valid.

### Digest endpoint returns `503` or `401`

- `503` means `REMINDER_JOB_SECRET` is missing on the backend.
- `401` means the scheduler value does not exactly match the backend value or is not being sent in the expected header.
- Restart or redeploy the backend after changing its environment variables.

### Digest returns `dryRun: true`

- Confirm `NODE_ENV=production`.
- Confirm `RESEND_API_KEY` is present on the backend service.
- Restart or redeploy after changing either variable.

### Digest claims but email is not received

- Confirm `EMAIL_FROM` belongs to the verified Resend domain.
- Check Resend logs for rejected, bounced, or suppressed messages.
- Confirm the clinic is approved, active, not archived, and has an email.
- Confirm the doctor has at least one eligible appointment.
- Check `reminder_digest_logs` for `status`, `failure_reason`, and `sent_at`.

Important operational detail: a failed digest row is marked `failed`, but the current unique `(recipient_email, local_digest_date)` index prevents a later claim for that same recipient/date. A retry strategy is not currently implemented; investigate the failed row and use a controlled database correction only with an operational runbook.

## 11. Optional SMS and WhatsApp configuration

These are not required for staff in-app reminders or the daily staff digest.

### SMS via Twilio

Set on the backend only:

```text
SMS_NOTIFICATIONS_ENABLED=true
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_MESSAGING_SERVICE_SID=MG...
```

External setup:

1. Create a Twilio Messaging Service.
2. Add an approved sender to its sender pool.
3. Verify destination numbers when using a Twilio trial account.
4. Complete India DLT, sender, and transactional-template requirements before production traffic.
5. Review `docs/notifications/sms-notification-layer.md`.

### WhatsApp

Choose one provider with `WHATSAPP_PROVIDER`.

Twilio:

```text
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=+...
```

Meta Cloud API:

```text
WHATSAPP_PROVIDER=meta
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_VERIFY_TOKEN=...
WHATSAPP_BOOKING_TEMPLATE=booking_received
WHATSAPP_CONFIRM_TEMPLATE=booking_confirmed
WHATSAPP_CONSENT_TEMPLATE=consent_request
```

Zavu:

```text
WHATSAPP_PROVIDER=zavu
ZAVUDEV_API_KEY=zv_live_...
```

Meta requires a configured webhook for `GET /api/whatsapp-webhook` and `POST /api/whatsapp-webhook`, a WhatsApp Business number, a permanent access token, and approved utility templates. Review `docs/notifications/whatsapp-notification-layer.md`.

## 12. Configuration ownership summary

| Item | Where it is configured | Reminder impact |
|---|---|---|
| `DATABASE_URL` | Render backend | Required for all reminder reads and digest claims |
| `SESSION_SECRET` | Render backend | Required for dashboard authentication |
| `FRONTEND_URL` | Render backend | Required for credentialed CORS and digest dashboard links |
| `NODE_ENV=production` | Render backend | Required to enable real digest mode |
| `RESEND_API_KEY` | Render backend | Required for actual digest delivery |
| `EMAIL_FROM` | Render backend | Required for a valid production sender |
| `RESEND=PRODUCTION` | Render backend | Required for other real-recipient email flows |
| `REMINDER_JOB_SECRET` | Render backend and scheduler secret store | Required to authorize the digest scheduler |
| `VITE_API_URL` | Render Static Site | Required for the browser to reach the backend |
| Schema migration | Supabase production database | Required for session and digest persistence |
| Clinic/doctor/booking data | Supabase production database | Determines whether reminders are eligible |
| Resend DNS records | Authoritative DNS provider | Required for sender-domain verification and deliverability |
| Cron schedule | Supabase or Render | Required to invoke the daily digest repeatedly |

## Source files reviewed

- `server/reminder-policy.ts`
- `server/storage.ts`
- `server/reminder-digest.ts`
- `server/routes.ts`
- `server/index.ts`
- `server/db.ts`
- `client/src/lib/queryClient.ts`
- `migrations/0001_reminder_digest_logs.sql`
- `docs/features/booking/12-reminder-module.md`
- `docs/development/render-environment-setup.md`
- `docs/notifications/resend-email-production-setup.md`
- `docs/notifications/sms-notification-layer.md`
- `docs/notifications/whatsapp-notification-layer.md`
