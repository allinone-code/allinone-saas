/**
 * Neon SQL Editor için tek dosyalık kurulum betiği üretir.
 *
 * Neden gerekli?
 * `npm run db:bootstrap` bir terminal ve Node kurulumu ister. Terminal
 * kullanmak istemeyen (ya da kuramayan) kullanıcı için aynı sonucu Neon'un
 * web SQL editöründen tek seferde alabilmek gerekir.
 *
 * Üretilen dosya: docs/neon-kurulum.sql
 *
 * İçerik sırası:
 *   1. drizzle/*.sql migration'ları (0000 → 0003), doğru sırayla
 *   2. drizzle takip tablosu (sonradan `npm run db:migrate` çakışmasın)
 *   3. Başlangıç verisi: mağazalar, kullanıcılar, siparişler
 *   4. Sipariş satırlarından ürün kataloğu + fiyat gözlemleri + olay defteri
 *
 * Kullanım:
 *   npx tsx scripts/generate-neon-sql.ts
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { ALL_38_XLS_ORDERS, INITIAL_STORES } from "../fixtures/mockData";
import { DEFAULT_SYSTEM_USERS } from "../src/lib/auth";
import { backfillProductsFromOrders } from "../src/domain/productBackfill";
import { SETUP_PASSWORD, SETUP_PASSWORD_HASH } from "../src/setup/neonSetupPassword";

/** SQL string literali — tek tırnak kaçışlı, null güvenli */
function q(v: unknown): string {
  if (v === null || v === undefined || v === "") return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Sayısal alan — boşsa varsayılan */
function n(v: unknown, fallback = 0): string {
  const num = Number(v);
  return Number.isFinite(num) ? String(num) : String(fallback);
}

/** YES/NO metnini boolean'a çevirir (products tablosu boolean kullanır) */
function yesNo(v: unknown): string {
  return String(v ?? "").trim().toUpperCase() === "YES" ? "true" : "false";
}

function main() {
  const out: string[] = [];

  out.push(`-- ============================================================`);
  out.push(`-- CERBERUS — Neon tek dosyalık kurulum`);
  out.push(`-- Üretildi: ${new Date().toISOString()}`);
  out.push(`--`);
  out.push(`-- KULLANIM: Neon konsolu > SQL Editor > bu dosyanın TAMAMINI`);
  out.push(`-- yapıştırın > Run.`);
  out.push(`--`);
  out.push(`-- UYARI: İlk satır mevcut 'public' şemasını SİLER.`);
  out.push(`-- Korumak istediğiniz veri varsa o satırı silin.`);
  out.push(`-- ============================================================`);
  out.push(``);
  out.push(`BEGIN;`);
  out.push(``);
  out.push(`-- [1/5] Temiz başlangıç`);
  out.push(`DROP SCHEMA IF EXISTS public CASCADE;`);
  out.push(`CREATE SCHEMA public;`);
  out.push(``);

  // ---------------------------------------------------------------- şema
  out.push(`-- [2/5] Şema (drizzle migration'ları)`);
  const migFiles = readdirSync("./drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const journal = JSON.parse(readFileSync("./drizzle/meta/_journal.json", "utf8"));

  for (const f of migFiles) {
    const raw = readFileSync(`./drizzle/${f}`, "utf8");
    out.push(``);
    out.push(`-- ---- ${f} ----`);
    // drizzle'ın statement ayıracı SQL değil, temizlenmeli
    out.push(raw.split("--> statement-breakpoint").join("").trim());
  }

  // ------------------------------------------------- migration takip tablosu
  out.push(``);
  out.push(`-- [3/5] Drizzle migration takibi`);
  out.push(`-- Bunlar yazılmazsa 'npm run db:migrate' aynı migration'ları`);
  out.push(`-- tekrar uygulamaya çalışır ve hata verir.`);
  out.push(`CREATE SCHEMA IF NOT EXISTS drizzle;`);
  out.push(`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (`);
  out.push(`  id SERIAL PRIMARY KEY,`);
  out.push(`  hash text NOT NULL,`);
  out.push(`  created_at bigint`);
  out.push(`);`);

  for (const entry of journal.entries) {
    const file = migFiles.find((f) => f.startsWith(entry.tag.split("_")[0]));
    if (!file) continue;
    const hash = createHash("sha256")
      .update(readFileSync(`./drizzle/${file}`, "utf8"))
      .digest("hex");
    out.push(
      `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${q(hash)}, ${entry.when});`
    );
  }

  // -------------------------------------------------------------- mağazalar
  out.push(``);
  out.push(`-- [4/5] Başlangıç verisi`);
  out.push(``);
  out.push(`-- Mağazalar`);
  for (const s of INITIAL_STORES as Array<Record<string, unknown>>) {
    out.push(
      `INSERT INTO stores (store_code, store_name, marketplace, status, account_health_score) ` +
        `VALUES (${q(s.storeCode)}, ${q(s.storeName)}, ${q(s.marketplace ?? "AMAZON_US")}, ` +
        `${q(s.status ?? "ACTIVE")}, ${n(s.accountHealthScore, 100)}) ` +
        `ON CONFLICT (store_code) DO NOTHING;`
    );
  }

  // ------------------------------------------------------------ kullanıcılar
  out.push(``);
  out.push(`-- Kullanıcılar`);
  out.push(`-- Parola yer tutucudur; ilk girişten önce MUTLAKA değiştirin.`);
  out.push(`-- Aşağıdaki hash '${SETUP_PASSWORD}' parolasına karşılık gelir.`);
  // bcrypt(12) hash'i — 'CerberusKurulum2026!' parolasına karşılık gelir.
  // src/lib/passwords.ts ile üretildi ve testle doğrulanır
  // (scripts/neonSql.test.ts). Elle değiştirmeyin: yanlış hash girişi
  // sessizce imkânsız kılar.
  const PLACEHOLDER_HASH = SETUP_PASSWORD_HASH;
  for (const u of DEFAULT_SYSTEM_USERS) {
    out.push(
      `INSERT INTO users (name, email, password_hash, role, store_code) ` +
        `VALUES (${q(u.name)}, ${q(u.email.toLowerCase())}, ${q(PLACEHOLDER_HASH)}, ` +
        `${q(u.role)}, ${q(u.storeCode)}) ON CONFLICT (email) DO NOTHING;`
    );
  }

  // ------------------------------------------------------ ürünler + gözlemler
  // Siparişleri yazmadan ÖNCE ürünleri yazmalıyız: orders.product_id NOT NULL.
  const rows = (ALL_38_XLS_ORDERS as unknown as Array<Record<string, unknown>>).map((r, i) => ({
    id: i + 1,
    asin: r.asin,
    productTitle: r.productTitle,
    brandName: r.brandName,
    imageUrl: r.imageUrl,
    amazonUrl: r.amazonUrl,
    supplierName: r.supplierName,
    supplierCode: r.supplierCode,
    supplierUrl: r.supplierUrl,
    unitCost: r.unitCost,
    packCount: r.packCount,
    isFragile: r.isFragile,
    isMultiPack: r.isMultiPack,
    isBundle: r.isBundle,
    countPerBundle: r.countPerBundle,
    orderDate: r.orderDate,
    pshStatus: r.pshStatus,
    inventoryLabStatus: r.inventoryLabStatus,
    shippedToAmazon: r.shippedToAmazon,
  }));

  const backfill = backfillProductsFromOrders(rows as never);

  out.push(``);
  out.push(`-- Ürün kataloğu (${backfill.products.length} benzersiz ürün)`);
  out.push(`-- ${rows.length} sipariş satırı ${backfill.products.length} ürüne indirgendi.`);
  for (const p of backfill.products) {
    out.push(
      `INSERT INTO products (asin, title, brand, category, image_url, amazon_url, ` +
        `is_fragile, is_multipack, is_bundle, count_per_bundle, pack_count, ` +
        `lifecycle_stage, discovered_at) VALUES (` +
        `${q(p.asin)}, ${q(p.title)}, ${q(p.brand)}, ${q(p.category)}, ${q(p.imageUrl)}, ` +
        `${q(p.amazonUrl)}, ${p.isFragile ? "true" : "false"}, ` +
        `${p.isMultiPack ? "true" : "false"}, ${p.isBundle ? "true" : "false"}, ` +
        `${p.countPerBundle === null || p.countPerBundle === undefined ? "NULL" : n(p.countPerBundle)}, ` +
        `${n(p.packCount, 1)}, ${q(p.lifecycleStage)}, ` +
        `${q(new Date(p.discoveredAt).toISOString())}) ON CONFLICT (asin) DO NOTHING;`
    );
  }

  out.push(``);
  out.push(`-- Tedarikçi fiyat gözlemleri (${backfill.offers.length}) — trend analizinin kaynağı`);
  for (const o of backfill.offers) {
    out.push(
      `INSERT INTO supplier_offers (product_id, supplier_name, supplier_code, source_url, ` +
        `source_domain, unit_price, observed_at, source_type) SELECT id, ${q(o.supplierName)}, ` +
        `${q(o.supplierCode)}, ${q(o.sourceUrl)}, ${q(o.sourceDomain)}, ${q(o.unitPrice)}, ` +
        `${q(new Date(o.observedAt).toISOString())}, ${q(o.sourceType)} ` +
        `FROM products WHERE asin = ${q(o.asin)};`
    );
  }

  out.push(``);
  out.push(`-- Yaşam döngüsü olay defteri — her ürünün doğuş kaydı`);
  for (const p of backfill.products) {
    out.push(
      `INSERT INTO product_lifecycle_events (product_id, from_stage, to_stage, actor_name, ` +
        `reason, context_snapshot, occurred_at) SELECT id, NULL, ${q(p.lifecycleStage)}, ` +
        `'SYSTEM', 'Kurulum sırasında mevcut sipariş kayıtlarından oluşturuldu', ` +
        `${q(JSON.stringify({ sourceOrderCount: p.sourceOrderIds.length }))}::jsonb, ` +
        `${q(new Date(p.discoveredAt).toISOString())} FROM products WHERE asin = ${q(p.asin)};`
    );
  }

  // ------------------------------------------------------------- siparişler
  out.push(``);
  out.push(`-- Siparişler (${rows.length}) — her biri bir ürüne bağlı (product_id NOT NULL)`);
  for (const r of ALL_38_XLS_ORDERS as unknown as Array<Record<string, unknown>>) {
    const asin = String(r.asin ?? "").trim().toUpperCase();
    out.push(
      `INSERT INTO orders (buyer_store, order_date, image_url, fulfillment_type, product_title, ` +
        `asin, msku, supplier_name, supplier_code, supplier_url, amazon_url, order_number, ` +
        `pack_count, quantity, unit_cost, selling_price, total_cost, order_email, cargo_status, ` +
        `shipped_to_amazon, p1_cancel_qty, p2_missing_qty, p3_defective_qty, p4_expired_qty, ` +
        `refund_amount, credit_card, is_fragile, is_multipack, is_bundle, condition, brand_name, ` +
        `period_code, corrected_cost, psh_status, inventory_lab_status, product_id) SELECT ` +
        `${q(r.buyerStore)}, ${q(r.orderDate)}, ${q(r.imageUrl)}, ${q(r.fulfillmentType)}, ` +
        `${q(r.productTitle)}, ${q(asin)}, ${q(r.msku)}, ${q(r.supplierName)}, ${q(r.supplierCode)}, ` +
        `${q(r.supplierUrl)}, ${q(r.amazonUrl)}, ${q(r.orderNumber)}, ${n(r.packCount, 1)}, ` +
        `${n(r.quantity, 1)}, ${q(r.unitCost ?? "0.00")}, ${q(r.sellingPrice ?? "0.00")}, ` +
        `${q(r.totalCost ?? "0.00")}, ${q(r.orderEmail)}, ${q(r.cargoStatus ?? "Yolda")}, ` +
        `${n(r.shippedToAmazon)}, ${n(r.p1CancelQty)}, ${n(r.p2MissingQty)}, ` +
        `${n(r.p3DefectiveQty)}, ${n(r.p4ExpiredQty)}, ${q(r.refundAmount ?? "0.00")}, ` +
        `${q(r.creditCard)}, ${q(r.isFragile ?? "NO")}, ${q(r.isMultiPack ?? "NO")}, ` +
        `${q(r.isBundle ?? "NO")}, ${q(r.condition ?? "New")}, ${q(r.brandName)}, ` +
        `${q(r.periodCode)}, ${q(r.correctedCost ?? r.totalCost ?? "0.00")}, ` +
        `${q(r.pshStatus ?? "BEKLIYOR")}, ${q(r.inventoryLabStatus ?? "GIRILMEDI")}, id ` +
        `FROM products WHERE asin = ${q(asin)};`
    );
  }

  // -------------------------------------------------------------- doğrulama
  out.push(``);
  out.push(`-- [5/5] Doğrulama`);
  out.push(`-- Ürüne bağlanmamış sipariş varsa kurulum hatalıdır; işlemi geri alın.`);
  out.push(`DO $$`);
  out.push(`DECLARE orphan_count integer;`);
  out.push(`BEGIN`);
  out.push(`  SELECT count(*) INTO orphan_count FROM orders WHERE product_id IS NULL;`);
  out.push(`  IF orphan_count > 0 THEN`);
  out.push(`    RAISE EXCEPTION 'Kurulum hatali: % siparis urune bagli degil', orphan_count;`);
  out.push(`  END IF;`);
  out.push(`END $$;`);
  out.push(``);
  out.push(`COMMIT;`);
  out.push(``);
  out.push(`-- Sonuç özeti`);
  out.push(`SELECT 'stores' AS tablo, count(*) AS adet FROM stores`);
  out.push(`UNION ALL SELECT 'users', count(*) FROM users`);
  out.push(`UNION ALL SELECT 'orders', count(*) FROM orders`);
  out.push(`UNION ALL SELECT 'products', count(*) FROM products`);
  out.push(`UNION ALL SELECT 'supplier_offers', count(*) FROM supplier_offers`);
  out.push(`UNION ALL SELECT 'product_lifecycle_events', count(*) FROM product_lifecycle_events;`);
  out.push(``);

  const sql = out.join("\n");
  writeFileSync("docs/neon-kurulum.sql", sql);

  console.log("docs/neon-kurulum.sql yazıldı.");
  console.log(`  satır         : ${sql.split("\n").length}`);
  console.log(`  mağaza        : ${INITIAL_STORES.length}`);
  console.log(`  kullanıcı     : ${DEFAULT_SYSTEM_USERS.length}`);
  console.log(`  sipariş       : ${rows.length}`);
  console.log(`  ürün          : ${backfill.products.length}`);
  console.log(`  fiyat gözlemi : ${backfill.offers.length}`);
}

main();
