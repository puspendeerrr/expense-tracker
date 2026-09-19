CREATE TYPE "public"."account_event_type" AS ENUM('login_succeeded', 'login_failed', 'logout', 'new_device_detected', 'session_revoked', 'sessions_revoked_all', 'password_changed', 'password_reset', 'device_renamed', 'profile_updated', 'account_deactivated', 'account_reactivated', 'data_exported');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'security_new_device';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'security_password_changed';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'security_session_revoked';--> statement-breakpoint
CREATE TABLE "account_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "account_event_type" NOT NULL,
	"session_id" uuid,
	"ip_address" text,
	"user_agent" text,
	"device_signature" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "device_name" text;--> statement-breakpoint
ALTER TABLE "account_events" ADD CONSTRAINT "account_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_events" ADD CONSTRAINT "account_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_events_user_created_idx" ON "account_events" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "account_events_user_signature_idx" ON "account_events" USING btree ("user_id","device_signature");