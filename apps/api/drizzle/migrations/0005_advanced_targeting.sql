ALTER TYPE "targeting_kind" ADD VALUE 'geo';--> statement-breakpoint
ALTER TYPE "targeting_kind" ADD VALUE 'session_page_views';--> statement-breakpoint
ALTER TYPE "targeting_kind" ADD VALUE 'utm';--> statement-breakpoint
ALTER TYPE "targeting_kind" ADD VALUE 'ab_test';--> statement-breakpoint
ALTER TABLE "frequency_rules" ADD COLUMN "interval_days" integer;