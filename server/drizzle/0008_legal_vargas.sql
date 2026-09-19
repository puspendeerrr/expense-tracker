CREATE TABLE "admin_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"actor_email" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"target_label" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audits" ADD CONSTRAINT "admin_audits_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audits_created_idx" ON "admin_audits" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "admin_audits_actor_idx" ON "admin_audits" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "admin_audits_target_idx" ON "admin_audits" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "admin_audits_action_idx" ON "admin_audits" USING btree ("action");