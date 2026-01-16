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
    // One more final attempt with absolute path from root
    distPath = path.resolve(process.cwd(), "dist", "public");
    console.log(`[SYSTEM] Final fallback path: ${distPath}`);
    
    if (!fs.existsSync(distPath)) {
       // Check if we are inside dist already
       distPath = path.resolve(process.cwd(), "public");
       console.log(`[SYSTEM] Checking internal dist path: ${distPath}`);
    }
  }

  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
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
