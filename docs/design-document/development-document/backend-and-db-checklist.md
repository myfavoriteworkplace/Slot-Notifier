# BookMySlot — Backend & Database Development Checklist

Every agent and developer must work through this document after completing any backend route, storage method, or schema change. This is the backend equivalent of the frontend per-feature checklist in `replit.md`.

---

## Part 1 — Per-Feature Backend Checklist

Run every applicable step after completing a backend feature or fix. Do not hand back to the user until all relevant steps pass.

---

### Step A — Build Check (hard gate)

```bash
npm run build   # must exit 0
```

Or restart the **"Build Check"** workflow in Replit. The esbuild server bundle (`dist/index.cjs`) is built as part of this step. TypeScript errors in server code only surface here — `npm run dev` uses `tsx` which skips full type checking.

---

### Step B — Auth guard on every new route

Every new Express route must carry the correct auth middleware as the second argument. The project has three separate auth systems — do not mix them.

| Route namespace | Correct guard | Who it protects |
|---|---|---|
| `/api/auth/clinic/*` | clinic session check (inline `req.session.clinicId`) | Logged-in clinic owners |
| `/api/auth/doctor/*` | doctor session check (inline `req.session.doctorId`) | Logged-in doctors |
| `/api/clinics/:id/approve` etc. | `isAuthenticated` | Superuser (Replit OIDC or ADMIN_EMAIL) |
| `/api/consent/*`, `/api/public/*` | none — intentionally public | Patients / unauthenticated |

**Verification grep before finishing any new route:**

```bash
# Confirm the route has a guard (or that it is intentionally public)
grep -n "your-new-path" server/routes.ts server/index.ts
# Check the line above the handler — is there a middleware argument?
```

**Rule:** A route with no guard that was meant to be protected is a security hole. A route with the wrong guard (e.g. clinic check on a superuser route) will silently reject legitimate requests.

---

### Step C — Zod validation on every mutating route

Every `POST`, `PUT`, and `PATCH` route must validate `req.body` with a Zod schema before passing it to storage. Use `.safeParse()` so you can return a clean 400 error instead of letting a type error surface from the database.

**Pattern:**

```ts
const result = insertThingSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ message: result.error.errors[0].message });
}
const data = result.data;
// now pass data to storage — never pass req.body directly
```

**Verification grep:**

```bash
grep -n "req\.body" server/routes.ts
# Every occurrence should be immediately followed by .safeParse or .parse
# Any bare req.body passed to a storage call is a bug
```

---

### Step D — IStorage interface + DatabaseStorage both updated

When adding a new storage method:

1. Declare the method signature in `IStorage` (the interface at the top of `server/storage.ts`).
2. Implement it in `DatabaseStorage` (the class below).
3. Both must exist before the route calls it.

**Verification:**

```bash
grep -n "yourNewMethod" server/storage.ts
# Must return at least 2 results: one in the interface, one in the class
```

TypeScript will catch a missing implementation at build time — but only if the Build Check is run (Step A above).

---

### Step E — HTTP status code conventions

Use consistent status codes across all routes. Wrong codes break client-side error handling.

| Situation | Status code |
|---|---|
| Resource created | `201` |
| Successful update or fetch | `200` |
| No content to return (delete with no body) | `204` |
| Bad input / validation failed | `400` |
| Not authenticated (no session) | `401` |
| Authenticated but not authorised | `403` |
| Resource not found | `404` |
| Conflict (duplicate, already exists) | `409` |
| Unhandled server error | `500` |

**Rule:** Never return `200` for a create. Never return `400` for an auth failure. Never return `500` for something the client caused (bad input → `400`).

---

### Step F — console.log hygiene in backend files

The codebase has existing structured log lines with `[LABEL]` prefixes (e.g. `[RAZORPAY]`, `[EMAIL]`, `[WHATSAPP]`). Do not remove these — they are intentional audit logs.

**Rule for new code:** Every new `console.log` you add must follow the same labelled format:

```ts
// CORRECT — structured, labelled
console.log(`[BILLING] Invoice ${invoiceId} confirmed for clinic ${clinicId}`);

// WRONG — bare debug log, must not be committed
console.log("here");
console.log(req.body);
console.log(result);
```

**Scan for bare debug logs in files you touched:**

```bash
# Check files you modified — not the whole codebase (legacy logs are acceptable)
grep -n 'console\.log("' server/routes.ts | grep -v "\[" | head -20
grep -n "console\.log(\`" server/routes.ts | grep -v "\[" | head -20
```

---

