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
  ssl: process.env.NODE_ENV === "production" ? {
    rejectUnauthorized: false
  } : false
});
export const db = drizzle(pool, { schema });

/**
 * Ensures the session table exists in the database.
 * This is useful for local development and initial deployment.
 */
export async function ensureSessionTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      )
      WITH (OIDS=FALSE);
    `);
    
    // Check if primary key exists before adding
    const pkCheck = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'session' AND constraint_type = 'PRIMARY KEY';
    `);
    
    if (pkCheck.rowCount === 0) {
      await pool.query(`
        ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
      `);
    }

    // Check if index exists before creating
    const indexCheck = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'session' AND indexname = 'IDX_session_expire';
    `);

    if (indexCheck.rowCount === 0) {
      await pool.query(`
        CREATE INDEX "IDX_session_expire" ON "session" ("expire");
      `);
    }
    
    console.log("[DATABASE] Session table verified/created successfully");
  } catch (err) {
    console.error("[DATABASE] Error ensuring session table:", err);
  }
}
