import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export function serveStatic(app: Express) {
  let distPath: string;

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    distPath = path.resolve(__dirname, "public");
  } catch (e) {
    distPath = path.resolve(process.cwd(), "dist", "public");
  }
  
  console.log(`[SYSTEM] Initial static path check: ${distPath}`);
  
  const possiblePaths = [
    distPath,
    path.resolve(process.cwd(), "dist", "public"),
    path.resolve(process.cwd(), "public"),
    path.resolve("/", "home", "runner", "workspace", "dist", "public"),
    "/home/runner/workspace/dist/public",
    path.resolve(process.cwd(), "dist"),
    path.resolve(process.cwd(), "client", "dist")
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p) && (fs.existsSync(path.join(p, "index.html")) || fs.existsSync(path.join(p, "assets")))) {
      distPath = p;
      console.log(`[SYSTEM] Found valid static root at: ${distPath}`);
      break;
    }
  }

  if (fs.existsSync(distPath)) {
    // Crucial for Replit: Set specific cache and headers to avoid blank screen
    app.use(express.static(distPath, {
      maxAge: '1h',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css');
        }
        res.setHeader('X-Content-Type-Options', 'nosniff');
      }
    }));

    const assetsPath = path.resolve(distPath, "assets");
    if (fs.existsSync(assetsPath)) {
      app.use("/assets", express.static(assetsPath, {
        maxAge: '1y',
        immutable: true,
        fallthrough: false
      }));
    }

    setupCatchAll(app, distPath);
  } else {
    console.error(`[CRITICAL ERROR] No valid static root found. Search paths: ${JSON.stringify(possiblePaths)}`);
  }
}

function setupCatchAll(app: Express, distPath: string) {
  app.get("*", (req, res, next) => {
    // Explicitly ignore API routes in the catch-all
    if (req.path.startsWith("/api/")) {
      console.log(`[STATIC] API route not found: ${req.method} ${req.path}`);
      return res.status(404).json({ message: "API route not found" });
    }
    
    if (req.method === "GET") {
      const indexPath = path.resolve(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(indexPath);
      } else {
        const fallbackIndex = path.resolve(process.cwd(), "dist", "public", "index.html");
        if (fs.existsSync(fallbackIndex)) {
          res.sendFile(fallbackIndex);
        } else {
          next();
        }
      }
      return;
    }
    next();
  });
}
