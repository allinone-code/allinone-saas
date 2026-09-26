import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { scrapedProducts, type ScrapedProduct } from "@/db/schema";
import type { ScrapedItem } from "@/lib/crawler/scraper";

/**
 * Fiyat geçmişi kalıcılığı — hem sunucu crawler'ı hem bookmarklet aynı
 * mantığı kullanır.
 *
 * Neden ayrı modül: "indirimi erken görmek" ancak KESİNTİSİZ fiyat serisi
 * varsa çalışır. İki ayrı kod yolu iki ayrı kural demek olurdu ve
 * davranış zamanla ayrışırdı — biri indirimi kaçırırken diğeri sayıyormuş gibi
 * görünür. Tek uygulama, tek doğruluk.
 *
 * Temel kural: her yakalamada yeni satır AÇILMAZ. GTIN bazlı mevcut kayıt
 * güncellenir, böylece aynı ürünün fiyat tarihi parçalanmaz.
 */

export interface PriceDrop {
  title: string;
  from: string;
  to: string;
  pct: number;
}

export interface PersistResult {
  rows: ScrapedProduct[];
  priceDrops: PriceDrop[];
  inserted: number;
  updated: number;
}

export interface PersistInput {
  products: ScrapedItem[];
  sourceDomain: string;
  /**
   * `scrape_jobs` kaydı. Zorunlu: `scraped_products.job_id` bir foreign key,
   * ve her yakalamanın kim tarafından/ne zaman yapıldığı denetim izinde
   * görünmelidir. Bookmarklet yolu da bu yüzden iş kaydı açar.
   */
  jobId: number;
  now?: Date;
}

export async function persistScrapedProducts(input: PersistInput): Promise<PersistResult> {
  const now = input.now ?? new Date();
  const { products, sourceDomain } = input;

  const gtins = products.map((p) => p.gtin).filter((g): g is string => Boolean(g));
  const priorRows = gtins.length
    ? await db
        .select()
        .from(scrapedProducts)
        .where(
          and(inArray(scrapedProducts.gtin, gtins), eq(scrapedProducts.sourceDomain, sourceDomain))
        )
    : [];
  const byGtin = new Map(priorRows.map((row) => [row.gtin as string, row]));

  const toInsert: (typeof scrapedProducts.$inferInsert)[] = [];
  const toUpdate: Array<{ id: number; patch: Partial<typeof scrapedProducts.$inferInsert>; priceDrop: PriceDrop | null }> = [];
  const seenGtin = new Set<string>();

  for (const p of products) {
    const price = p.price !== null ? p.price.toFixed(2) : null;
    const prior = p.gtin ? byGtin.get(p.gtin) : undefined;

    if (prior) {
      // Kesintisiz seri kuralı:
      //  - baseline yoksa bu gözlem tepe olur
      //  - fiyat baseline'ın üstüne çıkarsa yeni tepe (indirim sayacı sıfırlanır)
      //  - fiyat baseline'ın altındaysa ve henüz kaydedilmediyse AN kaydedilir
      const priorBaseline = prior.baselinePrice !== null ? Number(prior.baselinePrice) : null;
      const nextBaseline =
        priorBaseline === null
          ? p.price
          : p.price !== null && p.price > priorBaseline
            ? p.price
            : priorBaseline;

      const crossedBelow = nextBaseline !== null && p.price !== null && p.price < nextBaseline;

      toUpdate.push({
        id: prior.id,
        patch: {
          sourceUrl: p.sourceUrl,
          title: p.title,
          brand: p.brand,
          price,
          currency: p.currency,
          imageUrl: p.imageUrl,
          availability: p.availability,
          asinCandidate: p.asinCandidate,
          sourceSku: p.sourceSku,
          mpn: p.mpn,
          baselinePrice: nextBaseline !== null ? nextBaseline.toFixed(2) : null,
          baselineAt: priorBaseline === null && p.price !== null ? now : prior.baselineAt,
          firstBelowBaselineAt: crossedBelow ? (prior.firstBelowBaselineAt ?? now) : prior.firstBelowBaselineAt,
          lastPriceChangeAt:
            prior.price !== null && price !== null && Number(prior.price) !== p.price
              ? now
              : prior.lastPriceChangeAt,
        },
        priceDrop:
          crossedBelow && prior.price !== null && Number(prior.price) !== p.price
            ? {
                title: p.title,
                from: Number(prior.price).toFixed(2),
                to: (p.price as number).toFixed(2),
                pct: Math.round(((Number(prior.price) - (p.price as number)) / Number(prior.price)) * 100),
              }
            : null,
      });
      continue;
    }

    // Yeni kayıt. GTIN benzersiz index'i var; aynı GTIN bu yakalamada iki kez
    // geçerse ilkini koruruz (Postgres unique index ikinciyi reddetmesin).
    if (p.gtin) {
      if (seenGtin.has(p.gtin)) continue;
      seenGtin.add(p.gtin);
    }
    toInsert.push({
      jobId: input.jobId,
      sourceUrl: p.sourceUrl,
      sourceDomain: p.sourceDomain,
      title: p.title,
      brand: p.brand,
      price,
      currency: p.currency,
      imageUrl: p.imageUrl,
      availability: p.availability,
      asinCandidate: p.asinCandidate,
      sourceSku: p.sourceSku,
      gtin: p.gtin,
      mpn: p.mpn,
      baselinePrice: p.price !== null ? p.price.toFixed(2) : null,
      baselineAt: p.price !== null ? now : null,
      lastPriceChangeAt: now,
      status: "PENDING",
    });
  }

  if (toInsert.length) {
    await db.insert(scrapedProducts).values(toInsert);
  }

  const priceDrops: PriceDrop[] = [];
  for (const update of toUpdate) {
    await db.update(scrapedProducts).set(update.patch).where(eq(scrapedProducts.id, update.id));
    if (update.priceDrop) priceDrops.push(update.priceDrop);
  }

  // Sonuç kümesi: güncellenen + yeni kayıtlar tek listede döner.
  const allGtin = products.map((p) => p.gtin).filter((g): g is string => Boolean(g));
  const rows = allGtin.length
    ? await db
        .select()
        .from(scrapedProducts)
        .where(
          and(inArray(scrapedProducts.gtin, allGtin), eq(scrapedProducts.sourceDomain, sourceDomain))
        )
    : [];

  return { rows, priceDrops, inserted: toInsert.length, updated: toUpdate.length };
}

/** Fiyat düşüşlerini kullanıcıya gösterilecek tek cümleye çevirir. */
export function describePriceDrops(drops: PriceDrop[]): string | null {
  if (!drops.length) return null;
  const shown = drops
    .slice(0, 3)
    .map((d) => `${d.title.slice(0, 40)} $${d.from}→$${d.to} (%${d.pct})`)
    .join(", ");
  return `🔻 ${drops.length} üründe fiyat düştü: ${shown}${drops.length > 3 ? ` +${drops.length - 3} tane daha` : ""}`;
}
