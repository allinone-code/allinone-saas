/**
 * T7.2 — Saklama politikası raporu (salt-okunur, KURU ÇALIŞTIRMA).
 * Politika: docs/compliance/veri-envanteri.md
 *
 * Kullanım: DATABASE_URL=... npm run retention:report
 *
 * Bu script hiçbir şeyi SİLMEZ; neyin, neden, ne zaman arşivlenmesi/silinmesi
 * gerektiğini listeler. Fiili arşivleme kararı insan onayıyla yapılır.
 */
import "dotenv/config";
import { db } from "../src/db";
import { orders, auditLogs, researchSessions } from "../src/db/schema";
import { lt, count, and, ne } from "drizzle-orm";

const POLICY = {
  auditLogsDays: 365,      // denetim izi: 1 yıl saklandıktan sonra arşiv
  staleOrdersDays: 365,    // tamamlanmış + 1 yıl eskiyen siparişler: arşiv adayı
  researchSessionsDays: 180,
} as const;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log("KVKK Saklama Politikası Raporu (kuru çalıştırma — silme yok)");
  console.log("=".repeat(60));

  const [oldAudit] = await db
    .select({ total: count() })
    .from(auditLogs)
    .where(lt(auditLogs.createdAt, daysAgo(POLICY.auditLogsDays)));

  const [oldOrders] = await db
    .select({ total: count() })
    .from(orders)
    .where(
      and(
        lt(orders.createdAt, daysAgo(POLICY.staleOrdersDays)),
        ne(orders.cargoStatus, "Yolda")
      )
    );

  const [oldSessions] = await db
    .select({ total: count() })
    .from(researchSessions)
    .where(lt(researchSessions.startedAt, daysAgo(POLICY.researchSessionsDays)));

  console.log(`audit_logs > ${POLICY.auditLogsDays} gün (arşiv adayı)      : ${oldAudit.total}`);
  console.log(`orders (tamamlanmış) > ${POLICY.staleOrdersDays} gün        : ${oldOrders.total}`);
  console.log(`research_sessions > ${POLICY.researchSessionsDays} gün      : ${oldSessions.total}`);
  console.log("=".repeat(60));
  console.log("Aksiyon: bu listeler üzerinden arşivleme kararını İNSAN onayıyla alın.");
  console.log("Audit arşivi öncesi: npm run audit:checkpoint (T6.5) çalıştırın.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Rapor başarısız:", err);
  process.exit(1);
});
