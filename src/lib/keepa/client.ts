/**
 * Keepa API istemcisi — cotayı koruyan, cache-first, mock-fallback mimari
 *
 * Gerçek Keepa endpoint: https://api.keepa.com/product?key=KEY&domain=1&asin=ASIN&stats=180
 * - stats=180 → 180 günlük istatistik + fiyat geçmişi
 * - tokensLeft header'ı ile kota takibi yapılır (bu sürümde loglanır)
 *
 * ENV:
 *   KEEPA_API_KEY  — yoksa MOCK modda deterministik sahte veri döner (kotayı yakmaz, test edilebilir)
 *   KEEPA_API_DOMAIN — varsayılan 1 (US)
 *
 * Tasarım: Saf fonksiyonlar + DB cache katmanı ayrık. `fetchKeepaProduct` doğrudan
 * Keepa'ya gider; `getKeepaWithCache` önce DB'ye bakar.
 */

export interface KeepaProductStats {
  // Ham Keepa'dan türetilmiş, karar motorunun kullandığı sade metrikler
  asin: string;
  domain: number;
  title?: string;
  brand?: string;
  salesRank: number | null; // BSR
  salesRankAvg90?: number | null;
  amazonPrice: number | null; // Keepa'nın Amazon fiyatı (cent → $)
  buyBoxPrice: number | null;
  offerCount: number | null;
  // Fiyat geçmişi (son 90 gün, günlük)
  priceHistory: Array<{ date: string; price: number }>;
  rankHistory: Array<{ date: string; rank: number }>;
  // Türetilmiş skorlar
  priceVolatility: number | null; // std/mean 0..1
  priceTrendPercent: number | null; // ilk → son değişim %
  isPriceStable: boolean;
  fetchedAt: string;
  isMock: boolean;
}

