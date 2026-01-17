import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export function serveStatic(app: Express) {
  let distPath: string;
  const isReplit = !!process.env.REPL_ID;

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    distPath = path.resolve(__dirname, "public");
  } catch (e) {
    distPath = path.resolve(process.cwd(), "dist", "public");
  }
  
  console.log(`[SYSTEM] Initial static path check: ${distPath}`);
  
  // Force check standard locations
  const possiblePaths = [
    distPath,
    path.resolve(process.cwd(), "dist", "public"),
    path.resolve(process.cwd(), "public"),
    path.resolve("/", "home", "runner", "workspace", "dist", "public"),
    "/home/runner/workspace/dist/public"
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, "index.html"))) {
      distPath = p;
      console.log(`[SYSTEM] Found valid static root at: ${distPath}`);
      break;
    }
  }

  if (fs.existsSync(distPath)) {
    // Standard static serving
    app.use(express.static(distPath, {
      maxAge: '1d',
      index: false
    }));

    // Explicit fallback for assets directory
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
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    if (req.method === "GET") {
      const indexPath = path.resolve(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        // Fallback: search for index.html in common places if the current one is missing
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
