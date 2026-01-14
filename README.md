# BookMySlot - Dental Clinic Appointment Booking System

A robust, full-stack appointment booking application designed for dental clinics. It features role-based access control, real-time notifications, and supports both Replit native and external cloud deployments.

---

## 🏗 System Architecture

The application follows a modern full-stack architecture designed for scalability and ease of deployment.

### 1. Frontend (Client-Side)
- **Framework**: React 18 with TypeScript.
- **Styling**: Tailwind CSS + shadcn/ui (Radix UI primitives).
- **State Management**: TanStack Query (v5) for efficient server state synchronization and caching.
- **Routing**: `wouter` for lightweight, hook-based client-side routing.
- **Build Tool**: Vite, providing fast HMR (Hot Module Replacement) during development.

### 2. Backend (Server-Side)
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript (using `tsx` for execution).
- **ORM**: Drizzle ORM for type-safe database interactions.
- **Authentication**:
  - **Replit Mode**: Uses Replit OIDC for seamless, zero-config auth.
  - **External Mode**: Uses Passport.js with a Local Strategy (email/password) based on environment variables.
- **Middleware**: Custom logging, error handling, and session management (using `express-session`).

### 3. Database & Storage
- **Database**: PostgreSQL (works with Neon, Supabase, or local PG).
- **Schema Management**: Drizzle Kit handles migrations and schema "push" operations.
- **Persistence**: Managed through an `IStorage` interface (`server/storage.ts`), making it easy to swap storage backends.

---

## 🔄 Core Workflows

### 🛠 Development Workflow
1. **Schema Changes**: Modify `shared/schema.ts`.
2. **Database Update**: Run `npm run db:push` to sync the database.
3. **Execution**: `npm run dev` starts both Vite and Express. Vite proxies API requests to Express, creating a unified development experience.

### 🔐 Authentication Flow
1. **Replit Environment**:
   - App detects `REPL_ID`.
   - Uses Replit OIDC via `@replit/oidc`.
   - Users claim "Superuser" status on the first login to the `/admin` dashboard.
2. **Standalone Environment (Render/Local)**:
   - App detects `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
   - Switches to Passport Local strategy.
   - Admin manages clinics; clinics log in with credentials set by the Admin.
   - **Important**: For Render, ensure both variables are set in the dashboard to enable this mode.

---

## 🚀 Deployment Guide

### A. Replit Deployment (Easiest)
Replit handles the infrastructure, database, and auth automatically.
1. Click the **Deploy** button in the Replit sidebar.
2. The system automatically provisions a PostgreSQL database and sets `DATABASE_URL`.
3. Replit OIDC handles auth automatically.
4. Your app is live at `https://[project-name].[username].replit.app`.

### B. Render Deployment (Professional)
Deployment on Render is split into three parts: Database, Backend, and Frontend.

#### 1. Provision PostgreSQL
- New > PostgreSQL.
- Name: `bookmyslot-db`.
- Copy the **Internal Database URL** for the backend and **External Database URL** for local migration.

#### 2. Deploy Backend (Web Service)
- **Build Command**: `npm install && npm run db:push && npx tsx script/build-standalone.ts`
- **Start Command**: `node dist-backend/server.cjs`
- **Required Env Vars**:
  - `DATABASE_URL`: Your Internal DB URL.
  - `SESSION_SECRET`: A long random string.
  - `ADMIN_EMAIL`: Your login email.
  - `ADMIN_PASSWORD`: Your login password.
  - `FRONTEND_URL`: `https://your-app.onrender.com` (CORS setup).
  - `NODE_ENV`: `production`.

#### 3. Deploy Frontend (Static Site)
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist/client`
- **Required Env Vars**:
  - `VITE_API_URL`: `https://your-backend-service.onrender.com`.

---

## 💻 Local Development Setup

### 1. Prerequisites
- **Node.js**: v20 or higher.
- **Database**: A running PostgreSQL instance.

### 2. Setup
```bash
git clone <url>
npm install
```

### 3. Environment (.env)
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
SESSION_SECRET=your_32_char_secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=password123
REPL_ID=local_dev
PORT=5000
```

### 4. Initialize & Run
```bash
npm run db:push
npm run dev
```
Access the app at `http://localhost:5000`.

---

## 🧪 Troubleshooting

| Issue | Solution |
|-------|----------|
| `tsx not found` | Run `npm install` again. |
| `DATABASE_URL` error | Ensure your `.env` is correct and PG is running. |
| `bcrypt` build error | We use `bcryptjs` now to avoid native build issues. |
| 401 Unauthorized | Check if you are logged in or if your session secret changed. |

---

## 📜 License
MIT
