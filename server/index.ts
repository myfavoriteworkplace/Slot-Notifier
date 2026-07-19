import * as dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { registerOgRouteProduction } from "./og-inject";
import { createServer } from "http";
import cors from "cors";
import { pool } from "./db";

const PostgresStore = connectPg(session);
const app = express();
const httpServer = createServer(app);

// Trust proxy for deployments behind load balancers (Render, etc.)
app.set("trust proxy", 1);

// ------------------ COMPRESSION ------------------
// Gzip all responses > 1 KB — reduces JS/JSON transfer by 60-80%
app.use(compression());

// Determine frontend URL(s)
// FRONTEND_URL can be a comma-separated list of allowed origins
const FRONTEND_URL_RAW =
  process.env.NODE_ENV === "production"
    ? process.env.FRONTEND_URL || "https://book-my-slot-client.onrender.com"
    : "http://localhost:5173";

const FRONTEND_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "https://bookmyslot.dental.mossaic.in",
  "https://www.bookmyslot.dental.mossaic.in",
  "https://api.bookmyslot.dental.mossaic.in",
  "https://book-my-slot-client.onrender.com",
  ...FRONTEND_URL_RAW.split(",").map((u) => u.trim()).filter(Boolean),
  ...(process.env.EXTRA_CORS_ORIGINS || "").split(",").map((u) => u.trim()).filter(Boolean),
];

// ------------------ SESSION ------------------
const sessionSecret = (() => {
  if (process.env.NODE_ENV === "production") {
    if (!process.env.SESSION_SECRET) {
      throw new Error("SESSION_SECRET must be set in production");
    }
    return process.env.SESSION_SECRET;
  }
  return process.env.SESSION_SECRET || "book-my-slot-secret";
})();
console.log("[Environment]", process.env.NODE_ENV);

const ALLOWED_FRONTEND_ORIGINS = new Set(FRONTEND_ORIGINS);
const REPLIT_ORIGIN_REGEX = /^https:\/\/[a-z0-9.-]+\.replit\.dev$/;

