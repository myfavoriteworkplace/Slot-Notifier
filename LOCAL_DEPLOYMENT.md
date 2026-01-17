# Local Environment Replication Guide

This guide provides detailed instructions to replicate a production-like environment (similar to Render) on your local machine for testing.

## 🏗 Setup & Installation

1. **Clone and Install**:
   ```bash
   git clone <your-repo-url>
   cd book-my-slot
   npm install
   ```

2. **Database Setup (External Render DB)**:
   Since you are not using Docker, you will connect directly to your Render database:
   1. Go to your **Render Dashboard**.
   2. Select your PostgreSQL database.
   3. Copy the **External Database URL**.
   4. Paste it into your local `.env` file as the `DATABASE_URL`.
   *Note: Render databases usually allow all connections by default, but check "Access Control" if you have issues.*

3. **Database Initialization**:
   Sync the schema to your Render database:
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
PORT=5001
FRONTEND_URL=http://localhost:5001
VITE_API_URL=http://localhost:5001
SESSION_SECRET=your_random_secret_here

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
   *The application will be accessible at `http://localhost:5001`.*

---

## 🧪 Testing the Flow

1. **Database Session Store**: The application now uses PostgreSQL for session storage. Ensure your database is accessible.
2. **SSL Requirement**: For external Render databases, SSL is now enforced with `sslmode=require` and `rejectUnauthorized: false`.
3. **Admin Access**: Navigate to `http://localhost:5001/login` and use your `ADMIN_EMAIL` credentials.
2. **Clinic Creation**: Create a new clinic in the admin dashboard.
3. **Clinic Access**: Navigate to `http://localhost:5001/clinic-login` and use the credentials you just created.
4. **Public Booking**: Navigate to the home page and book a slot to verify the end-to-end flow.

## 📝 Troubleshooting

- **CORS**: Ensure `FRONTEND_URL` and `VITE_API_URL` are identical in `.env`.
- **Database**: If `npm run db:push` fails, verify Docker is running with `docker ps`.
- **Auth**: If you are redirected to Replit login, ensure `REPL_ID` is NOT set in your `.env`.
