CREATE TYPE "public"."bid_status" AS ENUM('matched', 'not_found');--> statement-breakpoint
CREATE TYPE "public"."match_method" AS ENUM('exact', 'trgm', 'typo');--> statement-breakpoint
CREATE TABLE "contractor" (
	"id" serial PRIMARY KEY NOT NULL,
	"canonical_name" text NOT NULL,
	"display_name" text NOT NULL,
	"norm_name" text NOT NULL,
	"primary_state" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractor_alias" (
	"id" serial PRIMARY KEY NOT NULL,
	"contractor_id" integer NOT NULL,
	"raw_name" text NOT NULL,
	"norm_name" text NOT NULL,
	"occurrences" integer DEFAULT 1 NOT NULL,
	"first_seen" timestamp with time zone,
	"last_seen" timestamp with time zone,
	"match_method" "match_method" NOT NULL,
	"confidence" numeric(5, 4)
);
--> statement-breakpoint
CREATE TABLE "inspection" (
	"activity_nr" bigint PRIMARY KEY NOT NULL,
	"contractor_id" integer,
	"estab_name_raw" text,
	"site_address" text,
	"site_city" text,
	"site_state" text,
	"site_zip" text,
	"naics_code" text,
	"insp_type" text,
	"insp_scope" text,
	"owner_type" text,
	"is_state_plan" boolean,
	"union_status" text,
	"safety_const" text,
	"nr_in_estab" integer,
	"open_date" date,
	"close_case_date" date
);
--> statement-breakpoint
CREATE TABLE "violation" (
	"id" serial PRIMARY KEY NOT NULL,
	"activity_nr" bigint NOT NULL,
	"citation_id" text NOT NULL,
	"standard" text,
	"viol_type" text,
	"current_penalty" numeric,
	"initial_penalty" numeric,
	"nr_instances" integer,
	"nr_exposed" integer,
	"gravity" integer,
	"issuance_date" date,
	"abate_date" date,
	"final_order_date" date
);
--> statement-breakpoint
CREATE TABLE "accident" (
	"summary_nr" bigint PRIMARY KEY NOT NULL,
	"event_date" date,
	"event_desc" text,
	"project_type" text,
	"build_stories" integer,
	"nonbuild_ht" integer,
	"fatality_flag" boolean
);
--> statement-breakpoint
CREATE TABLE "accident_injury" (
	"id" serial PRIMARY KEY NOT NULL,
	"summary_nr" bigint NOT NULL,
	"rel_insp_nr" bigint,
	"degree_of_inj" text,
	"nature_of_inj" text,
	"part_of_body" text,
	"fat_cause" text,
	"fall_ht" integer,
	"fall_distance" integer,
	"age" integer,
	"sex" text
);
--> statement-breakpoint
CREATE TABLE "bid" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bid_contractor" (
	"id" serial PRIMARY KEY NOT NULL,
	"bid_id" integer NOT NULL,
	"contractor_id" integer,
	"entered_name" text NOT NULL,
	"trade" text,
	"status" "bid_status" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accident_chunk" (
	"id" serial PRIMARY KEY NOT NULL,
	"summary_nr" bigint NOT NULL,
	"contractor_ids" integer[],
	"event_date" date,
	"text" text NOT NULL,
	"tsv" "tsvector",
	"embedding" vector(384),
	"embedding_model" text
);
--> statement-breakpoint
CREATE TABLE "cfr_section" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_code" text NOT NULL,
	"title" text,
	"text" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contractor_alias" ADD CONSTRAINT "contractor_alias_contractor_id_contractor_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_contractor_id_contractor_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "violation" ADD CONSTRAINT "violation_activity_nr_inspection_activity_nr_fk" FOREIGN KEY ("activity_nr") REFERENCES "public"."inspection"("activity_nr") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accident_injury" ADD CONSTRAINT "accident_injury_summary_nr_accident_summary_nr_fk" FOREIGN KEY ("summary_nr") REFERENCES "public"."accident"("summary_nr") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_contractor" ADD CONSTRAINT "bid_contractor_bid_id_bid_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bid"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_contractor" ADD CONSTRAINT "bid_contractor_contractor_id_contractor_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accident_chunk" ADD CONSTRAINT "accident_chunk_summary_nr_accident_summary_nr_fk" FOREIGN KEY ("summary_nr") REFERENCES "public"."accident"("summary_nr") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contractor_norm_name_trgm_idx" ON "contractor" USING gin ("norm_name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "contractor_alias_uq" ON "contractor_alias" USING btree ("contractor_id","norm_name");--> statement-breakpoint
CREATE INDEX "contractor_alias_norm_trgm_idx" ON "contractor_alias" USING gin ("norm_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "inspection_contractor_idx" ON "inspection" USING btree ("contractor_id");--> statement-breakpoint
CREATE INDEX "inspection_state_idx" ON "inspection" USING btree ("site_state");--> statement-breakpoint
CREATE INDEX "inspection_naics_idx" ON "inspection" USING btree ("naics_code");--> statement-breakpoint
CREATE UNIQUE INDEX "violation_activity_citation_uq" ON "violation" USING btree ("activity_nr","citation_id");--> statement-breakpoint
CREATE INDEX "violation_activity_idx" ON "violation" USING btree ("activity_nr");--> statement-breakpoint
CREATE INDEX "violation_type_idx" ON "violation" USING btree ("viol_type");--> statement-breakpoint
CREATE INDEX "accident_injury_summary_idx" ON "accident_injury" USING btree ("summary_nr");--> statement-breakpoint
CREATE INDEX "accident_injury_rel_insp_idx" ON "accident_injury" USING btree ("rel_insp_nr");--> statement-breakpoint
CREATE UNIQUE INDEX "bid_contractor_uq" ON "bid_contractor" USING btree ("bid_id","contractor_id") WHERE "bid_contractor"."contractor_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "accident_chunk_embedding_hnsw" ON "accident_chunk" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "accident_chunk_contractors_gin" ON "accident_chunk" USING gin ("contractor_ids");--> statement-breakpoint
CREATE INDEX "accident_chunk_tsv_gin" ON "accident_chunk" USING gin ("tsv");--> statement-breakpoint
CREATE UNIQUE INDEX "cfr_section_code_uq" ON "cfr_section" USING btree ("section_code");