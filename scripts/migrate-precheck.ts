#!/usr/bin/env node
/**
 * Production migration ÖNCESİ güvenlik kontrolü.
 *
 * NEDEN VAR: `drizzle-kit migrate`, migration'ı ledger'da "yapıldı" görüyorsa
 * ATLAR. Eğer bir migration kısmen uygulandıysa (ledger kaydı yazıldı ama tablo
 * oluşmadıysa), `db:migrate` 0012'yi atlayıp 0013'te PATLAR ve durumu daha da
 * karmaşıklaştırır. Bu repo'da tam olarak bu senaryo yaşandı.
 *
 * KULLANIM:
 *   DATABASE_URL="postgresql://..." npm run db:migrate:check
 *   DATABASE_URL="postgresql://..." npm run db:migrate:check -- --apply
 *
 * --apply verilirse güvenli bulunduğunda migration'ı çalıştırır.
 * Tehlikeli bulunursa ÇALIŞMAZ, ne yapılması gerektiğini yazar.
 *
 * GÜVENLİK: bu script ASLA şifre basmaz. Bağlantı dizesinin parçalarını
 * yalnızca host/veritabanı adı için gösterir.
 */

// `.env` yüklenir; ancak shell'de tanımlı DATABASE_URL onu EZER (dotenv varsayılan
// davranışı). Yani `DATABASE_URL=... npm run db:migrate:check` production'a
// giderken, çıplak `npm run db:migrate:check` yerel DB'yi kullanır.
import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

const APPLY = process.argv.includes("--apply");

interface MigrationFile {
  tag: string;
  hash: string;
  path: string;
}

function loadMigrations(): MigrationFile[] {
  const dir = resolve(process.cwd(), "drizzle");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => {
      const sql = readFileSync(resolve(dir, f), "utf8");
      return {
        tag: f.replace(/\.sql$/, ""),
        hash: createHash("sha256").update(sql).digest("hex"),
        path: resolve(dir, f),
      };
    });
}

/**
 * Migration'ın beklenen ŞEMA etkisini çıkarır.
 *
 * Sadece tablo varlığına bakmak YETMEZ: `ALTER TABLE ... ADD COLUMN` türü
 * migration'larda tablo var ama kolon yoksa aynı sessiz 500'e yol açar —
 * kullanıcı hatayı ancak runtime'da görür. Bu yüzden kolonlar da kontrol
 * edilir. (Bu script ilk sürümünde yalnız tabloya bakıyordu ve eksik kolonu
 * "uygulanmış" diye geçiyordu.)
 */
