# BookMySlot — Notification Service

## Context Document for AI Agents and Developers

> **How to use this document:**
> Read this before adding new notification triggers, modifying the WebSocket server, changing how the bell UI works, or debugging missing notifications in production. It covers the full end-to-end lifecycle of a notification from the database row to the browser toast.

---

## 1. Overview

BookMySlot has a **dual-channel notification system** for clinic admins:

| Channel | Technology | Purpose |
|---|---|---|
| **Real-time push** | WebSocket (`ws` package) | Instant bell + toast when a patient books |
| **Persistent store** | PostgreSQL `notifications` table | Survives page reloads; shown in the bell dropdown |
| **Polling fallback** | TanStack Query `refetchInterval` | Re-syncs every 30 seconds if the WebSocket drops |

When a patient completes a booking:
1. A `notifications` row is inserted for the clinic's `userId`
2. The new notification is broadcast over WebSocket to all connected browser tabs for that clinic
3. The clinic admin sees the bell badge increment **instantly** and a toast pops up
4. If the admin reloads the page, the notification is still there (loaded from DB via polling)

Doctors and the Super Admin also have the notification bell in the header but currently **only clinic bookings trigger notifications**. The bell still renders for them and shows any stored rows.

---

## 2. Database Schema

**File:** `shared/schema.ts`

```typescript
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),   // No FK — see §2.1
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
```

### 2.1 — The `userId` Field and the FK Bug (Important History)

The `userId` column originally had `.references(() => users.id)` — a foreign key pointing to the Replit Auth `users` table. This caused **every** `createNotification` call to fail silently with a PostgreSQL FK violation, because clinic and doctor IDs do not exist in the `users` table.

**The FK was removed** in May 2026 via a startup migration in `server/index.ts`:

```sql
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
```

**Do not re-add a foreign key** on `notifications.user_id`. The column is intentionally a free-form string identifier.

### 2.2 — `userId` Format Per Role

The `userId` stored in each notification row depends on who the notification is for:

| Role | `userId` value | Example |
|---|---|---|
| Clinic Admin | `String(clinic.id)` | `"5"` |
| Doctor | `String(doctor.id)` or `doctor.email` | `"12"` or `"dr.priya@clinic.com"` |
| Super Admin | `"superuser"` | `"superuser"` |

The GET `/api/notifications` route derives the userId the same way:

```typescript
// server/routes.ts — GET /api/notifications
const userId = String(sess.doctorId || sess.doctorEmail || sess.clinicId || sess.adminEmail || "superuser");
```

**Rule:** Always compute `userId` using this same expression when creating a notification, or the notification will not appear for the intended user.

---

## 3. Storage Layer

**File:** `server/storage.ts` — class `DatabaseStorage`

Three methods handle all notification persistence:

```typescript
// Insert a new notification row
async createNotification(insertNotification: InsertNotification): Promise<Notification>

// Fetch all notifications for a user, newest first
async getNotifications(userId: string): Promise<Notification[]>

// Mark a single notification as read
async markNotificationRead(id: number): Promise<Notification | undefined>
```

The `IStorage` interface in `server/storage.ts` declares all three. Always call these via the `storage` instance — never query the `notifications` table directly from a route.

---

## 4. Backend API Routes

**File:** `server/routes.ts`

### `GET /api/notifications`

Returns all notifications for the currently logged-in user. Returns `[]` for unauthenticated requests (does not return 401 — the bell silently stays empty for public users).

```typescript
app.get("/api/notifications", async (req, res) => {
  const sess = req.session as any;
  if (!sess?.adminLoggedIn && !sess?.doctorLoggedIn) return res.json([]);
  const userId = String(sess.doctorId || sess.doctorEmail || sess.clinicId || sess.adminEmail || "superuser");
  const userNotifications = await storage.getNotifications(userId);
  res.json(userNotifications);
});
```

### `PATCH /api/notifications/:id/read`

Marks one notification as read. Requires `isAuthenticated`. Returns the updated notification object.

---

