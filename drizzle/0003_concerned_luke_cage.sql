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
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "product_id" SET NOT NULL;
