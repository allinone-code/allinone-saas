/**
 * Tek seferlik veritabanı seed script'i (T2.4).
 *
 * Kullanım:  DATABASE_URL=... npm run db:seed
 *
 * ÖNEMLİ DEĞİŞİKLİK: Seed artık HTTP route'ları içinden ÇAĞRILMAZ.
 * GET/POST handler'ları salt-okunur/işlevseldir; ilk kurulum ve geliştirme
 * verisi yalnızca bu script ile yüklenir.
 */
import "dotenv/config";
import { ensureCerberusSeeded } from "../src/db/seed";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("HATA: DATABASE_URL tanımlı değil. Önce .env dosyanızı doldurun.");
    process.exit(1);
  }

  console.log("CERBERUS seed başlıyor...");
  await ensureCerberusSeeded();
  console.log("Seed tamamlandı.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed başarısız:", err);
  process.exit(1);
});
