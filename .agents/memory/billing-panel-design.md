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

## Pharmacy description parsing (`parsePharmacyDesc`)
Pharmacy line-item descriptions are stored as `"MedicineName × qty — schedule"`. `parsePharmacyDesc` splits at `×` to extract:
- medicine name (before `×`, trimmed)
- schedule string (after the quantity number, e.g. `1×/day · 5 days`)

**Why:** Keeps the display clean in the Pharmacy table (medicine column + schedule column) without changing the stored data format.

## `serviceGroups` in `renderBillCard`
Uses `origIdx` (the item's index in the original `services` array) so deletion mutations send the correct index to the backend even after category-based filtering. Never use the filtered-array index for delete.

## `groupByDate` for older bills
Older bills are displayed with date-divider labels by passing them through `groupByDate()`. The date groups are collapsible via `expandedDates` state (a `Set<string>`).

## `previewCollapsed` state
The open invoice body (line items + totals) is collapsible. State: `previewCollapsed` boolean, toggled by the chevron button in the sticky toolbar. Toolbar is always visible.
