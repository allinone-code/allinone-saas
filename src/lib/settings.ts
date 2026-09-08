import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface ThresholdConfig {
  rejectRoi: number; // < reject → REJECT (varsayılan 25)
  testRoi: number;   // < test → TEST, üzeri BUY (varsayılan 38)
}

const DEFAULTS: ThresholdConfig = { rejectRoi: 25, testRoi: 38 };

export async function getThresholds(): Promise<ThresholdConfig> {
  try {
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, "roi_thresholds"));
    // also support legacy separate keys
    if (!rows.length) {
      const r1 = await db.select().from(appSettings).where(eq(appSettings.key, "roi_reject"));
      const r2 = await db.select().from(appSettings).where(eq(appSettings.key, "roi_test"));
      if (r1.length || r2.length) {
        const rej = r1.length ? Number(r1[0].value) : DEFAULTS.rejectRoi;
        const tst = r2.length ? Number(r2[0].value) : DEFAULTS.testRoi;
        if (Number.isFinite(rej) && Number.isFinite(tst)) return { rejectRoi: rej, testRoi: tst };
      }
      return DEFAULTS;
    }
    const v = JSON.parse(rows[0].value) as Partial<ThresholdConfig>;
    const rejectRoi = Number(v.rejectRoi);
    const testRoi = Number(v.testRoi);
    return {
      rejectRoi: Number.isFinite(rejectRoi) ? rejectRoi : DEFAULTS.rejectRoi,
      testRoi: Number.isFinite(testRoi) ? testRoi : DEFAULTS.testRoi,
    };
  } catch {
    return DEFAULTS;
  }
}

export async function getKeepaKey(): Promise<string | null> {
  // Öncelik: Vercel env → DB settings → null (mock)
  if (process.env.KEEPA_API_KEY?.trim()) return process.env.KEEPA_API_KEY.trim();
  try {
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, "keepa_api_key"));
    if (rows.length && rows[0].value.trim()) return rows[0].value.trim();
  } catch {}
  return null;
}

export async function setSetting(key: string, value: string, actor: string) {
  const existing = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  if (existing.length) {
    await db.update(appSettings).set({ value, updatedBy: actor, updatedAt: new Date() }).where(eq(appSettings.key, key));
  } else {
    await db.insert(appSettings).values({ key, value, updatedBy: actor });
  }
}
