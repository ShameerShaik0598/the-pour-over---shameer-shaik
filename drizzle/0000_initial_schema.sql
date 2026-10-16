CREATE TYPE "public"."app_event_type" AS ENUM('app_open', 'read_story', 'link_click', 'login');--> statement-breakpoint
CREATE TYPE "public"."app_origin" AS ENUM('csv', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."delivery_outcome" AS ENUM('accepted', 'duplicate', 'invalid', 'bad_signature', 'stale', 'too_large', 'rate_limited');--> statement-breakpoint
CREATE TYPE "public"."subscriber_status" AS ENUM('active', 'unsubscribed');--> statement-breakpoint
CREATE TABLE "app_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"event" "app_event_type" NOT NULL,
	"user_id" text,
	"device_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_users" (
	"user_id" text PRIMARY KEY NOT NULL,
	"email" text,
	"subscriber_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"origin" "app_origin" DEFAULT 'csv' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"sent_prompt" text NOT NULL,
	"plan" jsonb,
	"outcome" text NOT NULL,
	"provider" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_links" (
	"device_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_conflicts" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"ref_a" text NOT NULL,
	"ref_b" text NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quarantine" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_file" text NOT NULL,
	"row_number" integer NOT NULL,
	"raw" jsonb NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"filter" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"signup_date" date NOT NULL,
	"status" "subscriber_status" NOT NULL,
	"source" text NOT NULL,
	"last_open_date" date,
	"duplicate_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscribers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "visitors" (
	"visitor_id" text PRIMARY KEY NOT NULL,
	"email" text,
	"subscriber_id" uuid,
	"conflict" boolean DEFAULT false NOT NULL,
	"first_seen" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "web_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "web_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"visitor_id" text NOT NULL,
	"page" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"utm_source" text,
	"row_key" text NOT NULL,
	CONSTRAINT "web_events_row_key_unique" UNIQUE("row_key")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "webhook_deliveries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"event_id" text,
	"outcome" "delivery_outcome" NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_users" ADD CONSTRAINT "app_users_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_events" ADD CONSTRAINT "web_events_visitor_id_visitors_visitor_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("visitor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_events_device_idx" ON "app_events" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "app_events_user_idx" ON "app_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "app_events_occurred_idx" ON "app_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "web_events_visitor_time_idx" ON "web_events" USING btree ("visitor_id","occurred_at");