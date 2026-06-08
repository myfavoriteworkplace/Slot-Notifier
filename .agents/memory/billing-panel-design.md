---
name: BillingHistoryPanel design rules
description: UI conventions and layout rules for the billing panel in the clinic patient card
---

## Font sizes
Minimum font size across the entire panel is `text-xs`. Never use `text-[10px]`, `text-[9px]`, or `text-[11px]`. Applies to: StatusBadge, AuditActionLabel, cashier form labels, button text, section headers, audit trail log entries, previous visits, past prescriptions.

## Category grouping (three groups, consistent everywhere)
- **Consultation & Procedures**: categories `Consultation`, `Procedure`, `Treatment`, `Consumable`
- **Pharmacy**: category `Pharmacy`
- **Other**: everything else

This grouping is used in both the open invoice section AND inside `renderBillCard` for older bills, and in the InvoicePreviewModal.

## Active bill card styling
Active (open) bill card: `border-primary/40` border + `bg-primary/10` header background. Use opacity fractions supported by Tailwind (e.g. `/10`, `/20`, `/40`) — avoid `/8` which is non-standard.

## Table styling — must match ClinicalRecordsTab prescription table
- Wrap every category table in `<div className="mx-3 mb-2 rounded-lg border border-border/50 overflow-hidden">`
- `<thead>` row: `bg-muted/40 border-b border-border/40`, th text: `text-muted-foreground` (not `/60`)
- `<tbody>`: `divide-y divide-border/30`
- Row bg in tbody: `bg-background` (ensures contrast against dividers)

## Pharmacy description format and parsing
Pharmacy line-item descriptions are stored as a concatenated string: `"Name Dosage ×Qty Frequency Duration"` (e.g. `"Amoxicillin 500mg ×14 Twice daily 7 days"`).

`parsePharmacyDesc(desc)` → `{ medicine, frequency, duration }`:
- Split at `×` to get medicine name
- After `×qty`, regex-extract duration pattern `/^(.*?)\s*(\d+\s+(?:days?|weeks?|months?|years?))$/i`
- Remainder before duration = frequency

Pharmacy tables always render columns: **Medicine | Frequency | Duration | Qty | ₹/Unit | Total | [del]**

Non-pharmacy tables use: **Description | Qty | ₹/Unit | Total | [del]** (or Description | Qty | Amount | [del] in the bill card expanded view)

## InvoicePreviewModal
- Only show `bills.filter(b => b.paymentStatus !== "paid")` — never include paid bills in preview
- Total label: "Outstanding" (not "Total") when showing open bills
- Pharmacy group renders as a full table (Medicine / Frequency / Duration / Amount columns)
- Other groups render as a flat divider list

## Data scoping — critical rule
- Bills by bookingId: `/api/auth/clinic/bills/booking/:id` — safe, exact scope
- Patient bill history: by email then phone — OK for billing history display only (read-only)
- **DO NOT** fetch clinical records by phone for billing context — phone collisions cause wrong-patient data to appear when family members share a number. The "Past Prescriptions" section was removed from billing for this reason.
- Current booking prescription: `/api/clinical-records/booking/:bookingId` — safe (bookingId scoped)

## Deduplication known bug
Line-item dedup (handleLoadPrescription) matches by first word of description — "Amoxicillin 250mg" and "Amoxicillin 500mg" treated as duplicates. Low priority; no fix applied yet.

## `serviceGroups` in `renderBillCard`
Uses `origIdx` (item's index in the original `services` array) for deletion mutations — never use the filtered-array index.

## `groupByDate` for older bills
Older bills displayed with date-divider labels via `groupByDate()`. Collapsible via `expandedDates` state (a `Set<string>`).

## `previewCollapsed` state
The open invoice body is collapsible. State: `previewCollapsed` boolean, toggled by the chevron button in the sticky toolbar.
