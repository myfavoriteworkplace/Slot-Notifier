#!/usr/bin/env node
"use strict";

const { execSync, spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// ── helpers ──────────────────────────────────────────────────────────────────

const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";
const DIM    = "\x1b[2m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const GREEN  = "\x1b[32m";
const BLUE   = "\x1b[34m";
const MAGENTA= "\x1b[35m";

function color(c, text) { return `${c}${text}${RESET}`; }

function isAvailable(cmd) {
  try {
    execSync(`${cmd} --version`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function severityBadge(sev) {
  const s = (sev || "").toLowerCase();
  if (s === "critical") return color(RED,    `[CRITICAL]`);
  if (s === "high")     return color(RED,    `[HIGH]    `);
  if (s === "moderate" || s === "medium") return color(YELLOW, `[MEDIUM]  `);
  if (s === "low")      return color(CYAN,   `[LOW]     `);
  if (s === "info")     return color(DIM,    `[INFO]    `);
  return color(DIM, `[${(sev || "unknown").toUpperCase().padEnd(8)}]`);
}

function header(title) {
  const line = "─".repeat(60);
  console.log(`\n${color(BOLD + BLUE, line)}`);
  console.log(color(BOLD + BLUE, `  ${title}`));
  console.log(color(BOLD + BLUE, line));
}

function summaryLine(label, counts) {
  const parts = [];
  if (counts.critical) parts.push(color(RED,    `${counts.critical} critical`));
  if (counts.high)     parts.push(color(RED,    `${counts.high} high`));
  if (counts.moderate || counts.medium)
    parts.push(color(YELLOW, `${counts.moderate || counts.medium} medium`));
  if (counts.low)      parts.push(color(CYAN,   `${counts.low} low`));
  if (counts.info)     parts.push(color(DIM,    `${counts.info} info`));
  if (!parts.length)   parts.push(color(GREEN,  "no findings"));
  console.log(`  ${color(BOLD, label.padEnd(20))} ${parts.join("  ")}`);
}

// ── 1. npm audit ─────────────────────────────────────────────────────────────

function runNpmAudit() {
  header("1 / 4  NPM DEPENDENCY AUDIT");

  let raw;
  try {
    raw = execSync("npm audit --json", { cwd: ROOT, stdio: "pipe" }).toString();
  } catch (e) {
    raw = e.stdout ? e.stdout.toString() : null;
    if (!raw) {
      console.log(color(YELLOW, "  npm audit failed — skipping"));
      return { critical: 0, high: 0, moderate: 0, low: 0, info: 0 };
    }
  }

  let data;
  try { data = JSON.parse(raw); } catch {
    console.log(color(YELLOW, "  Could not parse npm audit output"));
    return {};
  }

  const counts = data.metadata?.vulnerabilities || {};
  const vulns  = Object.values(data.vulnerabilities || {});

  // Print grouped by severity
  const bySev = {};
  vulns.forEach(v => {
    const sev = v.severity || "info";
    if (!bySev[sev]) bySev[sev] = [];
    bySev[sev].push(v);
  });

  const order = ["critical", "high", "moderate", "low", "info"];
  let printed = 0;
  order.forEach(sev => {
    const list = bySev[sev] || [];
    list.forEach(v => {
      const fixInfo = v.fixAvailable
        ? (typeof v.fixAvailable === "object"
            ? `  fix → ${v.fixAvailable.name}@${v.fixAvailable.version}`
            : `  fix available`)
        : "  no fix available";
      console.log(`  ${severityBadge(sev)} ${color(BOLD, v.name)}@${v.range || "?"}${color(DIM, fixInfo)}`);
      if (v.via && Array.isArray(v.via)) {
        const viaNames = v.via.map(x => (typeof x === "string" ? x : x.title || x.url || "")).filter(Boolean);
        if (viaNames.length) console.log(`           ${color(DIM, "via: " + viaNames.slice(0, 3).join(", "))}`);
      }
      printed++;
    });
  });

  if (printed === 0) console.log(color(GREEN, "  No vulnerabilities found."));

  console.log();
  summaryLine("npm audit", counts);

  return counts;
}

// ── 2. ESLint security ────────────────────────────────────────────────────────

function runEslint() {
  header("2 / 4  ESLINT SECURITY SCAN");

  const eslintBin = path.join(ROOT, "node_modules", ".bin", "eslint");
  if (!require("fs").existsSync(eslintBin)) {
    console.log(color(YELLOW, "  eslint not found. Run:"));
    console.log(color(DIM,    "    npm install --save-dev eslint eslint-plugin-security"));
    return { high: 0, medium: 0, low: 0 };
  }

  let raw;
  try {
    raw = execSync(
      `"${eslintBin}" server/ client/src/ --ext .ts,.tsx,.js,.jsx -f json --no-eslintrc -c .eslintrc.json`,
      { cwd: ROOT, stdio: "pipe" }
    ).toString();
  } catch (e) {
    raw = e.stdout ? e.stdout.toString() : null;
    if (!raw) {
      console.log(color(YELLOW, "  ESLint could not run — check .eslintrc.json exists"));
      return { high: 0, medium: 0, low: 0 };
    }
  }

  let results;
  try { results = JSON.parse(raw); } catch {
    console.log(color(YELLOW, "  Could not parse ESLint output"));
    return { high: 0, medium: 0, low: 0 };
  }

  let high = 0, medium = 0, low = 0;

  results.forEach(file => {
    const rel = path.relative(ROOT, file.filePath);
    file.messages.forEach(msg => {
      const sev = msg.severity === 2 ? "HIGH" : msg.severity === 1 ? "MEDIUM" : "LOW";
      if (msg.severity === 2) high++;
      else if (msg.severity === 1) medium++;
      else low++;
      console.log(`  ${severityBadge(sev)} ${color(DIM, rel + ":" + msg.line)}  ${msg.message}  ${color(DIM, msg.ruleId || "")}`);
    });
  });

  if (high + medium + low === 0) console.log(color(GREEN, "  No ESLint security issues found."));

  console.log();
  summaryLine("ESLint", { high, medium, low });
  return { high, medium, low };
}

// ── 3. Semgrep ───────────────────────────────────────────────────────────────

function runSemgrep() {
  header("3 / 4  SEMGREP OWASP SCAN");

  if (!isAvailable("semgrep")) {
    console.log(color(YELLOW, "  semgrep not installed — skipping."));
    console.log(color(DIM,    "  To install:  pip install semgrep"));
    console.log(color(DIM,    "  Then re-run: npm run scan"));
    return { critical: 0, high: 0, medium: 0, low: 0 };
  }

  let raw;
  try {
    raw = execSync(
      `semgrep --config "p/owasp-top-ten" --json --quiet server/ client/src/ shared/`,
      { cwd: ROOT, stdio: "pipe", timeout: 120000 }
    ).toString();
  } catch (e) {
    raw = e.stdout ? e.stdout.toString() : null;
    if (!raw) {
      console.log(color(YELLOW, "  Semgrep scan failed."));
      return { critical: 0, high: 0, medium: 0, low: 0 };
    }
  }

  let data;
  try { data = JSON.parse(raw); } catch {
    console.log(color(YELLOW, "  Could not parse Semgrep output"));
    return { critical: 0, high: 0, medium: 0, low: 0 };
  }

  const counts = { critical: 0, high: 0, medium: 0, low: 0 };

  (data.results || []).forEach(r => {
    const sev = (r.extra?.severity || r.severity || "medium").toLowerCase();
    if (sev === "error" || sev === "critical") counts.critical++;
    else if (sev === "warning" || sev === "high") counts.high++;
    else if (sev === "info" || sev === "medium") counts.medium++;
    else counts.low++;

    const file = path.relative(ROOT, r.path || "");
    const line = r.start?.line || "?";
    const msg  = (r.extra?.message || r.message || "").trim().split("\n")[0].substring(0, 100);
    const rule = r.check_id || "";
    const shortRule = rule.split(".").pop() || rule;
    console.log(`  ${severityBadge(sev)} ${color(DIM, file + ":" + line)}  ${msg}  ${color(DIM, shortRule)}`);
  });

  if (!data.results?.length) console.log(color(GREEN, "  No Semgrep findings."));

  console.log();
  summaryLine("Semgrep", counts);
  return counts;
}

// ── 4. NodeJsScan ────────────────────────────────────────────────────────────

function runNodeJsScan() {
  header("4 / 4  NODEJSSCAN (NODE SAST)");

  if (!isAvailable("nodejsscan")) {
    console.log(color(YELLOW, "  nodejsscan not installed — skipping."));
    console.log(color(DIM,    "  To install:  pip install nodejsscan"));
    console.log(color(DIM,    "  Then re-run: npm run scan"));
    return { high: 0, medium: 0, low: 0 };
  }

  let raw;
  try {
    raw = execSync(
      `nodejsscan -d . -o /tmp/njsscan_out.json`,
      { cwd: ROOT, stdio: "pipe", timeout: 60000 }
    ).toString();
  } catch (e) {
    raw = e.stdout ? e.stdout.toString() : null;
  }

  let data;
  try {
    const fs = require("fs");
    const out = fs.readFileSync("/tmp/njsscan_out.json", "utf8");
    data = JSON.parse(out);
  } catch {
    console.log(color(YELLOW, "  Could not parse NodeJsScan output"));
    return { high: 0, medium: 0, low: 0 };
  }

  let high = 0, medium = 0, low = 0;

  const findings = data.nodejs || data.findings || data.results || {};
  Object.entries(findings).forEach(([ruleId, finding]) => {
    if (!finding || !finding.files) return;
    const sev = (finding.metadata?.severity || "medium").toLowerCase();
    if (sev === "high" || sev === "error") high++;
    else if (sev === "medium" || sev === "warning") medium++;
    else low++;

    const fileList = (finding.files || []).slice(0, 2).map(f =>
      path.relative(ROOT, f.file_path || "") + ":" + (f.match_lines?.[0] || "?")
    ).join(", ");

    console.log(`  ${severityBadge(sev)} ${color(BOLD, ruleId)}  ${color(DIM, fileList)}`);
    if (finding.metadata?.description) {
      console.log(`           ${color(DIM, finding.metadata.description.substring(0, 90))}`);
    }
  });

  if (high + medium + low === 0) console.log(color(GREEN, "  No NodeJsScan findings."));

  console.log();
  summaryLine("NodeJsScan", { high, medium, low });
  return { high, medium, low };
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const start = Date.now();

  console.log(color(BOLD + MAGENTA, "\n╔══════════════════════════════════════════════════════════╗"));
  console.log(color(BOLD + MAGENTA,   "║           BookMySlot — Security Scan                     ║"));
  console.log(color(BOLD + MAGENTA,   "╚══════════════════════════════════════════════════════════╝"));
  console.log(color(DIM, `  ${new Date().toLocaleString()}`));

  const r1 = runNpmAudit();
  const r2 = runEslint();
  const r3 = runSemgrep();
  const r4 = runNodeJsScan();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  // ── Grand summary ──
  header("SUMMARY");

  summaryLine("npm audit",  r1);
  summaryLine("ESLint",     r2);
  summaryLine("Semgrep",    r3);
  summaryLine("NodeJsScan", r4);

  const totalCritical = (r1.critical||0) + (r3.critical||0);
  const totalHigh     = (r1.high||0) + (r2.high||0) + (r3.high||0) + (r4.high||0);

  console.log();
  if (totalCritical > 0) {
    console.log(color(RED + BOLD,  `  ⚠  ${totalCritical} critical issue(s) found — review before deploying`));
  } else if (totalHigh > 0) {
    console.log(color(YELLOW + BOLD, `  ⚠  ${totalHigh} high issue(s) found`));
  } else {
    console.log(color(GREEN + BOLD,  "  ✓  No critical or high findings"));
  }

  console.log(color(DIM, `\n  Completed in ${elapsed}s`));
  console.log();
}

main();
