CREATE TABLE "product_match_candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"asin" text NOT NULL,
	"title" text,
	"brand" text,
	"confidence" text NOT NULL,
	"reason" text NOT NULL,
	"source" text NOT NULL,
	"is_applied" boolean DEFAULT false NOT NULL,
	"reviewed_at" timestamp,
	"reviewed_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_match_candidates_confidence_enum" CHECK ("product_match_candidates"."confidence" in ('exact','high','medium','low'))
);
--> statement-breakpoint
ALTER TABLE "product_match_candidates" ADD CONSTRAINT "product_match_candidates_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_match_candidates_product_asin_uq" ON "product_match_candidates" USING btree ("product_id","asin");--> statement-breakpoint
CREATE INDEX "product_match_candidates_product_idx" ON "product_match_candidates" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_match_candidates_pending_idx" ON "product_match_candidates" USING btree ("is_applied");