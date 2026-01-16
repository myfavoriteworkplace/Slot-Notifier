import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // In the CJS bundle, __dirname is the dist/ directory
  const distPath = path.resolve(__dirname, "public");
  
  console.log(`[SYSTEM] Static assets path: ${distPath}`);
  
  if (!fs.existsSync(distPath)) {
    console.error(`[ERROR] Build directory not found: ${distPath}`);
    // Fallback for different environments
    const fallbackPath = path.resolve(process.cwd(), "dist", "public");
    if (fs.existsSync(fallbackPath)) {
      app.use(express.static(fallbackPath));
      setupCatchAll(app, fallbackPath);
      return;
    }
    throw new Error(`Static assets directory not found at ${distPath} or ${fallbackPath}`);
  }

  app.use(express.static(distPath));
  setupCatchAll(app, distPath);
}

function setupCatchAll(app: Express, distPath: string) {
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    if (req.method === "GET") {
      res.sendFile(path.resolve(distPath, "index.html"));
      return;
    }
    next();
  });
}
