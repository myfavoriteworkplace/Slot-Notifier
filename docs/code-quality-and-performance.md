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
"clinic:doctor":     "clinic doctor -- node --import tsx/esm server/index.ts",
"clinic:flame":      "clinic flame -- node --import tsx/esm server/index.ts",
"clinic:bubbleprof": "clinic bubbleprof -- node --import tsx/esm server/index.ts"
```

**Why `node --import tsx/esm` instead of `node server.js`?**  
The standard Node Clinic guide uses `node server.js` because it assumes a plain JavaScript project. BookMySlot is TypeScript. Clinic v11 strictly requires the command after `--` to be literally `node` — it rejects shell wrappers like `node_modules/.bin/tsx`. The fix is to call `node` directly and pre-load `tsx` as a TypeScript ESM module via the `--import tsx/esm` flag. This compiles TypeScript on the fly, exactly like running `tsx` directly, but satisfies Clinic's requirement. The project uses `"type": "module"` (ESM) and Node.js v20+, so `--import tsx/esm` is the correct approach — the older `--loader` flag was deprecated in Node v20.6.0 and tsx actively rejects it.

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

#### Issue 2 — `--loader` Flag Rejected on Node v20+

**What you see**
```
Error: tsx must be loaded with --import instead of --loader
The --loader flag was deprecated in Node v20.6.0 and v18.19.0
Node.js v20.19.4
```

**Why it happens**  
Node.js deprecated the `--loader` flag in v20.6.0. The tsx package (v3+) detects this and actively throws an error rather than silently using the old behaviour. The scripts originally used `--loader tsx/esm` which worked on older Node versions but fails on v20+.

**Fix applied**  
Scripts updated in `package.json` from `--loader tsx/esm` to `--import tsx/esm`. The `--import` flag is the correct modern replacement — it pre-loads tsx as a TypeScript ESM module before the server starts, achieving the same result.

```bash
# Old (broken on Node v20+)
clinic doctor -- node --loader tsx/esm server/index.ts

# Fixed (works on Node v20+)
clinic doctor -- node --import tsx/esm server/index.ts
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

1. Your server starts normally on port 5000.
2. Send it some traffic — open the app in a browser, click around, trigger the slow feature.
3. Press `Ctrl+C` to stop the server.
4. Clinic processes the data and **automatically opens the HTML report** in your default browser.
5. If it doesn't open automatically, the file path is printed in the terminal — copy and paste it into any browser.

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
clinic heap -- node --import tsx/esm server/index.ts
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

## Future Sections

- **ESLint Performance Rules** — catching expensive patterns at the linting stage
- **Lighthouse CI** — automated frontend performance audits in the browser
- **PostgreSQL EXPLAIN ANALYZE** — reading query plans for slow database calls
