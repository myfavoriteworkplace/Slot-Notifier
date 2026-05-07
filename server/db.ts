import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import * as dotenv from "dotenv";

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

const sslRequired =
  process.env.DATABASE_URL?.includes("supabase.co") ||
  process.env.DATABASE_URL?.includes("sslmode=require");

export const pool = new Pool({
  connectionString,
  ssl: sslRequired || process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on("error", (err) => {
  console.error("[DATABASE] Unexpected pool error:", err.message);
});

export const db = drizzle(pool, { schema });

export async function ensureSessionTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      );
    `);

    const indexCheck = await pool.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'session' AND indexname = 'IDX_session_expire';
    `);

    if (indexCheck.rowCount === 0) {
      await pool.query(`CREATE INDEX "IDX_session_expire" ON "session" ("expire");`);
    }

    await pool.query(`
      ALTER TABLE IF EXISTS "bookings" ADD COLUMN IF NOT EXISTS "description" text;
    `);

    await pool.query(`
      ALTER TABLE IF EXISTS "bookings" ADD COLUMN IF NOT EXISTS "assigned_doctor" varchar(255);
    `);

    await pool.query(`
      ALTER TABLE IF EXISTS "bookings" ADD COLUMN IF NOT EXISTS "assigned_doctor_email" varchar(255);
    `);

    await pool.query(`
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "phone" varchar(50);
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "email" varchar(255);
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "website" varchar(255);
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "doctor_name" varchar(255);
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "doctor_specialization" varchar(255);
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "doctor_degree" varchar(255);
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "doctors" jsonb DEFAULT '[]'::jsonb;
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "city" varchar(255);
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "pincode" varchar(20);
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "latitude" real;
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "longitude" real;
    `);

    console.log("[DATABASE] Session table and schema checks complete.");
  } catch (err: any) {
    if (err.code === "42P07") {
      console.log("[DATABASE] Session index already exists, skipping");
    } else {
      console.error("[DATABASE] Error ensuring session table:", err.message);
    }
  }

  // Dedicated block for map location columns so they always run regardless of earlier errors
  try {
    await pool.query(`
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "latitude" real;
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "longitude" real;
    `);
    console.log("[DATABASE] Map location columns ready.");
  } catch (err: any) {
    console.error("[DATABASE] Error adding map location columns:", err.message);
  }

  // booking_notes is in its own block so a 42P07 from the session index
  // can never abort this migration.
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS booking_notes (
        id serial PRIMARY KEY,
        booking_id integer NOT NULL REFERENCES bookings(id),
        author_type varchar(20) NOT NULL,
        author_name varchar(255) NOT NULL,
        content text NOT NULL,
        created_at timestamp DEFAULT NOW()
      );
    `);

    // Migrate existing doctorNotes → first message in thread (idempotent)
    await pool.query(`
      INSERT INTO booking_notes (booking_id, author_type, author_name, content, created_at)
      SELECT
        b.id,
        'doctor',
        COALESCE(b.assigned_doctor, 'Doctor'),
        b.doctor_notes,
        COALESCE(b.created_at, NOW())
      FROM bookings b
      WHERE b.doctor_notes IS NOT NULL AND b.doctor_notes != ''
        AND NOT EXISTS (
          SELECT 1 FROM booking_notes bn
          WHERE bn.booking_id = b.id AND bn.author_type = 'doctor'
        );
    `);

    console.log("[DATABASE] booking_notes table ready.");
  } catch (err: any) {
    console.error("[DATABASE] Error ensuring booking_notes table:", err.message);
  }

  // Extended bookings columns (added over time)
  try {
    await pool.query(`
      ALTER TABLE IF EXISTS "bookings" ADD COLUMN IF NOT EXISTS "assigned_doctor_email" varchar(255);
      ALTER TABLE IF EXISTS "bookings" ADD COLUMN IF NOT EXISTS "doctor_approval_status" varchar(20);
      ALTER TABLE IF EXISTS "bookings" ADD COLUMN IF NOT EXISTS "doctor_notes" text;
      ALTER TABLE IF EXISTS "bookings" ADD COLUMN IF NOT EXISTS "clinical_status" varchar(50);
      ALTER TABLE IF EXISTS "bookings" ADD COLUMN IF NOT EXISTS "confirmed_by" varchar(20);
      ALTER TABLE IF EXISTS "bookings" ADD COLUMN IF NOT EXISTS "payment_status" varchar(20);
      ALTER TABLE IF EXISTS "bookings" ADD COLUMN IF NOT EXISTS "razorpay_order_id" varchar(255);
      ALTER TABLE IF EXISTS "bookings" ADD COLUMN IF NOT EXISTS "razorpay_payment_id" varchar(255);
    `);
    console.log("[DATABASE] Extended booking columns ready.");
  } catch (err: any) {
    console.error("[DATABASE] Error adding extended booking columns:", err.message);
  }

  // Consent signature columns on bookings
  try {
    await pool.query(`
      ALTER TABLE IF EXISTS "bookings" ADD COLUMN IF NOT EXISTS "consent_signature" text;
      ALTER TABLE IF EXISTS "bookings" ADD COLUMN IF NOT EXISTS "consent_signed_at" timestamp;
      ALTER TABLE IF EXISTS "bookings" ADD COLUMN IF NOT EXISTS "consent_ip" varchar(45);
    `);
    console.log("[DATABASE] Consent columns on bookings ready.");
  } catch (err: any) {
    console.error("[DATABASE] Error adding consent columns:", err.message);
  }

  // Consent tokens table
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS consent_tokens (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER NOT NULL REFERENCES bookings(id),
        clinic_id INTEGER NOT NULL REFERENCES clinics(id),
        token VARCHAR(255) NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("[DATABASE] consent_tokens table ready.");
  } catch (err: any) {
    console.error("[DATABASE] Error ensuring consent_tokens table:", err.message);
  }

  // Missing doctor columns
  try {
    await pool.query(`
      ALTER TABLE IF EXISTS "doctors" ADD COLUMN IF NOT EXISTS "college" varchar(255);
      ALTER TABLE IF EXISTS "doctors" ADD COLUMN IF NOT EXISTS "bio" text;
      ALTER TABLE IF EXISTS "doctors" ADD COLUMN IF NOT EXISTS "phone" varchar(50);
      ALTER TABLE IF EXISTS "doctors" ADD COLUMN IF NOT EXISTS "years_of_experience" integer;
      ALTER TABLE IF EXISTS "doctors" ADD COLUMN IF NOT EXISTS "languages" text[];
    `);
    console.log("[DATABASE] Doctor extended columns ready.");
  } catch (err: any) {
    console.error("[DATABASE] Error adding doctor extended columns:", err.message);
  }

  // Missing clinic columns
  try {
    await pool.query(`
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "logo_url" varchar(1000);
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'approved';
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "registered_by" varchar(255);
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "is_archived" boolean DEFAULT false;
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "google_business_url" varchar(1000);
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "gst_number" varchar(50);
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "medical_license_url" varchar(1000);
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "clinic_reg_cert_url" varchar(1000);
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "trust_score" integer DEFAULT 0;
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "plan" varchar(20) DEFAULT 'starter';
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "subscription_status" varchar(20) DEFAULT 'unpaid';
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "billing_cycle" varchar(10) DEFAULT 'monthly';
      ALTER TABLE IF EXISTS "clinics" ADD COLUMN IF NOT EXISTS "razorpay_subscription_id" varchar(255);
    `);
    console.log("[DATABASE] Clinic extended columns ready.");
  } catch (err: any) {
    console.error("[DATABASE] Error adding clinic extended columns:", err.message);
  }

  // slots table
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS slots (
        id SERIAL PRIMARY KEY,
        owner_id varchar REFERENCES users(id),
        start_time timestamp NOT NULL,
        end_time timestamp NOT NULL,
        is_booked boolean NOT NULL DEFAULT false,
        clinic_name varchar(255),
        clinic_id integer REFERENCES clinics(id),
        max_bookings integer NOT NULL DEFAULT 3,
        is_cancelled boolean NOT NULL DEFAULT false
      );
    `);
    console.log("[DATABASE] slots table ready.");
  } catch (err: any) {
    console.error("[DATABASE] Error ensuring slots table:", err.message);
  }

  // bookings table (depends on slots)
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        slot_id integer NOT NULL REFERENCES slots(id),
        customer_id varchar REFERENCES users(id),
        customer_name varchar(255) NOT NULL,
        customer_phone varchar(50) NOT NULL,
        customer_email varchar(255),
        verification_code varchar(10),
        verification_status varchar(20) NOT NULL DEFAULT 'pending',
        verification_expires_at timestamp,
        description text,
        assigned_doctor varchar(255),
        assigned_doctor_email varchar(255),
        doctor_approval_status varchar(20),
        doctor_notes text,
        clinical_status varchar(50),
        confirmed_by varchar(20),
        payment_status varchar(20),
        razorpay_order_id varchar(255),
        razorpay_payment_id varchar(255),
        consent_signature text,
        consent_signed_at timestamp,
        consent_ip varchar(45),
        consent_token varchar(255),
        payment_amount integer,
        created_at timestamp DEFAULT NOW()
      );
    `);
    console.log("[DATABASE] bookings table ready.");
  } catch (err: any) {
    console.error("[DATABASE] Error ensuring bookings table:", err.message);
  }

  // notifications table
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id varchar NOT NULL REFERENCES users(id),
        message text NOT NULL,
        read boolean NOT NULL DEFAULT false,
        created_at timestamp DEFAULT NOW()
      );
    `);
    console.log("[DATABASE] notifications table ready.");
  } catch (err: any) {
    console.error("[DATABASE] Error ensuring notifications table:", err.message);
  }

  // email_otps table
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_otps (
        id SERIAL PRIMARY KEY,
        email varchar(255) NOT NULL,
        otp_hash varchar(255) NOT NULL,
        expires_at timestamp NOT NULL,
        verified boolean NOT NULL DEFAULT false,
        verified_token varchar(64),
        purpose varchar(50) NOT NULL DEFAULT 'booking',
        created_at timestamp DEFAULT NOW()
      );
    `);
    console.log("[DATABASE] email_otps table ready.");
  } catch (err: any) {
    console.error("[DATABASE] Error ensuring email_otps table:", err.message);
  }

  // site_settings table
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        id SERIAL PRIMARY KEY,
        key varchar(255) NOT NULL UNIQUE,
        value text NOT NULL,
        updated_at timestamp DEFAULT NOW()
      );
    `);
    console.log("[DATABASE] site_settings table ready.");
  } catch (err: any) {
    console.error("[DATABASE] Error ensuring site_settings table:", err.message);
  }

  // doctor_leaves table
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS doctor_leaves (
        id SERIAL PRIMARY KEY,
        doctor_id integer NOT NULL REFERENCES doctors(id),
        leave_date varchar(10) NOT NULL,
        reason varchar(255),
        created_at timestamp DEFAULT NOW()
      );
    `);
    console.log("[DATABASE] doctor_leaves table ready.");
  } catch (err: any) {
    console.error("[DATABASE] Error ensuring doctor_leaves table:", err.message);
  }

  // doctor_certifications table
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS doctor_certifications (
        id SERIAL PRIMARY KEY,
        doctor_id integer NOT NULL REFERENCES doctors(id),
        title varchar(255) NOT NULL,
        issuer varchar(255),
        year varchar(10),
        description text,
        image_url varchar(1000),
        created_at timestamp DEFAULT NOW()
      );
    `);
    console.log("[DATABASE] doctor_certifications table ready.");
  } catch (err: any) {
    console.error("[DATABASE] Error ensuring doctor_certifications table:", err.message);
  }

  // doctor_cases table
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS doctor_cases (
        id SERIAL PRIMARY KEY,
        doctor_id integer NOT NULL REFERENCES doctors(id),
        title varchar(255) NOT NULL,
        description text,
        tags jsonb DEFAULT '[]'::jsonb,
        media_urls jsonb DEFAULT '[]'::jsonb,
        created_at timestamp DEFAULT NOW()
      );
    `);
    console.log("[DATABASE] doctor_cases table ready.");
  } catch (err: any) {
    console.error("[DATABASE] Error ensuring doctor_cases table:", err.message);
  }
}
