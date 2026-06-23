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
          // Extract every component that is ONLY imported by the lazy
          // ClinicDashboard chunk into a named "clinic-shared" chunk.
          // This makes the lazy ClinicDashboard-*.js file contain only
          // ClinicDashboard.tsx itself — no inter-component deps remain inside
          // the chunk, so Rollup cannot produce a TDZ ordering issue there.
          //
          // Components shared with other pages (AppointmentCard, BookingNotesThread,
          // ClinicalRecordsTab, SpecializationInput, BookingProgressStrip…) are
          // already placed in the index chunk by Rollup; we do NOT list them here.
          const CLINIC_ONLY_COMPONENTS = [
            "/components/ImageUpload",
            "/components/MapLocationPicker",
            "/components/ExportDataPanel",
            "/components/PharmacyStockPanel",
            "/components/WebsiteConfigPanel",
            "/components/BillingHistoryPanel",
            "/components/ClinicAnalyticsPanel",
            "/components/InventoryPanel",
            "/components/panels/",
          ];
          if (CLINIC_ONLY_COMPONENTS.some((p) => id.includes(p))) {
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
