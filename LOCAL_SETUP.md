# Local Setup Guide (Replicating Render Environment)

Follow these steps to set up the project on your local machine with an environment that mirrors the Render.com production deployment.

## 1. Prerequisites
- **Node.js**: v20 or higher.
- **PostgreSQL**: A running instance (local or hosted like Supabase/Neon).
- **Git**: For version control.

## 2. Initial Setup
```bash
# Clone the repository
git clone <your-repo-url>
cd BookMySlot

# Install dependencies
npm install
```

## 3. Environment Configuration
Create a `.env` file in the root directory. This configuration mimics how Render handles the backend and database.

```env
# Database Connection (Use your local or external PG URL)
DATABASE_URL=postgresql://postgres:password@localhost:5432/bookmyslot

# Security
SESSION_SECRET=a_very_long_random_string_for_production_security

# Admin Credentials (Matches your Render config)
ADMIN_EMAIL=itsmyfavoriteworkplace@gmail.com
ADMIN_PASSWORD=Arun@1234

# Environment Flags
NODE_ENV=production
PORT=5000

# Frontend URL (For CORS - replication of Render's cross-site policy)
FRONTEND_URL=http://localhost:5000
```

## 4. Replicating the "Production" Build
On Render, the project is built into a standalone package. To replicate this locally:

```bash
# 1. Sync the database schema
npm run db:push

# 2. Build the full-stack application
# This compiles the React frontend and the Express backend
npm run build

# 3. Start the "Production" server
# This runs the compiled backend just like Render does
node dist-backend/server.cjs
```

## 5. Verification Endpoints
Once running, you can verify your local environment mirrors Render using these URLs:

- **Combined Health**: `http://localhost:5000/api/health`
- **Backend Only**: `http://localhost:5000/api/health/backend`
- **Database Only**: `http://localhost:5000/api/health/database`

## 6. Common Issues & Differences
- **CORS**: In local `production` mode, ensure `FRONTEND_URL` in `.env` matches the port you are accessing (default `5000`).
- **Logs**: Look for `[API-RESPONSE]` in your terminal to see the exact data being sent to the UI, just like in the Render logs.
- **Database**: Ensure your `DATABASE_URL` is accessible. If using a local PG, make sure the database `bookmyslot` exists.
