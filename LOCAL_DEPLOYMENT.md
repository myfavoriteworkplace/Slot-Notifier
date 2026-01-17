# Local Environment Replication Guide

This guide provides detailed instructions to replicate a production-like environment (similar to Render) on your local machine for testing.

## 🏗 Setup & Installation

1. **Clone and Install**:
   ```bash
   git clone <your-repo-url>
   cd book-my-slot
   npm install
   ```

2. **Database Setup**:
   You have two options for your database:

   ### Option A: Local Database (Docker)
   We provide a `docker-compose.yml` to spin up a local PostgreSQL instance.
   ```bash
   docker-compose up -d
   ```
   *This starts a database at `localhost:5432` with user/pass: `postgres/postgres`.*

   ### Option B: Use External Render Database
   If you already have a database configured in Render, you can connect to it directly from your local machine:
   1. Go to your **Render Dashboard**.
   2. Select your PostgreSQL database.
   3. Copy the **External Database URL**.
   4. Paste it into your local `.env` as the `DATABASE_URL`.
   *Note: Ensure your local IP address is allowed in the Render database's "Access Control" settings if you have restricted access.*

3. **Database Initialization**:
   Sync the schema to your local database:
   ```bash
   npm run db:push
   ```

---

## 🌍 Environment Configuration

Create a `.env` file by copying the template:
```bash
cp .env.example .env
```

Ensure your `.env` contains these values to replicate the production behavior:

```env
# Database Connection (Matches docker-compose)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bookmyslot

# Security
SESSION_SECRET=a_very_long_random_string_for_local_testing

# Standalone Admin Credentials (Mimics Render Prod Auth)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin_password123

# URLs & Networking
PORT=5000
FRONTEND_URL=http://localhost:5000
VITE_API_URL=http://localhost:5000

# Environment Mode
NODE_ENV=production
```

---

## 🚀 Building & Running (Production Replication)

To test exactly like Render, follow these steps:

1. **Build the Application**:
   This compiles the React frontend and the backend server.
   ```bash
   npm run build
   ```

2. **Run the Production Build**:
   ```bash
   npm run start
   ```
   *The application will be accessible at `http://localhost:5000`.*

---

## 🧪 Testing the Flow

1. **Admin Access**: Navigate to `http://localhost:5000/login` and use your `ADMIN_EMAIL` credentials.
2. **Clinic Creation**: Create a new clinic in the admin dashboard.
3. **Clinic Access**: Navigate to `http://localhost:5000/clinic-login` and use the credentials you just created.
4. **Public Booking**: Navigate to the home page and book a slot to verify the end-to-end flow.

## 📝 Troubleshooting

- **CORS**: Ensure `FRONTEND_URL` and `VITE_API_URL` are identical in `.env`.
- **Database**: If `npm run db:push` fails, verify Docker is running with `docker ps`.
- **Auth**: If you are redirected to Replit login, ensure `REPL_ID` is NOT set in your `.env`.
