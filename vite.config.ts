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
          // Break diamond deps inside the lazy ClinicDashboard chunk:
          // BookingProgressStrip is imported by both ClinicDashboard (direct)
          // and AppointmentCard; ImageUpload is imported by both ClinicDashboard
          // (direct) and WebsiteConfigPanel. Putting them in a separate chunk
          // guarantees they are initialised before the ClinicDashboard chunk runs.
          if (id.includes("/components/BookingProgressStrip")) {
            return "clinic-shared";
          }
          if (id.includes("/components/ImageUpload")) {
            return "clinic-shared";
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
