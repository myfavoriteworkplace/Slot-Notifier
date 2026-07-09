# Code Quality & Performance

This document covers local-only developer tooling for profiling and improving the performance of the BookMySlot backend. Everything here runs **only on your local machine during development** — none of it affects the production server, the Replit workflow, or any deployed environment.

---

## Node Clinic

### What It Is

Node Clinic is a free, open-source profiling toolkit built specifically for Node.js backends. It wraps your server process, records what it is doing while it runs, then generates a visual HTML report when you stop it. It helps you find:

- Parts of the code that slow down the server response time
- Functions that use too much CPU
- Memory that is never released (memory leaks)
- Async operations (database calls, promises) that are queuing up and blocking each other

It is purely a **diagnostic tool** — it reads your running server and reports findings. It never modifies your code and has zero impact on production.

---

### The Four Tools

#### Clinic Doctor
The general health check. Records event loop delay, CPU usage, and memory usage over time and automatically flags which category the problem falls into. Best starting point — run this first when the server feels slow or unresponsive.

#### Clinic Flame
Generates a flamegraph — a stacked bar chart where each bar is a function call and its width represents how long it was on the CPU. Lets you see exactly which function (and which file/line) is responsible for CPU time. Use this when Doctor flags a CPU issue.

#### Clinic Bubbleprof
Visualises async activity as bubbles connected by lines. Each bubble is a group of async operations (e.g. a database query, a promise chain). Wide connections between bubbles mean delays. Use this when Doctor flags event loop delay or slow async behaviour — for example, a slow PostgreSQL query or a long-running Twilio/Resend call.

#### Clinic Heap (bonus)
Snapshots JavaScript heap memory at intervals and compares them. Shows which objects are accumulating and not being garbage collected. Use this if you suspect a memory leak (server memory grows over hours/days without coming back down).

---

### What Changed in This Project

Three npm scripts were added to `package.json`. They are **only ever run manually** — they never execute during `npm run dev`, `npm run build`, `npm run start`, or the Replit workflow.

```json
"clinic:doctor":     "npm run build && clinic doctor -- node dist/index.cjs",
"clinic:flame":      "npm run build && clinic flame -- node dist/index.cjs",
"clinic:bubbleprof": "npm run build && clinic bubbleprof -- node dist/index.cjs"
```

**Why compile first instead of running TypeScript directly?**  
The standard guide uses `node server.js` against plain JavaScript. This project is TypeScript. After trying two TypeScript-on-the-fly approaches (`--loader tsx/esm` and `--import tsx/esm`), both failed on Node v20 for different reasons:

- `--loader tsx/esm` — deprecated in Node v20.6.0; tsx v3+ throws a hard error and refuses to run
- `--import tsx/esm` — works for normal development, but Clinic v11 + Node v20 + `--import` ESM hooks are incompatible: Node spins up a separate internal worker thread for ESM module registration, which interferes with Clinic's trace event collector. The `traceevent` file is never written, so no HTML report is ever produced

The reliable solution is to compile the TypeScript to JavaScript first (`npm run build` → `dist/index.cjs`) and profile the compiled output directly with plain `node`. No loaders, no ESM hooks, no worker threads — exactly what Clinic was designed for. Each clinic script now runs `npm run build` automatically before profiling, so you never need to remember to build manually.

**`.clinic/` is git-ignored**  
When Clinic finishes a run it writes an HTML report into a `.clinic/` folder at the project root. This folder is added to `.gitignore` so reports never get committed.

---

### Troubleshooting — Issues We Hit During Setup

These are real problems encountered when setting up Clinic on this project, documented here so you don't hit them again.

---

#### Issue 1 — VS Code Debugger Interfering (server never starts)

**What you see**
```
Debugger listening on ws://127.0.0.1:xxxxx/...
Debugger attached.
> clinic doctor -- node --import tsx/esm server/index.ts
Debugger listening on ws://127.0.0.1:xxxxx/...
Debugger attached.
Waiting for the debugger to disconnect...
Waiting for the debugger to disconnect...
```
The server never reaches `[express] Server listening on port 5000`. The process just hangs or exits silently.

