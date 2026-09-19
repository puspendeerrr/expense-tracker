CREATE TYPE "public"."activity_type" AS ENUM('group_created', 'member_joined', 'member_left', 'member_removed', 'invite_regenerated', 'payday_updated', 'expense_created', 'expense_updated', 'expense_deleted', 'settlement_created', 'settlement_approved', 'settlement_rejected', 'settlement_cancelled');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('groceries', 'food_dining', 'rent', 'utilities', 'entertainment', 'travel', 'household', 'medical', 'other');--> statement-breakpoint
CREATE TYPE "public"."group_role" AS ENUM('creator', 'member');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('expense_added', 'expense_updated', 'expense_deleted', 'settlement_requested', 'settlement_approved', 'settlement_rejected', 'member_joined', 'payment_reminder');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('cash', 'upi');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('paid_pending_approval', 'will_pay_soon', 'completed', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."split_type" AS ENUM('everyone', 'specific');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"type" "activity_type" NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"legacy_mongo_id" text
);
--> statement-breakpoint
CREATE TABLE "expense_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"share_paise" bigint NOT NULL,
	CONSTRAINT "expense_participants_share_non_negative" CHECK ("expense_participants"."share_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"title" text NOT NULL,
	"amount_paise" bigint NOT NULL,
	"paid_by" uuid NOT NULL,
	"split_type" "split_type" DEFAULT 'everyone' NOT NULL,
	"payment_mode" "payment_mode" DEFAULT 'cash' NOT NULL,
	"category" "expense_category",
	"expense_date" date NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"receipt_url" text,
	"receipt_storage_key" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"legacy_mongo_id" text,
	CONSTRAINT "expenses_amount_positive" CHECK ("expenses"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "group_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"currency" text DEFAULT 'INR' NOT NULL,
	"invite_code" text NOT NULL,
	"invite_token" text NOT NULL,
	"invite_rotated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payday" integer,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"legacy_mongo_id" text,
	CONSTRAINT "groups_payday_range" CHECK ("groups"."payday" is null or ("groups"."payday" between 1 and 31))
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"sender_user_id" uuid,
	"group_id" uuid,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"payer_id" uuid NOT NULL,
	"receiver_id" uuid NOT NULL,
	"amount_paise" bigint NOT NULL,
	"status" "settlement_status" DEFAULT 'paid_pending_approval' NOT NULL,
	"payment_method" "payment_mode" DEFAULT 'upi' NOT NULL,
	"proof_url" text,
	"proof_storage_key" text,
	"rejection_reason" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"legacy_mongo_id" text,
	CONSTRAINT "settlements_amount_positive" CHECK ("settlements"."amount_paise" > 0),
	CONSTRAINT "settlements_distinct_parties" CHECK ("settlements"."payer_id" <> "settlements"."receiver_id")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_participants" ADD CONSTRAINT "expense_participants_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_participants" ADD CONSTRAINT "expense_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_payer_id_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_group_created_idx" ON "activities" USING btree ("group_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "activities_actor_idx" ON "activities" USING btree ("actor_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "activities_legacy_mongo_id_unique" ON "activities" USING btree ("legacy_mongo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_participants_expense_user_unique" ON "expense_participants" USING btree ("expense_id","user_id");--> statement-breakpoint
CREATE INDEX "expense_participants_user_idx" ON "expense_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "expense_participants_expense_idx" ON "expense_participants" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "expenses_group_date_idx" ON "expenses" USING btree ("group_id","expense_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "expenses_group_paid_by_idx" ON "expenses" USING btree ("group_id","paid_by");--> statement-breakpoint
CREATE INDEX "expenses_group_created_idx" ON "expenses" USING btree ("group_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_legacy_mongo_id_unique" ON "expenses" USING btree ("legacy_mongo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_members_group_user_unique" ON "group_members" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "group_members_user_idx" ON "group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "group_members_group_idx" ON "group_members" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_invite_code_unique" ON "groups" USING btree ("invite_code");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_invite_token_unique" ON "groups" USING btree ("invite_token");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_legacy_mongo_id_unique" ON "groups" USING btree ("legacy_mongo_id");--> statement-breakpoint
CREATE INDEX "groups_created_by_idx" ON "groups" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "notifications" USING btree ("recipient_user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_recipient_unread_idx" ON "notifications" USING btree ("recipient_user_id") WHERE "notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "settlements_group_status_idx" ON "settlements" USING btree ("group_id","status");--> statement-breakpoint
CREATE INDEX "settlements_group_created_idx" ON "settlements" USING btree ("group_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "settlements_payer_status_idx" ON "settlements" USING btree ("payer_id","status");--> statement-breakpoint
CREATE INDEX "settlements_receiver_status_idx" ON "settlements" USING btree ("receiver_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "settlements_legacy_mongo_id_unique" ON "settlements" USING btree ("legacy_mongo_id");