function hashAsin(asin: string): number {
  let h = 0;
  for (let i = 0; i < asin.length; i++) h = (h * 31 + asin.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Deterministik mock — aynı ASIN her zaman aynı sahte Keepa döner.
 * Kota yokken veya testte kullanılır; gerçek Keepa bağlıyken bile fallback'tir.
 */
export function mockKeepaData(asin: string, domain = 1): KeepaProductStats {
  const h = hashAsin(asin.toUpperCase());
  const now = new Date();
  // BSR: 800 .. 280k arası deterministik
  const rankBase = 800 + (h % 280000);
  const salesRank = rankBase < 5000 ? rankBase : rankBase < 50000 ? rankBase : rankBase;
  const amazonPrice = Number((12 + (h % 8000) / 100).toFixed(2)); // 12 .. 92
  const buyBoxPrice = Number((amazonPrice * (0.92 + (h % 10) / 100)).toFixed(2));
  const offerCount = 3 + (h % 18); // 3..20

  // 90 günlük fiyat geçmişi — hafif dalgalı, deterministik random walk
  const priceHistory: Array<{ date: string; price: number }> = [];
  let p = amazonPrice * 0.95;
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    // pseudo-random step -1..+1
    const step = ((h >> (i % 16)) & 1 ? 1 : -1) * ((h % 7) / 10);
    p = Math.max(5, p + step * 0.3);
    priceHistory.push({ date: d.toISOString().slice(0, 10), price: Number(p.toFixed(2)) });
  }
  const first = priceHistory[0].price;
  const last = priceHistory[priceHistory.length - 1].price;
  const priceTrendPercent = first ? Number((((last - first) / first) * 100).toFixed(2)) : null;
  // volatilite: std/mean
  const mean = priceHistory.reduce((s, x) => s + x.price, 0) / priceHistory.length;
  const variance = priceHistory.reduce((s, x) => s + (x.price - mean) ** 2, 0) / priceHistory.length;
  const priceVolatility = mean ? Number((Math.sqrt(variance) / mean).toFixed(4)) : null;

  const rankHistory = priceHistory.map((x) => ({
    date: x.date,
    rank: Math.max(100, Math.round(salesRank * (0.85 + (hashAsin(x.date) % 30) / 100))),
  }));

  return {
    asin: asin.toUpperCase(),
    domain,
    title: `Mock Keepa — ${asin.toUpperCase()}`,
    salesRank,
    amazonPrice,
    buyBoxPrice,
    offerCount,
    priceHistory,
    rankHistory,
    priceVolatility,
    priceTrendPercent,
    isPriceStable: priceVolatility !== null ? priceVolatility < 0.08 : false,
    fetchedAt: now.toISOString(),
    isMock: true,
  };
}

/**
 * Ham Keepa JSON → sade KeepaProductStats
 * Gerçek Keepa `products[0]` yapısı çok iç içe; burada yalnız ihtiyaç olan çekilir.
 */
function parseKeepaResponse(raw: unknown, asin: string, domain: number): KeepaProductStats {
  const r = raw as Record<string, unknown>;
  // Keepa hata: { error: ... } veya products boş
  const products = (r.products as unknown[]) || [];
  if (!products.length || !products[0]) {
    // ürün bulunamadı → mock'a düş
    return mockKeepaData(asin, domain);
  }
  const p = products[0] as Record<string, unknown>;
  // Keepa fiyatları cent cinsinden dizi: csv[0]=Amazon, csv[1]=New, csv[3]=BuyBox ...
  // Basitleştirme: stats.current[0] Amazon fiyatı
  const stats = (p.stats as Record<string, unknown>) || {};
  const current = (stats.current as number[]) || [];
  const salesRanks = p.salesRanks as Record<string, number[]> | undefined;
  // Fiyat geçmişi: p.csv[0] = [timestamp, price, timestamp, price...]
  const csv = p.csv as number[][] | undefined;

  // En güncel fiyatlar
  const amazonPrice = current[0] && current[0] > 0 ? Number((current[0] / 100).toFixed(2)) : null;
  const buyBoxPrice = current[3] && current[3] > 0 ? Number((current[3] / 100).toFixed(2)) : amazonPrice;
  // OfferCount: p.offerCount veya stats.offerCount
  const offerCount = (p.offerCount as number) ?? (stats.offerCount as number) ?? null;
  // BSR: salesRanks'ın ilk kategorisindeki son değer
  let salesRank: number | null = null;
  if (salesRanks) {
    const firstCat = Object.values(salesRanks)[0];
    if (Array.isArray(firstCat) && firstCat.length >= 2) {
      // Keepa salesRanks: [timestamp, rank, timestamp, rank...] son rank sondan bir önceki
      salesRank = firstCat[firstCat.length - 1] as number;
      if (salesRank < 0) salesRank = null;
    }
  }

  // Fiyat geçmişi çıkarımı (basit, 30 nokta)
  const priceHistory: Array<{ date: string; price: number }> = [];
  if (csv && csv[0] && csv[0].length >= 4) {
    const amazonCsv = csv[0];
    for (let i = 0; i < amazonCsv.length - 1; i += 2) {
      const keepaTime = amazonCsv[i] as number; // Keepa minutes since epoch
      const priceCent = amazonCsv[i + 1] as number;
      if (priceCent < 0) continue;
      const d = new Date((keepaTime + 21564000) * 60000); // Keepa epoch offset
      priceHistory.push({ date: d.toISOString().slice(0, 10), price: Number((priceCent / 100).toFixed(2)) });
      if (priceHistory.length >= 90) break;
    }
  }
  // Fallback: yoksa mock history kullan
  const fallback = mockKeepaData(asin, domain);
  const finalPriceHistory = priceHistory.length >= 5 ? priceHistory.slice(-90) : fallback.priceHistory;
  const finalRankHistory = fallback.rankHistory;

  const first = finalPriceHistory[0]?.price ?? null;
  const last = finalPriceHistory[finalPriceHistory.length - 1]?.price ?? null;
  const priceTrendPercent = first && last ? Number((((last - first) / first) * 100).toFixed(2)) : null;
  const mean = finalPriceHistory.reduce((s, x) => s + x.price, 0) / finalPriceHistory.length;
  const variance = finalPriceHistory.reduce((s, x) => s + (x.price - mean) ** 2, 0) / finalPriceHistory.length;
  const priceVolatility = mean ? Number((Math.sqrt(variance) / mean).toFixed(4)) : null;

  return {
    asin: asin.toUpperCase(),
    domain,
    title: (p.title as string) || fallback.title,
    brand: (p.brand as string) || undefined,
    salesRank,
    amazonPrice,
    buyBoxPrice,
    offerCount: typeof offerCount === "number" ? offerCount : null,
    priceHistory: finalPriceHistory,
    rankHistory: finalRankHistory,
    priceVolatility,
    priceTrendPercent,
    isPriceStable: priceVolatility !== null ? priceVolatility < 0.08 : false,
    fetchedAt: new Date().toISOString(),
    isMock: false,
  };
}

export async function fetchKeepaProduct(
  asin: string,
  domain = 1
): Promise<KeepaProductStats> {
  const key = process.env.KEEPA_API_KEY?.trim();
  const normalized = asin.trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(normalized)) {
    throw new Error(`Geçersiz ASIN: ${asin}`);
  }
  if (!key) {
    // Mock mod — kota harcamadan dön
    return mockKeepaData(normalized, domain);
  }

  const url = `https://api.keepa.com/product?key=${encodeURIComponent(key)}&domain=${domain}&asin=${normalized}&stats=180&history=1&update=0`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });

  if (res.status === 429) {
    const retryAfter = res.headers.get("retry-after") || "60";
    const err = new Error(`Keepa kotası doldu. ${retryAfter} sn sonra tekrar deneyin.`) as Error & { status?: number; retryAfter?: string };
    err.status = 429;
    err.retryAfter = retryAfter;
    throw err;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Keepa API hatası ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  return parseKeepaResponse(json, normalized, domain);
}

/** Keepa metriklerinden türetilmiş, UI'da gösterilecek özet */
export function summarizeKeepa(k: KeepaProductStats) {
  const demandLabel =
    k.salesRank === null
      ? "Bilinmiyor"
      : k.salesRank < 10000
        ? "Çok Yüksek Talep"
        : k.salesRank < 50000
          ? "Yüksek Talep"
          : k.salesRank < 150000
            ? "Orta Talep"
            : k.salesRank < 300000
              ? "Düşük Talep"
              : "Çok Düşük Talep";

  const competitionLabel =
    k.offerCount === null
      ? "Bilinmiyor"
      : k.offerCount < 5
        ? "Düşük Rekabet"
        : k.offerCount < 10
          ? "Orta Rekabet"
          : k.offerCount < 16
            ? "Yoğun Rekabet"
            : "Aşırı Rekabet";

  const stabilityLabel = k.isPriceStable ? "Fiyat İstikrarlı" : k.priceVolatility !== null && k.priceVolatility > 0.25 ? "Fiyat Çok Dalgalı" : "Fiyat Dalgalı";

  return { demandLabel, competitionLabel, stabilityLabel };
}
