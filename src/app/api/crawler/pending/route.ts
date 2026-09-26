import { NextResponse } from "next/server";
import { db } from "@/db";
import { scrapeJobs, scrapedProducts } from "@/db/schema";
import { requireUser, isDenied, resolveStoreScope } from "@/lib/guards";
import { handleRouteError } from "@/lib/apiResponse";
import { and, desc, eq } from "drizzle-orm";

/**
 * GET /api/crawler/pending — onay bekleyen yakalamalar
 *
 * NEDEN VAR: eklenti/bookmarklet ürünü `scraped_products`'a yazar ve orada
 * durur. Kullanıcının iş akışı iki aşamalıdır: yakala → onayla → katalog.
 * Onaylanacak listeyi görecek bir yer olmazsa ikinci adım sessizce atlanır ve
 * yakalanan ürünler hiç katalogya girmez.
 *
 * MAĞAZA KAPSAMI: `scraped_products` üzerinde `storeCode` kolonu YOKTUR —
 * aynı kaynak URL iki mağaza için de ilgili olabilir. Bu yüzden kapsam, kaynak
 * işin sahibi (`scrape_jobs.storeCode`) üzerinden JOIN ile uygulanır. Bu JOIN
 * olmadan STORE_USER başka mağazanın yakalamalarını görebilirdi.
 */
export async function GET(req: Request) {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;
    const user = gate.user;

    const { searchParams } = new URL(req.url);
    const storeCode = resolveStoreScope(user, searchParams.get("storeCode") || "ALL");
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 100));

    const rows = await db
      .select({
        product: scrapedProducts,
        storeCode: scrapeJobs.storeCode,
      })
      .from(scrapedProducts)
      .innerJoin(scrapeJobs, eq(scrapeJobs.id, scrapedProducts.jobId))
      .where(
        storeCode === "ALL"
          ? eq(scrapedProducts.status, "PENDING")
          : and(eq(scrapedProducts.status, "PENDING"), eq(scrapeJobs.storeCode, storeCode))
      )
      .orderBy(desc(scrapedProducts.discoveredAt))
      .limit(limit);

    const items = rows.map(({ product: r }) => {
      const price = r.price !== null ? Number(r.price) : null;
      const baseline = r.baselinePrice !== null ? Number(r.baselinePrice) : null;
      // "Şimdi indirimde" = fiyat, kendi tepe fiyatının altında. Tek taramada
      // gördüğümüz `offers.highPrice` ile değil; tepe, ancak geçmişte
      // oluşmuşsa anlamlıdır.
      const isBelowBaseline = price !== null && baseline !== null && price < baseline;
      const discountPct =
        isBelowBaseline && baseline !== null && price !== null
          ? Math.round(((baseline - price) / baseline) * 100)
          : null;
      return {
        id: r.id,
        title: r.title,
        brand: r.brand,
        price,
        currency: r.currency,
        imageUrl: r.imageUrl,
        availability: r.availability,
        gtin: r.gtin,
        sourceSku: r.sourceSku,
        mpn: r.mpn,
        asinCandidate: r.asinCandidate,
        sourceUrl: r.sourceUrl,
        sourceDomain: r.sourceDomain,
        baselinePrice: baseline,
        firstBelowBaselineAt: r.firstBelowBaselineAt,
        discoveredAt: r.discoveredAt,
        isBelowBaseline,
        discountPct,
      };
    });

    return NextResponse.json({
      storeScope: storeCode,
      count: items.length,
      // Amazon eşleştirmesi yalnız GTIN ile mümkün. GTIN olmayan satır
      // katalogya girse bile Amazon'daki karşılığı bulunamaz; kullanıcıya
      // katalog eklemeden ÖNCE bunu söylemek gerekir.
      withoutGtin: items.filter((i) => !i.gtin).length,
      discounted: items.filter((i) => i.isBelowBaseline).length,
      items,
    });
  } catch (error: unknown) {
    return handleRouteError("GET /api/crawler/pending", error);
  }
}
