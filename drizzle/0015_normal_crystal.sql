CREATE TABLE "store_financials" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_code" text NOT NULL,
	"month" text NOT NULL,
	"source" text NOT NULL,
	"category" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"note" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "store_financials_month_format" CHECK ("store_financials"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "store_financials_source_enum" CHECK ("store_financials"."source" in ('AMAZON','PSH','INVENTORY_LAB','BANK')),
	CONSTRAINT "store_financials_category_enum" CHECK ("store_financials"."category" in ('REVENUE','COGS','AMAZON_FEES','PREP_SHIPPING','OTHER_EXPENSE','REPORTED_NET'))
);
--> statement-breakpoint
ALTER TABLE "store_financials" ADD CONSTRAINT "store_financials_store_code_stores_store_code_fk" FOREIGN KEY ("store_code") REFERENCES "public"."stores"("store_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "store_financials_uq" ON "store_financials" USING btree ("store_code","month","source","category","label");--> statement-breakpoint
CREATE INDEX "store_financials_store_month_idx" ON "store_financials" USING btree ("store_code","month");