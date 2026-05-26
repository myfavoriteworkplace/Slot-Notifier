# Notification Layer

## Overview

All user-facing feedback in BookMySlot flows through a single utility: `client/src/lib/notify.ts`.  
Direct `toast()` / `useToast()` calls have been removed from every page and component and replaced with typed `notify.*` calls.

---

## Files

| File | Role |
|---|---|
| `client/src/lib/notify.ts` | Central `notify` utility — thin wrapper over `toast()` |
| `client/src/lib/errors.ts` | `humaniseError(err)` — maps HTTP/network errors to plain English |
| `client/src/components/NetworkStatusBanner.tsx` | Top-of-page banner for offline / server-down states |

---

## `notify` API

```ts
import { notify } from "@/lib/notify";
```

| Method | Use for | Auto-dismisses? |
|---|---|---|
| `notify.success(title, opts?)` | Completed action | Yes (4 s) |
| `notify.info(title, opts?)` | Neutral information | Yes (5 s) |
| `notify.warning(title, opts?)` | Soft validation nudge | Yes (6 s) |
| `notify.error(title, opts?)` | Hard errors, failed actions | No (persistent) |
| `notify.critical(title, opts?)` | Access denied, fatal failures | No (persistent) |
| `notify.apiError(err, fallback?)` | Catch blocks from API calls | No (persistent) |

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

## `humaniseError`

```ts
import { humaniseError } from "@/lib/errors";
const msg = humaniseError(err); // always returns a string
```

Maps common failure modes to friendly text:

| Condition | Output |
|---|---|
| Network offline | "No internet connection — please check your network." |
| `fetch` failed | "Could not reach the server. Please try again." |
| HTTP 400 | Uses server `message` field if present |
| HTTP 401 | "Your session has expired. Please log in again." |
| HTTP 403 | "You don't have permission to do that." |
| HTTP 404 | "The requested item was not found." |
| HTTP 409 | "This action conflicts with existing data." |
| HTTP 422 | "Some of the submitted data is invalid." |
| HTTP 429 | "Too many requests — please wait a moment." |
| HTTP 500+ | "Something went wrong on the server. Please try again." |
| Unknown | Falls back to `err.message` or a generic string |

---

## `NetworkStatusBanner`

Mounted once in `App.tsx` above `<main>`. Polls `/api/health` every 30 s and listens to browser `online/offline` events.

| State | Banner |
|---|---|
| Offline | Amber — "You're offline. Changes may not save." |
| Server unreachable | Red — "Server is unreachable." + Retry button |
| Back online | Green flash for 3 s, then hides |

---

## Usage rules

1. **Never import `useToast` in pages or components.** All feedback goes through `notify`.
2. **`notify.apiError` in every catch block** — avoids leaking raw HTTP status strings.
3. **`notify.warning` for soft validation** (missing fields, empty state). Reserve `notify.error` for actions that actually failed.
4. **`notify.critical` for access-control failures** (redirect + toast on forbidden routes).
5. The `useToast` hook remains in `use-toast.ts`, `use-notifications.ts`, and `toaster.tsx` — these are infrastructure files and should not be changed.

---

## Files migrated

All `useToast` calls replaced across 20+ files including:

- `client/src/pages/Admin.tsx`
- `client/src/pages/ClinicDashboard.tsx` (6 200 lines)
- `client/src/pages/DoctorDashboard.tsx`
- `client/src/pages/RegisterClinic.tsx`
- `client/src/pages/Book.tsx`
- `client/src/pages/DoctorPublicProfile.tsx`
- `client/src/components/InventoryPanel.tsx`
- `client/src/components/NetworkStatusBanner.tsx`
- `client/src/hooks/use-slots.ts`
- `client/src/hooks/use-bookings.ts`
- `client/src/lib/auth-utils.ts`
- Plus: `SetupPassword`, `ConsentForm`, `ImageUpload`, `Dashboard`, `WebsiteConfigPanel`, `BillingHistoryPanel`, `ExportDataPanel`, `ClinicalRecordsTab`
