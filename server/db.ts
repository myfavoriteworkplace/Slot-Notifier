import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import * as dotenv from "dotenv";
import path from "path";

// Load env vars at the very top level before any export
dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL.includes("sslmode=") 
  ? process.env.DATABASE_URL 
  : process.env.DATABASE_URL + (process.env.DATABASE_URL.includes("?") ? "&" : "?") + "sslmode=require";

export const pool = new Pool({ 
  connectionString,
  ssl: {
    rejectUnauthorized: false // Required for some hosted Postgres providers
  }
});
export const db = drizzle(pool, { schema });
