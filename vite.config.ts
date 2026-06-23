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

          // ── ClinicDashboard gets its own synchronous chunk ────────────────
          //
          // ClinicDashboard.tsx is ~8 000 lines. Keeping it in a separate
          // output file reduces peak Rollup memory during the build.
          //
          // IMPORTANT: this is a *static* import in App.tsx (not React.lazy).
          // A static import produces a synchronous chunk: the browser fetches
          // and fully evaluates it BEFORE the index chunk runs. This means
          // every const/let in ClinicDashboard.tsx is always initialised before
          // any React render, making ReferenceError TDZ impossible.
          //
          // Previous attempts used React.lazy (dynamic async chunk). Async
          // chunks can be loaded at any time after the main bundle, and Rollup's
          // live-binding interop for async chunks can mis-order const
          // initialisation in minified output → TDZ ("Cannot access 'X' before
          // initialisation"). Removing lazy() eliminates this class of bug
          // permanently regardless of what is inside ClinicDashboard.tsx.
          if (id.includes("/client/src/pages/ClinicDashboard")) {
            return "clinic-dashboard";
          }

          // All other app-source (components, hooks, lib, shared schema) →
          // app-shared. This is also synchronous and initialised before index.
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
