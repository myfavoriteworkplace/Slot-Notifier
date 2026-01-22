# How to Run the App on Your Computer (Layman's Guide)

This guide will help you set up and run the "BookMySlot" application on your own computer. We will follow two different ways to run it: **Simple Mode** (easiest) and **Split Mode** (matching your production setup with two URLs).

---

## 🛠 Step 1: Getting Ready
Before starting, make sure you have:
1. **Node.js** installed (Version 20 or higher).
2. **PostgreSQL** (a database) running on your computer.

### Installation
1. Open your terminal (Command Prompt or Terminal app).
2. Type these commands one by one:
   ```bash
   # 1. Download the code (replace with your repo link)
   git clone <your-repo-link>
   
   # 2. Go into the project folder
   cd book-my-slot
   
   # 3. Install all the "parts" the app needs
   npm install
   ```

---

## 🌎 Method A: Simple Mode (One URL)
In this mode, everything runs on a single address (e.g., `http://localhost:5001`).

### 1. Configure the Settings
Create a new file named `.env` in the main folder (`book-my-slot/`) and paste this inside:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/my_database
SESSION_SECRET=a_random_secret_phrase
ADMIN_EMAIL=your@email.com
ADMIN_PASSWORD=your_password
NODE_ENV=production
PORT=5001
FRONTEND_URL=http://localhost:5001
VITE_API_URL=http://localhost:5001
```

### 2. Prepare the Database
Run this command in the main folder:
```bash
npm run db:push
```

### 3. Start the App
Run these commands in the main folder:
```bash
# Build the app first
npm run build

# Start the app
npm run start
```
*Open your browser to: `http://localhost:5001`*

---

## 🌍 Method B: Split Mode (Two URLs)
This matches your production setup where the **Frontend** and **Backend** have different addresses.

### 1. Start the Backend (API)
Open a terminal and go to the main folder (`book-my-slot/`).

**Configure Settings:**
Create/Edit the `.env` file in the main folder:
```env
DATABASE_URL=postgresql://... (same as above)
SESSION_SECRET=a_random_secret_phrase
ADMIN_EMAIL=your@email.com
ADMIN_PASSWORD=your_password
NODE_ENV=production
PORT=5000
FRONTEND_URL=http://localhost:5173
```

**Commands to Run:**
```bash
npm run build
npm run start
```
*The Backend is now running at `http://localhost:5000`.*

### 2. Start the Frontend (Website)
Open a **SECOND** terminal window and go to the same folder.

**Configure Settings:**
Go into the `client/` folder and create a file named `.env.local`:
- **Path:** `book-my-slot/client/.env.local`
- **Content:**
  ```env
  VITE_API_URL=http://localhost:5000
  ```

**Command to Run:**
```bash
# This starts the frontend on its own address
npx vite client
```
*The Frontend is now running at `http://localhost:5173`. Open this URL to use the app!*

---

## 🧪 How to Test
1. Go to `http://localhost:5173` in your browser.
2. Log in using the `ADMIN_EMAIL` you set earlier.
3. If everything works, you are successfully running the app locally with two separate URLs!

## 📝 Simple Troubleshooting
- **CORS Error?** Make sure `FRONTEND_URL` in the main `.env` file matches exactly where your frontend is running (usually `http://localhost:5173`).
- **Cannot connect?** Check if your PostgreSQL database is turned on.
