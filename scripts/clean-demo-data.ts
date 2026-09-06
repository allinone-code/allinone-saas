/**
 * CERBERUS — Demo Verisi Temizleme (Tek Komut)
 *
 * Üretim (Neon) veritabanından DEMO operasyonel verisini güvenle temizler;
 * kurumsal yapıyı (mağazalar, kullanıcılar, araştırmacı kadrosu) korur.
 *
 * Kullanım:
 *   DATABASE_URL=... npm run db:clean-demo                    # DRY-RUN (hiçbir şey silmez)
 *   DATABASE_URL=... npm run db:clean-demo -- --yes DEMO-TEMIZLE   # gerçekten siler
 *
 * Güvenlik:
 *   - Varsayılan mod dry-run'dır; silme YALNIZCA "--yes DEMO-TEMIZLE" ile çalışır.
 *   - Tek transaction: kısmi hata olursa hiçbir şey silinmez.
 *   - İşlem denetim izine (audit_logs) yazılır; bu tablo SİLİNMEZ.
 *
 * Silinen (demo operasyonel veri):
 *   orders, psh_batches, product_masters, products,
 *   supplier_offers, product_lifecycle_events, research_sessions
 *
 * Korunan (kurumsal yapı):
 *   users (kullanıcı hesapları), stores (mağaza tanımları),
 *   researchers (sourcing kadrosu), audit_logs (denetim izi)
 *
 * Ek temizlik: stores.total_orders_count / total_spend demo siparişlerden
 * türediği için 0'a sıfırlanır — boş tabloda demo finansal görünmesin.
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  orders,
  pshBatches,
  productMasters,
  products,
  supplierOffers,
  productLifecycleEvents,
  researchSessions,
  stores,
  auditLogs,
} from "@/db/schema";

const args = process.argv.slice(2);
const WANTS_YES = args.includes("--yes");
const CONFIRM_CODE = "DEMO-TEMIZLE";
const HAS_CODE = args.includes(CONFIRM_CODE);
const DRY_RUN = !(WANTS_YES && HAS_CODE);

const ACTOR = process.env.CLEAN_ACTOR_NAME || "SISTEM (demo veri temizliği)";

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  const r = (result as { rows?: unknown })?.rows;
  return Array.isArray(r) ? (r as Array<Record<string, unknown>>) : [];
}

async function countOf(table: string): Promise<number> {
  const rows = rowsOf(await db.execute(sql.raw(`select count(*)::int as n from ${table}`)));
  return Number(rows[0]?.n ?? 0);
}

function fail(msg: string): never {
  console.error(`\nHATA: ${msg}`);
  process.exit(1);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    fail("DATABASE_URL tanımlı değil. Neon pooler bağlantı adresinizi verin.");
  }

  if (WANTS_YES && !HAS_CODE) {
    fail(`"--yes" verildi ama onay kodu eksik. Doğru kullanım:\n  npm run db:clean-demo -- --yes ${CONFIRM_CODE}`);
  }

  const target = process.env.DATABASE_URL.replace(/:\/\/[^@]*@/, "://<gizli>@");
  console.log("CERBERUS — Demo Verisi Temizleme");
  console.log(`Hedef : ${target}`);
  console.log(`Mod   : ${DRY_RUN ? "DRY-RUN (hiçbir şey silinmeyecek)" : "GERÇEK SİLME"}\n`);

  const counts = {
    orders: await countOf("orders"),
    psh_batches: await countOf("psh_batches"),
    product_masters: await countOf("product_masters"),
    products: await countOf("products"),
    supplier_offers: await countOf("supplier_offers"),
    product_lifecycle_events: await countOf("product_lifecycle_events"),
    research_sessions: await countOf("research_sessions"),
    // korunacaklar
    users: await countOf("users"),
    stores: await countOf("stores"),
    researchers: await countOf("researchers"),
    audit_logs: await countOf("audit_logs"),
  };

  console.log("SİLİNECEK (demo operasyonel veri):");
  console.log(`  orders                    ${counts.orders}`);
  console.log(`  psh_batches               ${counts.psh_batches}`);
  console.log(`  product_masters           ${counts.product_masters}`);
  console.log(`  products                  ${counts.products}`);
  console.log(`  supplier_offers           ${counts.supplier_offers}`);
  console.log(`  product_lifecycle_events  ${counts.product_lifecycle_events}`);
  console.log(`  research_sessions         ${counts.research_sessions}`);

  console.log("\nKORUNACAK (kurumsal yapı):");
  console.log(`  users          ${counts.users}  (kullanıcı hesapları — girişler etkilenmez)`);
  console.log(`  stores         ${counts.stores}  (mağaza tanımları; sipariş sayaçları sıfırlanır)`);
  console.log(`  researchers    ${counts.researchers}  (sourcing kadrosu)`);
  console.log(`  audit_logs     ${counts.audit_logs}  (denetim izi — bu işlem de kaydedilir)`);

  if (DRY_RUN) {
    console.log("\nDRY-RUN: hiçbir değişiklik yapılmadı.");
    console.log(`Gerçekten silmek için:  npm run db:clean-demo -- --yes ${CONFIRM_CODE}`);
    process.exit(0);
  }

  // ── GERÇEK SİLME ──────────────────────────────────────────────────────
  await db.transaction(async (tx) => {
    // FK sırası: orders önce (products'a RESTRICT FK), sonra batch, eski
    // ürün kasası, ürün-merkezli çekirdek ve araştırma oturumları.
    await tx.delete(orders);
    await tx.delete(pshBatches);
    await tx.delete(productMasters);
    await tx.delete(supplierOffers);
    await tx.delete(productLifecycleEvents);
    await tx.delete(products);
    await tx.delete(researchSessions);

    // Mağazaların siparişten türeyen sayaçları sıfırla (demo finansal kalmasın)
    await tx.update(stores).set({ totalOrdersCount: 0, totalSpend: "0.00" });

    // Denetim izi (append-only — silinmez)
    await tx.insert(auditLogs).values({
      actorName: ACTOR,
      storeCode: "ALL",
      actionType: "DATABASE_DEMO_CLEAN",
      targetEntity:
        "orders,psh_batches,product_masters,products,supplier_offers,product_lifecycle_events,research_sessions",
      beforeState: "DEMO_VERISI",
      afterState: "GERCEK_VERI_ICIN_HAZIR",
      details:
        "Demo veri temizlendi. Mağazalar, kullanıcılar ve araştırmacı kadrosu korundu; mağaza sipariş sayaçları sıfırlandı.",
    });
  });

  console.log("\nTEMİZLİK TAMAMLANDI");
  console.log("  ✅ Demo operasyonel veri silindi, kurumsal yapı korundu.");
  console.log("  ✅ Mağaza sipariş sayaçları (total_orders_count, total_spend) sıfırlandı.");
  console.log("  ✅ Denetim izine kayıt eklendi.");
  console.log("\nSonraki adım: kendi gerçek XLS/Drive verinizi yükleyin.");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nTemizlik başarısız (değişiklik yapılmadı):", err);
  process.exit(1);
});