function schemaEffects(sql: string): Array<{ table: string; column: string | null }> {
  const effects: Array<{ table: string; column: string | null }> = [];
  for (const m of sql.matchAll(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"([^"]+)"/gi)) {
    effects.push({ table: m[1], column: null });
  }
  for (const m of sql.matchAll(
    /ALTER TABLE\s+"([^"]+)"\s+ADD COLUMN\s+(?:IF NOT EXISTS\s+)?"?([^"\s(]+)"?/gi
  )) {
    effects.push({ table: m[1], column: m[2] });
  }
  return effects;
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//***:***@${u.hostname}${u.port ? `:${u.port}` : ""}/${u.pathname.replace(/^\//, "")}`;
  } catch {
    return "(ayrıştırılamadı)";
  }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("HATA: DATABASE_URL tanımlı değil.");
    console.error("Bu script'i production URL'i ile çalıştırın:\n");
    console.error('  DATABASE_URL="postgresql://..." npm run db:migrate:check\n');
    process.exit(1);
  }

  console.log("Hedef:", maskUrl(url));
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  if (isLocal) {
    console.log("⚠️  Bu YEREL veritabanı. Production için Neon URL'i kullanın.\n");
  }
  console.log();

  const client = new Client({ connectionString: url, connectionTimeoutMillis: 15_000 });
  try {
    await client.connect();
  } catch (error) {
    console.error("Bağlantı kurulamadı:", error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const problems: string[] = [];
  const fixes: string[] = [];

  // 1) Ledger var mı?
  const ledgerExists = await client
    .query(`SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS ok`)
    .then((r) => r.rows[0]?.ok === true)
    .catch(() => false);

  const applied = new Set<string>();
  if (ledgerExists) {
    const rows = await client.query("SELECT hash FROM drizzle.__drizzle_migrations");
    for (const r of rows.rows) applied.add(r.hash);
  }

  const migrations = loadMigrations();
  console.log(`Migration dosyası: ${migrations.length} | ledger kaydı: ${applied.size}\n`);

  // 2) Her migration için: ledger'da var mı, tablo gerçekten var mı?
  console.log("Kontrol                         | Durum");
  console.log("---------------------------------+--------------------------------");

  for (const m of migrations) {
    const recorded = applied.has(m.hash);
    const effects = schemaEffects(readFileSync(m.path, "utf8"));
    const missing: string[] = [];

    for (const effect of effects) {
      const tableExists = await client
        .query("SELECT to_regclass($1) IS NOT NULL AS ok", [effect.table])
        .then((r) => r.rows[0]?.ok === true)
        .catch(() => false);
      if (!tableExists) {
        missing.push(effect.table);
        continue;
      }
      if (effect.column) {
        const columnExists = await client
          .query(
            `SELECT count(*)::int AS n FROM information_schema.columns
             WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
            [effect.table, effect.column]
          )
          .then((r) => (r.rows[0]?.n ?? 0) > 0)
          .catch(() => false);
        if (!columnExists) missing.push(`${effect.table}.${effect.column}`);
      }
    }

    if (recorded && missing.length) {
      // EN TEHLİKELİ DURUM: ledger "yapıldı" diyor, şema etkisi yok.
      problems.push(`${m.tag}: ledger'da kayıtlı ama eksik → ${missing.join(", ")}`);
      fixes.push(
        `${m.tag} için ledger kaydını silin, sonra migrate çalıştırın:\n` +
          `    DELETE FROM drizzle.__drizzle_migrations WHERE hash = '${m.hash}';`
      );
      console.log(`${m.tag.padEnd(31)} | ⚠️  LEDGER VAR, ŞEMA EKSİK`);
    } else if (missing.length) {
      console.log(`${m.tag.padEnd(31)} | · bekliyor (${missing.join(", ")})`);
    } else if (recorded) {
      console.log(`${m.tag.padEnd(31)} | ✓ uygulanmış`);
    } else {
      console.log(`${m.tag.padEnd(31)} | ? ledger'da yok ama şema etkisi mevcut`);
    }
  }

  await client.end();
  console.log();

  const pending = migrations.filter((m) => !applied.has(m.hash));
  console.log(`Bekleyen migration: ${pending.length} (${pending.map((m) => m.tag).join(", ") || "yok"})`);
  console.log();

  if (problems.length) {
    console.log("❌ GÜVENLİ DEĞİL — otomatik migrate ÇALIŞTIRILMAZ.\n");
    for (const p of problems) console.log(`  • ${p}`);
    console.log("\nÖnce şunları yapın:\n");
    for (const f of fixes) console.log(f);
    console.log("\nSonra tekrar çalıştırın:  npm run db:migrate:check -- --apply");
    process.exit(2);
  }

  if (!pending.length) {
    console.log("✅ Her şey güncel. Migration çalıştırmaya gerek yok.");
    return;
  }

  if (!APPLY) {
    console.log("✅ Güvenli. Migration'ı çalıştırmak için -- --apply ekleyin:");
    console.log(`   DATABASE_URL="postgresql://..." npm run db:migrate:check -- --apply`);
    return;
  }

  console.log("▶ Migration uygulanıyor…\n");
  const { execFileSync } = await import("node:child_process");
  try {
    execFileSync("npx", ["drizzle-kit", "migrate"], { stdio: "inherit" });
    console.log("\n✅ Tamamlandı.");
  } catch {
    console.error("\n❌ Migration BAŞARISIZ. Kontrol edin:  npm run db:migrate:check");
    process.exit(1);
  }
}

void main();
