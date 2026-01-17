# Local Deployment and Build Documentation

This guide provides detailed instructions to replicate a production-like environment (similar to Render) on your local machine.

## 🛠 Prerequisites
- **Node.js**: v20 or higher
- **PostgreSQL**: A running instance (local or remote)
- **Git**: To clone the repository

---

## 🏗 Setup & Installation

1. **Clone and Install**:
   ```bash
   git clone <your-repo-url>
   cd book-my-slot
   npm install
   ```

2. **Database Setup**:
   - Ensure PostgreSQL is running.
   - Create a new database (e.g., `bookmyslot`).
   - Run the migration/push command to sync the schema:
     ```bash
     npm run db:push
     ```

---

## 🌍 Environment Configuration

Create a `.env` file in the root directory with the following variables. This setup mimics the production environment by using the Standalone Authentication mode.

```env
# Database Connection
DATABASE_URL=postgresql://postgres:password@localhost:5432/bookmyslot

# Security
SESSION_SECRET=your_long_random_session_secret_here

# Standalone Admin Credentials (Production-like Auth)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=strongpassword123

# URLs & Networking
PORT=5000
FRONTEND_URL=http://localhost:5000
VITE_API_URL=http://localhost:5000

# Environment Mode
NODE_ENV=production
```

---

## 🚀 Building for Production (Local)

To truly replicate the Render environment, you should build the application and run the production artifacts.

1. **Build the Application**:
   This command builds both the frontend (Vite) and the backend (Standalone script).
   ```bash
   npm run build
   ```
   *Output directories:*
   - `dist/public`: Compiled React frontend.
   - `dist-backend`: Compiled Express server.

2. **Run the Production Build**:
   Instead of using the development server, run the compiled files directly:
   ```bash
   node dist-backend/server.cjs
   ```

---

## 🔗 Endpoint Summary

| Component | URL | Description |
|-----------|-----|-------------|
| **App Frontend** | `http://localhost:5000` | Main application entry point |
| **Admin Login** | `http://localhost:5000/admin` | Login with your `ADMIN_EMAIL` |
| **API Base** | `http://localhost:5000/api` | Backend API endpoints |

---

## 🧪 Verifying the Deployment

1. Open `http://localhost:5000` in your browser.
2. Navigate to `/admin` and log in with the credentials set in your `.env`.
3. Create a clinic and verify you can log in as a clinic staff member.
4. Try booking a slot as a public user to ensure the flow is working end-to-end.

---

## 📝 Troubleshooting

- **CORS Errors**: Ensure `FRONTEND_URL` and `VITE_API_URL` are both set to `http://localhost:5000` for a unified local deployment.
- **Auth Issues**: If you see Replit login prompts, make sure `REPL_ID` is **NOT** set in your `.env` (or set to something other than a real Replit ID).
- **Database Connection**: Verify your `DATABASE_URL` matches your local PostgreSQL credentials.
