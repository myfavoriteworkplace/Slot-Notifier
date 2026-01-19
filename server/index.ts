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

// Required for Render / proxies
app.set("trust proxy", 1);

/* ----------------------- SESSION ----------------------- */

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
    saveUninitialized: true,
    cookie: {
      secure: false, // Render terminates SSL
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
    proxy: true,
    rolling: true,
  })
);

/* ----------------------- CORS ----------------------- */

const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      const allowedOrigins = FRONTEND_URL.split(",").map(o => o.trim());

      if (
        allowedOrigins.includes(origin) ||
        origin.includes("onrender") ||
        origin.includes("localhost")
      ) {
        return callback(null, true);
      }

      callback(new Error("Not allowed by CORS"));
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

app.options("*", cors());

/* ----------------------- BODY PARSERS ----------------------- */

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

/* ----------------------- LOGGER ----------------------- */

function log(message: string, source = "express") {
  const time = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  console.log(`${time} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  log(`[REQUEST] ${req.method} ${path} IP=${req.ip}`);

  const originalJson = res.json;
  res.json = function (body, ...args) {
    return originalJson.call(this, body, ...args);
  };

  res.on("finish", () => {
    if (path.startsWith("/api")) {
      log(
        `${req.method} ${path} ${res.statusCode} ${Date.now() - start}ms`
      );
    }
  });

  next();
});

/* ----------------------- BOOTSTRAP ----------------------- */

(async () => {
  try {
    const { ensureSessionTable } = await import("./db");
    await ensureSessionTable();

    const seedModule = await import("./seed-test-clinic");
    await seedModule.seed();
  } catch (err) {
    console.error("[SYSTEM] Startup init failed:", err);
  }

  const port = Number(process.env.PORT) || 5000;
  console.log(
    `[SYSTEM] Starting server on port ${port} (${process.env.NODE_ENV})`
  );

  // 🔥 REGISTER ROUTES FIRST
  await registerRoutes(httpServer, app);

  // 🔥 STATIC / SPA SERVING
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  /* ----------------------- SAFE API 404 ----------------------- */
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({
        status: "error",
        message: "API endpoint not found",
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
      });
    }
    next();
  });

  /* ----------------------- GLOBAL ERROR ----------------------- */
  app.use(
    (err: any, req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;

      console.error("[ERROR]");
      console.error("Path:", req.originalUrl);
      console.error("Message:", err.message);
      if (err.stack) console.error(err.stack);

      res.status(status).json({
        status: "error",
        message: err.message || "Internal Server Error",
      });
    }
  );

  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => log(`Server running on port ${port}`)
  );
})();
