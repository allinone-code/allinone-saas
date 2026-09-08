import { NextResponse } from "next/server";
import { db } from "@/db";
import { keepaCache, auditLogs } from "@/db/schema";
import { requireUser, isDenied, resolveStoreScope } from "@/lib/guards";
import { parseBody, keepaAnalyzeSchema } from "@/lib/validation";
import { handleRouteError } from "@/lib/apiResponse";
import { fetchKeepaProduct, summarizeKeepa } from "@/lib/keepa/client";
import { computeKeepaDecision } from "@/domain/keepaDecision";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/keepa/analyze — ASIN için Keepa çek + decision üret
 * Cache-first: 24 saat taze ise DB'den döner.
 */
export async function POST(req: Request) {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;
    const user = gate.user;

    const parsed = await parseBody(req, keepaAnalyzeSchema);
    if ("response" in parsed) return parsed.response;
    const { asin, domain = 1, sourcePrice = 20, sellingPrice = 45, sourceDomain = "amazon.com", duplicateScore = 12 } = parsed.data;

    const normalized = asin.trim().toUpperCase();
    const targetStore = resolveStoreScope(user, null);

    // Cache kontrol
    const cachedRows = await db.select().from(keepaCache).where(and(eq(keepaCache.asin, normalized), eq(keepaCache.domain, domain))).limit(1);
    const now = new Date();
    const isCacheValid = cachedRows.length && new Date(cachedRows[0].expiresAt).getTime() > now.getTime();

    let keepa;
    let fromCache = false;

    if (isCacheValid) {
      const row = cachedRows[0];
      keepa = {
        asin: row.asin,
        domain: row.domain,
        salesRank: row.salesRank,
        amazonPrice: row.amazonPrice ? Number(row.amazonPrice) : null,
        buyBoxPrice: row.buyBoxPrice ? Number(row.buyBoxPrice) : null,
        offerCount: row.offerCount,
        priceHistory: (row.data as Record<string, unknown>)?.priceHistory as Array<{ date: string; price: number }> || [],
        rankHistory: (row.data as Record<string, unknown>)?.rankHistory as Array<{ date: string; rank: number }> || [],
        priceVolatility: (row.data as Record<string, unknown>)?.priceVolatility as number | null || null,
        priceTrendPercent: (row.data as Record<string, unknown>)?.priceTrendPercent as number | null || null,
        isPriceStable: Boolean((row.data as Record<string, unknown>)?.isPriceStable),
        fetchedAt: row.fetchedAt.toISOString(),
        isMock: Boolean((row.data as Record<string, unknown>)?.isMock),
        title: (row.data as Record<string, unknown>)?.title as string | undefined,
        brand: (row.data as Record<string, unknown>)?.brand as string | undefined,
      } as unknown as Awaited<ReturnType<typeof fetchKeepaProduct>>;
      fromCache = true;
    } else {
      try {
        keepa = await fetchKeepaProduct(normalized, domain);
      } catch (e: unknown) {
        const err = e as Error & { status?: number; retryAfter?: string };
        if (err.status === 429) {
          return NextResponse.json({ error: err.message, retryAfter: err.retryAfter }, { status: 429 });
        }
        throw e;
      }

      // Cache'e yaz (upsert)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const payload = {
        asin: keepa.asin,
        domain: keepa.domain,
        data: keepa as unknown as Record<string, unknown>,
        salesRank: keepa.salesRank,
        amazonPrice: keepa.amazonPrice !== null ? keepa.amazonPrice.toFixed(2) : null,
        buyBoxPrice: keepa.buyBoxPrice !== null ? keepa.buyBoxPrice.toFixed(2) : null,
        offerCount: keepa.offerCount,
        fetchedAt: new Date(keepa.fetchedAt),
        expiresAt,
      };
      if (cachedRows.length) {
        await db.update(keepaCache).set(payload).where(eq(keepaCache.id, cachedRows[0].id));
      } else {
        await db.insert(keepaCache).values(payload);
      }
    }

    const decision = computeKeepaDecision({
      sourcePrice: Number(sourcePrice) || 20,
      sellingPrice: Number(sellingPrice) || 45,
      sourceDomain: sourceDomain || keepa.salesRank?.toString() || "amazon.com",
      duplicateScore: Number(duplicateScore) || 12,
      keepa,
    });

    const summary = summarizeKeepa(keepa);

    // Audit (sadece taze çekimlerde, cache hitlerde değil)
    if (!fromCache) {
      await db.insert(auditLogs).values({
        actorName: user.name,
        storeCode: targetStore === "ALL" ? "HRN" : targetStore,
        actionType: "KEEPA_ANALYSIS",
        targetEntity: `${normalized} (${decision.decisionAction})`,
        beforeState: `BSR ${keepa.salesRank ?? "—"} | ${keepa.offerCount ?? "—"} satıcı`,
        afterState: `${decision.decisionAction} ${decision.confidenceScore}%`,
        details: `Keepa: ${summary.demandLabel}, ${summary.competitionLabel}, volatilite %${keepa.priceVolatility !== null ? (keepa.priceVolatility * 100).toFixed(1) : "—"}`,
      });
    }

    return NextResponse.json({
      asin: normalized,
      domain,
      keepa,
      summary,
      decision,
      fromCache,
      cachedUntil: fromCache ? cachedRows[0].expiresAt.toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error: unknown) {
    return handleRouteError("POST /api/keepa/analyze", error);
  }
}

export async function GET(req: Request) {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;
    const { searchParams } = new URL(req.url);
    const asin = (searchParams.get("asin") || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(asin)) {
      return NextResponse.json({ error: "Geçerli bir ASIN girin (10 haneli)." }, { status: 400 });
    }
    const domain = Number(searchParams.get("domain") || 1);
    const rows = await db.select().from(keepaCache).where(and(eq(keepaCache.asin, asin), eq(keepaCache.domain, domain))).limit(1);
    if (!rows.length) return NextResponse.json({ cached: false, asin });
    const r = rows[0];
    const isExpired = new Date(r.expiresAt).getTime() <= Date.now();
    return NextResponse.json({
      cached: true,
      isExpired,
      asin: r.asin,
      domain: r.domain,
      salesRank: r.salesRank,
      amazonPrice: r.amazonPrice,
      buyBoxPrice: r.buyBoxPrice,
      offerCount: r.offerCount,
      fetchedAt: r.fetchedAt,
      expiresAt: r.expiresAt,
      data: r.data,
    });
  } catch (error: unknown) {
    return handleRouteError("GET /api/keepa/analyze", error);
  }
}
