/**
 * CERBERUS — Canlıya Alma Ön Kontrolü (Production Preflight)
 *
 * Kullanım:
 *   DATABASE_URL=... SESSION_SECRET=... \
 *   SEED_ADMIN_PASSWORD=... SEED_STORE_PASSWORD=... \
 *   npm run preflight
 *
 * Amaç: Vercel + Neon üzerinde yayına almadan ÖNCE tek komutla "gerçekten hazır
 * mıyız?" sorusunu cevaplamak. Başarısız (FAIL) bulgu varsa süreç 1 koduyla çıkar,
 * böylece CI/deploy betiklerine güvenle bağlanabilir.
 *
 * Kontrol listesi:
 *   1. Ortam değişkenleri (DATABASE_URL, SESSION_SECRET, seed parolaları)
 *   2. Bağlantı tipi (üretimde postgres:// + -pooler host önerisi)
 *   3. DB bağlantısı (SELECT 1)
 *   4. Migration'lar uygulanmış mı
 *   5. Seed verisi (kullanıcı + mağaza) var mı
 *   6. Ürüne bağlanmamış (yetim) sipariş var mı
 *
 * Bu betik SADECE okur — hiçbir şey yazmaz, silmez, değiştirmez.
 */
import "dotenv/config";
import { sql } from "drizzle-orm";

type Severity = "PASS" | "WARN" | "FAIL";
interface Finding {
  severity: Severity;
  check: string;
  detail: string;
}

const findings: Finding[] = [];
const out = (sev: Severity, check: string, detail: string) =>
  findings.push({ severity: sev, check, detail });

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  const r = (result as { rows?: unknown })?.rows;
  return Array.isArray(r) ? (r as Array<Record<string, unknown>>) : [];
}

