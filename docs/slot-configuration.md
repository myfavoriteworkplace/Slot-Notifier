# Slot Configuration — Developer Reference

> **Last updated:** June 2026  
> **Covers:** Time brackets, default capacities, procedure cost units, booking cap logic, DB schema, storage layer, API contracts, and UI wiring.

---

## 1. Overview

BookMySlot uses a **slot-unit system** for appointment booking. A clinic's working day is split into five fixed **time brackets**. Each bracket has a configurable maximum number of **slot units** (not patients). When a patient books a procedure, the booking consumes 1–3 units depending on the procedure category. A bracket is "full" when the sum of units already booked equals or exceeds its maximum.

```
1 slot unit = 25 minutes  (20 min treatment + 5 min buffer)
```

---

## 2. Time Brackets

Defined in `client/src/pages/ClinicDashboard.tsx` (the `SLOT_SECTIONS` array).

| ID | Label         | Start    | End      | Duration | Default Capacity (units) |
|----|---------------|----------|----------|----------|--------------------------|
| 1  | Early Morning | 08:00 AM | 10:00 AM | 2h 00m   | **4**                    |
| 2  | Late Morning  | 10:00 AM | 12:30 PM | 2h 30m   | **6**                    |
| 3  | Midday        | 12:30 PM | 02:00 PM | 1h 30m   | **3**                    |
| 4  | Afternoon     | 02:00 PM | 05:00 PM | 3h 00m   | **7**                    |
| 5  | Evening       | 05:00 PM | 07:30 PM | 2h 30m   | **6**                    |

> **Note on bracket ID "3" (Midday):** The start time is 12:30 PM (not 12:00 PM). Server-side bracket detection must account for `startMinute: 30`. When comparing booking times, use `getHours() + getMinutes()` or ISO string comparison — never assume integer-hour boundaries.

### 2.1 Default Capacity Map

```ts
// client/src/pages/ClinicDashboard.tsx
const DEFAULT_SECTION_CAPACITY: Record<string, number> = {
  "1": 4,   // Early Morning
  "2": 6,   // Late Morning
  "3": 3,   // Midday
  "4": 7,   // Afternoon
  "5": 6,   // Evening
};
```

These are the **fallback values** used when a clinic has not yet saved a `defaultSlotConfig`. Once a clinic saves a configuration it is stored in `clinics.default_slot_config` (JSONB) and takes precedence.

---

## 3. Procedure Categories & Slot Cost

Each procedure category is mapped to a **slot cost** (integer, 1–3). This determines how many slot units are consumed per booking.

```ts
// client/src/pages/ClinicDashboard.tsx
const PROCEDURE_SLOT_COST: Record<string, number> = {
  "Consultation":               1,   // 25 min
  "Diagnostics":                1,   // 25 min
  "Cleaning / Preventive":      2,   // 50 min
  "Fillings / Minor Restorations": 2, // 50 min
  "Major Procedures":           3,   // 75 min
};
```

| Category                       | Units | Est. Duration | Notes                              |
|--------------------------------|-------|---------------|------------------------------------|
| Consultation                   | 1     | 25 min        | New patient intake, follow-ups     |
| Diagnostics                    | 1     | 25 min        | X-rays, OPG, intra-oral scans      |
| Cleaning / Preventive          | 2     | 50 min        | Scaling, polishing, fluoride       |
| Fillings / Minor Restorations  | 2     | 50 min        | Composites, GIC, simple extractions|
| Major Procedures               | 3     | 75 min        | RCT, crowns, surgical extractions, implants, orthodontic adjustments |

> **Adding a new category:** Add an entry to `PROCEDURE_SLOT_COST` in `ClinicDashboard.tsx` **and** add the matching `<SelectItem>` in the booking form dropdown (around line 5659). No backend changes are needed — the cost is sent as an integer in the API request body.

> **Unknown / unset category:** Falls back to cost `1` via `PROCEDURE_SLOT_COST[cat] ?? 1`. Public patient bookings always default to cost `1` because patients do not select a procedure category.

---

## 4. Database Schema

### 4.1 `slots` table

```ts
// shared/schema.ts
export const slots = pgTable("slots", {
  id:          serial("id").primaryKey(),
  ownerId:     integer("owner_id").notNull(),
  startTime:   timestamp("start_time").notNull(),
  endTime:     timestamp("end_time").notNull(),
  maxBookings: integer("max_bookings").default(3).notNull(),
  ...
});
```

- `maxBookings` — the **unit cap** for this slot. Despite the column name, it represents slot units (not patient headcount) when the slot-cost system is active.
- The default `3` in the column definition is a DB-level fallback only. Application-level defaults use `DEFAULT_SECTION_CAPACITY` which correctly maps bracket duration to realistic capacity.

### 4.2 `bookings` table — `slot_cost` column

