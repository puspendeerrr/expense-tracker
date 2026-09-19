CREATE TYPE "public"."dashboard_mode" AS ENUM('summary', 'detailed');--> statement-breakpoint
CREATE TYPE "public"."dashboard_view" AS ENUM('group', 'personal');--> statement-breakpoint
CREATE TABLE "user_dashboard_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"mode" "dashboard_mode" DEFAULT 'detailed' NOT NULL,
	"view" "dashboard_view" DEFAULT 'group' NOT NULL,
	"widgets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_dashboard_preferences" ADD CONSTRAINT "user_dashboard_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;