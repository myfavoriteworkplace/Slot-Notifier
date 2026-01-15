import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // ONLY catch-all for non-API routes to prevent 404 on API calls
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      console.log(`[STATIC-DEBUG] Request to API path ${req.path} intercepted by static fallback. This should not happen.`);
      return next();
    }
    if (req.method === "GET") {
      return res.sendFile(path.resolve(distPath, "index.html"));
    }
    next();
  });
}