## 5. WebSocket Server

**File:** `server/routes.ts` — inside `registerRoutes(httpServer, app)`

### Setup

```typescript
const wss = new WebSocketServer({ server: httpServer, path: "/ws/notifications" });
const clinicSockets = new Map<string, Set<WebSocket>>();
```

**Critical:** The path `/ws/notifications` is required. Without a path, the WebSocket server intercepts **all** upgrade requests on the HTTP server — including Vite's HMR connection — which crashes the dev server with "Invalid WebSocket frame" errors.

### Client Authentication Protocol

After connecting, the browser client sends one message to register itself:

```json
{ "type": "auth", "clinicId": 5 }
```

The server adds the socket to the map and acknowledges:

```json
{ "type": "auth_ok" }
```

If the client does not send `auth`, it will never receive any broadcasts (the socket is silently ignored).

### The `clinicSockets` Map

```typescript
// clinicId (string) → Set of connected WebSocket clients for that clinic
const clinicSockets = new Map<string, Set<WebSocket>>();
```

Multiple browser tabs from the same clinic each have their own WebSocket entry in the Set. All tabs receive the broadcast simultaneously.

### `broadcastToClinic(clinicId, data)`

```typescript
function broadcastToClinic(clinicId: string, data: object) {
  const clients = clinicSockets.get(clinicId);
  if (!clients) return;
  const message = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}
```

### Cleanup on Disconnect

When a socket closes, it is removed from its clinic's Set to prevent memory leaks and sending to dead connections:

```typescript
ws.on("close", () => {
  if (registeredClinicId) {
    clinicSockets.get(registeredClinicId)?.delete(ws);
  }
});
```

---

## 6. Triggering a Notification: Booking Flow

**File:** `server/routes.ts` — `POST /api/public/bookings`

After the booking is created and emails/WhatsApp messages are sent, this block runs:

```typescript
try {
  const notifMessage = `New booking from ${customerName} on ${requestedStart.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short'
  })} at ${requestedStart.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true
  })}`;

  const notification = await storage.createNotification({
    userId: String(clinic.id),
    message: notifMessage,
    read: false,
  });

  broadcastToClinic(String(clinic.id), { type: "new_booking", notification });
} catch (e: any) {
  console.error('[NOTIFICATION] Failed to create or broadcast:', e.message);
}
```

**Key points:**
- This is wrapped in its own `try/catch` so a notification failure never breaks the booking response
- The `broadcastToClinic` call happens **after** the DB insert, so the broadcast payload contains the full notification object (including `id` and `createdAt`)
- If no WebSocket clients are connected for the clinic, `broadcastToClinic` is a no-op — the notification is still persisted in the DB

### Adding Notifications to Other Routes

To send a notification from any other route, follow this same pattern:
1. Compute `userId` using the same formula as the GET route
2. Call `storage.createNotification({ userId, message, read: false })`
3. Call `broadcastToClinic(userId, { type: "your_event_type", notification })`

The `broadcastToClinic` function is defined at the top of `registerRoutes`, so it is in scope for all routes defined inside that function.

---

## 7. Frontend: Hooks

**File:** `client/src/hooks/use-notifications.ts`

### `useNotifications()`

Fetches and caches the notification list using TanStack Query. Polls every 30 seconds as a fallback.

```typescript
export function useNotifications() {
  return useQuery({
    queryKey: [api.notifications.list.path],  // "/api/notifications"
    queryFn: async () => { ... },
    refetchInterval: 30000,
  });
}
```

### `useMarkNotificationRead()`

Mutation that sends `PATCH /api/notifications/:id/read` and then invalidates the notification query cache.

### `useNotificationSocket(clinicId?: number)`

Opens a WebSocket connection to `/ws/notifications`, authenticates with the clinic's ID, and handles incoming messages.

**Full behaviour:**
1. Opens `ws[s]://<host>/ws/notifications` (protocol auto-detected from `window.location`)
2. On `open`: sends `{ type: "auth", clinicId }`
3. On `message` of type `new_booking`:
   - Calls `queryClient.invalidateQueries({ queryKey: [api.notifications.list.path] })` — instant bell badge update
   - Shows a `toast()` — "New Booking Request: [message]" — even if the dropdown is closed
