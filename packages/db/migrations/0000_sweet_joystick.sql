CREATE TYPE "public"."ai_provider" AS ENUM('chatgpt', 'gemini', 'perplexity');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('vault.key.created', 'vault.key.decrypted', 'vault.key.deleted', 'vault.key.rotated', 'vault.key.validated', 'brand.created', 'brand.updated', 'brand.deleted', 'keyword.created', 'keyword.updated', 'keyword.deleted', 'scan.triggered', 'scan.completed', 'org.invited_member', 'org.removed_member', 'org.role_changed');--> statement-breakpoint
CREATE TYPE "public"."dialect" AS ENUM('msa', 'gulf', 'levantine', 'egyptian');--> statement-breakpoint
CREATE TYPE "public"."keyword_dialect" AS ENUM('msa', 'gulf', 'levantine', 'egyptian', 'auto');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('ar', 'en');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('starter', 'growth', 'agency', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."scan_schedule" AS ENUM('daily', 'weekly', 'custom');--> statement-breakpoint
CREATE TYPE "public"."sentiment" AS ENUM('positive', 'neutral', 'negative');--> statement-breakpoint
CREATE TYPE "public"."vault_provider" AS ENUM('openai', 'gemini', 'perplexity');--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_org_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"plan" "plan" DEFAULT 'starter' NOT NULL,
	"country" text,
	"billing_email" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_clerk_org_id_unique" UNIQUE("clerk_org_id"),
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organizations_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "organizations_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"org_id" uuid NOT NULL,
	"role" "org_role" DEFAULT 'member' NOT NULL,
	"preferred_dialect" "dialect" DEFAULT 'msa' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "api_keys_vault" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider" "vault_provider" NOT NULL,
	"encrypted_key" "bytea" NOT NULL,
	"iv" "bytea" NOT NULL,
	"auth_tag" "bytea" NOT NULL,
	"last_four" text NOT NULL,
	"is_valid" boolean DEFAULT true NOT NULL,
	"last_validated_at" timestamp with time zone,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"aliases_ar" text[] DEFAULT '{}'::text[] NOT NULL,
	"aliases_en" text[] DEFAULT '{}'::text[] NOT NULL,
	"website" text,
	"competitors" text[] DEFAULT '{}'::text[] NOT NULL,
	"industry" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"query_text" text NOT NULL,
	"language" "language" DEFAULT 'ar' NOT NULL,
	"dialect" "keyword_dialect" DEFAULT 'auto' NOT NULL,
	"schedule" "scan_schedule" DEFAULT 'daily' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_scanned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"keyword_id" uuid NOT NULL,
	"ai_provider" "ai_provider" NOT NULL,
	"raw_response" jsonb NOT NULL,
	"geo_score" double precision NOT NULL,
	"brand_mentioned" boolean NOT NULL,
	"mention_position" integer,
	"mention_rank" integer,
	"sentiment" "sentiment" DEFAULT 'neutral' NOT NULL,
	"sentiment_score" double precision DEFAULT 0 NOT NULL,
	"citations" text[] DEFAULT '{}'::text[] NOT NULL,
	"competitors_mentioned" text[] DEFAULT '{}'::text[] NOT NULL,
	"context_snippet" text,
	"detected_dialect" "dialect",
	"latency_ms" integer NOT NULL,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"metric_date" date NOT NULL,
	"avg_geo_score" double precision NOT NULL,
	"ai_share_of_voice" double precision NOT NULL,
	"total_scans" integer NOT NULL,
	"brand_mentions" integer NOT NULL,
	"competitor_breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider_breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"actor_clerk_user_id" text,
	"action" "audit_action" NOT NULL,
	"entity_ref" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"company" text,
	"website" text,
	"country" text,
	"brand_count" integer,
	"notes" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"ip_address" text,
	"user_agent" text,
	"invited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys_vault" ADD CONSTRAINT "api_keys_vault_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_results" ADD CONSTRAINT "scan_results_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_org_idx" ON "users" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "vault_org_idx" ON "api_keys_vault" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vault_org_provider_unique" ON "api_keys_vault" USING btree ("org_id","provider");--> statement-breakpoint
CREATE INDEX "brands_org_idx" ON "brands" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "keywords_brand_idx" ON "keywords" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "keywords_active_idx" ON "keywords" USING btree ("is_active","last_scanned_at");--> statement-breakpoint
CREATE INDEX "scan_keyword_idx" ON "scan_results" USING btree ("keyword_id");--> statement-breakpoint
CREATE INDEX "scan_keyword_time_idx" ON "scan_results" USING btree ("keyword_id","scanned_at");--> statement-breakpoint
CREATE INDEX "scan_time_idx" ON "scan_results" USING btree ("scanned_at");--> statement-breakpoint
CREATE INDEX "metrics_brand_idx" ON "daily_metrics" USING btree ("brand_id");--> statement-breakpoint
CREATE UNIQUE INDEX "metrics_brand_date_unique" ON "daily_metrics" USING btree ("brand_id","metric_date");--> statement-breakpoint
CREATE INDEX "audit_org_idx" ON "audit_logs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "audit_org_time_idx" ON "audit_logs" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "waitlist_email_idx" ON "waitlist_entries" USING btree ("email");--> statement-breakpoint
CREATE INDEX "waitlist_created_idx" ON "waitlist_entries" USING btree ("created_at");