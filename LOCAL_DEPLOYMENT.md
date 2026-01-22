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
   You can connect directly to your external Render database or a local PostgreSQL instance:
   1. Go to your **Render Dashboard**.
   2. Select your PostgreSQL database.
   3. Copy the **External Database URL**.
   4. Paste it into your local `.env` file as the `DATABASE_URL`.

3. **Database Initialization**:
   Sync the schema to your database:
   ```bash
   npm run db:push
   ```

---

## 🌎 Running in Single URL Mode (Combined)
This is the default `npm start` behavior where the Express server serves both the API and the static frontend files.

1. **Environment Configuration**:
   Create a `.env` file:
   ```env
   DATABASE_URL=postgresql://...
   SESSION_SECRET=your_random_secret
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=admin_password123
   NODE_ENV=production
   PORT=5001
   FRONTEND_URL=http://localhost:5001
   VITE_API_URL=http://localhost:5001
   ```

2. **Build and Run**:
   ```bash
   npm run build
   npm run start
   ```
   *Accessible at `http://localhost:5001`.*

---

## 🌍 Running in Split URL Mode (Frontend & Backend Separate)
This replicates a production setup where the Frontend and Backend are deployed to different URLs.

### 1. Backend Setup (Terminal 1)
1. **Environment Configuration**:
   Create a `.env` file in the root:
   ```env
   DATABASE_URL=postgresql://...
   SESSION_SECRET=your_random_secret
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=admin_password123
   NODE_ENV=production
   PORT=5000
   FRONTEND_URL=http://localhost:5173
   ```

2. **Run Backend**:
   ```bash
   npm run build
   npm run start
   ```
   *Backend API available at `http://localhost:5000`.*

### 2. Frontend Setup (Terminal 2)
1. **Environment Configuration**:
   Create a `client/.env.local` file:
   ```env
   VITE_API_URL=http://localhost:5000
   ```

2. **Run Frontend**:
   ```bash
   # Use Vite to serve the frontend on a separate port
   npx vite client
   ```
   *Frontend available at `http://localhost:5173`.*

---

## 🧪 Testing the Flow

1. **Cross-Origin Requests**: The frontend at `localhost:5173` will now communicate with the backend at `localhost:5000`.
2. **Admin Access**: Navigate to `http://localhost:5173/login` and use your `ADMIN_EMAIL` credentials.
3. **Clinic Dashboard**: Verify that creating and managing slots works across the two different URLs.

## 📝 Troubleshooting

- **CORS Errors**: Ensure the `FRONTEND_URL` in the backend `.env` exactly matches the URL/port where your frontend is running.
- **VITE_API_URL**: If the frontend can't find the backend, verify this is set correctly in `client/.env.local` before starting the frontend.