async function main() {
  const isProd = process.env.NODE_ENV === "production";
  const url = process.env.DATABASE_URL;

  console.log("CERBERUS — Canlıya Alma Ön Kontrolü\n");

  // ── 1. Ortam değişkenleri ──────────────────────────────────────────────
  if (!url) {
    out("FAIL", "DATABASE_URL", "Tanımlı değil. Uygulama açılışta hata verir.");
  } else {
    if (url.startsWith("pglite:")) {
      out(
        isProd ? "FAIL" : "WARN",
        "DATABASE_URL",
        "pglite: sürücüsü yalnızca geliştirme içindir; üretimde postgres:// kullanın."
      );
    } else if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
      out("FAIL", "DATABASE_URL", "Bilinmeyen şema. postgres:// bekleniyordu.");
    } else {
      out("PASS", "DATABASE_URL", "postgres:// bağlantısı tanımlı.");
      if (isProd && !/[-.]pooler[-.]/.test(url)) {
        out(
          "WARN",
          "DATABASE_URL",
          "Üretimde Neon POOLER adresini kullanın (-pooler içeren host). Doğrudan bağlantı serverless'ta limit tüketir."
        );
      }
    }
  }

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    out(
      isProd ? "FAIL" : "WARN",
      "SESSION_SECRET",
      isProd
        ? "Eksik veya 32 karakterden kısa. Üretimde TÜM oturumlar reddedilir (fail-closed). openssl rand -base64 48 üretin."
        : "Eksik veya 32 karakterden kısa. Geliştirmede dev-secret kullanılır; üretimde zorunlu."
    );
  } else {
    out("PASS", "SESSION_SECRET", `${sessionSecret.length} karakter — yeterli.`);
  }

  const adminPw = process.env.SEED_ADMIN_PASSWORD;
  const storePw = process.env.SEED_STORE_PASSWORD;
  if (isProd && (!adminPw || !storePw)) {
    out(
      "WARN",
      "SEED_*_PASSWORD",
      "Üretimde seed parolaları tanımlı değil — varsayılan hesaplar OLUŞTURULMAZ. İlk kurulumda zorunlu."
    );
  }
  if (adminPw && adminPw.length < 12) out("FAIL", "SEED_ADMIN_PASSWORD", "En az 12 karakter olmalı.");
  if (storePw && storePw.length < 12) out("FAIL", "SEED_STORE_PASSWORD", "En az 12 karakter olmalı.");
  if (adminPw && adminPw.length >= 12) out("PASS", "SEED_ADMIN_PASSWORD", "Uzunluk uygun.");
  if (storePw && storePw.length >= 12) out("PASS", "SEED_STORE_PASSWORD", "Uzunluk uygun.");

  if (!url) {
    // DB'ye bağlanmadan kalan kontrolleri raporlayıp çık.
    reportAndExit();
    return;
  }

  // ── 2. DB bağlantısı ve şema durumu ───────────────────────────────────
  const { db } = await import("@/db");
  try {
    await db.execute(sql`select 1`);
    out("PASS", "DB bağlantısı", "SELECT 1 başarılı.");
  } catch (err) {
    out("FAIL", "DB bağlantısı", err instanceof Error ? err.message : String(err));
    reportAndExit();
    return;
  }

  let applied = 0;
  try {
    const mig = rowsOf(
      await db.execute(sql`select hash from drizzle.__drizzle_migrations`)
    );
    applied = mig.length;
    out(
      applied >= 4 ? "PASS" : "FAIL",
      "Migration",
      `${applied}/4 migration uygulanmış${applied >= 4 ? "" : " — npm run db:bootstrap çalıştırın"}.`
    );
  } catch {
    out("FAIL", "Migration", "drizzle.__drizzle_migrations bulunamadı — şema hiç kurulmamış.");
  }

  try {
    const [u] = rowsOf(await db.execute(sql`select count(*)::int as n from users`));
    const [s] = rowsOf(await db.execute(sql`select count(*)::int as n from stores`));
    const users = Number(u?.n ?? 0);
    const stores = Number(s?.n ?? 0);
    out(users > 0 ? "PASS" : "WARN", "Seed: users", `${users} kullanıcı (0 ise giriş yapılamaz).`);
    out(stores > 0 ? "PASS" : "WARN", "Seed: stores", `${stores} mağaza tanımı.`);
  } catch {
    out("WARN", "Seed", "users/stores tablosu okunamadı — şema kurulmamış olabilir.");
  }

  try {
    const [o] = rowsOf(
      await db.execute(sql`select count(*)::int as n from orders where product_id is null`)
    );
    const orphans = Number(o?.n ?? 0);
    out(
      orphans === 0 ? "PASS" : "FAIL",
      "Veri bütünlüğü",
      orphans === 0
        ? "Ürüne bağlanmamış (yetim) sipariş yok."
        : `${orphans} sipariş ürüne bağlı değil — npm run db:bootstrap ile geri doldurun.`
    );
  } catch {
    out("WARN", "Veri bütünlüğü", "orders.product_id kontrolü yapılamadı (şema eksik olabilir).");
  }

  reportAndExit();
}

function reportAndExit() {
  const fails = findings.filter((f) => f.severity === "FAIL").length;
  const warns = findings.filter((f) => f.severity === "WARN").length;

  console.log("\nSONUÇ");
  console.log("─────");
  for (const f of findings) {
    const icon = f.severity === "PASS" ? "✅" : f.severity === "WARN" ? "⚠️ " : "❌";
    console.log(`${icon} [${f.severity}] ${f.check}: ${f.detail}`);
  }

  console.log("\nÖZET");
  console.log(`  ✅ PASS: ${findings.length - fails - warns}   ⚠️ WARN: ${warns}   ❌ FAIL: ${fails}`);

  if (fails > 0) {
    console.log("\n❌ YAYINA HAZIR DEĞİL — yukarıdaki FAIL maddelerini giderin.");
    process.exit(1);
  }
  if (warns > 0) {
    console.log("\n⚠️  UYARILARLA YAYINLANABİLİR — WARN maddelerini gözden geçirin.");
  } else {
    console.log("\n✅ TÜM KONTROLLER GEÇTİ — yayına hazır.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Preflight başarısız (beklenmeyen hata):", err);
  process.exit(2);
});
