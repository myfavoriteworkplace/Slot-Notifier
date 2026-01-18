# 🚀 Local Production Simulation Guide

Follow these steps to replicate the production environment (Render/External Cloud) on your local machine.

## Prerequisites
- Node.js (v18+)
- PostgreSQL database
- Environment variables configured

## Step-by-Step Setup

### 1. Environment Configuration
Create a `.env.local` file (or copy from `.env.local.example`). Ensure it contains your production-simulated settings:
```bash
NODE_ENV=production
DATABASE_URL=your_postgres_url
SESSION_SECRET=your_secure_random_string
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_password
PORT=5000
```

### 2. Build the Application
You must compile the TypeScript backend and build the React frontend for production:
```bash
# Install dependencies
npm install

# Build both frontend and backend
npm run build
```
This generates a `dist/` folder containing the optimized production assets.

### 3. Initialize the Database
Ensure your database schema is up to date with the production models:
```bash
npx drizzle-kit push
```

### 4. Run the Production Server
Start the server in production mode. We provide a helper script for this:
```bash
# Using the helper script
chmod +x run-local.sh
./run-local.sh
```
*Alternatively, run directly:*
```bash
NODE_ENV=production node dist/index.cjs
```

## 🔍 Verifying the Setup

Once the server is running, you can verify the "Production Behavior" using the following endpoints:

| Action | URL | Expected Result |
|--------|-----|-----------------|
| **Access App** | `http://localhost:5000` | Should load the built React app |
| **System Health** | `http://localhost:5000/api/health` | Returns JSON with `status: "ok"` |
| **Admin API** | `http://localhost:5000/api/auth/admin/login` | Responds to POST with auth logic |

## 💡 Troubleshooting
- **404 Errors**: If API calls fail, ensure the build completed successfully and `NODE_ENV` is set to `production`.
- **Database Connection**: Verify your `DATABASE_URL` is accessible from your terminal.
- **Port Conflict**: If port 5000 is in use, change the `PORT` in your `.env.local`.