```ts
// shared/schema.ts
slotCost: integer("slot_cost").default(1),
```

- Added in June 2026 migration.
- Stores how many slot units **this booking consumes**.
- Legacy rows created before this column existed have `NULL` in the DB; the storage layer coalesces `NULL → 1` so existing data behaves as single-unit bookings.

### 4.3 `clinics` table — `default_slot_config` column

```ts
defaultSlotConfig: jsonb("default_slot_config")
```

Shape of the JSONB value:

```json
{
  "sections": {
    "1": { "maxBookings": 4, "isCancelled": false },
    "2": { "maxBookings": 6, "isCancelled": false },
    "3": { "maxBookings": 3, "isCancelled": false },
    "4": { "maxBookings": 7, "isCancelled": false },
    "5": { "maxBookings": 6, "isCancelled": false }
  }
}
```

- `maxBookings` in this JSONB means **slot units**, not patient count.
- `isCancelled: true` disables that bracket for the clinic globally (no slots can be created for it).

---

## 5. Startup Migration

`server/index.ts` runs a migration block on every startup to add `slot_cost` if it doesn't already exist:

```sql
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS slot_cost INTEGER DEFAULT 1;
```

This is idempotent — safe to run multiple times. It also means schema sync with Drizzle push is not required for this column to appear in production.

---

## 6. Storage Layer

### 6.1 `countVerifiedBookingsForClinicTime`

```ts
// server/storage.ts
async countVerifiedBookingsForClinicTime(
  clinicId: number,
  clinicName: string,
  startTime: Date
): Promise<number>
```

**Returns:** The **sum of `slotCost`** for all active (non-cancelled) bookings at the given clinic + start time — i.e., how many slot units are already consumed.

- Filters: `status !== 'cancelled'`, matches `clinicId` (or `clinicName` for legacy rows), matches `startTime` exactly.
- Coalesces `NULL slotCost` to `1` for legacy rows:
  ```ts
  return verifiedBookings.reduce((sum, r) => sum + ((r.booking as any).slotCost ?? 1), 0);
  ```

> **Important:** This function returns **units consumed**, not the number of bookings. Always compare it against `maxBookings` (the unit cap), not against an expected patient count.

---

## 7. API Contracts

### 7.1 Public Booking (Patient-facing)

`POST /api/auth/clinic/public/book`

