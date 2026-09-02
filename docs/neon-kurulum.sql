-- ============================================================
-- CERBERUS — Neon tek dosyalık kurulum
-- Üretildi: 2026-09-02T00:49:54.817Z
--
-- KULLANIM: Neon konsolu > SQL Editor > bu dosyanın TAMAMINI
-- yapıştırın > Run.
--
-- UYARI: İlk satır mevcut 'public' şemasını SİLER.
-- Korumak istediğiniz veri varsa o satırı silin.
-- ============================================================

BEGIN;

-- [1/5] Temiz başlangıç
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- [2/5] Şema (drizzle migration'ları)

-- ---- 0000_faz2-baseline.sql ----
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_name" text NOT NULL,
	"store_code" text DEFAULT 'HRN' NOT NULL,
	"action_type" text NOT NULL,
	"target_entity" text NOT NULL,
	"before_state" text,
	"after_state" text,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"buyer_store" text DEFAULT 'HRN' NOT NULL,
	"order_date" text NOT NULL,
	"image_url" text,
	"fulfillment_type" text DEFAULT 'FBA' NOT NULL,
	"product_title" text NOT NULL,
	"asin" text NOT NULL,
	"msku" text NOT NULL,
	"supplier_name" text NOT NULL,
	"supplier_code" text DEFAULT 'A198',
	"supplier_url" text NOT NULL,
	"amazon_url" text NOT NULL,
	"order_number" text NOT NULL,
	"drive_link" text,
	"pack_count" integer DEFAULT 1 NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_cost" numeric(10, 2) NOT NULL,
	"selling_price" numeric(10, 2) NOT NULL,
	"total_cost" numeric(12, 2) NOT NULL,
	"order_email" text NOT NULL,
	"cargo_status" text DEFAULT 'Yolda' NOT NULL,
	"shipped_to_amazon" integer DEFAULT 0 NOT NULL,
	"p1_cancel_qty" integer DEFAULT 0 NOT NULL,
	"p2_missing_qty" integer DEFAULT 0 NOT NULL,
	"p3_defective_qty" integer DEFAULT 0 NOT NULL,
	"p4_expired_qty" integer DEFAULT 0 NOT NULL,
	"problem_action" text,
	"problem_result" text,
	"refund_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"credit_card" text DEFAULT '1753',
	"is_fragile" text DEFAULT 'NO' NOT NULL,
	"is_multipack" text DEFAULT 'NO' NOT NULL,
	"is_bundle" text DEFAULT 'NO' NOT NULL,
	"count_per_bundle" integer,
	"condition" text DEFAULT 'New' NOT NULL,
	"brand_name" text NOT NULL,
	"description_1" text,
	"description_2" text,
	"audit_note" text,
	"period_code" text DEFAULT 'O26',
	"corrected_cost" numeric(12, 2) NOT NULL,
	"psh_batch_no" text,
	"psh_status" text DEFAULT 'BEKLIYOR' NOT NULL,
	"inventory_lab_status" text DEFAULT 'GIRILMEDI' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "product_masters" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_code" text NOT NULL,
	"title" text NOT NULL,
	"brand" text NOT NULL,
	"category" text NOT NULL,
	"upc" text NOT NULL,
	"asin" text NOT NULL,
	"msku" text NOT NULL,
	"source_url" text NOT NULL,
	"source_domain" text NOT NULL,
	"supplier_name" text NOT NULL,
	"researcher_code" text DEFAULT 'SRC-01' NOT NULL,
	"researcher_name" text NOT NULL,
	"lifecycle_stage" text DEFAULT 'APPROVED' NOT NULL,
	"data_quality_status" text DEFAULT 'VALID' NOT NULL,
	"data_freshness_status" text DEFAULT 'FRESH' NOT NULL,
	"observed_at" timestamp DEFAULT now() NOT NULL,
	"decision_action" text DEFAULT 'BUY' NOT NULL,
	"confidence_score" integer DEFAULT 88 NOT NULL,
	"risk_level" text DEFAULT 'LOW' NOT NULL,
	"policy_status" text DEFAULT 'APPROVED_BY_POLICY' NOT NULL,
	"source_price" numeric(10, 2) NOT NULL,
	"prep_cost" numeric(10, 2) DEFAULT '1.35' NOT NULL,
	"marketplace_fee" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"fulfillment_fee" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"landed_cost" numeric(10, 2) NOT NULL,
	"selling_price" numeric(10, 2) NOT NULL,
	"estimated_net_profit" numeric(10, 2) NOT NULL,
	"roi_percent" numeric(7, 2) NOT NULL,
	"actual_roi_percent" numeric(7, 2),
	"duplicate_score" integer DEFAULT 12 NOT NULL,
	"duplicate_status" text DEFAULT 'CLEAR' NOT NULL,
	"profitability_score" integer DEFAULT 88 NOT NULL,
	"demand_score" integer DEFAULT 92 NOT NULL,
	"competition_score" integer DEFAULT 78 NOT NULL,
	"price_stability_score" integer DEFAULT 85 NOT NULL,
	"supplier_risk_score" integer DEFAULT 94 NOT NULL,
	"operational_risk_score" integer DEFAULT 90 NOT NULL,
	"opportunity_score" integer DEFAULT 88 NOT NULL,
	"evidence_chain" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"channel_listings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cost_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"discovered_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_masters_product_code_unique" UNIQUE("product_code")
);

CREATE TABLE "psh_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_number" text NOT NULL,
	"store_code" text DEFAULT 'HRN' NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'HAZIRLANIYOR' NOT NULL,
	"total_items_count" integer DEFAULT 0 NOT NULL,
	"total_units_count" integer DEFAULT 0 NOT NULL,
	"received_units_count" integer DEFAULT 0 NOT NULL,
	"missing_units_count" integer DEFAULT 0 NOT NULL,
	"defective_units_count" integer DEFAULT 0 NOT NULL,
	"inventory_lab_synced" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "psh_batches_batch_number_unique" UNIQUE("batch_number")
);

CREATE TABLE "research_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_code" text NOT NULL,
	"researcher_code" text NOT NULL,
	"researcher_name" text NOT NULL,
	"source_domain" text NOT NULL,
	"products_found" integer DEFAULT 0 NOT NULL,
	"products_approved" integer DEFAULT 0 NOT NULL,
	"session_quality_score" integer DEFAULT 90 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "research_sessions_session_code_unique" UNIQUE("session_code")
);

CREATE TABLE "researchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"specialty_domain" text NOT NULL,
	"discovery_volume" integer DEFAULT 0 NOT NULL,
	"approval_rate" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"purchase_conversion" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"average_roi" numeric(6, 2) DEFAULT '0.00' NOT NULL,
	"average_net_profit" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"problem_rate" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"researcher_score" integer DEFAULT 85 NOT NULL,
	"active_listings_count" integer DEFAULT 0 NOT NULL,
	"avatar" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "researchers_code_unique" UNIQUE("code")
);

CREATE TABLE "stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_code" text NOT NULL,
	"store_name" text NOT NULL,
	"marketplace" text DEFAULT 'AMAZON' NOT NULL,
	"buyer_name" text DEFAULT 'Harun' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"default_card" text DEFAULT '1753',
	"default_email" text,
	"notes" text,
	"account_health_score" integer DEFAULT 98 NOT NULL,
	"total_orders_count" integer DEFAULT 0 NOT NULL,
	"total_spend" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stores_store_code_unique" UNIQUE("store_code")
);

CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'STORE_USER' NOT NULL,
	"store_code" text DEFAULT 'HRN' NOT NULL,
	"avatar" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_store_stores_store_code_fk" FOREIGN KEY ("buyer_store") REFERENCES "public"."stores"("store_code") ON DELETE no action ON UPDATE no action;