**Why it happens**  
VS Code has a feature called **Node.js Auto Attach** that automatically hooks a debugger into every Node process you start from the VS Code integrated terminal. When Clinic runs, it spawns a child Node process and instruments it from the outside. VS Code then also tries to attach a debugger to that same child process. The two conflict — the child process stalls waiting for the debugger to release it, and Clinic never gets to profile anything.

**Fix — disable Auto Attach for the terminal session**

Press `Ctrl+Shift+P` in VS Code, type `Toggle Auto Attach`, and set it to **Disabled**.

Then open a **new terminal tab** (important — the existing tab still has the old setting) and run your clinic command from there:

```bash
npm run clinic:doctor
```

The server will now boot normally and Clinic will profile it cleanly.

**To re-enable Auto Attach afterwards**

`Ctrl+Shift+P` → `Toggle Auto Attach` → set back to **Smart** (recommended) or **Always**.

**Alternative — use a system terminal outside VS Code**  
Open iTerm2, Terminal.app (macOS), or Windows Terminal — any terminal that is not the VS Code integrated terminal. Navigate to the project folder and run the clinic command from there. VS Code's debugger never attaches to external terminals, so this always works regardless of the Auto Attach setting.

---

#### Issue 2 — `traceevent` File Missing / No HTML Report Generated

**What you see**  
After pressing `Ctrl+C`, no HTML file appears. The `.clinic/` folder contains a numbered subfolder (e.g. `.clinic/96698.clinic-doctor/`) with only two raw files inside — `clinic-doctor-processstat` and `clinic-doctor-systeminfo` — but no `traceevent` file and no `.html` report.

Trying `--visualize-only` gives:
```
Error: ENOENT: no such file or directory, open '.clinic/96698.clinic-doctor/96698.clinic-doctor-traceevent'
```

**Why it happens**  
The `traceevent` file is written by Node.js's built-in trace collection system. Clinic activates it by injecting `--trace-event-categories` flags into your node process at startup. If that file never appears — even after a full run with traffic — it means trace collection never initialised at all.

