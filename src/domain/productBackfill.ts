/**
 * CERBERUS — Ürün Geri Doldurma (Backfill) Motoru
 *
 * AŞAMA 1.1: Mevcut `orders` satırlarından ürün merkezli çekirdeği türetir.
 *
 * Neden saf bir modül?
 * Geri doldurma, veritabanına dokunmadan test edilebilmelidir. Bu dosya
 * yalnızca "hangi satırlardan hangi ürün ve hangi fiyat gözlemleri çıkar"
 * sorusunu cevaplar; yazma işini çağıran katman yapar.
 *
 * Çözdüğü denetim bulguları (docs/audit/04):
 *   B-01  ürün alanları %50.8 tekrar ediyordu → tek `products` satırı
 *   B-02  fiyat zaman serisi JSONB'de gömülüydü → `supplier_offers` satırları
 *   B-03  orders ↔ ürün bağı metinseldi → FK için productId eşlemesi
 */

/** Geri doldurmaya giren ham sipariş satırı (orders tablosundan) */
export interface BackfillOrderRow {
  id: number;
  asin: string;
  productTitle: string;
  brandName: string;
  imageUrl: string | null;
  amazonUrl: string | null;
  supplierName: string;
  supplierCode: string | null;
  supplierUrl: string | null;
  unitCost: string | number;
  packCount: number;
  isFragile: string;
  isMultiPack: string;
  isBundle: string;
  countPerBundle: number | null;
  orderDate: string;
  /** Satırın ait olduğu ürünün yaşam döngüsü ipucu */
  pshStatus: string;
  inventoryLabStatus: string;
  shippedToAmazon: number;
}

export interface DerivedProduct {
  asin: string;
  title: string;
  brand: string;
  category: string;
  imageUrl: string | null;
  amazonUrl: string | null;
  isFragile: boolean;
  isMultiPack: boolean;
  isBundle: boolean;
  countPerBundle: number | null;
  packCount: number;
  lifecycleStage: string;
  discoveredAt: Date;
  /** Bu üründen türeyen sipariş satırı id'leri — FK geri doldurması için */
  sourceOrderIds: number[];
}

export interface DerivedOffer {
  asin: string;
  supplierName: string;
  supplierCode: string | null;
  sourceUrl: string | null;
  sourceDomain: string | null;
  unitPrice: string;
  observedAt: Date;
  sourceType: "MIGRATION";
}

export interface BackfillResult {
  products: DerivedProduct[];
  offers: DerivedOffer[];
  /** Uyarılar: veri kalitesi sorunları sessizce yutulmaz */
  warnings: string[];
  stats: {
    inputRows: number;
    uniqueProducts: number;
    offersCreated: number;
    duplicateOffersSkipped: number;
    rowsWithoutAsin: number;
  };
}

const YES = (v: unknown) => String(v ?? "").trim().toUpperCase() === "YES";

/** URL'den alan adını güvenle çıkarır; bozuk URL çökme sebebi olmamalı */
export function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Sipariş satırlarının operasyonel durumundan ürünün yaşam döngüsü durağını
 * çıkarır. En ileri durak kazanır: bir ürün bir kez satışa çıktıysa,
 * sonraki bir siparişi "bekliyor" olsa bile ürün SELLING'dedir.
 */
export function inferLifecycleStage(rows: BackfillOrderRow[]): string {
  let best = 0;
  const rank: Record<string, number> = {
    PURCHASING: 1,
    IN_WAREHOUSE: 2,
    LISTED: 3,
    SELLING: 4,
  };
  const stages = ["PURCHASING", "IN_WAREHOUSE", "LISTED", "SELLING"];

  for (const r of rows) {
    let stage = "PURCHASING";
    if (r.inventoryLabStatus === "AKTIF_SATISTA") stage = "SELLING";
    else if (r.inventoryLabStatus === "GIRILDI") stage = "LISTED";
    else if (r.pshStatus === "AMAZONA_SEVK" || r.shippedToAmazon > 0) stage = "LISTED";
    else if (r.pshStatus === "DEPO_SAYILDI") stage = "IN_WAREHOUSE";

    best = Math.max(best, rank[stage] ?? 1);
  }

  return stages[best - 1] ?? "PURCHASING";
}

/**
 * Ana geri doldurma dönüşümü.
 *
 * Çakışma politikası (B-02'de ölçülen gerçek durum): aynı ASIN farklı
 * satırlarda farklı başlık/maliyet taşıyabilir.
 *   - Başlık/marka gibi kimlik alanları: EN UZUN metin kazanır (en bilgili
 *     kayıt genellikle en eksiksiz olanıdır) ve fark varsa uyarı üretilir.
 *   - Fiyat: çakışma DEĞİLDİR — her biri ayrı bir zaman gözlemidir. Hepsi
 *     supplier_offers'a yazılır. Kaybedilen bilgi buydu.
 */
