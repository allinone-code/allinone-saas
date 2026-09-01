CREATE TABLE "product_lifecycle_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"from_stage" text,
	"to_stage" text NOT NULL,
	"actor_name" text DEFAULT 'SYSTEM' NOT NULL,
	"reason" text,
	"context_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lifecycle_events_to_stage_enum" CHECK ("product_lifecycle_events"."to_stage" in (
    'DISCOVERED', 'ANALYZING', 'SCORED', 'APPROVED', 'REJECTED',
    'PURCHASING', 'IN_WAREHOUSE', 'LISTED', 'SELLING', 'MONITORING',
    'PAUSED', 'DISCONTINUED'))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"asin" text NOT NULL,
	"upc" text,
	"title" text NOT NULL,
	"brand" text DEFAULT 'General' NOT NULL,
	"category" text DEFAULT 'UNCATEGORIZED' NOT NULL,
	"image_url" text,
	"amazon_url" text,
	"is_fragile" boolean DEFAULT false NOT NULL,
	"is_multipack" boolean DEFAULT false NOT NULL,
	"is_bundle" boolean DEFAULT false NOT NULL,
	"count_per_bundle" integer,
	"pack_count" integer DEFAULT 1 NOT NULL,
	"lifecycle_stage" text DEFAULT 'DISCOVERED' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"discovered_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_asin_unique" UNIQUE("asin"),
	CONSTRAINT "products_lifecycle_enum" CHECK ("products"."lifecycle_stage" in (
    'DISCOVERED', 'ANALYZING', 'SCORED', 'APPROVED', 'REJECTED',
    'PURCHASING', 'IN_WAREHOUSE', 'LISTED', 'SELLING', 'MONITORING',
    'PAUSED', 'DISCONTINUED')),
	CONSTRAINT "products_pack_count_positive" CHECK ("products"."pack_count" > 0),
	CONSTRAINT "products_bundle_count_positive" CHECK (
    "products"."count_per_bundle" is null or "products"."count_per_bundle" > 0)
);
--> statement-breakpoint
CREATE TABLE "supplier_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"supplier_name" text NOT NULL,
	"supplier_code" text,
	"source_url" text,
	"source_domain" text,
	"unit_price" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"in_stock" boolean DEFAULT true NOT NULL,
	"observed_at" timestamp DEFAULT now() NOT NULL,
	"source_type" text DEFAULT 'XLS_IMPORT' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_offers_price_non_negative" CHECK ("supplier_offers"."unit_price" >= 0),
	CONSTRAINT "supplier_offers_source_type_enum" CHECK ("supplier_offers"."source_type" in (
    'XLS_IMPORT', 'MANUAL', 'SCRAPER', 'API', 'MIGRATION'))
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "product_id" integer;--> statement-breakpoint
ALTER TABLE "product_lifecycle_events" ADD CONSTRAINT "product_lifecycle_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lifecycle_events_product_time_idx" ON "product_lifecycle_events" USING btree ("product_id","occurred_at");--> statement-breakpoint
CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand");--> statement-breakpoint
CREATE INDEX "products_lifecycle_idx" ON "products" USING btree ("lifecycle_stage");--> statement-breakpoint
CREATE INDEX "products_active_idx" ON "products" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "supplier_offers_product_observed_idx" ON "supplier_offers" USING btree ("product_id","observed_at");--> statement-breakpoint
CREATE INDEX "supplier_offers_supplier_idx" ON "supplier_offers" USING btree ("supplier_name");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_product_id_idx" ON "orders" USING btree ("product_id");