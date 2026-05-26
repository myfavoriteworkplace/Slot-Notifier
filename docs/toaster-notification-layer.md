# Toaster Notification Layer

## Overview

All user-facing feedback in BookMySlot flows through a single utility: `client/src/lib/notify.ts`.  
Direct `toast()` / `useToast()` calls have been removed from every page and component and replaced with typed `notify.*` calls.

The toaster renders **5 semantic variants**, each with a distinct icon, left accent bar, and colour — so users instantly read the severity at a glance. Auto-dismissing toasts (success / info / warning) include an animated progress bar showing the remaining display time.

---

## Files

| File | Role |
|---|---|
| `client/src/lib/notify.ts` | Central `notify` utility — thin wrapper over `toast()` |
| `client/src/lib/errors.ts` | `humaniseError(err)` — maps HTTP/network errors to plain English |
| `client/src/components/ui/toast.tsx` | Radix Toast primitives with 5-variant CVA styling |
| `client/src/components/ui/toaster.tsx` | Renderer — icons, accent bar, progress bar |
| `client/src/components/NetworkStatusBanner.tsx` | Top-of-page banner for offline / server-down states |

---

## `notify` API

```ts
import { notify } from "@/lib/notify";
```

| Method | Variant | Icon | Auto-dismisses? | Use for |
|---|---|---|---|---|
| `notify.success(title, opts?)` | `success` | ✅ CheckCircle2 (green) | Yes — 4 s | Completed actions |
| `notify.info(title, opts?)` | `info` | ℹ Info (blue) | Yes — 5 s | Neutral information |
| `notify.warning(title, opts?)` | `warning` | ⚠ AlertTriangle (amber) | Yes — 6 s | Soft validation nudges |
| `notify.error(title, opts?)` | `error` | ✕ XCircle (red) | No (persistent) | Hard errors, failed actions |
| `notify.critical(title, opts?)` | `critical` | 🛡 ShieldAlert (dark red) | No (persistent) | Access denied, fatal failures |
| `notify.apiError(err, fallback?)` | `error` | ✕ XCircle (red) | No (persistent) | Catch blocks from API calls |

All methods accept an optional second argument `{ description?: string }`.

### `notify.apiError`

Passes the error through `humaniseError()` first, so raw HTTP status codes and network messages are converted to readable English before display.

```ts
// Catch block pattern
} catch (err: any) {
  notify.apiError(err, "Could not save profile");
}

// Mutation onError pattern
onError: (err: any) => notify.apiError(err, "Failed to book slot"),
```

---

## Visual Variants

Each toast has:
- **Left 4 px coloured accent bar** — instant severity signal
- **Icon in a soft tinted bubble** — reinforces the type
- **Bold title + muted description** — clear text hierarchy
- **Animated progress bar** (success / info / warning only) — shrinks from full-width to zero over the dismiss duration

| Variant | Accent / Icon colour | Background | Dismisses |
|---|---|---|---|
| `success` | Green `#22C55E` | White, green border | 4 s |
| `info` | Blue `#3B82F6` | White, blue border | 5 s |
| `warning` | Amber `#F59E0B` | White, amber border | 6 s |
| `error` | Red `#EF4444` | White, red border | Never |
| `critical` | Deep red `#7F1D1D` | Dark red bg, white text | Never |

---

## `humaniseError`

```ts
import { humaniseError } from "@/lib/errors";
const msg = humaniseError(err); // always returns { title, description? }
```

Maps common failure modes to friendly text:

| Condition | Title | Description |
|---|---|---|
| Network offline | "You appear to be offline" | "Please check your internet connection and try again." |
| `fetch` failed | "Connection problem" | "Could not reach the server. Please try again." |
| HTTP 400 | "Invalid request" | "Please check the information you entered." |
| HTTP 401 | "Session expired" | "Please log in again to continue." |
| HTTP 403 | "Access denied" | "You don't have permission to do that." |
| HTTP 404 | "Not found" | "The item you're looking for doesn't exist." |
| HTTP 409 | "Already taken" | "This slot or record is already in use." |
| HTTP 422 | "Validation error" | "Please check the information you entered." |
| HTTP 429 | "Too many requests" | "Please wait a moment and try again." |
| HTTP 500+ | "Something went wrong" | "We hit an error on our end. Please try again." |
| Unknown | Falls back to `err.message` or generic string | — |

---

## `NetworkStatusBanner`

Mounted once in `App.tsx` above `<main>`. Polls `/api/health` every 30 s and listens to browser `online/offline` events.

| State | Banner |
|---|---|
| Offline | Amber — "You're offline — please check your internet connection." |
| Server unreachable | Red — "Server is unreachable — we're working on it. Please try again." + Retry button |

---

## Copy Standards

All notify call-sites follow these rules:

| Field | Rule | Example |
|---|---|---|
| `title` | Short noun phrase · sentence case · no punctuation | `"Booking confirmed"` `"Upload failed"` |
| `description` | One complete sentence with context · ends with period | `"Your appointment has been saved."` |
| `title` (error) | What failed, not the exception message | `"Could not save profile"` not `err.message` |
| URL clipboard | Always `"Copied to clipboard"` · no URL as description | — |

---

## Usage Rules

1. **Never import `useToast` in pages or components.** All feedback goes through `notify`.
2. **`notify.apiError` in every catch block** — avoids leaking raw HTTP status strings or `err?.message`.
3. **`notify.warning` for soft validation** (missing fields, empty state). Reserve `notify.error` for actions that actually failed.
4. **`notify.critical` for access-control failures** (redirect + toast on forbidden routes).
5. The `useToast` hook remains in `use-toast.ts`, `use-notifications.ts`, and `toaster.tsx` — infrastructure files, do not change.

---

## Files With notify Calls (20+)

- `client/src/pages/Admin.tsx`
- `client/src/pages/ClinicDashboard.tsx`
- `client/src/pages/DoctorDashboard.tsx`
- `client/src/pages/RegisterClinic.tsx`
- `client/src/pages/Book.tsx`
- `client/src/pages/DoctorPublicProfile.tsx`
- `client/src/pages/SetupPassword.tsx`
- `client/src/components/InventoryPanel.tsx`
- `client/src/components/NetworkStatusBanner.tsx`
- `client/src/components/BillingHistoryPanel.tsx`
- `client/src/components/ClinicalRecordsTab.tsx`
- `client/src/components/ExportDataPanel.tsx`
- `client/src/components/ImageUpload.tsx`
- `client/src/components/WebsiteConfigPanel.tsx`
- `client/src/hooks/use-slots.ts`
- `client/src/hooks/use-bookings.ts`
- `client/src/lib/auth-utils.ts`
- `client/src/pages/ConsentForm.tsx`
