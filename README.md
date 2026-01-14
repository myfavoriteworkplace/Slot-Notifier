# BookMySlot - Dental Clinic Appointment Booking System

A full-stack appointment booking application for dental clinics with role-based access control.

## Features

- **Public Booking**: Customers can book appointments without login
- **Clinic Dashboard**: Individual clinics can manage their bookings with filtering, cancellation, and Excel export
- **Admin Panel**: Super users can register and manage clinics
- **Dual Authentication**: Supports both Replit OIDC (on Replit) and email/password auth (for external deployment)

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit OIDC or environment-based email/password

---

## Table of Contents

1. [Local Development Setup](#local-development-setup)
2. [Environment Variables Reference](#environment-variables-reference)
3. [Database Setup](#database-setup)
4. [Running the Application](#running-the-application)
5. [Render Deployment](#render-deployment)
6. [Authentication Modes](#authentication-modes)
7. [Troubleshooting](#troubleshooting)

---

## Local Development Setup

### Prerequisites

- Node.js 18+ 
- PostgreSQL database (local or cloud-hosted)
- npm or yarn

### Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd bookmyslot
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Create Environment File

Create a `.env` file in the project root:

```bash
# .env - Local Development

# Database (Required)
DATABASE_URL=postgresql://username:password@localhost:5432/bookmyslot

# Session (Required)
SESSION_SECRET=your-random-32-character-secret-key-here

# Admin Authentication (Required for local dev without Replit)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-secure-admin-password

# Optional - defaults to 5000
PORT=5000

# For local development without Replit OIDC
REPL_ID=local_dev
```

### Step 4: Set Up Database

Create the database tables:

```bash
npm run db:push
```

### Step 5: Start the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5000`

---

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `SESSION_SECRET` | Secret key for session encryption (32+ chars) | `a1b2c3d4e5f6g7h8i9j0...` |

### Authentication Variables

| Variable | Description | When Required |
|----------|-------------|---------------|
| `ADMIN_EMAIL` | Admin login email | External deployment (Render) |
| `ADMIN_PASSWORD` | Admin login password | External deployment (Render) |
| `REPL_ID` | Replit environment ID | Auto-set on Replit; set to `local_dev` for local |
| `ISSUER_URL` | OIDC issuer URL | Only for Replit OIDC (defaults to Replit) |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment mode | `development` |
| `FRONTEND_URL` | Frontend URL for CORS (split deployment) | Not set |

---

## Database Setup

### Local PostgreSQL

1. Install PostgreSQL on your machine
2. Create a database:
   ```sql
   CREATE DATABASE bookmyslot;
   ```
3. Update `DATABASE_URL` in your `.env` file

### Cloud PostgreSQL (Neon, Supabase, etc.)

1. Create a PostgreSQL database on your preferred provider
2. Copy the connection string to `DATABASE_URL`

### Run Migrations

```bash
npm run db:push
```

This creates all necessary tables including:
- `users` - User accounts
- `clinics` - Dental clinic information
- `slots` - Available time slots
- `bookings` - Customer appointments
- `notifications` - In-app notifications
- `sessions` - Session storage

---

## Running the Application

### Development Mode

```bash
npm run dev
```

This starts both the Express backend and Vite frontend dev server on port 5000.

### Production Build

```bash
# Build the frontend
npm run build

# Start production server
npm run start
```

### Standalone Backend (for split deployment)

```bash
# Build standalone backend
npx tsx script/build-standalone.ts

# Run standalone backend
node dist-backend/server.cjs
```

---

## Render Deployment

### Architecture Overview

- **Frontend**: Static site (React/Vite) - FREE on Render
- **Backend**: Web service (Node.js/Express) - ~$7/month after free tier
- **Database**: PostgreSQL - ~$7/month after free tier

### Step 1: Create PostgreSQL Database

1. Go to Render Dashboard > New > PostgreSQL
2. Choose a name (e.g., `bookmyslot-db`)
3. Select the free tier or paid plan
4. Click "Create Database"
5. Copy the "External Database URL" for later use

### Step 2: Deploy Backend Service

1. Go to Render Dashboard > New > Web Service
2. Connect your GitHub repository
3. Configure build settings:

**Build Command:**
```bash
npm install --include=dev && npm run db:push && npx tsx script/build-standalone.ts
```

**Start Command:**
```bash
node dist-backend/server.cjs
```

**Environment Variables:**

Create a `.env.production` reference (set these in Render dashboard):

```bash
# .env.production - Render Backend

# Database (from Step 1)
DATABASE_URL=<paste-external-database-url>

# Session - generate a strong random string
SESSION_SECRET=<generate-32+-character-random-string>

# Environment
NODE_ENV=production
PORT=10000

# Admin Authentication (Required on Render)
ADMIN_EMAIL=your-admin@example.com
ADMIN_PASSWORD=<secure-admin-password>

# CORS - your frontend URL
FRONTEND_URL=https://your-frontend.onrender.com
```

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | (paste from Step 1) |
| `SESSION_SECRET` | (generate 32+ char random string) |
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `ADMIN_EMAIL` | Your admin email |
| `ADMIN_PASSWORD` | Your secure admin password |
| `FRONTEND_URL` | Your frontend URL (e.g., `https://bookmyslot.onrender.com`) |

### Step 3: Deploy Frontend (Static Site)

1. Go to Render Dashboard > New > Static Site
2. Connect your GitHub repository
3. Configure:
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist/client`

**Environment Variables:**

```bash
# .env.production - Render Frontend (set in Render dashboard)
VITE_API_URL=https://your-backend.onrender.com
```

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | Your backend URL (e.g., `https://bookmyslot-api.onrender.com`) |

### Step 4: Verify CORS Configuration

Ensure your backend's `FRONTEND_URL` environment variable matches your frontend's actual URL exactly (including `https://`).

---

## Authentication Modes

BookMySlot supports two authentication modes:

### Mode 1: Replit OIDC (Default on Replit)

When running on Replit, the application uses Replit's built-in OpenID Connect authentication.

- Users log in via Replit's authentication
- First user to claim superuser access becomes the admin
- No additional configuration needed on Replit

### Mode 2: Environment-Based Auth (External Deployment)

When `ADMIN_EMAIL` and `ADMIN_PASSWORD` are both set, the application switches to simple email/password authentication.

**How it works:**
1. Admin navigates to `/admin`
2. Enters the email and password from environment variables
3. Gets superuser access to manage clinics

**Clinic Login:**
- Clinics log in at `/clinic-login`
- Use username/password set when creating the clinic

### First-Time Setup (Superuser Bootstrap)

**On Replit:**
1. Log in via Replit authentication
2. Navigate to `/admin`
3. Click "Claim Superuser Access" if you're the first user

**On Render (or external deployment):**
1. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in environment variables
2. Navigate to `/admin`
3. Log in with your admin credentials
4. You automatically have superuser access

---

## Application Routes

| Route | Description | Access |
|-------|-------------|--------|
| `/` | Home page with clinic selection | Public |
| `/book/:clinicId` | Book appointment at a clinic | Public |
| `/admin` | Clinic management panel | Superuser only |
| `/clinic-login` | Clinic staff login | Public |
| `/clinic-dashboard` | Clinic booking management | Authenticated clinic |

---

## Troubleshooting

### Database Connection Issues

**Error**: `DATABASE_URL, ensure the database is provisioned`

- Ensure `DATABASE_URL` is correctly set in your environment
- Check that the database server is running
- Verify the connection string format: `postgresql://user:password@host:port/database`

### Session Issues

**Error**: `Session not available`

- Ensure `SESSION_SECRET` is set
- Check that the `sessions` table exists in your database
- Run `npm run db:push` to create missing tables

### CORS Errors

**Error**: `Access-Control-Allow-Origin` errors

- Verify `FRONTEND_URL` matches your actual frontend URL exactly
- Include the protocol (`https://`)
- Don't include trailing slashes

### Authentication Issues

**On Replit**: Make sure `REPL_ID` is set (automatic on Replit)

**On Render/External**:
- Verify both `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set
- Check for typos in credentials
- Ensure you're using the correct login page (`/admin` for admin, `/clinic-login` for clinics)

### Build Errors

**Error**: `Cannot find module`

```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
```

**Error**: `tsx not found`

```bash
npm install -D tsx
```

---

## Sample .env Files

### Local Development (.env)

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bookmyslot

# Session
SESSION_SECRET=dev-secret-key-change-in-production-32chars

# Admin Auth (for local testing without Replit)
ADMIN_EMAIL=admin@test.com
ADMIN_PASSWORD=testpassword123

# Local dev mode
REPL_ID=local_dev
PORT=5000
```

### Production - Render Backend

```bash
# Database (from Render PostgreSQL)
DATABASE_URL=postgresql://user:pass@host.render.com:5432/bookmyslot

# Session (generate a strong random string)
SESSION_SECRET=generate-this-with-openssl-rand-base64-32

# Environment
NODE_ENV=production
PORT=10000

# Admin Auth
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=very-secure-password-here

# CORS
FRONTEND_URL=https://bookmyslot.onrender.com
```

### Production - Render Frontend

```bash
# API URL (your backend service URL)
VITE_API_URL=https://bookmyslot-api.onrender.com
```

---

## Costs Summary (Render)

| Service | Free Tier | After Free Tier |
|---------|-----------|-----------------|
| Frontend (Static Site) | Always Free | Always Free |
| Backend (Web Service) | 750 hours/month | ~$7/month |
| PostgreSQL | 1 month | ~$7/month |

**Total after free tier: ~$14/month**

---

## Alternative: Replit Deployment

If you want simpler deployment with no additional costs beyond your Replit plan, use Replit's built-in publishing which handles everything automatically including the database and authentication.

1. Click the "Deploy" button in Replit
2. Follow the prompts to publish your app
3. Your app will be live at a `.replit.app` domain

---

## License

MIT
