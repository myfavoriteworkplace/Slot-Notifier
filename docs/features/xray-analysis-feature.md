# X-Ray Analysis Feature

## Overview

The **X-Ray Analysis** tab in the Doctor Dashboard allows doctors to upload a dental X-ray image and receive AI-powered analysis from a custom YOLO model hosted on Hugging Face Spaces. Detected findings are returned with labels, confidence scores, and bounding box coordinates, which are overlaid directly on the image in the browser.

This feature is available exclusively to authenticated doctors.

---

## Architecture

```
Doctor's Browser
      │
      │  POST /api/xray/analyse  (multipart/form-data)
      ▼
BookMySlot Express Backend  (server/routes.ts + server/aiService.ts)
      │
      │  POST /analyse-xray  (multipart/form-data, forwarded)
      ▼
Hugging Face Space
https://itsmyfavoriteworkplace-bookmyslot-ai-service.hf.space
      │
      │  JSON response { success, analysis: { findings } }
      ▼
Express Backend returns { success, findings[] }
      │
      ▼
Doctor's Browser renders overlay on image
```

The browser never contacts Hugging Face directly. All requests are proxied through the Express backend, which:
1. Validates the doctor session
2. Wakes the Hugging Face Space if it is sleeping (cold-start ping)
3. Forwards the image using `form-data` and Node's native `fetch`
4. Returns the findings to the frontend

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AI_SERVICE_URL` | No | `https://itsmyfavoriteworkplace-bookmyslot-ai-service.hf.space` | Base URL of the Hugging Face Space that runs the YOLO model. Change this if you move the AI service to a different host or upgrade to a paid Space. |

Set this in Replit's **Secrets / Environment Variables** panel, or in `.env` for local development.

> **Note:** This is not a secret (no API key required). It is a plain env var.

---

## Files Added / Changed

| File | Purpose |
|---|---|
| `server/aiService.ts` | Service module: health check, wake-and-analyse, TypeScript types for the HF API |
| `server/routes.ts` | New route: `POST /api/xray/analyse` — multer upload, doctor auth guard, calls `wakeAndAnalyse` |
| `client/src/components/XrayAnalysisTab.tsx` | Full React component: drag-and-drop upload, loading state, findings list, canvas bounding-box overlay |
| `client/src/pages/DoctorDashboard.tsx` | New `"xray"` tab added to `Tab` type, `NAV_ITEMS`, and conditional render block |
| `docs/xray-analysis-feature.md` | This document |

### npm packages added

| Package | Used in | Reason |
|---|---|---|
| `multer` | `server/routes.ts` | Parse `multipart/form-data` from the browser upload |
| `@types/multer` | dev | TypeScript types for multer |
| `form-data` | `server/aiService.ts` | Re-package the Buffer from multer into a multipart body for the Hugging Face request |

---

## API Route

### `POST /api/xray/analyse`

**Authentication:** Doctor session required (`sess.doctorLoggedIn === true`).

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | image file | Yes | The dental X-ray. Accepted: `image/jpeg`, `image/png`, `image/webp`, `image/bmp`. Max 10 MB. |

**Success Response — 200 OK**

```json
{
  "success": true,
  "findings": [
    {
      "class_id": 0,
      "label": "Finding Type 1",
      "confidence": 91.5,
      "location": { "x": 312.4, "y": 215.8, "width": 48.2, "height": 36.7 }
    }
  ]
}
```

**No findings — 200 OK**

```json
{ "success": true, "findings": [] }
```

**Error responses**

| HTTP Status | Meaning |
|---|---|
| 400 | No file provided |
| 401 | Not authenticated as a doctor |
| 504 | Hugging Face timed out (60 s+) |
| 502 | AI service returned `success: false` |
| 503 | Network error reaching Hugging Face |

---

## Hugging Face Space Details

| Item | Value |
|---|---|
| Base URL | `https://itsmyfavoriteworkplace-bookmyslot-ai-service.hf.space` |
| Health check | `GET /` → `{ "service": "BookMySlot AI", "status": "running" }` |
| Analyse endpoint | `POST /analyse-xray` — multipart, field name `file` |
| Swagger docs | `https://itsmyfavoriteworkplace-bookmyslot-ai-service.hf.space/docs` |
| Model | YOLOv8 dental findings detector (`models/best.pt`) |
| Max file size | 10 MB |

### Cold-Start / Sleep Behaviour

Hugging Face free-tier Spaces **go to sleep after 48 hours of inactivity**. When asleep, the first request wakes the container and loads the YOLO model — this takes **30–60 seconds**.

**How BookMySlot handles this:**

1. `isAiServiceHealthy()` pings `GET /` with a 10 s timeout.
2. If the ping fails (Space was asleep), the server waits 5 seconds to allow the container to boot.
3. `analyseXray()` then sends the image with a **90 s timeout** (higher than the 60 s recommended minimum to account for worst-case cold starts).

The frontend shows a spinner with the message *"This may take up to 60 seconds on first use"* so doctors are not confused by the delay.

**To eliminate cold starts:** Set up a free uptime monitor (e.g. UptimeRobot) to ping `GET /` every 20 minutes, or upgrade the Hugging Face Space to a paid always-on tier.

---

## Frontend Component — XrayAnalysisTab

Located at `client/src/components/XrayAnalysisTab.tsx`.

### Features

- **Drag-and-drop or click-to-browse** file upload zone
- **Image preview** before submitting
- **Inline loading overlay** on the image during analysis
- **Bounding-box canvas overlay** drawn directly on the image — each finding gets a coloured rectangle and a label with confidence
- **Toggle overlay** button to switch between the annotated view and the clean original
- **Per-finding cards** showing: label, confidence bar with colour coding (High / Medium / Low), and x/y/width/height pixel coordinates
- **Re-analyse** button to re-run without selecting a new file
- **Clinical disclaimer** banner reminding doctors this is decision support, not a diagnosis

### Confidence colour coding

| Range | Colour | Label |
|---|---|---|
| ≥ 85 % | Red | High |
| 65 – 84 % | Amber | Medium |
| < 65 % | Green | Low |

> Higher confidence = model is more certain. Red does not mean more dangerous — it means the model detected the finding with high certainty.

---

## Security Notes

- The route is protected by a doctor session check. Unauthenticated requests receive `401`.
- The Hugging Face URL is never exposed to the browser; it lives only in the server env var.
- Files are held in memory only (multer `memoryStorage`) and never written to disk or stored anywhere after the response is sent.
- File type is checked by MIME type (`image/*` only) and size is capped at 10 MB.

---

## Local Development

1. Ensure `AI_SERVICE_URL` is set in your `.env` (or omit it to use the default production URL).
2. Run `npm run dev` — the X-ray route is available at `POST http://localhost:5000/api/xray/analyse`.
3. Log in as a doctor in the browser, navigate to Doctor Dashboard → **Analyse X-Ray**.
4. Upload any dental X-ray JPEG/PNG; results appear within 5–60 seconds depending on whether the Space is warm.

---

## Future Improvements

- Save analysis results to a `xray_analyses` DB table linked to a booking or patient, creating a permanent clinical record.
- Display the DENTEX taxonomy labels once the model is retrained with validated class names.
- Add a "attach to patient record" button so findings can be included in a clinical note.
- Upgrade to a paid Hugging Face Space for always-on, sub-5-second inference.
