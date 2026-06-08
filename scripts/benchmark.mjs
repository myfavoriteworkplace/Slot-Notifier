/**
 * BookMySlot — API Benchmark Runner
 *
 * Runs autocannon against all safe read-only endpoints sequentially
 * and prints a combined summary table.
 *
 * Prerequisites:
 *   1. npm install -g autocannon
 *   2. Server must be running: npm run dev (in a separate terminal)
 *
 * Usage:
 *   npm run benchmark
 */

import autocannon from "autocannon";
import { writeFileSync, mkdirSync } from "fs";

const BASE_URL = "http://localhost:5000";
const CONNECTIONS = 20;
const DURATION = 15;

// p99 thresholds in ms — results above these are flagged as SLOW
const THRESHOLDS = {
  "/api/health": 20,
  "/api/health/database": 50,
  "/api/public/clinics": 300,
  "/api/smile-deals": 400,
  "/api/public/clinic-availability": 400,
  "/api/notifications": 200,
};

const ENDPOINTS = [
  {
    label: "GET /api/health",
    path: "/api/health",
    connections: 10,
    duration: 10,
  },
  {
    label: "GET /api/health/database",
    path: "/api/health/database",
    connections: 10,
    duration: 10,
  },
  {
    label: "GET /api/public/clinics",
    path: "/api/public/clinics",
    connections: CONNECTIONS,
    duration: DURATION,
  },
  {
    label: "GET /api/smile-deals",
    path: "/api/smile-deals",
    connections: CONNECTIONS,
    duration: DURATION,
  },
  {
    label: "GET /api/public/clinic-availability",
    path: "/api/public/clinic-availability?clinicId=1",
    connections: CONNECTIONS,
    duration: DURATION,
  },
  {
    label: "GET /api/notifications",
    path: "/api/notifications",
    connections: 10,
    duration: 10,
  },
];

async function checkServer() {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
  } catch {
    console.error(`\n❌  Cannot reach server at ${BASE_URL}`);
    console.error(
      "    Start it first in another terminal:  npm run dev\n"
    );
    process.exit(1);
  }
}

function runTest(endpoint) {
  return new Promise((resolve, reject) => {
    const instance = autocannon(
      {
        url: `${BASE_URL}${endpoint.path}`,
        connections: endpoint.connections,
        duration: endpoint.duration,
        silent: true,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    autocannon.track(instance, { renderProgressBar: false });
  });
}

function pad(str, len) {
  return String(str).padEnd(len);
}

function rpad(str, len) {
  return String(str).padStart(len);
}

function formatMs(val) {
  return `${Math.round(val)}ms`;
}

function statusIcon(p99, threshold) {
  if (p99 > threshold * 2) return "❌ FAIL";
  if (p99 > threshold) return "⚠️  SLOW";
  return "✅ PASS";
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const startedAt = new Date().toLocaleString();

  console.log("\n" + "━".repeat(70));
  console.log(`  BookMySlot API Benchmark — ${startedAt}`);
  console.log(`  Server : ${BASE_URL}`);
  console.log(`  Config : ${CONNECTIONS} connections · ${DURATION}s per endpoint`);
  console.log("━".repeat(70));

  await checkServer();

  const results = [];

  for (const endpoint of ENDPOINTS) {
    process.stdout.write(`  Running  ${endpoint.label} ...`);
    const result = await runTest(endpoint);
    results.push({ endpoint, result });
    process.stdout.write(" done\n");
  }

  console.log("\n" + "━".repeat(70));
  console.log(
    `  ${pad("Endpoint", 42)} ${rpad("p50", 7)} ${rpad("p99", 7)} ${rpad("Req/s", 7)}  Status`
  );
  console.log("  " + "─".repeat(68));

  let hasFailures = false;

  for (const { endpoint, result } of results) {
    const p50 = formatMs(result.latency.p50);
    const p99 = formatMs(result.latency.p99);
    const reqSec = Math.round(result.requests.average);
    const threshold = THRESHOLDS[endpoint.path.split("?")[0]] ?? 500;
    const status = statusIcon(result.latency.p99, threshold);

    if (status !== "✅ PASS") hasFailures = true;

    console.log(
      `  ${pad(endpoint.label, 42)} ${rpad(p50, 7)} ${rpad(p99, 7)} ${rpad(reqSec, 7)}  ${status}`
    );
  }

  console.log("━".repeat(70));

  // Save results to .benchmarks/
  try {
    mkdirSync(".benchmarks", { recursive: true });
    const outPath = `.benchmarks/${timestamp}.json`;
    const payload = {
      runAt: new Date().toISOString(),
      server: BASE_URL,
      results: results.map(({ endpoint, result }) => ({
        label: endpoint.label,
        path: endpoint.path,
        p50: result.latency.p50,
        p99: result.latency.p99,
        p999: result.latency.p999,
        reqPerSec: Math.round(result.requests.average),
        errors: result.errors,
        timeouts: result.timeouts,
      })),
    };
    writeFileSync(outPath, JSON.stringify(payload, null, 2));
    console.log(`\n  Results saved → ${outPath}\n`);
  } catch {
    console.log("\n  (Could not save results file — continuing)\n");
  }

  process.exit(hasFailures ? 1 : 0);
}

main().catch((err) => {
  console.error("Benchmark failed:", err.message);
  process.exit(1);
});
