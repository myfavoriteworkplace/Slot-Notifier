import * as dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import cors from "cors";
import { pool } from "./db";

const PostgresStore = connectPg(session);
const app = express();
const httpServer = createServer(app);

// Trust proxy for deployments behind load balancers (Render, etc.)
app.set("trust proxy", 1);

// Determine frontend URL(s)
const FRONTEND_URL =
  process.env.NODE_ENV === "production"
    ? process.env.FRONTEND_URL || "https://book-my-slot-client.onrender.com"
    : "http://localhost:5173";
const FRONTEND_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  FRONTEND_URL,
];

// ------------------ SESSION ------------------
const sessionSecret = process.env.SESSION_SECRET || "book-my-slot-secret";
console.log("[Environment]", process.env.NODE_ENV);

app.use(
  session({
    store: new PostgresStore({
      pool,
      tableName: "session",
      createTableIfMissing: false,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false, // do not save empty sessions
    rolling: true,            // refresh cookie expiry on every response
    unset: "destroy",
    proxy: true,              // trust X-Forwarded-* headers (important on Render)
    cookie: {
      secure: process.env.NODE_ENV === "production", // HTTPS only in prod
      httpOnly: true,                               // JS cannot access cookie
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,            // 30 days
    },
  })
);

// ------------------ CORS ------------------
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || FRONTEND_ORIGINS.includes(origin) || origin.includes("replit.dev")) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cookie",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    exposedHeaders: ["Set-Cookie"],
  })
);

// Handle OPTIONS preflight requests
app.options("*", cors({ origin: FRONTEND_ORIGINS, credentials: true }));

// ------------------ BODY PARSING ------------------
declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

// ------------------ LOGGER ------------------
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      log(logLine);
    }
  });

  next();
});

// ------------------ STARTUP ------------------
(async () => {
  try {
    // Run database migrations/sync on startup
    log("Running database schema sync...", "system");
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);
    
    try {
      const { stdout, stderr } = await execAsync("npm run db:push");
      log(`Schema sync output: ${stdout}`, "system");
      if (stderr) log(`Schema sync warnings: ${stderr}`, "system");
    } catch (dbErr: any) {
      log(`Schema sync failed (non-fatal): ${dbErr.message}`, "system");
    }

    const { ensureSessionTable } = await import("./db");
    await ensureSessionTable();

    const seedModule = await import("./seed-test-clinic");
    await seedModule.seed();
  } catch (err) {
    console.error("[SYSTEM] Startup initialization failed:", err);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  console.log(`[SYSTEM] Starting server on port ${port} with NODE_ENV=${process.env.NODE_ENV}`);

  // Register API routes
  await registerRoutes(httpServer, app);

  // Serve frontend static files in production
  if (process.env.NODE_ENV === "production") {
    console.log("[SYSTEM] Production mode: Serving static files");
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // SPA fallback: serve frontend for non-API routes
  app.get("*", (req, res, next) => {
    if (!req.path.startsWith("/api")) {
      return serveStatic(app)(req, res, next);
    }
    next();
  });

  // 404 handler for API routes
  app.use("/api/*", (req, res) => {
    res.status(404).json({
      message: "API endpoint not found",
      path: req.originalUrl,
      method: req.method,
      suggestion:
        "Ensure the path matches exactly and CORS is configured correctly for cross-origin requests.",
    });
  });

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error(`[ERROR] ${new Date().toISOString()} - ${status}: ${message}`);
    console.error(`[ERROR DETAILS] Method: ${_req.method}, Path: ${_req.path}`);
    if (_req.body && Object.keys(_req.body).length > 0) {
      const sanitizedBody = { ..._req.body };
      if (sanitizedBody.password) sanitizedBody.password = "********";
      console.error(`[ERROR BODY] ${JSON.stringify(sanitizedBody)}`);
    }
    if (err.stack) console.error(`[ERROR STACK] ${err.stack}`);

    res.status(status).json({
      message,
      details: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  });

  // Start server
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`Server listening on port ${port}`);
    }
  );
})();