### Step G — Async error handling

Every async route handler must be wrapped in `try/catch`. Unhandled promise rejections in Express do not automatically return a 500 — they crash the process or hang the request.

```ts
// CORRECT
app.post("/api/something", async (req, res) => {
  try {
    const result = await storage.doThing(data);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// WRONG — unhandled rejection
app.post("/api/something", async (req, res) => {
  const result = await storage.doThing(data);  // if this throws, request hangs
  res.json(result);
});
```

---

### Quick backend gate summary

```
[ ] Build Check (npm run build) exits 0
[ ] Every new route has the correct auth guard
[ ] Every POST/PATCH/PUT validates req.body with Zod .safeParse()
[ ] IStorage interface declared AND DatabaseStorage implements it
[ ] HTTP status codes match the convention table above
[ ] New console.log calls use [LABEL] prefix — no bare debug logs
[ ] Every async handler is wrapped in try/catch
```

---

## Part 2 — Schema Change Checklist

Run every applicable step whenever `shared/schema.ts` is modified (new table, new column, changed type).

---

### Step A — Dual registration rule (most commonly missed)

Every column or table added to `shared/schema.ts` must **also** appear in the startup migration block in `server/index.ts`. The Drizzle schema drives TypeScript types — the migration block is what actually creates or alters the table in the running database.

