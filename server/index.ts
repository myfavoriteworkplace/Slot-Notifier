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

// Trust proxy is essential for deployments behind a load balancer (like Render)
app.set("trust proxy", 1);

// Configure sessions with Postgres store
const sessionSecret = process.env.SESSION_SECRET || "book-my-slot-secret";
app.use(
  session({
    store: new PostgresStore({
      pool,
      tableName: "session",
      createTableIfMissing: false,
    }),
    secret: sessionSecret,
    resave: true,
    saveUninitialized: true, // Changed to true to ensure session is initialized
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000, 
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
    proxy: true, // Required for trust proxy to work with express-session
    rolling: true, // Force session cookie to be set on every response
  })
);

// Configure CORS for cross-domain requests
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(cors({
  origin: (origin, callback) => {
    // In development or if no origin (local requests), allow it
    if (!origin || process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }

    const allowedOrigins = FRONTEND_URL.split(",").map(url => url.trim());
    // In production, especially on Render, we need to allow both the frontend domain and potentially same-site requests
    if (allowedOrigins.indexOf(origin!) !== -1 || allowedOrigins.includes("*") || origin!.includes("replit") || origin!.includes("onrender") || origin!.includes("localhost")) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With", "Accept", "Origin"],
  exposedHeaders: ["Set-Cookie"]
}));

app.options("*", cors());

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
  }),
);

app.use(express.urlencoded({ extended: false }));

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
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // LOG ALL REQUESTS IN PRODUCTION FOR DEBUGGING
  if (process.env.NODE_ENV === "production" || true) {
    log(`[REQUEST] ${req.method} ${path} - IP: ${req.ip} - Headers: ${JSON.stringify({
      host: req.headers.host,
      "user-agent": req.headers["user-agent"],
      "x-forwarded-for": req.headers["x-forwarded-for"]
    })}`);
  }

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Run seed script on startup to ensure demo data exists (especially for Render)
  try {
    const { ensureSessionTable } = await import("./db");
    await ensureSessionTable();
    
    const seedModule = await import("./seed-test-clinic");
    await seedModule.seed();
  } catch (err) {
    console.error("[SYSTEM] Startup initialization failed:", err);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  console.log(`[SYSTEM] Starting server on port ${port} with NODE_ENV=${process.env.NODE_ENV}`);
  
  // register routes first
  await registerRoutes(httpServer, app);

  // Serve static files AFTER routes
  if (process.env.NODE_ENV === "production") {
    console.log("[SYSTEM] Production mode: Serving static files");
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Final 404 handler for API routes that weren't matched
  app.use("/api/*", (req, res) => {
    res.status(404).json({ 
      message: "API endpoint not found",
      path: req.originalUrl,
      method: req.method,
      suggestion: "If you are using a cross-site request, ensure CORS is correctly configured and that the path matches exactly."
    });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    // Detailed error logging
    console.error(`[ERROR] ${new Date().toISOString()} - ${status}: ${message}`);
    console.error(`[ERROR DETAILS] Method: ${_req.method}, Path: ${_req.path}`);
    if (_req.body && Object.keys(_req.body).length > 0) {
      const sanitizedBody = { ..._req.body };
      if (sanitizedBody.password) sanitizedBody.password = "********";
      console.error(`[ERROR BODY] ${JSON.stringify(sanitizedBody)}`);
    }
    if (err.stack) {
      console.error(`[ERROR STACK] ${err.stack}`);
    }

    res.status(status).json({ message, details: process.env.NODE_ENV === 'development' ? err.stack : undefined });
  });

  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
