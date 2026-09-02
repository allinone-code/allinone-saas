/**
 * CERBERUS — Sıfırdan Veritabanı Kurulumu (tek komut)
 *
 * Kullanım:
 *   DATABASE_URL=... npm run db:bootstrap            # güvenli mod (veri korunur)
 *   DATABASE_URL=... npm run db:bootstrap -- --reset # HER ŞEYİ SİL, sıfırdan kur
 *
 * Neden ayrı bir betik?
 * Doğru kurulum sırası önemlidir ve elle yapılınca kolayca yanlış gider:
 *
 *   1. migration'lar (şema)
 *   2. geri doldurma (mevcut siparişlerden ürün kataloğu)
 *   3. NOT NULL göçü (ancak 2 bittikten sonra geçebilir)
 *   4. seed (ilk kullanıcı/mağaza verisi)
 *
 * `0003` migration'ı ürüne bağlanmamış sipariş varsa bilinçli olarak durur.
 * Bu betik o durumu önceden görüp geri doldurmayı araya sokar, böylece göç
 * tek seferde ve doğru sırayla tamamlanır.
 */
import "dotenv/config";
import { sql } from "drizzle-orm";

const RESET = process.argv.includes("--reset");
const SKIP_SEED = process.argv.includes("--no-seed");

function step(n: number, title: string) {
  console.log(`\n[${n}/5] ${title}`);
}

/**
 * `db.execute` sürücüye göre farklı şekil döndürür: node-postgres
 * `{ rows: [...] }`, pglite doğrudan dizi. Tek yerde normalize ediyoruz ki
 * bootstrap her iki sürücüde de aynı çalışsın.
 */
function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  const r = (result as { rows?: unknown })?.rows;
  return Array.isArray(r) ? (r as Array<Record<string, unknown>>) : [];
}

function fail(message: string): never {
  console.error(`\nHATA: ${message}`);
  process.exit(1);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    fail("DATABASE_URL tanımlı değil. .env dosyanızı doldurun veya değişkeni verin.");
  }

  const target = url.replace(/:\/\/[^@]*@/, "://<gizli>@");
  console.log("CERBERUS veritabanı kurulumu");
  console.log(`Hedef : ${target}`);
  console.log(`Mod   : ${RESET ? "SIFIRDAN KURULUM (mevcut veri SİLİNİR)" : "güvenli (veri korunur)"}`);

  // Dinamik import: DATABASE_URL doğrulanmadan db modülü yüklenmemeli.
  const { db } = await import("@/db");

  // -------------------------------------------------------------------------
  step(1, RESET ? "Mevcut şema siliniyor" : "Mevcut durum kontrol ediliyor");

  if (RESET) {
    // public şemasını komple düşürmek, tablo sırası/FK bağımlılığı ile
    // uğraşmadan tam temiz bir başlangıç verir.
    await db.execute(sql`drop schema if exists public cascade`);
    await db.execute(sql`create schema public`);
    console.log("      public şeması sıfırlandı.");
  } else {
    const [row] = rowsOf(
      await db.execute(sql`
        select count(*)::int as n
        from information_schema.tables
        where table_schema = 'public'
      `)
    );
    console.log(`      mevcut tablo sayısı: ${row?.n ?? 0}`);
  }

  // -------------------------------------------------------------------------
  step(2, "Şema migration'ları uygulanıyor");

  // Not: drizzle-kit CLI yerine programatik migrator kullanıyoruz ki
  // "0003 durdu" durumunu yakalayıp araya geri doldurmayı sokabilelim.
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");

  try {
    await migrate(db as never, { migrationsFolder: "./drizzle" });
    console.log("      tüm migration'lar uygulandı.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // 0003'ün güvenlik kontrolü: ürüne bağlanmamış sipariş var.
    if (!msg.includes("Gecis durduruldu")) throw err;

    console.log("      0003 durdu: ürüne bağlanmamış siparişler var (beklenen).");

    step(3, "Mevcut siparişlerden ürün kataloğu oluşturuluyor");
    const { applyProductBackfill } = await import("@/db/applyBackfill");
    const result = await applyProductBackfill(db);
    console.log(
      `      ${result.productsCreated} ürün, ${result.offersInserted} fiyat gözlemi, ` +
        `${result.ordersLinked} sipariş bağlandı.`
    );
    if (result.warnings.length > 0) {
      console.log(`      ${result.warnings.length} uyarı (ilk 5):`);
      for (const w of result.warnings.slice(0, 5)) console.log(`        - ${w}`);
    }

    console.log("      migration yeniden deneniyor...");
    await migrate(db as never, { migrationsFolder: "./drizzle" });
    console.log("      tüm migration'lar uygulandı.");
  }

  // -------------------------------------------------------------------------
  step(4, "Veri bütünlüğü doğrulanıyor");

  const [orphans] = rowsOf(
    await db.execute(sql`select count(*)::int as n from orders where product_id is null`)
  );
  const orphanCount = Number(orphans?.n ?? 0);

  if (orphanCount > 0) {
    fail(`${orphanCount} sipariş hâlâ ürüne bağlı değil. Kurulum güvenli değil.`);
  }
  console.log("      yetim sipariş yok — product_id bütünlüğü sağlam.");

  // -------------------------------------------------------------------------
  if (SKIP_SEED) {
    step(5, "Seed atlandı (--no-seed)");
  } else {
    step(5, "Başlangıç verisi yükleniyor");

    if (!process.env.SEED_ADMIN_PASSWORD || !process.env.SEED_STORE_PASSWORD) {
      console.log(
        "      UYARI: SEED_ADMIN_PASSWORD / SEED_STORE_PASSWORD tanımlı değil.\n" +
          "      Varsayılan hesaplar OLUŞTURULMAYACAK (bilinen parolalı hesap açılmaz)."
      );
    }

    const { ensureCerberusSeeded } = await import("@/db/seed");
    await ensureCerberusSeeded();
    console.log("      seed tamamlandı.");
  }

  // -------------------------------------------------------------------------
  const tables = ["stores", "users", "orders", "products", "supplier_offers", "product_lifecycle_events"];
  console.log("\nÖZET");
  for (const t of tables) {
    const [r] = rowsOf(await db.execute(sql.raw(`select count(*)::int as n from ${t}`)));
    console.log(`  ${t.padEnd(26)} ${Number(r?.n ?? 0)}`);
  }

  console.log("\nKurulum tamamlandı.");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nKurulum başarısız:", err);
  process.exit(1);
});