export function backfillProductsFromOrders(rows: BackfillOrderRow[]): BackfillResult {
  const warnings: string[] = [];
  const byAsin = new Map<string, BackfillOrderRow[]>();
  let rowsWithoutAsin = 0;

  for (const r of rows) {
    const asin = String(r.asin || "").trim().toUpperCase();
    if (!asin) {
      rowsWithoutAsin++;
      warnings.push(`Sipariş #${r.id}: ASIN boş — ürüne bağlanamadı.`);
      continue;
    }
    const bucket = byAsin.get(asin);
    if (bucket) bucket.push(r);
    else byAsin.set(asin, [r]);
  }

  const products: DerivedProduct[] = [];
  const offers: DerivedOffer[] = [];
  let duplicateOffersSkipped = 0;

  for (const [asin, group] of byAsin) {
    // Kimlik alanlarında en bilgili kaydı seç
    const titles = [...new Set(group.map((r) => (r.productTitle || "").trim()).filter(Boolean))];
    const brands = [...new Set(group.map((r) => (r.brandName || "").trim()).filter(Boolean))];

    if (titles.length > 1) {
      warnings.push(
        `${asin}: ${titles.length} farklı başlık bulundu; en uzun olan seçildi.`
      );
    }
    if (brands.length > 1) {
      warnings.push(`${asin}: ${brands.length} farklı marka bulundu: ${brands.join(" / ")}`);
    }

    const title =
      titles.sort((a, b) => b.length - a.length)[0] || `Ürün ${asin}`;
    const brand = brands.sort((a, b) => b.length - a.length)[0] || "General";

    const first = group[0];
    const dates = group
      .map((r) => new Date(r.orderDate))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    products.push({
      asin,
      title,
      brand: brand.toUpperCase(),
      category: "UNCATEGORIZED",
      imageUrl: group.find((r) => r.imageUrl)?.imageUrl ?? null,
      amazonUrl: group.find((r) => r.amazonUrl)?.amazonUrl ?? null,
      isFragile: group.some((r) => YES(r.isFragile)),
      isMultiPack: group.some((r) => YES(r.isMultiPack)),
      isBundle: group.some((r) => YES(r.isBundle)),
      countPerBundle: group.find((r) => r.countPerBundle)?.countPerBundle ?? null,
      packCount: Math.max(1, ...group.map((r) => Number(r.packCount) || 1)),
      lifecycleStage: inferLifecycleStage(group),
      discoveredAt: dates[0] ?? new Date(),
      sourceOrderIds: group.map((r) => r.id),
    });

    // --- Fiyat zaman serisi ---
    // Aynı (tarih, tedarikçi, fiyat) üçlüsü tekrar ediyorsa tek gözlem sayılır;
    // farklı fiyat AYRI gözlemdir — B-02'de kaybolan bilgi tam olarak buydu.
    const seen = new Set<string>();
    for (const r of group) {
      const price = Number(String(r.unitCost).replace(",", ".")) || 0;
      const observedAt = new Date(r.orderDate);
      if (Number.isNaN(observedAt.getTime())) continue;

      const key = `${observedAt.toISOString().slice(0, 10)}|${r.supplierName}|${price.toFixed(2)}`;
      if (seen.has(key)) {
        duplicateOffersSkipped++;
        continue;
      }
      seen.add(key);

      offers.push({
        asin,
        supplierName: r.supplierName || "BİLİNMEYEN",
        supplierCode: r.supplierCode ?? null,
        sourceUrl: r.supplierUrl ?? null,
        sourceDomain: extractDomain(r.supplierUrl),
        unitPrice: price.toFixed(2),
        observedAt,
        sourceType: "MIGRATION",
      });
    }
  }

  return {
    products,
    offers,
    warnings,
    stats: {
      inputRows: rows.length,
      uniqueProducts: products.length,
      offersCreated: offers.length,
      duplicateOffersSkipped,
      rowsWithoutAsin,
    },
  };
}

/**
 * Fiyat trendi — B-02'nin asıl kazancı.
 *
 * Aynı ürünün zaman içindeki maliyet gözlemlerinden yön çıkarır. Bu hesap
 * eskiden İMKÂNSIZDI: fiyat geçmişi JSONB içinde gömülüydü.
 */
export interface PriceTrend {
  direction: "FALLING" | "RISING" | "STABLE" | "UNKNOWN";
  changePercent: number | null;
  firstPrice: number | null;
  latestPrice: number | null;
  observationCount: number;
  /** Arbitraj sinyali: maliyet anlamlı düştüyse tekrar alım fırsatı */
  isBuyingOpportunity: boolean;
}

export function computePriceTrend(
  observations: Array<{ unitPrice: string | number; observedAt: Date | string }>
): PriceTrend {
  const sorted = observations
    .map((o) => ({
      price: Number(o.unitPrice) || 0,
      at: o.observedAt instanceof Date ? o.observedAt : new Date(o.observedAt),
    }))
    .filter((o) => !Number.isNaN(o.at.getTime()))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  if (sorted.length === 0) {
    return {
      direction: "UNKNOWN",
      changePercent: null,
      firstPrice: null,
      latestPrice: null,
      observationCount: 0,
      isBuyingOpportunity: false,
    };
  }

  const firstPrice = sorted[0].price;
  const latestPrice = sorted[sorted.length - 1].price;

  if (sorted.length === 1 || firstPrice === 0) {
    return {
      direction: sorted.length === 1 ? "UNKNOWN" : "STABLE",
      changePercent: null,
      firstPrice,
      latestPrice,
      observationCount: sorted.length,
      isBuyingOpportunity: false,
    };
  }

  const changePercent = Number((((latestPrice - firstPrice) / firstPrice) * 100).toFixed(2));

  // ±2 puanlık bant gürültü sayılır; her kuruş oynaması sinyal değildir.
  const direction =
    Math.abs(changePercent) < 2 ? "STABLE" : changePercent < 0 ? "FALLING" : "RISING";

  return {
    direction,
    changePercent,
    firstPrice,
    latestPrice,
    observationCount: sorted.length,
    // %5'ten fazla düşüş = anlamlı arbitraj fırsatı
    isBuyingOpportunity: changePercent <= -5,
  };
}
