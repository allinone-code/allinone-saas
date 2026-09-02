-- AŞAMA 3 — Karar kasasını ürün kataloğuna bağla.
--
-- product_masters.product_id: bir ürünün en fazla bir kasa kaydı vardır.
-- Tarihsel (ASIN kesişimsiz) kayıtlar NULL kalabilir; yeni keşifler her
-- zaman bir products satırına yazılır.
ALTER TABLE "product_masters" ADD COLUMN "product_id" integer;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_masters_product_id_products_id_fk'
  ) THEN
    ALTER TABLE "product_masters"
      ADD CONSTRAINT "product_masters_product_id_products_id_fk"
      FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;--> statement-breakpoint
-- Aynı ASIN'e birden fazla kasa kaydı varsa en yeni olan bağlanır.
WITH ranked AS (
  SELECT
    pm.id,
    p.id AS product_id,
    row_number() OVER (
      PARTITION BY p.id
      ORDER BY pm.discovered_at DESC NULLS LAST, pm.id DESC
    ) AS rn
  FROM product_masters pm
  JOIN products p ON upper(trim(pm.asin)) = p.asin
  WHERE pm.product_id IS NULL
)
UPDATE product_masters pm
SET product_id = ranked.product_id
FROM ranked
WHERE pm.id = ranked.id AND ranked.rn = 1;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_masters_product_id_uq" ON "product_masters" USING btree ("product_id") WHERE "product_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_masters_product_id_idx" ON "product_masters" USING btree ("product_id");
