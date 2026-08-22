CREATE TABLE IF NOT EXISTS "reminder_digest_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_email" varchar(255) NOT NULL,
	"role" varchar(20) NOT NULL,
	"clinic_id" integer,
	"doctor_id" integer,
	"local_digest_date" varchar(10) NOT NULL,
	"appointment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"template_version" varchar(30) NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"status" varchar(20) DEFAULT 'claimed' NOT NULL,
	"attempted_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reminder_digest_logs" ADD CONSTRAINT "reminder_digest_logs_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reminder_digest_logs" ADD CONSTRAINT "reminder_digest_logs_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reminder_digest_recipient_date_idx" ON "reminder_digest_logs" USING btree ("recipient_email","local_digest_date");