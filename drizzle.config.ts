import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";

const envPath = path.resolve(process.cwd(), ".env");
console.log("Checking for .env at:", envPath);
console.log("File exists:", fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

if (!process.env.DATABASE_URL) {
  console.log("Current working directory:", process.cwd());
  console.log("Environment variables keys:", Object.keys(process.env));
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
