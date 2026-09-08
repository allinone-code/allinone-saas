CREATE TABLE "keepa_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"asin" text NOT NULL,
	"domain" integer DEFAULT 1 NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sales_rank" integer,
	"amazon_price" numeric(10, 2),
	"buy_box_price" numeric(10, 2),
	"offer_count" integer,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrape_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_url" text NOT NULL,
	"source_domain" text NOT NULL,
	"store_code" text DEFAULT 'HRN' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"product_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_by" text DEFAULT 'SYSTEM' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "scrape_jobs_status_enum" CHECK ("scrape_jobs"."status" in ('PENDING','DONE','FAILED'))
);
--> statement-breakpoint
CREATE TABLE "scraped_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"source_url" text NOT NULL,
	"source_domain" text NOT NULL,
	"title" text NOT NULL,
	"brand" text DEFAULT 'BILINMIYOR' NOT NULL,
	"price" numeric(10, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"image_url" text,
	"availability" text DEFAULT 'UNKNOWN' NOT NULL,
	"asin_candidate" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"discovered_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scraped_products_availability_enum" CHECK ("scraped_products"."availability" in ('IN_STOCK','OUT_OF_STOCK','UNKNOWN')),
	CONSTRAINT "scraped_products_status_enum" CHECK ("scraped_products"."status" in ('PENDING','IMPORTED','REJECTED'))
);
--> statement-breakpoint
ALTER TABLE "scraped_products" ADD CONSTRAINT "scraped_products_job_id_scrape_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."scrape_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "keepa_cache_asin_domain_uq" ON "keepa_cache" USING btree ("asin","domain");--> statement-breakpoint
CREATE INDEX "keepa_cache_expires_idx" ON "keepa_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "keepa_cache_sales_rank_idx" ON "keepa_cache" USING btree ("sales_rank");--> statement-breakpoint
CREATE INDEX "scrape_jobs_domain_idx" ON "scrape_jobs" USING btree ("source_domain");--> statement-breakpoint
CREATE INDEX "scrape_jobs_store_idx" ON "scrape_jobs" USING btree ("store_code");--> statement-breakpoint
CREATE INDEX "scraped_products_job_idx" ON "scraped_products" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "scraped_products_domain_idx" ON "scraped_products" USING btree ("source_domain");--> statement-breakpoint
CREATE INDEX "scraped_products_status_idx" ON "scraped_products" USING btree ("status");