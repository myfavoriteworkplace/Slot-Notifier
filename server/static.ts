import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export function serveStatic(app: Express) {
  let distPath: string;

  try {
    // In ESM, we can get __dirname like this
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    distPath = path.resolve(__dirname, "public");
  } catch (e) {
    // Fallback if import.meta.url is not available (CJS)
    distPath = path.resolve(process.cwd(), "dist", "public");
  }
  
  console.log(`[SYSTEM] Static assets path: ${distPath}`);
  
  if (!fs.existsSync(distPath)) {
    console.error(`[ERROR] Build directory not found: ${distPath}`);
    // Check if we are inside dist already
    const cwdPublic = path.resolve(process.cwd(), "public");
    const distDistPublic = path.resolve(process.cwd(), "dist", "public");
    
    if (fs.existsSync(distDistPublic)) {
      distPath = distDistPublic;
    } else if (fs.existsSync(cwdPublic)) {
      distPath = cwdPublic;
    }
    console.log(`[SYSTEM] Adjusted fallback path: ${distPath}`);
  }

  if (fs.existsSync(distPath)) {
    // Crucial: Set correct MIME types and headers
    app.use(express.static(distPath, {
      setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
        } else if (path.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css');
        }
        res.setHeader('Cache-Control', 'public, max-age=31536000');
      }
    }));
    setupCatchAll(app, distPath);
  } else {
    console.error(`[CRITICAL ERROR] All static asset paths failed.`);
  }
}

function setupCatchAll(app: Express, distPath: string) {
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    if (req.method === "GET") {
      const indexPath = path.resolve(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        next();
      }
      return;
    }
    next();
  });
}
