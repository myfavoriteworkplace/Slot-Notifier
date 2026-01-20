# BookMySlot API Documentation

This document describes the publicly available API endpoints for fetching major items from the database.

## Endpoints

### 1. List All Clinics
Fetches a list of all active clinics with their public information.

- **URL**: `/api/public/clinics`
- **Method**: `GET`
- **Response**: `200 OK`
- **Payload**:
```json
[
  {
    "id": 1,
    "name": "Demo Smile Clinic",
    "address": "123 Dental Lane",
    "username": "demo_clinic"
  },
  ...
]
```

### 2. Get Clinic Bookings
Fetches the list of bookings for a specific clinic using its username.

- **URL**: `/api/public/clinics/:username/bookings`
- **Method**: `GET`
- **URL Parameters**: 
  - `username`: The unique username of the clinic (e.g., `demo_clinic`, `smile_1`)
- **Response**: `200 OK`
- **Payload**:
```json
[
  {
    "id": 101,
    "customerName": "Rahul Sharma",
    "startTime": "2026-01-20T10:00:00.000Z",
    "endTime": "2026-01-20T11:00:00.000Z",
    "status": "verified"
  },
  ...
]
```

### 3. Health Check
Basic endpoint to verify service availability.

- **URL**: `/api/health`
- **Method**: `GET`
- **Response**: `200 OK`
- **Payload**:
```json
{
  "status": "ok",
  "backend": true,
  "database": true,
  "timestamp": "2026-01-20T15:30:00.000Z"
}
```