app.use(
  session({
    store: new PostgresStore({
      pool,
      tableName: "session",
      createTableIfMissing: false,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false, // do not save empty sessions
    rolling: true,            // refresh cookie expiry on every response
    unset: "destroy",
    proxy: true,              // trust X-Forwarded-* headers (important on Render)
    cookie: {
      secure: process.env.NODE_ENV === "production", // HTTPS only in prod
      httpOnly: true,                               // JS cannot access cookie
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,            // 30 days
    },
  })
);

// ------------------ CORS ------------------
app.use(
  cors({
    origin: function (origin, callback) {
      const isAllowedOrigin =
        !origin ||
        ALLOWED_FRONTEND_ORIGINS.has(origin) ||
        REPLIT_ORIGIN_REGEX.test(origin);
      if (isAllowedOrigin) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cookie",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    exposedHeaders: ["Set-Cookie"],
  })
);

// Handle OPTIONS preflight requests
app.options("*", cors({ origin: FRONTEND_ORIGINS, credentials: true }));

// ------------------ BODY PARSING ------------------
declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

// ------------------ LOGGER ------------------
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

function redactLogBody(value: any): any {
  if (Array.isArray(value)) return value.map(redactLogBody);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      key.toLowerCase().includes("token") ? "[redacted]" : redactLogBody(nested),
    ])
  );
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(redactLogBody(capturedJsonResponse))}`;
      log(logLine);
    }
  });

  next();
});

// ------------------ STARTUP ------------------
(async () => {
  try {
    // Ensure database schema is synced
    log("Syncing database schema...", "system");
    
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      
      // Add all missing clinics columns in one block
      await db.execute(sql`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='logo_url') THEN
            ALTER TABLE clinics ADD COLUMN logo_url varchar(1000);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='status') THEN
            ALTER TABLE clinics ADD COLUMN status varchar(20) NOT NULL DEFAULT 'approved';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='registered_by') THEN
            ALTER TABLE clinics ADD COLUMN registered_by varchar(255);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='is_archived') THEN
            ALTER TABLE clinics ADD COLUMN is_archived boolean NOT NULL DEFAULT false;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='city') THEN
            ALTER TABLE clinics ADD COLUMN city varchar(255);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='pincode') THEN
            ALTER TABLE clinics ADD COLUMN pincode varchar(20);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='phone') THEN
            ALTER TABLE clinics ADD COLUMN phone varchar(50);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='website') THEN
            ALTER TABLE clinics ADD COLUMN website varchar(255);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='doctor_name') THEN
            ALTER TABLE clinics ADD COLUMN doctor_name varchar(255);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='doctor_specialization') THEN
            ALTER TABLE clinics ADD COLUMN doctor_specialization varchar(255);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='doctor_degree') THEN
            ALTER TABLE clinics ADD COLUMN doctor_degree varchar(255);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='doctors') THEN
            ALTER TABLE clinics ADD COLUMN doctors jsonb DEFAULT '[]';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='google_business_url') THEN
            ALTER TABLE clinics ADD COLUMN google_business_url varchar(1000);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='gst_number') THEN
            ALTER TABLE clinics ADD COLUMN gst_number varchar(50);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='medical_license_url') THEN
            ALTER TABLE clinics ADD COLUMN medical_license_url varchar(1000);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='clinic_reg_cert_url') THEN
            ALTER TABLE clinics ADD COLUMN clinic_reg_cert_url varchar(1000);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='trust_score') THEN
            ALTER TABLE clinics ADD COLUMN trust_score integer DEFAULT 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='plan') THEN
            ALTER TABLE clinics ADD COLUMN plan varchar(20) DEFAULT 'starter';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='subscription_status') THEN
            ALTER TABLE clinics ADD COLUMN subscription_status varchar(20) DEFAULT 'unpaid';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='billing_cycle') THEN
            ALTER TABLE clinics ADD COLUMN billing_cycle varchar(10) DEFAULT 'monthly';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='razorpay_subscription_id') THEN
            ALTER TABLE clinics ADD COLUMN razorpay_subscription_id varchar(255);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='default_slot_config') THEN
            ALTER TABLE clinics ADD COLUMN default_slot_config jsonb;
          END IF;
        END $$;
      `);
      log("clinics columns verified/updated", "system");

      // Create activation_tokens table if not exists
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS activation_tokens (
          id serial PRIMARY KEY,
          token varchar(255) NOT NULL UNIQUE,
          clinic_id integer NOT NULL REFERENCES clinics(id),
          plan varchar(20) NOT NULL,
          billing_cycle varchar(10) NOT NULL,
          razorpay_subscription_id varchar(255),
          short_url varchar(1000),
          expires_at timestamp NOT NULL,
          used boolean NOT NULL DEFAULT false,
          created_at timestamp DEFAULT now()
        );
      `);
      log("activation_tokens table verified/created", "system");

      // Add missing columns to bookings table
      await db.execute(sql`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='description') THEN
            ALTER TABLE bookings ADD COLUMN description text;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='assigned_doctor') THEN
            ALTER TABLE bookings ADD COLUMN assigned_doctor varchar(255);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='assigned_doctor_email') THEN
            ALTER TABLE bookings ADD COLUMN assigned_doctor_email varchar(255);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='doctor_approval_status') THEN
            ALTER TABLE bookings ADD COLUMN doctor_approval_status varchar(30);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='doctor_notes') THEN
            ALTER TABLE bookings ADD COLUMN doctor_notes text;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='clinical_status') THEN
            ALTER TABLE bookings ADD COLUMN clinical_status varchar(50);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='visit_status') THEN
            ALTER TABLE bookings ADD COLUMN visit_status varchar(50);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='checked_in_at') THEN
            ALTER TABLE bookings ADD COLUMN checked_in_at timestamp;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='confirmed_by') THEN
            ALTER TABLE bookings ADD COLUMN confirmed_by varchar(20);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='consent_signed_at') THEN
            ALTER TABLE bookings ADD COLUMN consent_signed_at timestamp;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='consent_signature') THEN
            ALTER TABLE bookings ADD COLUMN consent_signature text;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='consent_token') THEN
            ALTER TABLE bookings ADD COLUMN consent_token varchar(255);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='payment_status') THEN
            ALTER TABLE bookings ADD COLUMN payment_status varchar(30);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='payment_amount') THEN
            ALTER TABLE bookings ADD COLUMN payment_amount integer;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='razorpay_order_id') THEN
            ALTER TABLE bookings ADD COLUMN razorpay_order_id varchar(255);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='razorpay_payment_id') THEN
            ALTER TABLE bookings ADD COLUMN razorpay_payment_id varchar(255);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='cancellation_reason') THEN
            ALTER TABLE bookings ADD COLUMN cancellation_reason text;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='slot_cost') THEN
            ALTER TABLE bookings ADD COLUMN slot_cost integer DEFAULT 1;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='visit_completion_note') THEN
            ALTER TABLE bookings ADD COLUMN visit_completion_note text;
          END IF;
        END $$;
      `);
      log("bookings columns verified/updated", "system");

      await db.execute(sql`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='visit_type') THEN
            ALTER TABLE bookings ADD COLUMN visit_type VARCHAR(50);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='treatment_category') THEN
            ALTER TABLE bookings ADD COLUMN treatment_category VARCHAR(255);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='booked_by') THEN
            ALTER TABLE bookings ADD COLUMN booked_by VARCHAR(20);
          END IF;
        END $$;
      `);
      log("bookings visit_type/treatment_category/booked_by columns verified", "system");

      // Check if doctor_invites table exists
      const checkTable = await db.execute(
        sql`SELECT table_name FROM information_schema.tables WHERE table_name='doctor_invites'`
      );
      
      if ((checkTable as any).rowCount === 0) {
        log("Creating doctor_invites table...", "system");
        await db.execute(sql`
          CREATE TABLE doctor_invites (
            id SERIAL PRIMARY KEY,
            clinic_id INTEGER NOT NULL REFERENCES clinics(id),
            email VARCHAR(255) NOT NULL,
            token VARCHAR(255) NOT NULL UNIQUE,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        log("Successfully created doctor_invites table", "system");
      } else {
        log("doctor_invites table already exists", "system");
      }

      // Check if doctors table exists
      const checkDoctorsTable = await db.execute(
        sql`SELECT table_name FROM information_schema.tables WHERE table_name='doctors'`
      );

      if ((checkDoctorsTable as any).rowCount === 0) {
        log("Creating doctors table...", "system");
        await db.execute(sql`
          CREATE TABLE doctors (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            specialization VARCHAR(255),
            degree VARCHAR(255),
            image_url VARCHAR(1000),
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        log("Successfully created doctors table", "system");
      }

      // Check if clinic_doctors table exists
      const checkClinicDoctorsTable = await db.execute(
        sql`SELECT table_name FROM information_schema.tables WHERE table_name='clinic_doctors'`
      );

      if ((checkClinicDoctorsTable as any).rowCount === 0) {
        log("Creating clinic_doctors table...", "system");
        await db.execute(sql`
          CREATE TABLE clinic_doctors (
            id SERIAL PRIMARY KEY,
            clinic_id INTEGER NOT NULL REFERENCES clinics(id),
            doctor_id INTEGER NOT NULL REFERENCES doctors(id),
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        log("Successfully created clinic_doctors table", "system");
      }

      // Check if patients table exists
      const checkPatientsTable = await db.execute(
        sql`SELECT table_name FROM information_schema.tables WHERE table_name='patients'`
      );

      if ((checkPatientsTable as any).rowCount === 0) {
        log("Creating patients table...", "system");
        await db.execute(sql`
          CREATE TABLE patients (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            phone VARCHAR(50),
            doctor_id INTEGER REFERENCES doctors(id),
            clinic_id INTEGER REFERENCES clinics(id),
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        log("Successfully created patients table", "system");
      }

      // Check if smile_deals table exists
      const checkSmileDealsTable = await db.execute(
        sql`SELECT table_name FROM information_schema.tables WHERE table_name='smile_deals'`
      );

      if ((checkSmileDealsTable as any).rowCount === 0) {
        log("Creating smile_deals table...", "system");
        await db.execute(sql`
          CREATE TABLE smile_deals (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            image_url VARCHAR(1000) NOT NULL,
            booking_link VARCHAR(1000) NOT NULL,
            price VARCHAR(50),
            is_active BOOLEAN DEFAULT true NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        log("Successfully created smile_deals table", "system");
      }

      // Add missing columns to smile_deals if they don't exist
      await db.execute(sql`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smile_deals' AND column_name='video_url') THEN
            ALTER TABLE smile_deals ADD COLUMN video_url VARCHAR(1000);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smile_deals' AND column_name='starts_at') THEN
            ALTER TABLE smile_deals ADD COLUMN starts_at TIMESTAMP;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smile_deals' AND column_name='expires_at') THEN
            ALTER TABLE smile_deals ADD COLUMN expires_at TIMESTAMP;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smile_deals' AND column_name='is_featured') THEN
            ALTER TABLE smile_deals ADD COLUMN is_featured BOOLEAN DEFAULT false NOT NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smile_deals' AND column_name='category') THEN
            ALTER TABLE smile_deals ADD COLUMN category VARCHAR(100);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smile_deals' AND column_name='view_count') THEN
            ALTER TABLE smile_deals ADD COLUMN view_count INTEGER DEFAULT 0 NOT NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smile_deals' AND column_name='click_count') THEN
            ALTER TABLE smile_deals ADD COLUMN click_count INTEGER DEFAULT 0 NOT NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smile_deals' AND column_name='original_price') THEN
            ALTER TABLE smile_deals ADD COLUMN original_price VARCHAR(50);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smile_deals' AND column_name='is_flash') THEN
            ALTER TABLE smile_deals ADD COLUMN is_flash BOOLEAN DEFAULT false NOT NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smile_deals' AND column_name='subcategory') THEN
            ALTER TABLE smile_deals ADD COLUMN subcategory VARCHAR(100);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smile_deals' AND column_name='clinic_id') THEN
            ALTER TABLE smile_deals ADD COLUMN clinic_id INTEGER REFERENCES clinics(id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smile_deals' AND column_name='contact_info') THEN
            ALTER TABLE smile_deals ADD COLUMN contact_info JSONB;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='smile_deals' AND column_name='target_audience') THEN
            ALTER TABLE smile_deals ADD COLUMN target_audience VARCHAR(20) NOT NULL DEFAULT 'patient';
          END IF;
        END $$;
      `);
      log("smile_deals columns verified/updated", "system");

      // Add missing columns to doctors table
      await db.execute(sql`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='doctors' AND column_name='college') THEN
            ALTER TABLE doctors ADD COLUMN college VARCHAR(255);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='doctors' AND column_name='bio') THEN
            ALTER TABLE doctors ADD COLUMN bio TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='doctors' AND column_name='phone') THEN
            ALTER TABLE doctors ADD COLUMN phone VARCHAR(50);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='doctors' AND column_name='years_of_experience') THEN
            ALTER TABLE doctors ADD COLUMN years_of_experience INTEGER;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='doctors' AND column_name='languages') THEN
            ALTER TABLE doctors ADD COLUMN languages TEXT[];
          END IF;
        END $$;
      `);
      log("doctors columns verified/updated", "system");

      // Create doctor_certifications table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS doctor_certifications (
          id SERIAL PRIMARY KEY,
          doctor_id INTEGER NOT NULL REFERENCES doctors(id),
          title VARCHAR(255) NOT NULL,
          issuer VARCHAR(255),
          year VARCHAR(10),
          description TEXT,
          image_url VARCHAR(1000),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      log("doctor_certifications table verified/created", "system");

      // Create doctor_cases table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS doctor_cases (
          id SERIAL PRIMARY KEY,
          doctor_id INTEGER NOT NULL REFERENCES doctors(id),
          title VARCHAR(255) NOT NULL,
          description TEXT,
          tags JSONB DEFAULT '[]',
          media_urls JSONB DEFAULT '[]',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      log("doctor_cases table verified/created", "system");

      // Create doctor_leaves table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS doctor_leaves (
          id SERIAL PRIMARY KEY,
          doctor_id INTEGER NOT NULL REFERENCES doctors(id),
          leave_date VARCHAR(10) NOT NULL,
          reason VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      log("doctor_leaves table verified/created", "system");

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS email_otps (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          otp_hash VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          verified BOOLEAN DEFAULT false NOT NULL,
          verified_token VARCHAR(64),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_otps' AND column_name='purpose') THEN
            ALTER TABLE email_otps ADD COLUMN purpose VARCHAR(50) NOT NULL DEFAULT 'booking';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_otps' AND column_name='attempts') THEN
            ALTER TABLE email_otps ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_otps' AND column_name='locked_until') THEN
            ALTER TABLE email_otps ADD COLUMN locked_until TIMESTAMP;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_otps' AND column_name='send_count') THEN
            ALTER TABLE email_otps ADD COLUMN send_count INTEGER NOT NULL DEFAULT 1;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_otps' AND column_name='send_window_start') THEN
            ALTER TABLE email_otps ADD COLUMN send_window_start TIMESTAMP DEFAULT NOW();
          END IF;
        END $$;
      `);
      log("email_otps table verified/created", "system");

      // Create clinical_records table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS clinical_records (
          id SERIAL PRIMARY KEY,
          booking_id INTEGER NOT NULL REFERENCES bookings(id),
          clinic_id INTEGER NOT NULL REFERENCES clinics(id),
          patient_name VARCHAR(255) NOT NULL,
          patient_phone VARCHAR(50),
          doctor_name VARCHAR(255),
          diagnosis JSONB DEFAULT '[]',
          prescription TEXT,
          notes TEXT,
          is_deleted BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      log("clinical_records table verified/created", "system");

      // Create patient_bills table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS patient_bills (
          id SERIAL PRIMARY KEY,
          clinic_id INTEGER NOT NULL REFERENCES clinics(id),
          booking_id INTEGER REFERENCES bookings(id),
          bill_number VARCHAR(50) NOT NULL,
          patient_name VARCHAR(255) NOT NULL,
          patient_phone VARCHAR(50),
          patient_email VARCHAR(255),
          services JSONB DEFAULT '[]',
          subtotal REAL NOT NULL DEFAULT 0,
          discount_pct REAL NOT NULL DEFAULT 0,
          tax_pct REAL NOT NULL DEFAULT 0,
          total REAL NOT NULL DEFAULT 0,
          payment_method VARCHAR(50) DEFAULT 'Cash',
          payment_status VARCHAR(20) NOT NULL DEFAULT 'paid',
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      log("patient_bills table verified/created", "system");

      // Add cashier + amount columns to patient_bills
      await db.execute(sql`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patient_bills' AND column_name='cashier_id') THEN
            ALTER TABLE patient_bills ADD COLUMN cashier_id VARCHAR(100);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patient_bills' AND column_name='cashier_notes') THEN
            ALTER TABLE patient_bills ADD COLUMN cashier_notes TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patient_bills' AND column_name='amount_received') THEN
            ALTER TABLE patient_bills ADD COLUMN amount_received REAL;
          END IF;
        END $$;
      `);
      log("patient_bills cashier columns verified/added", "system");

      // Create pharmacy_stock table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS pharmacy_stock (
          id SERIAL PRIMARY KEY,
          clinic_id INTEGER NOT NULL REFERENCES clinics(id),
          medicine_name VARCHAR(255) NOT NULL,
          dosage VARCHAR(100),
          unit_price REAL NOT NULL DEFAULT 0,
          available_qty INTEGER NOT NULL DEFAULT 0,
          expiry_date VARCHAR(20),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      log("pharmacy_stock table verified/created", "system");

      // Create billing_audit_logs table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS billing_audit_logs (
          id SERIAL PRIMARY KEY,
          clinic_id INTEGER NOT NULL,
          booking_id INTEGER,
          bill_id INTEGER,
          action VARCHAR(100) NOT NULL,
          details JSONB DEFAULT '{}',
          performed_by VARCHAR(100),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      log("billing_audit_logs table verified/created", "system");

      // ── Patient identity columns ─────────────────────────────────────────────
      await db.execute(sql`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='patient_code') THEN
            ALTER TABLE patients ADD COLUMN patient_code VARCHAR(20);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='visit_count') THEN
            ALTER TABLE patients ADD COLUMN visit_count INTEGER NOT NULL DEFAULT 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='last_visit_at') THEN
            ALTER TABLE patients ADD COLUMN last_visit_at TIMESTAMP;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='patient_id') THEN
            ALTER TABLE bookings ADD COLUMN patient_id INTEGER REFERENCES patients(id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='customer_age') THEN
            ALTER TABLE bookings ADD COLUMN customer_age integer;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='customer_gender') THEN
            ALTER TABLE bookings ADD COLUMN customer_gender varchar(20);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patient_bills' AND column_name='patient_id') THEN
            ALTER TABLE patient_bills ADD COLUMN patient_id INTEGER REFERENCES patients(id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinical_records' AND column_name='patient_id') THEN
            ALTER TABLE clinical_records ADD COLUMN patient_id INTEGER REFERENCES patients(id);
          END IF;
        END $$;
      `);
      log("patient identity columns ready", "system");

      // ── Backfill patientCode for legacy patients that are missing one ──────
      try {
        await db.execute(sql`
          UPDATE patients p
          SET patient_code = 'PAT-' || LPAD(CAST(sub.rn AS TEXT), 4, '0')
          FROM (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY clinic_id ORDER BY created_at ASC NULLS LAST, id ASC) AS rn
            FROM patients
            WHERE patient_code IS NULL
          ) sub
          WHERE p.id = sub.id
        `);
        log("patientCode backfill complete", "DATABASE");
      } catch (e: any) {
        console.error("[DATABASE] patientCode backfill failed (non-fatal):", e.message);
      }

      // ── Unique constraint on (clinic_id, patient_code) ────────────────────
      try {
        await db.execute(sql`
          ALTER TABLE patients
            ADD CONSTRAINT patients_clinic_patient_code_unique UNIQUE (clinic_id, patient_code)
        `);
        log("patients (clinic_id, patient_code) unique constraint added", "DATABASE");
      } catch (e: any) {
        if (!e.message?.includes("already exists")) {
          console.error("[DATABASE] patients unique constraint failed (non-fatal):", e.message);
        }
      }

      // ── Backfill: create patient records from historical bookings ───────────
      // Safe to run every startup — only touches bookings where patient_id IS NULL.
      // Becomes a no-op once all bookings are linked.
      try {
        const unlinkedResult = await db.execute(sql`
          SELECT b.id, s.clinic_id, b.customer_email, b.customer_name, b.customer_phone
          FROM bookings b
          JOIN slots s ON s.id = b.slot_id
          WHERE b.customer_email IS NOT NULL
            AND b.customer_email != ''
            AND b.patient_id IS NULL
            AND s.clinic_id IS NOT NULL
          ORDER BY b.id
        `);
        const unlinked = (unlinkedResult as any).rows ?? [];

        if (unlinked.length > 0) {
          log(`Patient backfill: processing ${unlinked.length} unlinked booking(s)...`, "system");
          let created = 0, linked = 0;

          for (const row of unlinked) {
            try {
              const clinicId: number = row.clinic_id;
              const normalizedEmail: string = (row.customer_email as string).toLowerCase().trim();
              const name: string = row.customer_name || "Unknown";
              const phone: string | null = row.customer_phone || null;

              // Check if a patient record already exists for this clinic + email
              const existResult = await db.execute(sql`
                SELECT id FROM patients
                WHERE clinic_id = ${clinicId} AND email = ${normalizedEmail}
                LIMIT 1
              `);
              const existingRow = (existResult as any).rows?.[0];

              let patientId: number;
              if (existingRow) {
                await db.execute(sql`
                  UPDATE patients
                  SET visit_count = visit_count + 1, last_visit_at = NOW()
                  WHERE id = ${existingRow.id}
                `);
                patientId = existingRow.id;
              } else {
                // Generate a sequential PAT code scoped to this clinic
                const countResult = await db.execute(sql`
                  SELECT COUNT(*)::int AS count FROM patients WHERE clinic_id = ${clinicId}
                `);
                const seq = ((countResult as any).rows?.[0]?.count ?? 0) + 1;
                const patientCode = `PAT-${String(seq).padStart(4, "0")}`;

                const insertResult = await db.execute(sql`
                  INSERT INTO patients (clinic_id, email, name, phone, patient_code, visit_count, last_visit_at)
                  VALUES (${clinicId}, ${normalizedEmail}, ${name}, ${phone}, ${patientCode}, 1, NOW())
                  RETURNING id
                `);
                patientId = (insertResult as any).rows?.[0]?.id;
                created++;
              }

              // Link the booking to the patient record
              await db.execute(sql`
                UPDATE bookings SET patient_id = ${patientId} WHERE id = ${row.id}
              `);
              linked++;
            } catch (rowErr: any) {
              console.error(`[BACKFILL] Skipped booking ${row.id}:`, rowErr.message);
            }
          }

          log(`Patient backfill complete: ${created} new patient(s) created, ${linked} booking(s) linked`, "system");
        } else {
          log("Patient backfill: all bookings already linked — nothing to do", "system");
        }
      } catch (backfillErr: any) {
        log(`Patient backfill warning: ${backfillErr.message}`, "system");
      }

      // ── PII Audit log table ──────────────────────────────────────────────────
      try {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS audit_logs (
            id           serial PRIMARY KEY,
            actor_type   varchar(30)  NOT NULL,
            actor_id     varchar(255) NOT NULL,
            actor_label  varchar(255),
            clinic_id    integer,
            action       varchar(20)  NOT NULL,
            resource_type varchar(50) NOT NULL,
            resource_id  integer,
            ip_address   varchar(64),
            user_agent   text,
            created_at   timestamp DEFAULT now()
          );
        `);
        await db.execute(sql`
          CREATE INDEX IF NOT EXISTS audit_logs_clinic_id_idx   ON audit_logs (clinic_id);
          CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx    ON audit_logs (actor_id);
          CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx  ON audit_logs (created_at DESC);
        `);
        log("audit_logs table verified/created", "system");
      } catch (e: any) {
        log(`audit_logs migration warning: ${e.message}`, "system");
      }
      // ─────────────────────────────────────────────────────────────────────────

      // ── Consent text versions table + consent_tokens version column ──────────
      try {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS consent_text_versions (
            id                serial       PRIMARY KEY,
            clinic_id         integer      REFERENCES clinics(id),
            version           varchar(20)  NOT NULL,
            title             varchar(255) NOT NULL DEFAULT 'Standard Dental Consent',
            text_en           text         NOT NULL,
            text_hash         varchar(64)  NOT NULL,
            is_current        boolean      NOT NULL DEFAULT false,
            created_by_email  varchar(255),
            effective_from    timestamp    DEFAULT now(),
            created_at        timestamp    DEFAULT now()
          );
        `);
        await db.execute(sql`
          CREATE INDEX IF NOT EXISTS consent_text_versions_clinic_id_idx ON consent_text_versions (clinic_id);
          CREATE INDEX IF NOT EXISTS consent_text_versions_is_current_idx ON consent_text_versions (clinic_id, is_current);
        `);
        await db.execute(sql`
          ALTER TABLE consent_tokens
            ADD COLUMN IF NOT EXISTS consent_text_version_id integer REFERENCES consent_text_versions(id);
        `);
        log("consent_text_versions table + consent_tokens column verified/created", "system");
      } catch (e: any) {
        log(`consent_text_versions migration warning: ${e.message}`, "system");
      }

      // ── Seed global v1.0 default consent text if none exists ─────────────────
      try {
        const existing = await db.execute(sql`
          SELECT id FROM consent_text_versions WHERE clinic_id IS NULL LIMIT 1;
        `);
        if (existing.rows.length === 0) {
          const defaultText = `I hereby give my informed consent to the dental clinic to perform dental examination and any necessary dental treatment deemed appropriate by the treating dentist.

I understand and acknowledge the following:
- The nature of the proposed treatment and its alternatives have been explained to me.
- All dental procedures carry certain risks including pain, swelling, and infection.
- I am responsible for informing the clinic of any allergies or medical conditions.
- My personal and health information will be kept confidential.
- I have the right to withdraw consent at any time before treatment begins.

By signing below, I confirm that I have read and understood the above and voluntarily consent to the dental care provided by this clinic.`;
          const crypto = await import("crypto");
          const hash = crypto.createHash("sha256").update(defaultText).digest("hex");
          await db.execute(sql`
            INSERT INTO consent_text_versions
              (clinic_id, version, title, text_en, text_hash, is_current, effective_from)
            VALUES
              (NULL, '1.0', 'Standard Dental Consent', ${defaultText}, ${hash}, true, now());
          `);
          log("Seeded global v1.0 consent text", "system");
        }
      } catch (e: any) {
        log(`consent text seed warning: ${e.message}`, "system");
      }
      // ─────────────────────────────────────────────────────────────────────────

      // ── Drop FK constraint on notifications.user_id ─────────────────────────
      // notifications.user_id originally referenced users(id) (Replit Auth),
      // but clinic/doctor/admin IDs are not in the users table — the FK caused
      // every createNotification call to fail silently, so no push notifications
      // were ever delivered. Safe to run every startup (IF EXISTS is a no-op).
      try {
        await db.execute(sql`
          ALTER TABLE notifications
            DROP CONSTRAINT IF EXISTS notifications_user_id_users_id_fk;
        `);
        log("notifications user_id FK constraint removed", "system");
      } catch (e: any) {
        log(`notifications FK drop warning: ${e.message}`, "system");
      }

      // ── Add type + booking_id columns to notifications (deep-link support) ──
      try {
        await db.execute(sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type varchar(80);`);
        await db.execute(sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS booking_id integer;`);
        log("notifications type + booking_id columns ensured", "system");
      } catch (e: any) {
        log(`notifications column migration warning: ${e.message}`, "system");
      }

      // ── Backfill notifications.user_id with clinic:/doctor: prefix ──────────
      // clinics.id and doctors.id are both independent serial sequences that
      // start at 1, so legacy bare-numeric user_id values (e.g. "3") were
      // ambiguous and could collide between a clinic and a doctor with the
      // same numeric id, leaking notifications across roles. New rows are
      // always written with a "clinic:" or "doctor:" prefix — this backfills
      // old rows so they still resolve under the new scheme. Idempotent: only
      // touches rows whose user_id has no prefix yet.
      try {
        await db.execute(sql`
          UPDATE notifications n
          SET user_id = 'clinic:' || n.user_id
          WHERE n.user_id !~ ':'
            AND n.user_id ~ '^[0-9]+$'
            AND EXISTS (SELECT 1 FROM clinics c WHERE c.id = n.user_id::integer)
            AND NOT EXISTS (SELECT 1 FROM doctors d WHERE d.id = n.user_id::integer);
        `);
        await db.execute(sql`
          UPDATE notifications n
          SET user_id = 'doctor:' || n.user_id
          WHERE n.user_id !~ ':'
            AND n.user_id ~ '^[0-9]+$'
            AND EXISTS (SELECT 1 FROM doctors d WHERE d.id = n.user_id::integer)
            AND NOT EXISTS (SELECT 1 FROM clinics c WHERE c.id = n.user_id::integer);
        `);
        // Genuine collisions (same numeric id exists in both clinics and
        // doctors): unrecoverable — the original role was never stored — so
        // mark them read rather than guess wrong and leak them into a bell
        // that isn't theirs.
        const collisionResult: any = await db.execute(sql`
          UPDATE notifications n
          SET read = true
          WHERE n.user_id !~ ':'
            AND n.user_id ~ '^[0-9]+$'
            AND EXISTS (SELECT 1 FROM clinics c WHERE c.id = n.user_id::integer)
            AND EXISTS (SELECT 1 FROM doctors d WHERE d.id = n.user_id::integer)
            AND n.read = false
          RETURNING n.id;
        `);
        const collisionCount = collisionResult?.rows?.length ?? collisionResult?.rowCount ?? 0;
        if (collisionCount > 0) {
          log(`notifications user_id backfill: ${collisionCount} ambiguous legacy rows (id collision between a clinic and doctor) marked read — role unrecoverable`, "system");
        }
        log("notifications user_id clinic:/doctor: backfill complete", "system");
      } catch (e: any) {
        log(`notifications user_id backfill warning: ${e.message}`, "system");
      }

      // ── patient_charts table (odontogram — one chart per patient per clinic) ──
      try {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS patient_charts (
            id          SERIAL PRIMARY KEY,
            patient_id  INTEGER NOT NULL REFERENCES patients(id),
            clinic_id   INTEGER NOT NULL REFERENCES clinics(id),
            chart_data  TEXT NOT NULL DEFAULT '{}',
            updated_at  TIMESTAMP DEFAULT NOW(),
            created_at  TIMESTAMP DEFAULT NOW(),
            UNIQUE(patient_id, clinic_id)
          );
        `);
        log("patient_charts table ensured", "system");
      } catch (e: any) {
        log(`patient_charts migration warning: ${e.message}`, "system");
      }
      // ── patient_medical_history table (cross-visit medical profile) ──────────
      try {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS patient_medical_history (
            id                  SERIAL PRIMARY KEY,
            patient_id          INTEGER NOT NULL REFERENCES patients(id),
            clinic_id           INTEGER NOT NULL REFERENCES clinics(id),
            medical_alerts      JSONB DEFAULT '[]',
            general_conditions  JSONB DEFAULT '[]',
            current_medications JSONB DEFAULT '[]',
            allergies           JSONB DEFAULT '[]',
            surgical_history    JSONB DEFAULT '[]',
            family_history      JSONB DEFAULT '[]',
            dental_history      JSONB,
            vaccination_history JSONB DEFAULT '[]',
            insurance_details   JSONB,
            emergency_contact   JSONB,
            lifestyle           JSONB,
            medical_clearance   JSONB,
            general_notes       TEXT,
            attachments         JSONB DEFAULT '[]',
            updated_at          TIMESTAMP DEFAULT NOW(),
            created_at          TIMESTAMP DEFAULT NOW(),
            UNIQUE(patient_id, clinic_id)
          );
        `);
        log("patient_medical_history table ensured", "system");
      } catch (e: any) {
        log(`patient_medical_history migration warning: ${e.message}`, "system");
      }

      // ── Add unit_price column to inventory_items ──────────────────────────
      try {
        await db.execute(sql`ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS unit_price REAL;`);
        log("inventory_items unit_price column ensured", "system");
      } catch (e: any) {
        log(`inventory_items unit_price migration warning: ${e.message}`, "system");
      }
      // ── Add supplier/barcode/location/batch columns to inventory_items ────
      try {
        await db.execute(sql`
          ALTER TABLE inventory_items
            ADD COLUMN IF NOT EXISTS sku VARCHAR(100),
            ADD COLUMN IF NOT EXISTS barcode VARCHAR(100),
            ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(255),
            ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS supplier_contact VARCHAR(255),
            ADD COLUMN IF NOT EXISTS purchase_price REAL,
            ADD COLUMN IF NOT EXISTS last_purchased_date TIMESTAMP,
            ADD COLUMN IF NOT EXISTS location VARCHAR(255),
            ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100);
        `);
        log("inventory_items supplier/barcode/location/batch columns ensured", "system");
      } catch (e: any) {
        log(`inventory_items supplier/barcode/location/batch migration warning: ${e.message}`, "system");
      }
      // ─────────────────────────────────────────────────────────────────────────

    } catch (dbErr: any) {
      log(`Schema sync warning: ${dbErr.message}`, "system");
    }

    const { ensureSessionTable } = await import("./db");
    await ensureSessionTable();

    const seedModule = await import("./seed-test-clinic");
    await seedModule.seed();
  } catch (err) {
    console.error("[SYSTEM] Startup initialization failed:", err);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  console.log(`[SYSTEM] Starting server on port ${port} with NODE_ENV=${process.env.NODE_ENV}`);

  // Register API routes
  await registerRoutes(httpServer, app);

  // 404 handler for API routes — must be before Vite middleware so unmatched
  // API paths return JSON instead of the HTML catch-all
  app.use("/api/*", (req, res) => {
    res.status(404).json({
      message: "API endpoint not found",
      path: req.originalUrl,
      method: req.method,
      suggestion:
        "Ensure the path matches exactly and CORS is configured correctly for cross-origin requests.",
    });
  });

  // Serve frontend static files in production
  if (process.env.NODE_ENV === "production") {
    console.log("[SYSTEM] Production mode: Serving static files");
    // Must be registered before serveStatic so the route fires before the catch-all
    registerOgRouteProduction(app);
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error(`[ERROR] ${new Date().toISOString()} - ${status}: ${message}`);
    console.error(`[ERROR DETAILS] Method: ${_req.method}, Path: ${_req.path}`);
    if (_req.body && Object.keys(_req.body).length > 0) {
      const sanitizedBody = { ..._req.body };
      if (sanitizedBody.password) sanitizedBody.password = "********";
      console.error(`[ERROR BODY] ${JSON.stringify(sanitizedBody)}`);
    }
    if (err.stack) console.error(`[ERROR STACK] ${err.stack}`);

    res.status(status).json({
      message,
      details: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  });

  // Start server
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`Server listening on port ${port}`);
    }
  );
})();