**Skipping this means:** the app compiles and runs fine in Replit (because the column doesn't exist yet and nothing reads it), but crashes or silently corrupts data the moment any code path tries to use the column.

**Pattern for a new column:**

```ts
// shared/schema.ts — Drizzle definition
export const things = pgTable("things", {
  id: serial("id").primaryKey(),
  newField: text("new_field"),          // ← added here
});

// server/index.ts — startup migration block (MUST ALSO ADD THIS)
try {
  await db.execute(sql`
    ALTER TABLE things ADD COLUMN IF NOT EXISTS new_field text;
  `);
} catch {}
```

**Verification grep:**

```bash
# Check that every new column name appears in BOTH files
grep -n "new_field" shared/schema.ts server/index.ts
# Must return results in both files
```

---

### Step B — Migration safety (nullable / DEFAULT)

A new column added with `NOT NULL` and no `DEFAULT` will cause the `ALTER TABLE` to fail on any table that already has rows. Postgres cannot add a non-nullable column without a default to an existing table.

**Rules:**
- New column on an existing table → always nullable (`text("col")` without `.notNull()`) OR provide a default (`.default("value")`).
- New column that must be `NOT NULL` → add it as nullable first, backfill in a separate step, then add the NOT NULL constraint in a follow-up migration.
- New table → can have `NOT NULL` freely (table is empty).

**Pattern:**

```ts
// SAFE — nullable
newField: text("new_field"),

// SAFE — has a default
newField: varchar("new_field", { length: 50 }).default("pending"),

// UNSAFE — NOT NULL on existing table with no default → ALTER TABLE will fail
newField: text("new_field").notNull(),
```

---

### Step C — createInsertSchema + types for every new table

Every new table in `shared/schema.ts` must export:

1. An insert schema using `createInsertSchema` from `drizzle-zod` (with auto-generated fields omitted).
2. An insert type (`z.infer<typeof insertXSchema>`).
3. A select type (`typeof table.$inferSelect`).

**Pattern:**

```ts
export const insertThingSchema = createInsertSchema(things).omit({
  id: true,
  createdAt: true,
});
export type InsertThing = z.infer<typeof insertThingSchema>;
export type Thing = typeof things.$inferSelect;
```

**Why:** Routes and storage methods rely on these types for Zod validation and type safety. A table without them forces callers to use `any` or define their own types locally — both are bugs waiting to happen.

---

### Step D — Storage methods for every new table operation

Every new database operation must go through the storage layer, not be inlined into a route. Before finishing a schema change, add the corresponding method(s) to:

1. `IStorage` interface in `server/storage.ts` — declare the signature.
2. `DatabaseStorage` class in `server/storage.ts` — implement it with Drizzle queries.

**Rule:** Routes must never import `db` or write raw Drizzle queries. All database access goes through `storage`.

---

### Step E — Render Postgres SQL (required for every deploy)

The startup sync in `server/index.ts` runs automatically on Replit. It does **not** run automatically on Render's Postgres. Before deploying, the developer must run the exact SQL manually on Render.

**Document the SQL clearly** when finishing any schema change:

```sql
-- Run on Render Postgres before deploying
ALTER TABLE things ADD COLUMN IF NOT EXISTS new_field text;
```

Add this to the PR description or hand it to the developer explicitly. Do not assume it will run itself.

---

### Step F — Foreign key ON DELETE behaviour

When a new column references another table (`REFERENCES other_table(id)`), decide explicitly what happens when the parent row is deleted:

| Behaviour | When to use |
|---|---|
| `ON DELETE CASCADE` | Child row is meaningless without the parent (e.g. booking notes without a booking) |
| `ON DELETE SET NULL` | Child row should survive but lose the reference (e.g. optional doctor assignment) |
| `ON DELETE RESTRICT` (default) | Parent cannot be deleted while children exist — use sparingly, can cause confusing errors |

Always write the chosen behaviour explicitly in both the Drizzle schema and the migration SQL. Never rely on the default silently.

---

### Step G — Index on foreign keys and frequently filtered columns

Postgres does not automatically create indexes on foreign key columns. Missing indexes cause full table scans on every join. Add an index for:

- Every new foreign key column.
- Every column used in a `WHERE` clause on a large table (bookings, patients, audit_logs).

```ts
// Drizzle schema
export const things = pgTable("things", {
  clinicId: integer("clinic_id").references(() => clinics.id),
}, (table) => ({
  clinicIdIdx: index("things_clinic_id_idx").on(table.clinicId),
}));
```

```sql
-- Migration SQL for Render
CREATE INDEX IF NOT EXISTS things_clinic_id_idx ON things(clinic_id);
```

---

### Step H — Never drop or rename a column without a deprecation check

Dropping or renaming a column while the code still references it will crash the server at the point where the query runs — not at startup. The build check will not catch this.

**Before dropping or renaming any column:**

```bash
# Search every reference to the column name across the full codebase
grep -rn "old_column_name" server/ shared/ client/src/
# Every result must be updated or confirmed as dead code before the column is removed
```

---

### Quick schema gate summary

```
[ ] New column/table defined in shared/schema.ts
[ ] Matching ALTER TABLE / CREATE TABLE block added to server/index.ts startup sync
[ ] Column is nullable OR has a DEFAULT (if adding to an existing table with rows)
[ ] createInsertSchema + InsertType + SelectType exported for every new table
[ ] IStorage method declared AND DatabaseStorage method implemented
[ ] Exact SQL documented for manual run on Render Postgres before deploy
[ ] ON DELETE behaviour chosen explicitly for every new foreign key
[ ] Index added for every new foreign key and frequently filtered column
[ ] grep confirms no remaining references to any dropped/renamed column
```

---

## Part 3 — Senior Developer Standard for Backend Code

Write every route, storage method, and migration as if a senior backend developer will review it in a code review. Not as if a task description needs to be satisfied.

### Mindset

- **The database is the source of truth.** If data integrity cannot be enforced at the database level (constraints, foreign keys, NOT NULL), it must be enforced in the storage layer — never rely on the route layer to prevent bad data.
- **Routes are thin wrappers.** A route does three things: validate input, call storage, return a response. Business logic, computation, and data transformation belong in storage methods or dedicated service functions.
- **Failures must be explicit.** A 500 with `err.message` is acceptable. An empty catch block, a swallowed error, or a silent `undefined` return is not.
- **Idempotency matters.** Migrations use `IF NOT EXISTS` / `IF EXISTS` guards so they can be re-run safely. Routes that create resources should handle duplicate attempts gracefully (409 instead of 500).

### Backend code rules

1. **No `db` imports in route files.** All Drizzle queries live in `server/storage.ts`. Routes import `storage`, not `db`.
2. **No `req.body` passed raw to storage.** Always parse through a Zod schema first.
3. **No `any` types in storage methods.** Derive types from `shared/schema.ts` select/insert types.
4. **Every async function has try/catch.** Unhandled rejections hang requests or crash the process.
5. **Return a typed response shape.** Clients must be able to rely on the response structure. If a field is sometimes present and sometimes not, document it — don't let it vary silently.
6. **No magic numbers.** Timeouts, limits, thresholds — define them as named constants at the top of the file with a comment explaining the unit (e.g. `const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes`).
7. **Migrations are append-only.** Never modify an existing migration block in `server/index.ts`. Add new blocks below. Modifying an existing block can cause it to fail on environments where it already ran.

---

*This document lives at `docs/design-document/development-document/backend-and-db-checklist.md`.*
*Frontend checklist: `replit.md` → Per-Feature Development Checklist.*
*UI component checklist: `docs/agent-screen-design-prompt.md` → Feature Completion Gate.*