This is a known incompatibility: **Clinic v11 + Node v20 + `--import` ESM loader hooks**. When `--import tsx/esm` is used, Node v20 spins up a separate internal worker thread to handle ESM module registration. This happens at a level that prevents Clinic from attaching its trace collector before the process starts. Result: `processstat` and `systeminfo` are written (they don't need the trace system) but `traceevent` is never created.

The `--visualize-only` recovery trick only works when `traceevent` was actually collected. Folders missing that file cannot be recovered.

**Fix — already applied**  
The clinic scripts in `package.json` were updated to compile TypeScript first and profile the plain JavaScript output instead:

```bash
npm run build && clinic doctor -- node dist/index.cjs
```

Plain `node dist/index.cjs` gives Clinic a clean process with no ESM hooks, no worker threads, and no loaders — exactly what it needs to write the `traceevent` file correctly. The HTML report will open automatically after `Ctrl+C`.

**Recovery for incomplete `.clinic/` folders**  
The old numbered folders (e.g. `96185`, `96481`, `96698`) that are missing `traceevent` cannot be visualised. You can safely delete them:

```bash
rm -rf .clinic/
```

Then run a fresh session with the updated scripts.

---

#### Issue 3 — `--loader` Flag Rejected on Node v20+

**What you see**
```
Error: tsx must be loaded with --import instead of --loader
The --loader flag was deprecated in Node v20.6.0 and v18.19.0
Node.js v20.19.4
```

**Why it happens**  
Node.js deprecated the `--loader` flag in v20.6.0. The tsx package (v3+) detects this and actively throws an error rather than silently using the old behaviour. The scripts originally used `--loader tsx/esm` which worked on older Node versions but fails on v20+.

**Intermediate fix (led to Issue 2)**  
Scripts were updated from `--loader tsx/esm` to `--import tsx/esm`. This stopped the error but introduced the `traceevent` incompatibility described in Issue 2 above.

**Final fix — already applied**  
Both `--loader` and `--import` approaches were abandoned. The scripts now compile TypeScript first and profile the plain JavaScript output:

```bash
# First attempt (broken — --loader deprecated on Node v20)
clinic doctor -- node --loader tsx/esm server/index.ts

# Second attempt (broken — traceevent never written with --import on Node v20)
clinic doctor -- node --import tsx/esm server/index.ts

# Final working version
npm run build && clinic doctor -- node dist/index.cjs
```

This is already applied in the current `package.json` — no action needed.

---

### Where to Find the Results

When you press `Ctrl+C` to stop the server, Clinic processes the collected data and:

1. **Automatically opens the HTML report** in your default browser — you don't need to do anything
2. **Prints the full file path** in the terminal, for example:
   ```
   Generated HTML file is file:///Users/yourname/.../Slot-Notifier/.clinic/12345.clinic-doctor.html
   ```
3. If the browser doesn't open automatically, copy that path from the terminal and paste it directly into any browser address bar

All reports are saved in the **`.clinic/` folder** at the project root. Each run creates a new numbered file so old reports are never overwritten. The folder is git-ignored so these files stay on your local machine only.

---

### One-Time Local Setup

Do this once on your own development machine. None of these steps touch the server or Replit.

**1. Install Clinic globally**

```bash
npm install -g clinic
```

This installs the `clinic` command on your machine. It is not added to the project's `package.json` — it lives in your global npm folder.

**2. Verify the install**

```bash
clinic --version
```

You should see a version number like `13.x.x`.

**3. Confirm `.clinic/` is in `.gitignore`**

Open `.gitignore` and check that `.clinic/` is listed. If it is not there, add it:

```
.clinic/
```

---

### How to Run Each Tool

Make sure you are running these commands from the project root on your **local machine**, not inside Replit. Use `NODE_ENV=development` (already set by the scripts).

**Clinic Doctor — general health check**

```bash
npm run clinic:doctor
```

1. TypeScript is compiled first (~5 seconds) — you will see build output in the terminal.
2. Your server starts on port 5000 — wait until you see `[express] Server listening on port 5000`.
3. Open the app in a browser and use it actively for at least 30–60 seconds — log in, navigate pages, trigger bookings. This generates the trace data.
4. Press `Ctrl+C` to stop the server.
5. Clinic processes the data and **automatically opens the HTML report** in your default browser.
6. If it doesn't open automatically, the file path is printed in the terminal — copy and paste it into any browser.

**Clinic Flame — CPU flamegraph**

```bash
npm run clinic:flame
```

Same flow as above. The output is a flamegraph HTML file. The widest bars at the top are the most expensive functions. Click any bar to zoom into that call stack.

**Clinic Bubbleprof — async bottlenecks**

```bash
npm run clinic:bubbleprof
```

Same flow. The output shows async operations as bubbles. Hover over a bubble to see which part of your code triggered that async chain (e.g. a specific route handler making a database call).

**Clinic Heap — memory leak detection**

Clinic Heap is not in `package.json` yet but you can run it directly if needed:

```bash
npm run build && clinic heap -- node dist/index.cjs
```

Let it run for several minutes while sending traffic, then stop it. Look for objects whose count keeps growing.

---

### How to Read the Reports

| What you see | What it means | Where to look in code |
|---|---|---|
| Event loop delay spikes (red in Doctor) | Something is blocking the main thread | Synchronous operations in route handlers — `JSON.parse` on large payloads, heavy loops |
| High CPU (yellow in Doctor) | A function is doing too much computation | Run Flame next to find the specific function |
| Memory keeps growing (Doctor) | Possible memory leak | Run Heap next; check for event listeners not being removed or large arrays held in module scope |
| Fat bubbles with long connections (Bubbleprof) | Slow async chain | Usually a slow DB query or an external API call (Resend, Twilio, R2); add query indices or cache the result |
| Wide bars at top of flamegraph (Flame) | Most expensive functions | Check if they can be cached, moved off the hot path, or run less often |

---

### Important Limits

- **Server-side only.** Clinic profiles the Express backend process. It tells you nothing about React rendering speed or frontend bundle size. For frontend performance, use Chrome DevTools → Performance tab or Lighthouse.
- **Local machine only.** Never run `npm run clinic:*` on the production server or inside the Replit deployment — it would instrument and slow down live user traffic.
- **Short test runs are best.** Run Clinic for 30–120 seconds while reproducing the slow scenario. Longer runs generate very large report files.
- **Reports are local.** The `.clinic/` folder is git-ignored. Reports live only on your machine.

---

## Autocannon

### What It Is

Autocannon fires a continuous stream of HTTP requests at your local server and measures how it responds under load. You control how many users to simulate and for how long. When it finishes it prints a table showing latency (how long each request took) and throughput (how many requests per second your server handled).

It answers questions like: "Can my server handle 30 users checking slot availability at the same time?" or "Does the Smile Deals page slow down under load?"

It is purely a client-side tool — it makes HTTP calls and records timings. It never reads your code, never modifies files, and has no idea whether it is talking to a local or production server. Safety comes entirely from always pointing it at `http://localhost:5000` — as long as you do that, it is physically impossible for it to affect your deployed app or Replit environment.

---

### One-Time Setup

```bash
npm install -g autocannon
```

Global install on your local machine — not added to the project's `package.json`. Verify it worked:

```bash
autocannon --version
```

---

### Important: Start the Server First

Unlike Clinic (which wraps and starts the server for you), Autocannon connects to an **already-running server**. You need two terminal windows open at the same time:

- **Terminal 1** — start the server and leave it running:
  ```bash
  npm run dev
  ```
  Wait until you see `[express] Server listening on port 5000` before moving to Terminal 2.

- **Terminal 2** — run your autocannon commands here

---

### Key Flags

| Flag | What it does | Example |
|---|---|---|
| `-c` | Number of concurrent connections (simulated users) | `-c 20` |
| `-d` | Duration in seconds | `-d 20` |
| `-m` | HTTP method | `-m POST` |
| `-H` | Add a request header | `-H "Content-Type: application/json"` |
| `-b` | Request body | `-b '{"key":"value"}'` |
| `--json` | Output results as JSON instead of a table | `--json` |

---

### Tests to Run — Your Real Endpoints

These use the actual API endpoints in this project. Run each command in Terminal 2 while the server is running in Terminal 1.

---

**Test 1 — Baseline health check**

The fastest possible endpoint — no database, no logic. Use this to establish your baseline. If this is slow, something is wrong at the server level before any of your code runs.

```bash
autocannon -c 10 -d 10 http://localhost:5000/api/health
```

Expected: p99 under 5ms. If it's over 20ms, investigate the server startup and middleware chain.

---

**Test 2 — Public clinic listing**

The endpoint that loads the list of clinics patients see. Hits the database.

```bash
autocannon -c 20 -d 20 http://localhost:5000/api/public/clinics
```

Expected: p99 under 80ms. This is a simple SELECT so it should be fast.

---

**Test 3 — Smile Deals gallery**

The public Smile Deals page. Hits the database and returns image URLs and deal metadata.

```bash
autocannon -c 20 -d 20 http://localhost:5000/api/smile-deals
```

Expected: p99 under 100ms.

---

**Test 4 — Slot availability check**

The most frequently hit endpoint — every patient checks this before booking. Replace `1` with a real clinic ID from your local database.

```bash
autocannon -c 30 -d 20 "http://localhost:5000/api/public/clinic-availability?clinicId=1"
```

Expected: p99 under 150ms. If it creeps above 400ms under 30 users, the slot query likely needs a database index.

---

**Test 5 — Notifications polling**

This endpoint is called on every page load for every logged-in user. It quietly hits the database on a loop. Worth testing because notification volume grows over time.

```bash
autocannon -c 10 -d 15 http://localhost:5000/api/notifications
```

Expected: p99 under 50ms. If it's slow, check whether old notifications are being cleaned up.

---

**Test 6 — OTP send (rate limiting check)**

A POST endpoint that should be well-protected. Useful for verifying that hammering it doesn't cause errors or crashes.

```bash
autocannon -c 5 -d 10 -m POST \
  -H "Content-Type: application/json" \
  -b '{"email":"test@example.com","clinicId":1}' \
  http://localhost:5000/api/public/otp/send
```

Expected: consistent responses (even if they are 400 or 429 errors). What you don't want to see is crashes (500 errors) or the server becoming unresponsive.

---

### How to Read the Output Table

After autocannon finishes you will see something like this:

```
┌─────────┬──────┬──────┬───────┬──────┬─────────┬─────────┬──────────┐
│ Stat    │ 2.5% │ 50%  │ 97.5% │ 99%  │ Avg     │ Stdev   │ Max      │
├─────────┼──────┼──────┼───────┼──────┼─────────┼─────────┼──────────┤
│ Latency │ 8 ms │ 12ms │ 34 ms │ 52ms │ 13.4 ms │ 6.21 ms │ 210.3 ms │
└─────────┴──────┴──────┴───────┴──────┴─────────┴─────────┴──────────┘
┌───────────┬─────────┬─────────┬─────────┬────────┬─────────┬───────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%  │ Avg     │ Stdev     │
├───────────┼─────────┼─────────┼─────────┼────────┼─────────┼───────────┤
│ Req/Sec   │ 412     │ 450     │ 521     │ 580    │ 510.4   │ 42.3      │
└───────────┴─────────┴─────────┴─────────┴────────┴─────────┴───────────┘
```

| Column | What it means |
|---|---|
| **2.5%** | The fastest 2.5% of requests — your best-case response time |
| **50% (p50)** | Half of all requests finished within this time — your typical response time |
| **97.5% (p97.5)** | 97.5% of requests finished within this — what most users experience |
| **99% (p99)** | 99% of requests finished within this — your worst-case for normal users |
| **Max** | The single slowest request in the entire run — could be a one-off spike |
| **Avg** | Mathematical average — less useful than p99 because outliers skew it |
| **Stdev** | How consistent the server is — a high Stdev means very uneven response times |
| **Req/Sec** | Requests completed per second — your throughput |
| **Errors** | Any non-2xx responses — if this is non-zero, investigate immediately |

**The number to watch most: p99.** If your p99 latency is acceptable, 99% of your real users are getting a good experience. The Max column tells you about rare spikes, which are often unavoidable (garbage collection, cold DB connections).

---

### What Good vs Bad Looks Like for This Project

| Endpoint | Healthy p99 | Needs investigation | Action |
|---|---|---|---|
| `/api/health` | < 5ms | > 20ms | Check Express middleware overhead |
| `/api/public/clinics` | < 80ms | > 300ms | Add DB index or cache the result |
| `/api/smile-deals` | < 100ms | > 400ms | Add DB index on `is_active`, `expires_at` |
| `/api/public/clinic-availability` | < 150ms | > 400ms | Add composite index on `clinic_id` + `date` |
| `/api/notifications` | < 50ms | > 200ms | Check query filters; archive old notifications |

---

### Combine Autocannon with Clinic Doctor

Clinic Doctor has a built-in `--autocannon` flag that runs both tools simultaneously — Clinic profiles the server internals while Autocannon generates realistic load. This is the most powerful combination: you see exactly what the server is doing (flamegraph, event loop) while it is under real pressure.

```bash
npm run build

clinic doctor --autocannon [ -c 20 -d 30 /api/public/clinics ] -- node dist/index.cjs
```

The URL path after the flags is relative — Clinic fills in `http://localhost:<PORT>` automatically. Press `Ctrl+C` when done and both the Clinic HTML report and the autocannon summary will be generated.

---

### Automated Benchmark Runner

Instead of running each endpoint test manually one by one, a benchmark script runs all safe read-only endpoints sequentially and prints a combined summary table.

**Run it:**

```bash
# Terminal 1 — start the server and leave it running
npm run dev

# Terminal 2 — run the full benchmark suite
npm run benchmark
```

The script checks the server is reachable before starting. If it cannot connect it prints a clear error and exits — it will not silently hang.

**What gets tested automatically:**

| Endpoint | Connections | Duration |
|---|---|---|
| `GET /api/health` | 10 | 10s |
| `GET /api/health/database` | 10 | 10s |
| `GET /api/public/clinics` | 20 | 15s |
| `GET /api/smile-deals` | 20 | 15s |
| `GET /api/public/clinic-availability?clinicId=1` | 20 | 15s |
| `GET /api/notifications` | 10 | 10s |

POST endpoints and authenticated endpoints are intentionally excluded — they cause side effects (sending emails, creating records) and require session cookies that the script cannot provide.

**Example output:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  BookMySlot API Benchmark — 22/05/2026, 15:30:00
  Server : http://localhost:5000
  Config : 20 connections · 15s per endpoint
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Endpoint                                   p50     p99     Req/s   Status
  ────────────────────────────────────────────────────────────────────────
  GET /api/health                            2ms     4ms     4821    ✅ PASS
  GET /api/health/database                   4ms     12ms    1820    ✅ PASS
  GET /api/public/clinics                    18ms    52ms    890     ✅ PASS
  GET /api/smile-deals                       24ms    71ms    742     ✅ PASS
  GET /api/public/clinic-availability        45ms    198ms   380     ✅ PASS
  GET /api/notifications                     8ms     23ms    2100    ✅ PASS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Results saved → .benchmarks/2026-05-22T15-30-00.json
```

**Status icons:**

| Icon | Meaning |
|---|---|
| ✅ PASS | p99 is within the defined threshold for that endpoint |
| ⚠️ SLOW | p99 exceeded the threshold — worth investigating |
| ❌ FAIL | p99 is more than 2× the threshold — needs immediate attention |

The script exits with code `1` if any endpoint is SLOW or FAIL, and code `0` if all pass. This means you can optionally plug it into a CI pipeline later.

**Saved results:**  
Every run saves a timestamped JSON file to `.benchmarks/` at the project root. The folder is git-ignored so files stay local. Compare results across runs to catch regressions — if the p99 for `/api/public/clinics` was 52ms last week and is 310ms today, something changed.

---

### What Autocannon Does NOT Test

- **Frontend rendering** — it only hits API endpoints, not React components. Use Lighthouse for frontend performance.
- **WebSocket connections** — autocannon is HTTP only.
- **File uploads** — multipart form data needs a different tool (e.g. k6).
- **End-to-end user journeys** — autocannon hits one endpoint per run. For testing a full flow (login → check slots → book → confirm), use k6.

---

## Sentry — Frontend Error Tracking

### What It Is

Sentry automatically captures every unhandled JavaScript error that occurs in the React frontend and sends it to your Sentry dashboard at sentry.io. For each error you get:

- The full stack trace with exact file and line number
- The sequence of user actions leading up to the crash (breadcrumbs)
- The React component tree at the time of the error
- Browser, OS, and screen size of the affected user
- How many users were affected and how often it happens

It runs silently in the background. If Sentry's servers are unreachable for any reason, it fails silently and the app continues normally — it never blocks rendering or crashes the page.

---

### What Was Set Up

**Package installed:** `@sentry/react`

**File changed:** `client/src/main.tsx` — Sentry is initialised once before the React root renders. No other frontend files were touched.

```tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://9c45bd62145b7da0216f4d5a358521d5@o4511434421567488.ingest.de.sentry.io/4511434452697168",
  environment: import.meta.env.MODE,   // "development" or "production"
  enabled: import.meta.env.PROD,       // only active in production builds
  tracesSampleRate: 0.1,               // traces 10% of page loads for performance
});
```

**React ErrorBoundary added:** the `<App />` component is wrapped with `<Sentry.ErrorBoundary>`. If the entire React tree crashes, instead of a blank white screen the user sees a fallback message, and Sentry captures the full error automatically.

---

### Key Configuration Decisions

**`enabled: import.meta.env.PROD`**  
Sentry only activates when the app is running as a production build. During local development (`npm run dev`) it is completely inactive — no events are sent, no network calls are made. This prevents development errors and test noise from polluting your Sentry dashboard.

**`environment: import.meta.env.MODE`**  
Tags every error with the environment (`"development"` or `"production"`). Useful if you ever enable Sentry in staging or preview builds — errors from different environments are filterable in the dashboard.

**`tracesSampleRate: 0.1`**  
Captures performance traces for 10% of page loads (navigation timing, React rendering). Kept low to avoid using up your Sentry performance quota. Can be raised to `1.0` temporarily for detailed profiling, then lowered again.

**`sendDefaultPii` — intentionally omitted**  
The original snippet included `sendDefaultPii: true` which automatically collects user IP addresses. This was removed. If any clinic patients are in the EU, collecting IP addresses without explicit consent has GDPR implications. Sentry works fully without it.

---

### How to Use the Sentry Dashboard

1. Go to [sentry.io](https://sentry.io) and sign in
2. Open your project — errors from production will appear here automatically once the app is deployed
3. Each error entry shows: message, stack trace, affected users, first/last seen, and breadcrumbs
4. Click **Assign** to assign an error to yourself
5. Click **Resolve** once you have fixed it — Sentry will re-alert if the same error reappears

**Useful filters in the dashboard:**
- `environment:production` — only show live app errors
- `!has:assignee` — unassigned errors needing attention
- Sort by **Users Affected** to prioritise which errors hurt the most people

---

### What Sentry Does NOT Cover

- **Backend Express errors** — `@sentry/react` only captures frontend JavaScript errors. Server-side errors (crashed routes, database failures) are not sent to Sentry by this setup. Backend Sentry integration (`@sentry/node`) would need to be added to `server/index.ts` separately.
- **Network request failures** — a 500 from your API appears as a breadcrumb ("HTTP 500 to /api/bookings") but not as a standalone error unless your code explicitly throws based on it.
- **Performance in development** — `tracesSampleRate` has no effect in dev because `enabled: false`. Use Node Clinic and Autocannon locally instead.

---

### Updating the DSN or Disabling Sentry

The DSN is hardcoded in `client/src/main.tsx`. To rotate it (e.g. if it leaks):
1. Go to Sentry dashboard → Project Settings → Client Keys
2. Generate a new DSN and revoke the old one
3. Update the value in `client/src/main.tsx`

To disable Sentry entirely, change `enabled: import.meta.env.PROD` to `enabled: false` and redeploy.

---

## SonarCloud — Static Code Analysis

### What It Is

SonarCloud is a cloud-based static analysis service that inspects your source code on every push or pull request and reports issues before they reach production. It does not run your code — it reads it, much like a very thorough code reviewer that never gets tired.

For each scan it produces a report covering:

- **Bugs** — code patterns that will very likely cause incorrect behaviour at runtime (e.g. a null dereference, a promise never awaited, a condition that is always true)
- **Vulnerabilities** — security weaknesses in your own code (e.g. unsanitised input passed to a SQL query, a secret exposed in a log statement)
- **Security Hotspots** — code that is not necessarily wrong but deserves a human review (e.g. a `eval()` call, a regex that could be ReDoS-prone)
- **Code Smells** — maintainability issues that are not bugs today but will cause bugs tomorrow (e.g. a function with 200 lines, a deeply nested `if`, a duplicated block)
- **Duplications** — copy-pasted code blocks across files (signals where a shared helper or hook is missing)
- **Coverage** — what percentage of your code is exercised by tests (requires a test runner to generate a coverage report and upload it)

Each issue has a severity (Blocker → Critical → Major → Minor → Info) and an estimated fix time. Issues are tracked over time so you can see whether the codebase is improving or accumulating debt.

---

### How It Integrates With This Project

SonarCloud connects to your GitHub repository. The two most common integration points are:

**Option A — GitHub Actions (recommended for this project)**

A `.github/workflows/sonar.yml` file runs `sonar-scanner` on every push to `main` and on every pull request. The scanner uploads results to SonarCloud automatically. A quality gate status (pass / fail) appears directly on the PR.

**Option B — Render Build Hook**

Run `sonar-scanner` as a step in the Render build command before `npm run build`. Slower and less visible than GitHub Actions but requires no CI setup.

---

### Setup (One-Time)

**1. Create a SonarCloud account and project**
- Sign in at [sonarcloud.io](https://sonarcloud.io) with your GitHub account
- Click **+** → **Analyze new project** → select the BookMySlot repository
- SonarCloud will generate an **organisation key** and **project key**

**2. Add `sonar-project.properties` to the project root**

```properties
sonar.projectKey=YOUR_ORG_KEY_bookmyslot
sonar.organization=YOUR_ORG_KEY
sonar.projectName=BookMySlot
sonar.projectVersion=1.0

