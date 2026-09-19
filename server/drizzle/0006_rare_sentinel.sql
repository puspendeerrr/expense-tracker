ALTER TYPE "public"."split_type" ADD VALUE 'exact';--> statement-breakpoint
ALTER TYPE "public"."split_type" ADD VALUE 'percentage';--> statement-breakpoint
ALTER TYPE "public"."split_type" ADD VALUE 'shares';--> statement-breakpoint
ALTER TABLE "expense_participants" ADD COLUMN "split_value" bigint;--> statement-breakpoint
ALTER TABLE "expense_participants" ADD CONSTRAINT "expense_participants_split_value_non_negative" CHECK ("expense_participants"."split_value" is null or "expense_participants"."split_value" >= 0);