ALTER TABLE "orders" ADD CONSTRAINT "orders_psh_batch_no_psh_batches_batch_number_fk" FOREIGN KEY ("psh_batch_no") REFERENCES "public"."psh_batches"("batch_number") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "orders_order_number_store_uq" ON "orders" USING btree ("order_number","buyer_store");
CREATE INDEX "orders_buyer_store_date_idx" ON "orders" USING btree ("buyer_store","order_date");
CREATE INDEX "orders_asin_idx" ON "orders" USING btree ("asin");

-- ---- 0001_same_ultragirl.sql ----
CREATE INDEX "product_masters_asin_idx" ON "product_masters" USING btree ("asin");
ALTER TABLE "orders" ADD CONSTRAINT "orders_quantity_positive" CHECK ("orders"."quantity" > 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_pack_count_positive" CHECK ("orders"."pack_count" > 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_unit_cost_non_negative" CHECK ("orders"."unit_cost" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_selling_price_non_negative" CHECK ("orders"."selling_price" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_cost_non_negative" CHECK ("orders"."total_cost" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_refund_non_negative" CHECK ("orders"."refund_amount" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_fire_qty_non_negative" CHECK (
    "orders"."p1_cancel_qty" >= 0 and "orders"."p2_missing_qty" >= 0
    and "orders"."p3_defective_qty" >= 0 and "orders"."p4_expired_qty" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipped_non_negative" CHECK ("orders"."shipped_to_amazon" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipped_within_quantity" CHECK ("orders"."shipped_to_amazon" <= "orders"."quantity");
ALTER TABLE "orders" ADD CONSTRAINT "orders_fire_within_quantity" CHECK (
    "orders"."p1_cancel_qty" + "orders"."p2_missing_qty" + "orders"."p3_defective_qty" + "orders"."p4_expired_qty"
    <= "orders"."quantity");
ALTER TABLE "orders" ADD CONSTRAINT "orders_cargo_status_enum" CHECK ("orders"."cargo_status" in
    ('Yolda', 'Tam Geldi', 'İPTAL', 'Kayıp Depoya gelmiş'));
ALTER TABLE "orders" ADD CONSTRAINT "orders_psh_status_enum" CHECK ("orders"."psh_status" in
    ('BEKLIYOR', 'BATCH_OLUSTURULDU', 'DEPO_SAYILDI', 'AMAZONA_SEVK'));
ALTER TABLE "orders" ADD CONSTRAINT "orders_inventory_lab_status_enum" CHECK ("orders"."inventory_lab_status" in
    ('GIRILMEDI', 'GIRILDI', 'AKTIF_SATISTA'));
ALTER TABLE "orders" ADD CONSTRAINT "orders_fulfillment_type_enum" CHECK ("orders"."fulfillment_type" in ('FBA', 'FBM'));
ALTER TABLE "product_masters" ADD CONSTRAINT "pm_prices_non_negative" CHECK (
    "product_masters"."source_price" >= 0 and "product_masters"."landed_cost" >= 0 and "product_masters"."selling_price" >= 0);
ALTER TABLE "product_masters" ADD CONSTRAINT "pm_scores_in_range" CHECK (
    "product_masters"."confidence_score" between 0 and 100
    and "product_masters"."opportunity_score" between 0 and 100
    and "product_masters"."profitability_score" between 0 and 100
    and "product_masters"."demand_score" between 0 and 100
    and "product_masters"."competition_score" between 0 and 100
    and "product_masters"."price_stability_score" between 0 and 100
    and "product_masters"."supplier_risk_score" between 0 and 100
    and "product_masters"."operational_risk_score" between 0 and 100);
ALTER TABLE "product_masters" ADD CONSTRAINT "pm_duplicate_score_in_range" CHECK ("product_masters"."duplicate_score" between 0 and 100);
ALTER TABLE "product_masters" ADD CONSTRAINT "pm_decision_action_enum" CHECK ("product_masters"."decision_action" in
    ('BUY', 'TEST', 'WAIT', 'REJECT', 'REPRICE', 'REORDER', 'PAUSE', 'LIQUIDATE'));
ALTER TABLE "product_masters" ADD CONSTRAINT "pm_risk_level_enum" CHECK ("product_masters"."risk_level" in
    ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
ALTER TABLE "product_masters" ADD CONSTRAINT "pm_policy_status_enum" CHECK ("product_masters"."policy_status" in
    ('APPROVED_BY_POLICY', 'REQUIRES_MANAGER_APPROVAL', 'FLAGGED_IP_RISK'));
ALTER TABLE "product_masters" ADD CONSTRAINT "pm_freshness_enum" CHECK ("product_masters"."data_freshness_status" in
    ('FRESH', 'AGING', 'STALE', 'EXPIRED'));
ALTER TABLE "product_masters" ADD CONSTRAINT "pm_quality_enum" CHECK ("product_masters"."data_quality_status" in
    ('VALID', 'INVALID', 'MISSING', 'STALE', 'CONFLICTING'));

-- ---- 0002_lonely_drax.sql ----
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

ALTER TABLE "orders" ADD COLUMN "product_id" integer;
ALTER TABLE "product_lifecycle_events" ADD CONSTRAINT "product_lifecycle_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "lifecycle_events_product_time_idx" ON "product_lifecycle_events" USING btree ("product_id","occurred_at");
CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand");
CREATE INDEX "products_lifecycle_idx" ON "products" USING btree ("lifecycle_stage");
CREATE INDEX "products_active_idx" ON "products" USING btree ("is_active");
CREATE INDEX "supplier_offers_product_observed_idx" ON "supplier_offers" USING btree ("product_id","observed_at");
CREATE INDEX "supplier_offers_supplier_idx" ON "supplier_offers" USING btree ("supplier_name");
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
CREATE INDEX "orders_product_id_idx" ON "orders" USING btree ("product_id");

-- ---- 0003_concerned_luke_cage.sql ----
-- AŞAMA 1.2 — orders.product_id zorunlu hale gelir.
--
-- GÜVENLİK KONTROLÜ: Bu migration, ürüne bağlanmamış sipariş varken
-- çalışırsa veritabanı hatası verir ve göç yarıda kalır. Bunun yerine
-- açık ve anlaşılır bir mesajla durduruyoruz: önce geri doldurma
-- çalıştırılmalıdır (scripts/backfill-products.ts).
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT count(*) INTO orphan_count FROM "orders" WHERE "product_id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'Gecis durduruldu: % adet siparis henuz bir urune bagli degil. Once "npx tsx scripts/backfill-products.ts" calistirin.',
      orphan_count;
  END IF;
END $$;

ALTER TABLE "orders" ALTER COLUMN "product_id" SET NOT NULL;

-- [3/5] Drizzle migration takibi
-- Bunlar yazılmazsa 'npm run db:migrate' aynı migration'ları
-- tekrar uygulamaya çalışır ve hata verir.
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('58b92d1f43dbcc8d69c864c3869ddc3ebe67010823a34e5e4456972548da459f', 1788218061273);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('7d818d719b991b84c2eb810ce58d6c3bbf1debbcae8fb0ed6005870ed7852b61', 1788303393517);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('2b44baa71c80585734b877d5bbc191d4d67f6c589eaa0fe483d5f51d0e0a7c49', 1788304250820);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('82e2580cfc19eda43e36394c3c45b1084562dd5fd7f919d9d70ca0db8cf84b4c', 1788305303323);

-- [4/5] Başlangıç verisi

-- Mağazalar
INSERT INTO stores (store_code, store_name, marketplace, status, account_health_score) VALUES ('HRN', 'HRN Amazon US Storefront', 'AMAZON', 'ACTIVE', 100) ON CONFLICT (store_code) DO NOTHING;
INSERT INTO stores (store_code, store_name, marketplace, status, account_health_score) VALUES ('SEL', 'Selin Beauty & Health Amazon', 'AMAZON', 'ACTIVE', 100) ON CONFLICT (store_code) DO NOTHING;
INSERT INTO stores (store_code, store_name, marketplace, status, account_health_score) VALUES ('MK', 'Mert Prime Tech Amazon', 'AMAZON', 'ACTIVE', 100) ON CONFLICT (store_code) DO NOTHING;
INSERT INTO stores (store_code, store_name, marketplace, status, account_health_score) VALUES ('AMZ-02', 'Apex Frontier Amazon Store #02', 'AMAZON', 'ACTIVE', 100) ON CONFLICT (store_code) DO NOTHING;

-- Kullanıcılar
-- Parola yer tutucudur; ilk girişten önce MUTLAKA değiştirin.
-- Aşağıdaki hash 'CerberusKurulum2026!' parolasına karşılık gelir.
INSERT INTO users (name, email, password_hash, role, store_code) VALUES ('Ahmet Erdem (Sistem Yöneticisi)', 'ahmet@cerberus-commerce.io', '$2b$12$REUfg5IZyJgw.Wp3d9ECau0JnNOx/JarFNPyBcJOjEPqH8MQgjF2K', 'ADMIN', 'ALL') ON CONFLICT (email) DO NOTHING;
INSERT INTO users (name, email, password_hash, role, store_code) VALUES ('Harun (HRN Store Yöneticisi)', 'harun@cerberus-commerce.io', '$2b$12$REUfg5IZyJgw.Wp3d9ECau0JnNOx/JarFNPyBcJOjEPqH8MQgjF2K', 'STORE_USER', 'HRN') ON CONFLICT (email) DO NOTHING;
INSERT INTO users (name, email, password_hash, role, store_code) VALUES ('Selin Yılmaz (SEL Store Yöneticisi)', 'selin@cerberus-commerce.io', '$2b$12$REUfg5IZyJgw.Wp3d9ECau0JnNOx/JarFNPyBcJOjEPqH8MQgjF2K', 'STORE_USER', 'SEL') ON CONFLICT (email) DO NOTHING;
INSERT INTO users (name, email, password_hash, role, store_code) VALUES ('Can Demir (MK Store Yöneticisi)', 'can@cerberus-commerce.io', '$2b$12$REUfg5IZyJgw.Wp3d9ECau0JnNOx/JarFNPyBcJOjEPqH8MQgjF2K', 'STORE_USER', 'MK') ON CONFLICT (email) DO NOTHING;
INSERT INTO users (name, email, password_hash, role, store_code) VALUES ('Mert Yılmaz', 'mert@cerberus.io', '$2b$12$REUfg5IZyJgw.Wp3d9ECau0JnNOx/JarFNPyBcJOjEPqH8MQgjF2K', 'ADMIN', 'ALL') ON CONFLICT (email) DO NOTHING;

-- Ürün kataloğu (12 benzersiz ürün)
-- 24 sipariş satırı 12 ürüne indirgendi.
INSERT INTO products (asin, title, brand, category, image_url, amazon_url, is_fragile, is_multipack, is_bundle, count_per_bundle, pack_count, lifecycle_stage, discovered_at) VALUES ('B00014DAJ8', 'MegaFood One Daily Multivitamin - Multivitamin for Women and Men - with Real Food - Immune Support Supplement - Vitamin C & Vitamin B - Bone Health - Energy Metabolism - Vegetarian, Non-GMO - 180 Tabs', 'MEGAFOOD', 'UNCATEGORIZED', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80', 'https://www.amazon.com/dp/B00014DAJ8?th=1', false, false, false, NULL, 1, 'PURCHASING', '2026-01-21T00:00:00.000Z') ON CONFLICT (asin) DO NOTHING;
INSERT INTO products (asin, title, brand, category, image_url, amazon_url, is_fragile, is_multipack, is_bundle, count_per_bundle, pack_count, lifecycle_stage, discovered_at) VALUES ('B01CQ3E6HG', 'MegaFood Baby & Me 2 Prenatal Multi Vitamins - Prenatal Vitamins for Women with Choline, Methyl Folate & Iron, Vegetarian, Gluten-Free, Pre Natal Multivitamin for Women - 120 Tablets, 60 Servings', 'MEGAFOOD', 'UNCATEGORIZED', 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=200&auto=format&fit=crop&q=80', 'https://www.amazon.com/dp/B01CQ3E6HG?th=1', false, false, false, NULL, 1, 'SELLING', '2026-01-21T00:00:00.000Z') ON CONFLICT (asin) DO NOTHING;
INSERT INTO products (asin, title, brand, category, image_url, amazon_url, is_fragile, is_multipack, is_bundle, count_per_bundle, pack_count, lifecycle_stage, discovered_at) VALUES ('B00V7COK0G', 'Vital Proteins Grass Fed Beef Liver Capsules, Desiccated Liver Supplement, 750mg Liver Pills, 120 Count', 'VITAL', 'UNCATEGORIZED', 'https://images.unsplash.com/photo-1577401239170-897942555fb3?w=200&auto=format&fit=crop&q=80', 'https://www.amazon.com/dp/B00V7COK0G', false, false, false, NULL, 1, 'PURCHASING', '2026-01-21T00:00:00.000Z') ON CONFLICT (asin) DO NOTHING;
INSERT INTO products (asin, title, brand, category, image_url, amazon_url, is_fragile, is_multipack, is_bundle, count_per_bundle, pack_count, lifecycle_stage, discovered_at) VALUES ('B0D19MF171', 'Vital Proteins Collagen Peptides for Women - 20g Hydrolyzed Collagen, Vitamin C, Hyaluronic Acid, Reduce Fine Lines & Wrinkles, Verisol & Holimel - Skin Complex Supplement, Unflavored 11.9oz Powder', 'VITAL', 'UNCATEGORIZED', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80', 'https://www.amazon.com/dp/B0D19MF171', false, false, false, NULL, 1, 'PURCHASING', '2026-01-21T00:00:00.000Z') ON CONFLICT (asin) DO NOTHING;
INSERT INTO products (asin, title, brand, category, image_url, amazon_url, is_fragile, is_multipack, is_bundle, count_per_bundle, pack_count, lifecycle_stage, discovered_at) VALUES ('B0D19FGYZG', 'Vital Proteins Collagen Peptides + Biotin 10000mcg Hair Complex, Hair Growth Supplement - Clinically Studied Lustriva to Promote Thicker Fuller Hair, 20g Unflavored Collagen for Women 11.4oz Powder', 'VITAL', 'UNCATEGORIZED', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80', 'https://www.amazon.com/dp/B0D19FGYZG?th=1', false, false, false, NULL, 1, 'PURCHASING', '2026-01-22T00:00:00.000Z') ON CONFLICT (asin) DO NOTHING;
INSERT INTO products (asin, title, brand, category, image_url, amazon_url, is_fragile, is_multipack, is_bundle, count_per_bundle, pack_count, lifecycle_stage, discovered_at) VALUES ('B07WP7Q5BF', 'ONNIT Alpha Brain® Nootropic Brain Supplement for Men and Women, IGEN™ Non-GMO Tested, Memory, Mental Clarity, Cognitive Support and Focus Capsules with L-Theanine and Vitamin B6 (90 Count)', 'ONNIT', 'UNCATEGORIZED', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80', 'http://amazon.com/dp/B07WP7Q5BF?th=1', false, false, false, NULL, 1, 'PURCHASING', '2026-01-12T00:00:00.000Z') ON CONFLICT (asin) DO NOTHING;
INSERT INTO products (asin, title, brand, category, image_url, amazon_url, is_fragile, is_multipack, is_bundle, count_per_bundle, pack_count, lifecycle_stage, discovered_at) VALUES ('B0DGQX1FS7', 'FORCE FACTOR Hair Growth Accelerator Capsules, Lustriva & Biotin to Promote Thicker, Stronger, Fuller Hair, Women Hair Growth Vitamins, Clinically Studied, Supports All 4 Stages of Growth, 90ct', 'FORCE', 'UNCATEGORIZED', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80', 'https://www.amazon.com/dp/B0DGQX1FS7?th=1', false, false, false, NULL, 1, 'SELLING', '2026-02-11T00:00:00.000Z') ON CONFLICT (asin) DO NOTHING;
INSERT INTO products (asin, title, brand, category, image_url, amazon_url, is_fragile, is_multipack, is_bundle, count_per_bundle, pack_count, lifecycle_stage, discovered_at) VALUES ('B0DMTGWTM1', 'FORCE FACTOR NAD+ Anti-Aging Supplement (NMN or Nicotinamide Riboside Alternative) with Resveratrol, Astaxanthin, Spermidine & Luteolin Complex to Support Cellular Health & Healthy Aging, 60 Capsules', 'FORCE', 'UNCATEGORIZED', 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=200&auto=format&fit=crop&q=80', 'https://www.amazon.com/dp/B0DMTGWTM1', false, false, false, NULL, 1, 'SELLING', '2026-02-11T00:00:00.000Z') ON CONFLICT (asin) DO NOTHING;
INSERT INTO products (asin, title, brand, category, image_url, amazon_url, is_fragile, is_multipack, is_bundle, count_per_bundle, pack_count, lifecycle_stage, discovered_at) VALUES ('B0D47RZVR3', 'FORCE FACTOR Total Beets Ultimate Heart Health Blood Pressure Support Chews with CoQ10, Beet Root Powder, Grape Seed Extract, Blood Pressure Supplement for Circulation & Blood Flow, 60 Soft Chews', 'FORCE', 'UNCATEGORIZED', 'https://images.unsplash.com/photo-1577401239170-897942555fb3?w=200&auto=format&fit=crop&q=80', 'https://www.amazon.com/dp/B0D47RZVR3?th=1', false, false, false, NULL, 1, 'SELLING', '2026-02-11T00:00:00.000Z') ON CONFLICT (asin) DO NOTHING;
INSERT INTO products (asin, title, brand, category, image_url, amazon_url, is_fragile, is_multipack, is_bundle, count_per_bundle, pack_count, lifecycle_stage, discovered_at) VALUES ('B0D47Q69VD', 'FORCE FACTOR Total Beets Ultimate Heart Health Blood Pressure Support Chews with CoQ10, Beet Root Powder, Grape Seed Extract, Blood Pressure Supplement for Circulation & Blood Flow, 60 Soft Chews', 'FORCE', 'UNCATEGORIZED', 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=200&auto=format&fit=crop&q=80', 'https://www.amazon.com/dp/B0D47Q69VD?th=1', false, false, false, NULL, 1, 'IN_WAREHOUSE', '2026-02-13T00:00:00.000Z') ON CONFLICT (asin) DO NOTHING;
INSERT INTO products (asin, title, brand, category, image_url, amazon_url, is_fragile, is_multipack, is_bundle, count_per_bundle, pack_count, lifecycle_stage, discovered_at) VALUES ('B0DLL7MC7L', 'FORCE FACTOR Creatine HMB, 5g Creatine Monohydrate Powder, 3g myHMB, Support Muscle, Strength, Energy & Recovery, with AstraGin for Enhanced Absorption, ~30 Servings, Unflavored Powder', 'FORCE', 'UNCATEGORIZED', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80', 'https://www.amazon.com/dp/B0DLL7MC7L?th=1', false, false, false, NULL, 1, 'SELLING', '2026-02-12T00:00:00.000Z') ON CONFLICT (asin) DO NOTHING;
INSERT INTO products (asin, title, brand, category, image_url, amazon_url, is_fragile, is_multipack, is_bundle, count_per_bundle, pack_count, lifecycle_stage, discovered_at) VALUES ('B005S6XGZ2', 'Irwin Naturals Prosta-Strong - 180 Softgels - Prostate Health Support with Saw Palmetto, Lycopene & Pumpkin Seed - Supports Urinary Flow', 'IRWIN', 'UNCATEGORIZED', 'https://images.unsplash.com/photo-1577401239170-897942555fb3?w=200&auto=format&fit=crop&q=80', 'https://www.amazon.com/dp/B005S6XGZ2', false, false, false, NULL, 1, 'SELLING', '2026-02-12T00:00:00.000Z') ON CONFLICT (asin) DO NOTHING;

-- Tedarikçi fiyat gözlemleri (16) — trend analizinin kaynağı
INSERT INTO supplier_offers (product_id, supplier_name, supplier_code, source_url, source_domain, unit_price, observed_at, source_type) SELECT id, 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/megafood-one-daily-180-tablets/mf-1123', 'vitaminshoppe.com', '46.36', '2026-01-21T00:00:00.000Z', 'MIGRATION' FROM products WHERE asin = 'B00014DAJ8';
INSERT INTO supplier_offers (product_id, supplier_name, supplier_code, source_url, source_domain, unit_price, observed_at, source_type) SELECT id, 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/megafood-one-daily-180-tablets/mf-1123', 'vitaminshoppe.com', '46.36', '2026-01-23T00:00:00.000Z', 'MIGRATION' FROM products WHERE asin = 'B00014DAJ8';
INSERT INTO supplier_offers (product_id, supplier_name, supplier_code, source_url, source_domain, unit_price, observed_at, source_type) SELECT id, 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/baby-me-2-120-tablets/mf-1240', 'vitaminshoppe.com', '34.26', '2026-01-21T00:00:00.000Z', 'MIGRATION' FROM products WHERE asin = 'B01CQ3E6HG';
INSERT INTO supplier_offers (product_id, supplier_name, supplier_code, source_url, source_domain, unit_price, observed_at, source_type) SELECT id, 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/baby-me-2-120-tablets/mf-1240', 'vitaminshoppe.com', '34.27', '2026-01-23T00:00:00.000Z', 'MIGRATION' FROM products WHERE asin = 'B01CQ3E6HG';
INSERT INTO supplier_offers (product_id, supplier_name, supplier_code, source_url, source_domain, unit_price, observed_at, source_type) SELECT id, 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/beef-liver-120-cap/vtp0002', 'vitaminshoppe.com', '23.21', '2026-01-21T00:00:00.000Z', 'MIGRATION' FROM products WHERE asin = 'B00V7COK0G';
INSERT INTO supplier_offers (product_id, supplier_name, supplier_code, source_url, source_domain, unit_price, observed_at, source_type) SELECT id, 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/vital-proteins-unflavored-11-9-oz-powder/vtp-13008', 'vitaminshoppe.com', '16.19', '2026-01-21T00:00:00.000Z', 'MIGRATION' FROM products WHERE asin = 'B0D19MF171';
INSERT INTO supplier_offers (product_id, supplier_name, supplier_code, source_url, source_domain, unit_price, observed_at, source_type) SELECT id, 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/vital-proteins-unflavored-11-41-oz-powder/vtp-13007', 'vitaminshoppe.com', '16.19', '2026-01-22T00:00:00.000Z', 'MIGRATION' FROM products WHERE asin = 'B0D19FGYZG';
INSERT INTO supplier_offers (product_id, supplier_name, supplier_code, source_url, source_domain, unit_price, observed_at, source_type) SELECT id, 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/onnit-labs-alpha-brain-90-veggie-caps/onn1002', 'vitaminshoppe.com', '71.99', '2026-01-12T00:00:00.000Z', 'MIGRATION' FROM products WHERE asin = 'B07WP7Q5BF';
INSERT INTO supplier_offers (product_id, supplier_name, supplier_code, source_url, source_domain, unit_price, observed_at, source_type) SELECT id, 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/hair-growth-accelerator-90-capsules/hfm-13782', 'vitaminshoppe.com', '29.99', '2026-02-11T00:00:00.000Z', 'MIGRATION' FROM products WHERE asin = 'B0DGQX1FS7';
INSERT INTO supplier_offers (product_id, supplier_name, supplier_code, source_url, source_domain, unit_price, observed_at, source_type) SELECT id, 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/hair-growth-accelerator-90-capsules/hfm-13782', 'vitaminshoppe.com', '26.24', '2026-02-13T00:00:00.000Z', 'MIGRATION' FROM products WHERE asin = 'B0DGQX1FS7';
INSERT INTO supplier_offers (product_id, supplier_name, supplier_code, source_url, source_domain, unit_price, observed_at, source_type) SELECT id, 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/nad-longetivity-60-capsules/hfm-13908', 'vitaminshoppe.com', '23.99', '2026-02-11T00:00:00.000Z', 'MIGRATION' FROM products WHERE asin = 'B0DMTGWTM1';
INSERT INTO supplier_offers (product_id, supplier_name, supplier_code, source_url, source_domain, unit_price, observed_at, source_type) SELECT id, 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/total-beets-ultimate-heart-pomegranate-berry-60-soft-chews/hfm-12565', 'vitaminshoppe.com', '23.99', '2026-02-11T00:00:00.000Z', 'MIGRATION' FROM products WHERE asin = 'B0D47RZVR3';
INSERT INTO supplier_offers (product_id, supplier_name, supplier_code, source_url, source_domain, unit_price, observed_at, source_type) SELECT id, 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/total-beets-ultimate-heart-pomegranate-berry-60-soft-chews/hfm-12565', 'vitaminshoppe.com', '21.59', '2026-02-12T00:00:00.000Z', 'MIGRATION' FROM products WHERE asin = 'B0D47RZVR3';
INSERT INTO supplier_offers (product_id, supplier_name, supplier_code, source_url, source_domain, unit_price, observed_at, source_type) SELECT id, 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/total-beets-ultimate-heart-black-cherry-60-soft-chews/hfm-12566', 'vitaminshoppe.com', '20.32', '2026-02-13T00:00:00.000Z', 'MIGRATION' FROM products WHERE asin = 'B0D47Q69VD';
INSERT INTO supplier_offers (product_id, supplier_name, supplier_code, source_url, source_domain, unit_price, observed_at, source_type) SELECT id, 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/creatine-hmb-240-g-powder/fcs-14434', 'vitaminshoppe.com', '24.29', '2026-02-12T00:00:00.000Z', 'MIGRATION' FROM products WHERE asin = 'B0DLL7MC7L';
INSERT INTO supplier_offers (product_id, supplier_name, supplier_code, source_url, source_domain, unit_price, observed_at, source_type) SELECT id, 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/irwin-naturals-prosta-strong-vp-180-softgels/in-1100', 'vitaminshoppe.com', '37.79', '2026-02-12T00:00:00.000Z', 'MIGRATION' FROM products WHERE asin = 'B005S6XGZ2';

-- Yaşam döngüsü olay defteri — her ürünün doğuş kaydı
INSERT INTO product_lifecycle_events (product_id, from_stage, to_stage, actor_name, reason, context_snapshot, occurred_at) SELECT id, NULL, 'PURCHASING', 'SYSTEM', 'Kurulum sırasında mevcut sipariş kayıtlarından oluşturuldu', '{"sourceOrderCount":5}'::jsonb, '2026-01-21T00:00:00.000Z' FROM products WHERE asin = 'B00014DAJ8';
INSERT INTO product_lifecycle_events (product_id, from_stage, to_stage, actor_name, reason, context_snapshot, occurred_at) SELECT id, NULL, 'SELLING', 'SYSTEM', 'Kurulum sırasında mevcut sipariş kayıtlarından oluşturuldu', '{"sourceOrderCount":5}'::jsonb, '2026-01-21T00:00:00.000Z' FROM products WHERE asin = 'B01CQ3E6HG';
INSERT INTO product_lifecycle_events (product_id, from_stage, to_stage, actor_name, reason, context_snapshot, occurred_at) SELECT id, NULL, 'PURCHASING', 'SYSTEM', 'Kurulum sırasında mevcut sipariş kayıtlarından oluşturuldu', '{"sourceOrderCount":1}'::jsonb, '2026-01-21T00:00:00.000Z' FROM products WHERE asin = 'B00V7COK0G';
INSERT INTO product_lifecycle_events (product_id, from_stage, to_stage, actor_name, reason, context_snapshot, occurred_at) SELECT id, NULL, 'PURCHASING', 'SYSTEM', 'Kurulum sırasında mevcut sipariş kayıtlarından oluşturuldu', '{"sourceOrderCount":2}'::jsonb, '2026-01-21T00:00:00.000Z' FROM products WHERE asin = 'B0D19MF171';
INSERT INTO product_lifecycle_events (product_id, from_stage, to_stage, actor_name, reason, context_snapshot, occurred_at) SELECT id, NULL, 'PURCHASING', 'SYSTEM', 'Kurulum sırasında mevcut sipariş kayıtlarından oluşturuldu', '{"sourceOrderCount":1}'::jsonb, '2026-01-22T00:00:00.000Z' FROM products WHERE asin = 'B0D19FGYZG';
INSERT INTO product_lifecycle_events (product_id, from_stage, to_stage, actor_name, reason, context_snapshot, occurred_at) SELECT id, NULL, 'PURCHASING', 'SYSTEM', 'Kurulum sırasında mevcut sipariş kayıtlarından oluşturuldu', '{"sourceOrderCount":1}'::jsonb, '2026-01-12T00:00:00.000Z' FROM products WHERE asin = 'B07WP7Q5BF';
INSERT INTO product_lifecycle_events (product_id, from_stage, to_stage, actor_name, reason, context_snapshot, occurred_at) SELECT id, NULL, 'SELLING', 'SYSTEM', 'Kurulum sırasında mevcut sipariş kayıtlarından oluşturuldu', '{"sourceOrderCount":2}'::jsonb, '2026-02-11T00:00:00.000Z' FROM products WHERE asin = 'B0DGQX1FS7';
INSERT INTO product_lifecycle_events (product_id, from_stage, to_stage, actor_name, reason, context_snapshot, occurred_at) SELECT id, NULL, 'SELLING', 'SYSTEM', 'Kurulum sırasında mevcut sipariş kayıtlarından oluşturuldu', '{"sourceOrderCount":1}'::jsonb, '2026-02-11T00:00:00.000Z' FROM products WHERE asin = 'B0DMTGWTM1';
INSERT INTO product_lifecycle_events (product_id, from_stage, to_stage, actor_name, reason, context_snapshot, occurred_at) SELECT id, NULL, 'SELLING', 'SYSTEM', 'Kurulum sırasında mevcut sipariş kayıtlarından oluşturuldu', '{"sourceOrderCount":3}'::jsonb, '2026-02-11T00:00:00.000Z' FROM products WHERE asin = 'B0D47RZVR3';
INSERT INTO product_lifecycle_events (product_id, from_stage, to_stage, actor_name, reason, context_snapshot, occurred_at) SELECT id, NULL, 'IN_WAREHOUSE', 'SYSTEM', 'Kurulum sırasında mevcut sipariş kayıtlarından oluşturuldu', '{"sourceOrderCount":1}'::jsonb, '2026-02-13T00:00:00.000Z' FROM products WHERE asin = 'B0D47Q69VD';
INSERT INTO product_lifecycle_events (product_id, from_stage, to_stage, actor_name, reason, context_snapshot, occurred_at) SELECT id, NULL, 'SELLING', 'SYSTEM', 'Kurulum sırasında mevcut sipariş kayıtlarından oluşturuldu', '{"sourceOrderCount":1}'::jsonb, '2026-02-12T00:00:00.000Z' FROM products WHERE asin = 'B0DLL7MC7L';
INSERT INTO product_lifecycle_events (product_id, from_stage, to_stage, actor_name, reason, context_snapshot, occurred_at) SELECT id, NULL, 'SELLING', 'SYSTEM', 'Kurulum sırasında mevcut sipariş kayıtlarından oluşturuldu', '{"sourceOrderCount":1}'::jsonb, '2026-02-12T00:00:00.000Z' FROM products WHERE asin = 'B005S6XGZ2';

-- Siparişler (24) — her biri bir ürüne bağlı (product_id NOT NULL)
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-01-21', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80', 'FBA', 'MegaFood One Daily Multivitamin - Multivitamin for Women and Men - with Real Food - Immune Support Supplement - Vitamin C & Vitamin B - Bone Health - Energy Metabolism - Vegetarian, Non-GMO - 180 Tabs', 'B00014DAJ8', 'MHB00014DAJ8', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/megafood-one-daily-180-tablets/mf-1123', 'https://www.amazon.com/dp/B00014DAJ8?th=1', 'WO110074776', 1, 4, '46.36', '80.00', '185.44', 'cerberusnisan@gmail.com', 'İPTAL', 0, 4, 0, 0, 0, '185.44', '1753', 'NO', 'NO', 'NO', 'New', 'MegaFood', 'O26', '185.44', 'BEKLIYOR', 'GIRILMEDI', id FROM products WHERE asin = 'B00014DAJ8';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-01-21', 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=200&auto=format&fit=crop&q=80', 'FBA', 'MegaFood Baby & Me 2 Prenatal Multi Vitamins - Prenatal Vitamins for Women with Choline, Methyl Folate & Iron, Vegetarian, Gluten-Free, Pre Natal Multivitamin for Women - 120 Tablets, 60 Servings', 'B01CQ3E6HG', 'HRN-B01CQ3E6HG', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/baby-me-2-120-tablets/mf-1240', 'https://www.amazon.com/dp/B01CQ3E6HG?th=1', 'WO110074774', 1, 6, '34.26', '60.00', '205.58', 'cerberusnisan@gmail.com', 'İPTAL', 0, 6, 0, 0, 0, '205.58', '1753', 'NO', 'NO', 'NO', 'New', 'MegaFood', 'O26', '205.58', 'BEKLIYOR', 'GIRILMEDI', id FROM products WHERE asin = 'B01CQ3E6HG';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-01-21', 'https://images.unsplash.com/photo-1577401239170-897942555fb3?w=200&auto=format&fit=crop&q=80', 'FBA', 'Vital Proteins Grass Fed Beef Liver Capsules, Desiccated Liver Supplement, 750mg Liver Pills, 120 Count', 'B00V7COK0G', 'FCRB00V7COK0G', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/beef-liver-120-cap/vtp0002', 'https://www.amazon.com/dp/B00V7COK0G', 'WO110074739', 1, 8, '23.21', '50.00', '185.70', 'cerberusnisan@gmail.com', 'İPTAL', 0, 8, 0, 0, 0, '185.70', '1753', 'NO', 'NO', 'NO', 'New', 'Vital', 'O26', '185.70', 'BEKLIYOR', 'GIRILMEDI', id FROM products WHERE asin = 'B00V7COK0G';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-01-21', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80', 'FBA', 'Vital Proteins Collagen Peptides for Women - 20g Hydrolyzed Collagen, Vitamin C, Hyaluronic Acid, Reduce Fine Lines & Wrinkles, Verisol & Holimel - Skin Complex Supplement, Unflavored 11.9oz Powder', 'B0D19MF171', 'HRN-B0D19MF171', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/vital-proteins-unflavored-11-9-oz-powder/vtp-13008', 'https://www.amazon.com/dp/B0D19MF171', 'WO110074729', 1, 10, '16.19', '40.00', '161.92', 'cerberusnisan@gmail.com', 'İPTAL', 0, 10, 0, 0, 0, '161.92', '1753', 'NO', 'NO', 'NO', 'New', 'Vital', 'O26', '161.92', 'BEKLIYOR', 'GIRILMEDI', id FROM products WHERE asin = 'B0D19MF171';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-01-21', 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=200&auto=format&fit=crop&q=80', 'FBA', 'MegaFood Baby & Me 2 Prenatal Multi Vitamins - Prenatal Vitamins for Women with Choline, Methyl Folate & Iron, Vegetarian, Gluten-Free, Pre Natal Multivitamin for Women - 120 Tablets, 60 Servings', 'B01CQ3E6HG', 'HRN-B01CQ3E6HG', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/baby-me-2-120-tablets/mf-1240', 'https://www.amazon.com/dp/B01CQ3E6HG?th=1', 'WO110074759', 1, 6, '34.26', '60.00', '205.58', 'cerberusmay01@gmail.com', 'İPTAL', 0, 6, 0, 0, 0, '205.58', '1753', 'NO', 'NO', 'NO', 'New', 'MegaFood', 'O26', '205.58', 'BEKLIYOR', 'GIRILMEDI', id FROM products WHERE asin = 'B01CQ3E6HG';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-01-21', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80', 'FBA', 'MegaFood One Daily Multivitamin - Multivitamin for Women and Men - with Real Food - Immune Support Supplement - Vitamin C & Vitamin B - Bone Health - Energy Metabolism - Vegetarian, Non-GMO - 180 Tabs', 'B00014DAJ8', 'MHB00014DAJ8', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/megafood-one-daily-180-tablets/mf-1123', 'https://www.amazon.com/dp/B00014DAJ8?th=1', 'WO110074758', 1, 4, '46.36', '80.00', '185.44', 'cerberusmay01@gmail.com', 'İPTAL', 0, 4, 0, 0, 0, '185.44', '1753', 'NO', 'NO', 'NO', 'New', 'MegaFood', 'O26', '185.44', 'BEKLIYOR', 'GIRILMEDI', id FROM products WHERE asin = 'B00014DAJ8';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-01-21', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80', 'FBA', 'Vital Proteins Collagen Peptides for Women - 20g Hydrolyzed Collagen, Vitamin C, Hyaluronic Acid, Reduce Fine Lines & Wrinkles, Verisol & Holimel - Skin Complex Supplement, Unflavored 11.9oz Powder', 'B0D19MF171', 'HRN-B0D19MF171', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/vital-proteins-unflavored-11-9-oz-powder/vtp-13008', 'https://www.amazon.com/dp/B0D19MF171', 'WO110074722', 1, 10, '16.19', '40.00', '161.92', 'cerberusnisan@gmail.com', 'İPTAL', 0, 10, 0, 0, 0, '161.92', '1753', 'NO', 'NO', 'NO', 'New', 'Vital', 'O26', '161.92', 'BEKLIYOR', 'GIRILMEDI', id FROM products WHERE asin = 'B0D19MF171';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-01-22', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80', 'FBA', 'Vital Proteins Collagen Peptides + Biotin 10000mcg Hair Complex, Hair Growth Supplement - Clinically Studied Lustriva to Promote Thicker Fuller Hair, 20g Unflavored Collagen for Women 11.4oz Powder', 'B0D19FGYZG', 'HRN-B0D19FGYZG', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/vital-proteins-unflavored-11-41-oz-powder/vtp-13007', 'https://www.amazon.com/dp/B0D19FGYZG?th=1', 'WO110074721', 1, 10, '16.19', '40.00', '161.92', 'cerberusmay01@gmail.com', 'İPTAL', 0, 10, 0, 0, 0, '161.92', '1753', 'NO', 'NO', 'NO', 'New', 'Vital', 'O26', '161.92', 'BEKLIYOR', 'GIRILMEDI', id FROM products WHERE asin = 'B0D19FGYZG';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-01-21', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80', 'FBA', 'MegaFood One Daily Multivitamin - Multivitamin for Women and Men - with Real Food - Immune Support Supplement - Vitamin C & Vitamin B - Bone Health - Energy Metabolism - Vegetarian, Non-GMO - 180 Tabs', 'B00014DAJ8', 'MHB00014DAJ8', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/megafood-one-daily-180-tablets/mf-1123', 'https://www.amazon.com/dp/B00014DAJ8?th=1', 'WO110074782', 1, 4, '46.36', '80.00', '185.44', 'cerberusnewjersey@gmail.com', 'İPTAL', 0, 4, 0, 0, 0, '185.44', '1753', 'NO', 'NO', 'NO', 'New', 'MegaFood', 'O26', '185.44', 'BEKLIYOR', 'GIRILMEDI', id FROM products WHERE asin = 'B00014DAJ8';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-01-21', 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=200&auto=format&fit=crop&q=80', 'FBA', 'MegaFood Baby & Me 2 Prenatal Multi Vitamins - Prenatal Vitamins for Women with Choline, Methyl Folate & Iron, Vegetarian, Gluten-Free, Pre Natal Multivitamin for Women - 120 Tablets, 60 Servings', 'B01CQ3E6HG', 'HRN-B01CQ3E6HG', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/baby-me-2-120-tablets/mf-1240', 'https://www.amazon.com/dp/B01CQ3E6HG?th=1', 'WO110074754', 1, 6, '34.26', '60.00', '205.58', 'cerberusnewjersey@gmail.com', 'İPTAL', 0, 6, 0, 0, 0, '205.58', '1753', 'NO', 'NO', 'NO', 'New', 'MegaFood', 'O26', '205.58', 'BEKLIYOR', 'GIRILMEDI', id FROM products WHERE asin = 'B01CQ3E6HG';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-01-21', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80', 'FBA', 'MegaFood One Daily Multivitamin - Multivitamin for Women and Men - with Real Food - Immune Support Supplement - Vitamin C & Vitamin B - Bone Health - Energy Metabolism - Vegetarian, Non-GMO - 180 Tabs', 'B00014DAJ8', 'MHB00014DAJ8', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/megafood-one-daily-180-tablets/mf-1123', 'https://www.amazon.com/dp/B00014DAJ8?th=1', 'WO110074751', 1, 4, '46.36', '80.00', '185.44', 'cerberusnewjersey@gmail.com', 'İPTAL', 0, 4, 0, 0, 0, '185.44', '1753', 'NO', 'NO', 'NO', 'New', 'MegaFood', 'O26', '185.44', 'BEKLIYOR', 'GIRILMEDI', id FROM products WHERE asin = 'B00014DAJ8';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-01-21', 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=200&auto=format&fit=crop&q=80', 'FBA', 'MegaFood Baby & Me 2 Prenatal Multi Vitamins - Prenatal Vitamins for Women with Choline, Methyl Folate & Iron, Vegetarian, Gluten-Free, Pre Natal Multivitamin for Women - 120 Tablets, 60 Servings', 'B01CQ3E6HG', 'HRN-B01CQ3E6HG', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/baby-me-2-120-tablets/mf-1240', 'https://www.amazon.com/dp/B01CQ3E6HG?th=1', 'WO110074746', 1, 8, '34.26', '60.00', '274.11', 'cerberusnewjersey@gmail.com', 'İPTAL', 0, 8, 0, 0, 0, '274.11', '1753', 'NO', 'NO', 'NO', 'New', 'MegaFood', 'O26', '274.11', 'BEKLIYOR', 'GIRILMEDI', id FROM products WHERE asin = 'B01CQ3E6HG';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-01-12', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80', 'FBA', 'ONNIT Alpha Brain® Nootropic Brain Supplement for Men and Women, IGEN™ Non-GMO Tested, Memory, Mental Clarity, Cognitive Support and Focus Capsules with L-Theanine and Vitamin B6 (90 Count)', 'B07WP7Q5BF', 'HRN-B07WP7Q5BF', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/onnit-labs-alpha-brain-90-veggie-caps/onn1002', 'http://amazon.com/dp/B07WP7Q5BF?th=1', 'WO610572666', 1, 4, '71.99', '80.00', '287.96', 'cerberushaziran@gmail.com', 'İPTAL', 0, 4, 0, 0, 0, '287.96', '5686', 'NO', 'NO', 'NO', 'New', 'ONNIT', 'O26', '287.96', 'BEKLIYOR', 'GIRILMEDI', id FROM products WHERE asin = 'B07WP7Q5BF';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-01-23', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80', 'FBA', 'MegaFood One Daily Multivitamin - Multivitamin for Women and Men - with Real Food - Immune Support Supplement - Vitamin C & Vitamin B - Bone Health - Energy Metabolism - Vegetarian, Non-GMO - 180 Tabs', 'B00014DAJ8', 'MHB00014DAJ8', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/megafood-one-daily-180-tablets/mf-1123', 'https://www.amazon.com/dp/B00014DAJ8?th=1', 'WO110075479', 1, 4, '46.36', '80.00', '185.44', 'heyberus@gmail.com', 'İPTAL', 0, 4, 0, 0, 0, '185.44', '1753', 'NO', 'NO', 'NO', 'New', 'MegaFood', 'O26', '185.44', 'BEKLIYOR', 'GIRILMEDI', id FROM products WHERE asin = 'B00014DAJ8';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-01-23', 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=200&auto=format&fit=crop&q=80', 'FBA', 'MegaFood Baby & Me 2 Prenatal Multi Vitamins - Prenatal Vitamins for Women with Choline, Methyl Folate & Iron, Vegetarian, Gluten-Free, Pre Natal Multivitamin for Women - 120 Tablets, 60 Servings', 'B01CQ3E6HG', 'HRN-B01CQ3E6HG', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/baby-me-2-120-tablets/mf-1240', 'https://www.amazon.com/dp/B01CQ3E6HG?th=1', 'WO110075476', 1, 4, '34.27', '60.00', '137.06', 'heyberus@gmail.com', 'Tam Geldi', 4, 0, 0, 0, 0, '0.00', '1753', 'NO', 'NO', 'NO', 'New', 'MegaFood', 'Ş26', '137.06', 'AMAZONA_SEVK', 'AKTIF_SATISTA', id FROM products WHERE asin = 'B01CQ3E6HG';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-02-11', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80', 'FBA', 'FORCE FACTOR Hair Growth Accelerator Capsules, Lustriva & Biotin to Promote Thicker, Stronger, Fuller Hair, Women Hair Growth Vitamins, Clinically Studied, Supports All 4 Stages of Growth, 90ct', 'B0DGQX1FS7', 'HRN-B0DGQX1FS7', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/hair-growth-accelerator-90-capsules/hfm-13782', 'https://www.amazon.com/dp/B0DGQX1FS7?th=1', 'WO310759607', 1, 4, '29.99', '65.00', '119.97', 'heyberus@gmail.com', 'Tam Geldi', 0, 0, 4, 0, 0, '0.00', '1753', 'NO', 'NO', 'NO', 'New', 'FORCE', 'Ş26', '119.97', 'DEPO_SAYILDI', 'GIRILMEDI', id FROM products WHERE asin = 'B0DGQX1FS7';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-02-11', 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=200&auto=format&fit=crop&q=80', 'FBA', 'FORCE FACTOR NAD+ Anti-Aging Supplement (NMN or Nicotinamide Riboside Alternative) with Resveratrol, Astaxanthin, Spermidine & Luteolin Complex to Support Cellular Health & Healthy Aging, 60 Capsules', 'B0DMTGWTM1', 'HRN-B0DMTGWTM1', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/nad-longetivity-60-capsules/hfm-13908', 'https://www.amazon.com/dp/B0DMTGWTM1', 'WO310759615', 1, 4, '23.99', '40.00', '95.97', 'cerberusnurten@gmail.com', 'Tam Geldi', 4, 0, 0, 0, 0, '0.00', '1753', 'NO', 'NO', 'NO', 'New', 'FORCE', 'Ş26', '95.97', 'AMAZONA_SEVK', 'AKTIF_SATISTA', id FROM products WHERE asin = 'B0DMTGWTM1';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-02-11', 'https://images.unsplash.com/photo-1577401239170-897942555fb3?w=200&auto=format&fit=crop&q=80', 'FBA', 'FORCE FACTOR Total Beets Ultimate Heart Health Blood Pressure Support Chews with CoQ10, Beet Root Powder, Grape Seed Extract, Blood Pressure Supplement for Circulation & Blood Flow, 60 Soft Chews', 'B0D47RZVR3', 'HRN-B0D47RZVR3', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/total-beets-ultimate-heart-pomegranate-berry-60-soft-chews/hfm-12565', 'https://www.amazon.com/dp/B0D47RZVR3?th=1', 'WO310759625', 1, 4, '23.99', '40.00', '95.97', 'cerberushaziran@gmail.com', 'Tam Geldi', 0, 0, 4, 0, 0, '0.00', '1753', 'NO', 'NO', 'NO', 'New', 'FORCE', 'Ş26', '95.97', 'DEPO_SAYILDI', 'GIRILMEDI', id FROM products WHERE asin = 'B0D47RZVR3';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-02-12', 'https://images.unsplash.com/photo-1577401239170-897942555fb3?w=200&auto=format&fit=crop&q=80', 'FBA', 'FORCE FACTOR Total Beets Ultimate Heart Health Blood Pressure Support Chews with CoQ10, Beet Root Powder, Grape Seed Extract, Blood Pressure Supplement for Circulation & Blood Flow, 60 Soft Chews', 'B0D47RZVR3', 'HRN-B0D47RZVR3', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/total-beets-ultimate-heart-pomegranate-berry-60-soft-chews/hfm-12565', 'https://www.amazon.com/dp/B0D47RZVR3?th=1', 'WO110084963', 1, 6, '21.59', '40.00', '129.55', 'cerberusnisan@gmail.com', 'Tam Geldi', 6, 0, 0, 0, 0, '0.00', '1753', 'NO', 'NO', 'NO', 'New', 'FORCE', 'Ş26', '129.55', 'AMAZONA_SEVK', 'AKTIF_SATISTA', id FROM products WHERE asin = 'B0D47RZVR3';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-02-13', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80', 'FBA', 'FORCE FACTOR Hair Growth Accelerator Capsules, Lustriva & Biotin to Promote Thicker, Stronger, Fuller Hair, Women Hair Growth Vitamins, Clinically Studied, Supports All 4 Stages of Growth, 90ct', 'B0DGQX1FS7', 'HRN-B0DGQX1FS7', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/hair-growth-accelerator-90-capsules/hfm-13782', 'https://www.amazon.com/dp/B0DGQX1FS7?th=1', 'WO110086220', 1, 4, '26.24', '65.00', '104.96', 'adamwrite25@gmail.com', 'Tam Geldi', 4, 0, 0, 0, 0, '0.00', '1753', 'NO', 'NO', 'NO', 'New', 'FORCE', 'Ş26', '104.96', 'AMAZONA_SEVK', 'AKTIF_SATISTA', id FROM products WHERE asin = 'B0DGQX1FS7';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-02-13', 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=200&auto=format&fit=crop&q=80', 'FBA', 'FORCE FACTOR Total Beets Ultimate Heart Health Blood Pressure Support Chews with CoQ10, Beet Root Powder, Grape Seed Extract, Blood Pressure Supplement for Circulation & Blood Flow, 60 Soft Chews', 'B0D47Q69VD', 'HRN-B0D47Q69VD', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/total-beets-ultimate-heart-black-cherry-60-soft-chews/hfm-12566', 'https://www.amazon.com/dp/B0D47Q69VD?th=1', 'WO110086212', 1, 6, '20.32', '40.00', '121.94', 'adamwrite25@gmail.com', 'Tam Geldi', 0, 0, 6, 0, 0, '0.00', '1753', 'NO', 'NO', 'NO', 'New', 'FORCE', 'Ş26', '121.94', 'DEPO_SAYILDI', 'GIRILMEDI', id FROM products WHERE asin = 'B0D47Q69VD';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-02-12', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80', 'FBA', 'FORCE FACTOR Creatine HMB, 5g Creatine Monohydrate Powder, 3g myHMB, Support Muscle, Strength, Energy & Recovery, with AstraGin for Enhanced Absorption, ~30 Servings, Unflavored Powder', 'B0DLL7MC7L', 'HRN-B0DLL7MC7L', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/creatine-hmb-240-g-powder/fcs-14434', 'https://www.amazon.com/dp/B0DLL7MC7L?th=1', 'WO110085610', 1, 4, '24.29', '50.00', '97.17', 'adamwrite25@gmail.com', 'Tam Geldi', 4, 0, 0, 0, 0, '0.00', '1753', 'NO', 'NO', 'NO', 'New', 'FORCE', 'Ş26', '97.17', 'AMAZONA_SEVK', 'AKTIF_SATISTA', id FROM products WHERE asin = 'B0DLL7MC7L';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-02-12', 'https://images.unsplash.com/photo-1577401239170-897942555fb3?w=200&auto=format&fit=crop&q=80', 'FBA', 'Irwin Naturals Prosta-Strong - 180 Softgels - Prostate Health Support with Saw Palmetto, Lycopene & Pumpkin Seed - Supports Urinary Flow', 'B005S6XGZ2', 'HRN-B005S6XGZ2', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/irwin-naturals-prosta-strong-vp-180-softgels/in-1100', 'https://www.amazon.com/dp/B005S6XGZ2', 'WO110085580', 1, 4, '37.79', '50.00', '151.17', 'adamwrite25@gmail.com', 'Tam Geldi', 4, 0, 0, 0, 0, '0.00', '1753', 'NO', 'NO', 'NO', 'New', 'Irwin', 'Ş26', '151.17', 'AMAZONA_SEVK', 'AKTIF_SATISTA', id FROM products WHERE asin = 'B005S6XGZ2';
INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT 'HRN', '2026-02-12', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80', 'FBA', 'FORCE FACTOR Total Beets Ultimate Heart Health Blood Pressure Support Chews with CoQ10, Beet Root Powder, Grape Seed Extract, Blood Pressure Supplement for Circulation & Blood Flow, 60 Soft Chews', 'B0D47RZVR3', 'HRN-B0D47RZVR3', 'THE VITAMINSHOPPE', 'A198', 'https://www.vitaminshoppe.com/p/total-beets-ultimate-heart-pomegranate-berry-60-soft-chews/hfm-12565', 'https://www.amazon.com/dp/B0D47RZVR3?th=1', 'WO110085563', 1, 6, '21.59', '40.00', '129.55', 'adamwrite25@gmail.com', 'Tam Geldi', 6, 0, 0, 0, 0, '0.00', '1753', 'NO', 'NO', 'NO', 'New', 'FORCE', 'Ş26', '129.55', 'AMAZONA_SEVK', 'AKTIF_SATISTA', id FROM products WHERE asin = 'B0D47RZVR3';

-- [5/5] Doğrulama
-- Ürüne bağlanmamış sipariş varsa kurulum hatalıdır; işlemi geri alın.
DO $$
DECLARE orphan_count integer;
BEGIN
  SELECT count(*) INTO orphan_count FROM orders WHERE product_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Kurulum hatali: % siparis urune bagli degil', orphan_count;
  END IF;
END $$;

COMMIT;

-- Sonuç özeti
SELECT 'stores' AS tablo, count(*) AS adet FROM stores
UNION ALL SELECT 'users', count(*) FROM users
UNION ALL SELECT 'orders', count(*) FROM orders
UNION ALL SELECT 'products', count(*) FROM products
UNION ALL SELECT 'supplier_offers', count(*) FROM supplier_offers
UNION ALL SELECT 'product_lifecycle_events', count(*) FROM product_lifecycle_events;
