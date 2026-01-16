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
  
  if (!fs.existsSync(distPath)) {
    const cwdPublic = path.resolve(process.cwd(), "public");
    const distDistPublic = path.resolve(process.cwd(), "dist", "public");
    const rootPublic = path.resolve("/", "home", "runner", "workspace", "dist", "public");
    
    if (fs.existsSync(distDistPublic)) {
      distPath = distDistPublic;
    } else if (fs.existsSync(cwdPublic)) {
      distPath = cwdPublic;
    } else if (fs.existsSync(rootPublic)) {
      distPath = rootPublic;
    }
  }

  console.log(`[SYSTEM] Final static assets path: ${distPath}`);

  if (fs.existsSync(distPath)) {
    // Standard static serving
    app.use(express.static(distPath, {
      maxAge: '1d',
      index: false // We handle index.html in the catch-all
    }));

    // Explicit fallback for assets directory to ensure they are found
    const assetsPath = path.resolve(distPath, "assets");
    if (fs.existsSync(assetsPath)) {
      console.log(`[SYSTEM] Explicitly serving assets from: ${assetsPath}`);
      app.use("/assets", express.static(assetsPath, {
        maxAge: '1y',
        immutable: true,
        fallthrough: false // If it's in /assets and not found, 404 immediately
      }));
    }

    setupCatchAll(app, distPath);
  } else {
    console.error(`[CRITICAL ERROR] All static asset paths failed. CWD: ${process.cwd()}`);
    // List directory contents for debugging
    try {
      console.log(`[DEBUG] process.cwd() contents: ${fs.readdirSync(process.cwd())}`);
      const distCheck = path.resolve(process.cwd(), "dist");
      if (fs.existsSync(distCheck)) {
        console.log(`[DEBUG] dist/ contents: ${fs.readdirSync(distCheck)}`);
      }
    } catch (e) {}
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
        console.error(`[ERROR] Catch-all could not find index.html at ${indexPath}`);
        next();
      }
      return;
    }
    next();
  });
}
