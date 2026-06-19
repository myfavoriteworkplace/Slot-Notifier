import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    if (!process.env[k]) {
      process.env[k] = envConfig[k];
    }
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Ensure the database is provisioned.");
}

const rawUrl = process.env.DATABASE_URL;

const isLocalDb =
  rawUrl.includes("localhost") ||
  rawUrl.includes("127.0.0.1") ||
  rawUrl.includes("/var/run") ||
  !rawUrl.split("@")[1]?.includes(".");

const dbUrl = isLocalDb
  ? rawUrl.replace(/([?&])sslmode=[^&]*/g, "$1").replace(/[?&]$/, "")
  : rawUrl.includes("sslmode=")
    ? rawUrl
    : rawUrl + (rawUrl.includes("?") ? "&" : "?") + "sslmode=require";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
