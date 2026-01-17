import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export function serveStatic(app: Express) {
  let distPath: string;
  const isRender = process.env.DEPLOYMENT_TARGET === "render";
  const isReplit = !!process.env.REPL_ID;

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    distPath = path.resolve(__dirname, "public");
  } catch (e) {
    distPath = path.resolve(process.cwd(), "dist", "public");
  }
  
  console.log(`[SYSTEM] Environment Detection: Render=${isRender}, Replit=${isReplit}`);
  console.log(`[SYSTEM] Initial static path check: ${distPath}`);
  
  if (!fs.existsSync(distPath)) {
    const cwdPublic = path.resolve(process.cwd(), "public");
    const distDistPublic = path.resolve(process.cwd(), "dist", "public");
    const replitPublic = path.resolve("/", "home", "runner", "workspace", "dist", "public");
    const relativeDistPublic = path.resolve("dist", "public");
    
    if (fs.existsSync(distDistPublic)) {
      distPath = distDistPublic;
    } else if (fs.existsSync(cwdPublic)) {
      distPath = cwdPublic;
    } else if (fs.existsSync(replitPublic)) {
      distPath = replitPublic;
    } else if (fs.existsSync(relativeDistPublic)) {
      distPath = relativeDistPublic;
    }
  }

  console.log(`[SYSTEM] Final resolved static assets path: ${distPath}`);

  if (fs.existsSync(distPath)) {
    // Standard static serving
    app.use(express.static(distPath, {
      maxAge: '1d',
      index: false
    }));

    // Explicit fallback for assets directory to ensure they are found
    const assetsPath = path.resolve(distPath, "assets");
    if (fs.existsSync(assetsPath)) {
      console.log(`[SYSTEM] Found assets directory at: ${assetsPath}`);
      app.use("/assets", express.static(assetsPath, {
        maxAge: '1y',
        immutable: true,
        fallthrough: false
      }));
    } else {
      console.warn(`[SYSTEM] Assets directory NOT found at: ${assetsPath}`);
    }

    setupCatchAll(app, distPath);
  } else {
    console.error(`[CRITICAL ERROR] All static asset paths failed. Current Working Directory: ${process.cwd()}`);
    // Diagnostic listing
    try {
      const rootEntries = fs.readdirSync(process.cwd());
      console.log(`[DEBUG] CWD Root contents: ${JSON.stringify(rootEntries)}`);
      if (rootEntries.includes('dist')) {
        console.log(`[DEBUG] dist/ contents: ${JSON.stringify(fs.readdirSync(path.join(process.cwd(), 'dist')))}`);
      }
    } catch (e) {
      console.error(`[DEBUG] Failed to list directories: ${e}`);
    }
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
        console.error(`[ERROR] SPA Fallback failed: index.html not found at ${indexPath}`);
        next();
      }
      return;
    }
    next();
  });
}