# Source paths — exclude generated files and dependencies
sonar.sources=client/src,server,shared
sonar.exclusions=**/node_modules/**,**/dist/**,**/*.test.ts,**/*.test.tsx

# Language
sonar.typescript.tsconfigPath=tsconfig.json

# If you generate test coverage reports (Jest / Vitest):
# sonar.javascript.lcov.reportPaths=coverage/lcov.info
```

**3. Add `SONAR_TOKEN` secret**
- In SonarCloud → My Account → Security → generate a token
- Add it as a GitHub Actions secret named `SONAR_TOKEN`
- If using Render build hook instead, add it as a Render environment variable

**4. Add the GitHub Actions workflow**

Create `.github/workflows/sonar.yml`:
```yaml
name: SonarCloud Analysis
on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  sonar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0        # full history needed for blame and new-code detection
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

---

### Quality Gate

SonarCloud applies a **Quality Gate** — a pass/fail verdict that blocks a PR merge if the new code introduced in that PR crosses any threshold. The default Sonar Way gate checks that new code has:

- Zero new bugs
- Zero new vulnerabilities
- Security hotspot review coverage ≥ 80 %
- Duplication on new code ≤ 3 %
- Coverage ≥ 80 % (only enforced if you upload a coverage report)

You can customise the gate thresholds in the SonarCloud dashboard under **Administration → Quality Gates**.

---

### How to Read the SonarCloud Dashboard

1. Go to [sonarcloud.io](https://sonarcloud.io) and open your project
2. The **Overview** tab shows the Quality Gate verdict and a summary of all issues
3. The **Issues** tab lists every finding — filter by type, severity, or file
4. The **Code** tab shows the full source with inline annotations for each issue
5. The **Activity** tab shows how the issue count has changed over time
6. On a pull request, SonarCloud posts a comment summarising new issues introduced by that PR

**Useful filters:**
- `Type: Bug + Severity: Critical` — the shortest list of the highest-priority fixes
- `Status: Open + Assigned: Me` — your personal backlog
- `Resolution: False Positive` — issues you have reviewed and dismissed as intentional

---

### What SonarCloud Does NOT Cover

- **Runtime errors** — SonarCloud never runs your code. It will not catch a bug that only appears with certain input data, a race condition, or a memory leak under load. Use Sentry (above) for runtime errors and Node Clinic for performance.
- **Infrastructure or deployment issues** — network timeouts, misconfigured environment variables, and Render deployment failures are outside its scope.
- **End-to-end correctness** — SonarCloud does not know whether your API returns the right data for a given scenario. It only checks whether the code has known bad patterns.
- **Frontend visual regressions** — use Lighthouse CI or manual testing for layout and rendering issues.

---

### What to Prioritise for This Project

Given this project has no test suite at the moment, the most valuable things SonarCloud will surface immediately are:

1. **Unhandled promise rejections** — async functions in Express routes that are missing `await` or a `.catch()` handler — these cause silent 500 errors
2. **SQL injection hotspots** — any place where user input is concatenated into a raw SQL string rather than passed as a parameterised value
3. **Exposed secrets** — API keys or tokens accidentally committed as string literals
4. **Unused variables and dead code** — TypeScript catches some of these but SonarCloud is more thorough
5. **Overly complex functions** — the booking route in `server/routes.ts` is very long; SonarCloud's cognitive complexity metric will flag the worst offenders for extraction

---

## Future Sections

- **ESLint Performance Rules** — catching expensive patterns at the linting stage
- **Lighthouse CI** — automated frontend performance audits in the browser
- **PostgreSQL EXPLAIN ANALYZE** — reading query plans for slow database calls
- **k6** — scripted load testing for full user journeys across multiple endpoints
