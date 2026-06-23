import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
      ? [
          (await import("@replit/vite-plugin-runtime-error-modal")).default(),
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  optimizeDeps: {
    include: ["jspdf", "jspdf-autotable"],
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules/lucide-react/")) {
            return "icons";
          }
          if (id.includes("node_modules/")) {
            return "vendor";
          }

          // ── Definitive TDZ fix ────────────────────────────────────────────
          //
          // ClinicDashboard is React.lazy(). Its chunk must NOT co-bundle any
          // other app-source module, because Rollup can mis-order const/let
          // initialisation when circular chunk refs exist, triggering a
          // ReferenceError: Cannot access 'X' before initialisation in prod.
          //
          // Previous fix only moved /components/ here, leaving hooks, lib,
          // shared schema, etc. still bundled inside the ClinicDashboard chunk
          // — those cross-reference components, recreating the circularity.
          //
          // Fix: every non-page app-source file (components, hooks, lib,
          // shared schema, assets helpers) goes into "app-shared".
          // app-shared is a synchronous dependency of the index entry chunk
          // (App.tsx imports Header, queryClient, useClinicAuth, etc.), so it
          // is always fully initialised before any lazy chunk ever executes.
          // The ClinicDashboard lazy chunk therefore contains ONLY
          // ClinicDashboard.tsx and has zero modules to mis-order.
          //
          // Rule: anything under client/src OR shared/ that is NOT a page file
          // → app-shared.
          if (!id.includes("/node_modules/")) {
            const isAppSource =
              id.includes("/client/src/") || id.includes("/shared/");
            const isPageFile = id.includes("/client/src/pages/");
            if (isAppSource && !isPageFile) {
              return "app-shared";
            }
          }
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    sourcemapIgnoreList: false,
    allowedHosts: true,
    hmr: {
      clientPort: 443,
    },
  },
});