- `slotCost` is always `1` for public bookings (patients don't select procedure type).
- The server looks up the bracket's `maxBookings` from the clinic's `defaultSlotConfig` or falls back to `DEFAULT_SECTION_CAPACITY`.
- Booking is rejected if `existingUnits + 1 > maxBookings`.

### 7.2 Admin Booking (Clinic staff)

`POST /api/auth/clinic/admin-book`

**Request body:**

| Field           | Type   | Description                          |
|-----------------|--------|--------------------------------------|
| `customerName`  | string | Patient display name                 |
| `customerPhone` | string | Patient phone                        |
| `customerEmail` | string | Patient email (optional)             |
| `startTime`     | string | ISO 8601 datetime                    |
| `endTime`       | string | ISO 8601 datetime                    |
| `description`   | string | Free-text notes (may include `Category: X`) |
| `slotCost`      | number | **Slot units consumed.** 1–4, clamped server-side. Defaults to `1` if omitted. |

**Capacity check (server-side):**
```ts
const existingUnits = await storage.countVerifiedBookingsForClinicTime(...);
if (existingUnits + slotCost > admMax) {
  // 409 Conflict — "Only N slot units remaining. This procedure needs M."
}
```

**On success:** booking is created, then `slot_cost` is written to `bookings.slot_cost` in a follow-up `UPDATE`.

**Error response (409):**
```json
{
  "message": "Only 2 slot units remaining. This procedure needs 3. Choose a different bracket or procedure."
}
```

### 7.3 Default Config — Get / Save

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/auth/clinic/slot-config/default` | Returns `{ defaultSlotConfig: {...} \| null }` |
| `POST` | `/api/auth/clinic/slot-config/default` | Saves JSONB to `clinics.default_slot_config` |

---

## 8. Frontend Wiring

### 8.1 Admin Booking Flow

Location: `client/src/pages/ClinicDashboard.tsx` → `handleCreateBooking()`

1. Staff selects a **procedure category** from the dropdown.
2. `slotCost = PROCEDURE_SLOT_COST[category] ?? 1` is computed.
3. The slot picker reads `spotsLeft` from the availability query. A bracket is shown as unavailable if `spotsLeft < thisCost` (not just `spotsLeft === 0`).
4. Available brackets show a **violet badge** `"2 slots · 50 min"` when `thisCost > 1`.
5. `slotCost` is sent in the POST body to the admin booking endpoint.

### 8.2 Slot Configuration Editor

Location: `client/src/pages/ClinicDashboard.tsx` → Configure Slots tab

- Each bracket row shows its time range and an editable **"Max slots"** number input.
- The hint `"1 slot ≈ 25 min (20 min treatment + 5 min buffer)"` is shown below the section heading.
- Save persists the full `DayConfig` JSONB to the backend.
- On load, if no saved config exists, the UI pre-fills with `DEFAULT_SECTION_CAPACITY` values.

### 8.3 AppointmentCard — Duration Badge

Location: `client/src/components/AppointmentCard.tsx`

Bookings with `slotCost > 1` display a violet pill in the date/time row:

```tsx
{(booking as any).slotCost > 1 && (
  <span className="...violet styles...">
    {booking.slotCost} slots · {booking.slotCost * 25} min
  </span>
)}
```

Visible to both **clinic admin** and **doctor** roles.

---

## 9. Capacity Resolution Order

When determining the unit cap for a bracket, the server resolves in this order:

```
1. Slot row's own maxBookings (if the slot was individually configured)
2. Clinic's defaultSlotConfig.sections[bracketId].maxBookings
3. DEFAULT_SECTION_CAPACITY[bracketId]   ← hardcoded fallback
4. 3                                      ← absolute last resort
```

---

## 10. Full Data Flow — Admin Booking

```
Clinic staff selects category "Cleaning / Preventive"
        │
        ▼
slotCost = PROCEDURE_SLOT_COST["Cleaning / Preventive"] = 2
        │
        ▼
Slot picker: fetch /api/auth/clinic/availability
  → Each bracket returns spotsLeft
  → Bracket shown as FULL if spotsLeft < 2
  → Badge "2 slots · 50 min" shown on available brackets
        │
Staff picks a bracket (e.g. "Late Morning" — 10:00 AM)
        │
        ▼
POST /api/auth/clinic/admin-book
  { startTime, endTime, slotCost: 2, ... }
        │
        ▼
Server: existingUnits = SUM(slot_cost) for that bracket
  existingUnits + 2 ≤ 6  →  OK  (Late Morning cap = 6)
        │
        ▼
Booking created → UPDATE bookings SET slot_cost = 2 WHERE id = ...
        │
        ▼
AppointmentCard renders "2 slots · 50 min" violet badge
```

---

## 11. Future Enhancement Notes

### Adding more procedure categories

1. Add entry to `PROCEDURE_SLOT_COST` in `ClinicDashboard.tsx`.
2. Add `<SelectItem>` to the procedure category dropdown (same file, ~line 5659).
3. No DB migration needed; the cost travels as an integer in the API body.

### Per-procedure cost overrides at clinic level

Currently the cost map is global. A future enhancement could store a `procedureCostOverrides: Record<string, number>` field in `clinics.default_slot_config` and merge it with `PROCEDURE_SLOT_COST` at booking time.

### Making slot duration configurable

The `25 min / slot` constant appears in three places:
- `ClinicDashboard.tsx` badge: `slotCost * 25`
- `AppointmentCard.tsx` badge: `slotCost * 25`
- UI hint text: `"1 slot ≈ 25 min"`

To make this a clinic setting, store `slotDurationMinutes` in `defaultSlotConfig` and propagate it through the API response.

### Fractional slot costs (e.g. 1.5 units)

The schema stores `slot_cost` as `INTEGER`. To support half-unit procedures, change the column to `NUMERIC(4,1)` and update `countVerifiedBookingsForClinicTime` and all comparison arithmetic accordingly.

### Doctor-specific slot capacity

Currently all doctors at a clinic share the same bracket capacity. A future model could add a `doctor_slot_caps` table keyed on `(clinicId, doctorId, bracketId)` and filter `countVerifiedBookingsForClinicTime` by assigned doctor.

### Public patient booking cost

Today public patients always cost 1 unit. A future flow could ask patients to select their procedure type before booking (post-OTP screen), derive the cost, and enforce it the same way admin bookings do.

---

## 12. Key Files Quick Reference

| File | What it owns |
|------|--------------|
| `shared/schema.ts` | `slots.maxBookings`, `bookings.slotCost` column definitions |
| `server/index.ts` | Startup `ALTER TABLE` migration for `slot_cost` |
| `server/storage.ts` | `countVerifiedBookingsForClinicTime` — SUM of units |
| `server/routes.ts` | Admin booking route (capacity check + slot_cost write), public booking route, slot-config GET/POST |
| `client/src/pages/ClinicDashboard.tsx` | `SLOT_SECTIONS`, `DEFAULT_SECTION_CAPACITY`, `PROCEDURE_SLOT_COST`, slot editor UI, admin booking form, availability display |
| `client/src/components/AppointmentCard.tsx` | Duration badge (`slotCost > 1` → violet pill) |