4. On `close`: schedules a reconnect after 5 seconds
5. On component unmount: closes the socket and cancels any pending reconnect timer

```typescript
export function useNotificationSocket(clinicId?: number) {
  // Does nothing if clinicId is undefined — safe to call for all user types
}
```

---

## 8. Frontend: UI Integration

**File:** `client/src/components/Header.tsx`

### Where the hooks are called

```typescript
export function Header() {
  const { clinic } = useClinicAuth();

  const { data: notifications = [] } = useNotifications();     // polling + cache
  const { mutate: markRead } = useMarkNotificationRead();
  useNotificationSocket(clinic?.id ?? undefined);              // WebSocket (only active when clinicId is set)
  // ...
}
```

`useNotificationSocket` is called with `undefined` when the user is not a clinic admin (e.g. doctor or super admin). In that case the hook returns immediately without opening any socket.

### The `NotificationBell` component

Defined as a constant inside `Header` (not a separate file). It renders:
- A bell icon with a red badge showing the count of unread notifications
- A dropdown list of all notifications (most recent first)
- Each item has a "mark as read" button
- Rendered in three places: the Superuser block, the Clinic Admin block, and the Doctor block

---

## 9. Message Payload Reference

### Client → Server (after connect)

```json
{ "type": "auth", "clinicId": 5 }
```

### Server → Client: auth acknowledged

```json
{ "type": "auth_ok" }
```

### Server → Client: new booking

```json
{
  "type": "new_booking",
  "notification": {
    "id": 42,
    "userId": "5",
    "message": "New booking from Rahul K. on 23 May at 10:30 AM",
    "read": false,
    "createdAt": "2026-05-23T05:00:00.000Z"
  }
}
```

---

## 10. Limitations & Things to Know When Extending

| Limitation | Detail |
|---|---|
| **Only clinic admins receive WebSocket pushes** | Doctors and super admins can see stored notifications via polling but do not get real-time pushes. To add push for doctors, compute `userId` as `String(doctor.id)` and store a separate `doctorSockets` map, or refactor to use `userId` as the key for both. |
| **In-memory socket map** | `clinicSockets` lives in the Node.js process memory. If Render restarts the server or you run multiple instances, the map is lost. Clients reconnect automatically after 5 seconds (reconnect timer in the hook). For multi-instance setups, a shared pub/sub layer (Redis) would be needed. |
| **No authentication validation on WS auth message** | The server trusts the `clinicId` sent by the client. This is acceptable because: (a) the clinicId is not secret, (b) notifications only show the booking message text, (c) the actual notification data is fetched via the authenticated REST endpoint. If you add sensitive data to broadcasts, add server-side session validation on the WebSocket upgrade request. |
| **Toast requires clinic to have the tab open** | If the clinic admin's browser is closed, the WebSocket is not connected. The notification is still stored in the DB and will appear when they next log in (via the 30s poll on mount). |
| **No notification categories or priority** | All notifications use the same schema. If you need different types (e.g. cancellations, doctor declines), add a `type` varchar column to the `notifications` table and filter/style accordingly in `NotificationBell`. |

---

## 11. File Reference

| File | Role |
|---|---|
| `shared/schema.ts` | `notifications` table, `InsertNotification` type, `Notification` type |
| `server/storage.ts` | `createNotification`, `getNotifications`, `markNotificationRead` methods |
| `server/routes.ts` | WebSocket server setup, `broadcastToClinic`, GET/PATCH notification routes, booking trigger |
| `server/index.ts` | Startup migration to drop the FK constraint |
| `client/src/hooks/use-notifications.ts` | `useNotifications`, `useMarkNotificationRead`, `useNotificationSocket` |
| `client/src/components/Header.tsx` | `NotificationBell` component, hook call site |

---

*Last updated: May 2026*
