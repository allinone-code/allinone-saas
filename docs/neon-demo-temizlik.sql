-- ============================================================================
-- CERBERUS — DEMO VERİSİ TEMİZLEME (Neon SQL Editor)
-- ============================================================================
-- Bu betik, `npm run db:clean-demo -- --yes DEMO-TEMIZLE` script'inin birebir
-- SQL karşılığıdır. Terminal kullanmak istemiyorsanız bunu Neon konsolu →
-- SQL Editor'e yapıştırıp Run deyin.
--
--   SİLİNEN  (demo operasyonel veri):
--     orders, psh_batches, product_masters, products,
--     supplier_offers, product_lifecycle_events, research_sessions
--
--   KORUNAN  (kurumsal yapı):
--     users (kullanıcı hesapları — girişler etkilenmez)
--     stores (mağaza tanımları — sipariş sayaçları sıfırlanır)
--     researchers (sourcing kadrosu)
--     audit_logs (denetim izi — bu işlem de kaydedilir)
--
-- ⚠️  Çalıştırmadan önce: aşağıdaki SELECT çıktısını görüp emin olun.
--     Onay: bu betik SADECE demo verisini hedefler; geri dönüş Neon'un
--     point-in-time recovery'siyle mümkündür (yanlışlık olursa).
-- ============================================================================

-- 0) ÇALIŞTIRMADAN ÖNCE GÖR (hiçbir şey silmez):
SELECT 'orders'              AS tablo, count(*) AS satir FROM orders
UNION ALL SELECT 'psh_batches',            count(*) FROM psh_batches
UNION ALL SELECT 'product_masters',        count(*) FROM product_masters
UNION ALL SELECT 'products',               count(*) FROM products
UNION ALL SELECT 'supplier_offers',        count(*) FROM supplier_offers
UNION ALL SELECT 'product_lifecycle_events', count(*) FROM product_lifecycle_events
UNION ALL SELECT 'research_sessions',      count(*) FROM research_sessions
UNION ALL SELECT 'users (KORUNUR)',        count(*) FROM users
UNION ALL SELECT 'stores (KORUNUR)',       count(*) FROM stores
UNION ALL SELECT 'researchers (KORUNUR)',  count(*) FROM researchers;

-- 1) TEMİZLİK (yukarıdaki sayılar beklediğin gibiyse aşağıyı çalıştır):
BEGIN;

-- FK sırası önemli: orders önce (products'a RESTRICT FK var), sonra batch'ler,
-- eski ürün kasası, ürün-merkezli çekirdek ve araştırma oturumları.
DELETE FROM orders;
DELETE FROM psh_batches;
DELETE FROM product_masters;
DELETE FROM supplier_offers;
DELETE FROM product_lifecycle_events;
DELETE FROM products;
DELETE FROM research_sessions;

-- Mağazaların siparişten türeyen sayaçları sıfırla (demo finansal kalmasın)
UPDATE stores SET total_orders_count = 0, total_spend = 0.00;

-- Denetim izi (append-only — bu işlem de kayda geçer)
INSERT INTO audit_logs
  (actor_name, store_code, action_type, target_entity, before_state, after_state, details)
VALUES
  ('SISTEM (demo veri temizliği)', 'ALL', 'DATABASE_DEMO_CLEAN',
   'orders,psh_batches,product_masters,products,supplier_offers,product_lifecycle_events,research_sessions',
   'DEMO_VERISI', 'GERCEK_VERI_ICIN_HAZIR',
   'Demo veri temizlendi. Mağazalar, kullanıcılar ve araştırmacı kadrosu korundu; mağaza sipariş sayaçları sıfırlandı.');

COMMIT;

-- 2) DOĞRULAMA (temizlik sonrası):
SELECT 'orders'                AS tablo, count(*) AS satir FROM orders
UNION ALL SELECT 'products',              count(*) FROM products
UNION ALL SELECT 'users (KORUNUR)',       count(*) FROM users
UNION ALL SELECT 'stores (KORUNUR)',      count(*) FROM stores
UNION ALL SELECT 'researchers (KORUNUR)', count(*) FROM researchers
UNION ALL SELECT 'audit_logs',            count(*) FROM audit_logs;
