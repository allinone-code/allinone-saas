import { describe, it, expect } from "vitest";
import {
  backfillProductsFromOrders,
  computePriceTrend,
  extractDomain,
  inferLifecycleStage,
  type BackfillOrderRow,
} from "./productBackfill";

let nextId = 1;
function row(over: Partial<BackfillOrderRow> = {}): BackfillOrderRow {
  return {
    id: nextId++,
    asin: "B0TEST0001",
    productTitle: "Test Ürün",
    brandName: "TestBrand",
    imageUrl: "https://img.example/1.jpg",
    amazonUrl: "https://www.amazon.com/dp/B0TEST0001",
    supplierName: "THE VITAMINSHOPPE",
    supplierCode: "A198",
    supplierUrl: "https://www.vitaminshoppe.com/p/x",
    unitCost: "10.00",
    packCount: 1,
    isFragile: "NO",
    isMultiPack: "NO",
    isBundle: "NO",
    countPerBundle: null,
    orderDate: "2026-01-21",
    pshStatus: "BEKLIYOR",
    inventoryLabStatus: "GIRILMEDI",
    shippedToAmazon: 0,
    ...over,
  };
}

describe("backfillProductsFromOrders — tekrarı ürüne dönüştürür (B-01)", () => {
  it("aynı ASIN'li 5 satır TEK ürüne indirgenir", () => {
    const rows = Array.from({ length: 5 }, () => row());
    const r = backfillProductsFromOrders(rows);
    expect(r.stats.inputRows).toBe(5);
    expect(r.stats.uniqueProducts).toBe(1);
    expect(r.products[0].asin).toBe("B0TEST0001");
  });

  it("ASIN büyük harfe normalize edilir ve boşluk kırpılır", () => {
    const r = backfillProductsFromOrders([row({ asin: "  b0test0001 " })]);
    expect(r.products[0].asin).toBe("B0TEST0001");
  });

  it("ASIN'i olmayan satır ürüne bağlanmaz ve uyarı üretir", () => {
    const r = backfillProductsFromOrders([row({ asin: "" }), row()]);
    expect(r.stats.rowsWithoutAsin).toBe(1);
    expect(r.stats.uniqueProducts).toBe(1);
    expect(r.warnings.some((w) => w.includes("ASIN boş"))).toBe(true);
  });

  it("farklı başlıklarda en bilgili (en uzun) olan seçilir ve uyarılır", () => {
    const r = backfillProductsFromOrders([
      row({ productTitle: "Kısa" }),
      row({ productTitle: "Çok daha ayrıntılı ve eksiksiz ürün başlığı" }),
    ]);
    expect(r.products[0].title).toBe("Çok daha ayrıntılı ve eksiksiz ürün başlığı");
    expect(r.warnings.some((w) => w.includes("farklı başlık"))).toBe(true);
  });

  it("fiziksel nitelikler OR mantığıyla birleşir (biri kırılgansa ürün kırılgandır)", () => {
    const r = backfillProductsFromOrders([
      row({ isFragile: "NO" }),
      row({ isFragile: "YES" }),
    ]);
    expect(r.products[0].isFragile).toBe(true);
  });

  it("discoveredAt en ERKEN sipariş tarihidir", () => {
    const r = backfillProductsFromOrders([
      row({ orderDate: "2026-03-15" }),
      row({ orderDate: "2026-01-02" }),
    ]);
    expect(r.products[0].discoveredAt.toISOString().slice(0, 10)).toBe("2026-01-02");
  });

  it("kaynak sipariş id'leri korunur (FK geri doldurması için)", () => {
    const a = row();
    const b = row();
    const r = backfillProductsFromOrders([a, b]);
    expect(r.products[0].sourceOrderIds).toEqual([a.id, b.id]);
  });

  it("farklı ASIN'ler ayrı ürün olur", () => {
    const r = backfillProductsFromOrders([
      row({ asin: "B0AAA" }),
      row({ asin: "B0BBB" }),
    ]);
    expect(r.stats.uniqueProducts).toBe(2);
  });
});

describe("Fiyat zaman serisi — kaybolan bilgi geri kazanılır (B-02)", () => {
  it("aynı ürünün FARKLI fiyatları ayrı gözlem olarak saklanır", () => {
    // Gerçek veriden: B0DGQX1FS7 iki günde $29.99 -> $26.24
    const r = backfillProductsFromOrders([
      row({ asin: "B0DGQX1FS7", orderDate: "2026-02-11", unitCost: "29.99" }),
      row({ asin: "B0DGQX1FS7", orderDate: "2026-02-13", unitCost: "26.24" }),
    ]);
    expect(r.stats.uniqueProducts).toBe(1);
    expect(r.offers).toHaveLength(2);
    expect(r.offers.map((o) => o.unitPrice).sort()).toEqual(["26.24", "29.99"]);
  });

  it("aynı gün + aynı tedarikçi + aynı fiyat tek gözlem sayılır", () => {
    const r = backfillProductsFromOrders([
      row({ orderDate: "2026-01-21", unitCost: "46.36" }),
      row({ orderDate: "2026-01-21", unitCost: "46.36" }),
      row({ orderDate: "2026-01-21", unitCost: "46.36" }),
    ]);
    expect(r.offers).toHaveLength(1);
    expect(r.stats.duplicateOffersSkipped).toBe(2);
  });

  it("bir kuruşluk fark bile ayrı gözlemdir (veri kaybı olmaz)", () => {
    // Gerçek veriden: B01CQ3E6HG 34.26 -> 34.27
    const r = backfillProductsFromOrders([
      row({ orderDate: "2026-01-21", unitCost: "34.26" }),
      row({ orderDate: "2026-01-23", unitCost: "34.27" }),
    ]);
    expect(r.offers).toHaveLength(2);
  });

  it("tedarikçi alan adı URL'den çıkarılır", () => {
    const r = backfillProductsFromOrders([row()]);
    expect(r.offers[0].sourceDomain).toBe("vitaminshoppe.com");
  });

  it("virgüllü ondalık ayraç normalize edilir", () => {
    const r = backfillProductsFromOrders([row({ unitCost: "23,99" })]);
    expect(r.offers[0].unitPrice).toBe("23.99");
  });
});

describe("computePriceTrend — arbitraj sinyali", () => {
  it("düşen fiyat FALLING ve alım fırsatı olarak işaretlenir", () => {
    const t = computePriceTrend([
      { unitPrice: 29.99, observedAt: "2026-02-11" },
      { unitPrice: 26.24, observedAt: "2026-02-13" },
    ]);
    expect(t.direction).toBe("FALLING");
    expect(t.changePercent).toBeCloseTo(-12.5, 1);
    expect(t.isBuyingOpportunity).toBe(true);
  });

  it("yükselen fiyat RISING, fırsat değildir", () => {
    const t = computePriceTrend([
      { unitPrice: 20, observedAt: "2026-01-01" },
      { unitPrice: 25, observedAt: "2026-01-05" },
    ]);
    expect(t.direction).toBe("RISING");
    expect(t.isBuyingOpportunity).toBe(false);
  });

  it("bir kuruşluk oynama gürültüdür, STABLE sayılır", () => {
    const t = computePriceTrend([
      { unitPrice: 34.26, observedAt: "2026-01-21" },
      { unitPrice: 34.27, observedAt: "2026-01-23" },
    ]);
    expect(t.direction).toBe("STABLE");
    expect(t.isBuyingOpportunity).toBe(false);
  });

  it("küçük düşüş (%3) fırsat sayılmaz — eşik %5", () => {
    const t = computePriceTrend([
      { unitPrice: 100, observedAt: "2026-01-01" },
      { unitPrice: 97, observedAt: "2026-01-02" },
    ]);
    expect(t.direction).toBe("FALLING");
    expect(t.isBuyingOpportunity).toBe(false);
  });

  it("tek gözlemde yön bilinemez", () => {
    const t = computePriceTrend([{ unitPrice: 10, observedAt: "2026-01-01" }]);
    expect(t.direction).toBe("UNKNOWN");
    expect(t.changePercent).toBeNull();
  });

  it("gözlem yoksa UNKNOWN döner, sıfır uydurulmaz", () => {
    const t = computePriceTrend([]);
    expect(t.direction).toBe("UNKNOWN");
    expect(t.latestPrice).toBeNull();
  });

  it("gözlemler tarih sırasına göre değerlendirilir (girdi sırası önemsiz)", () => {
    const t = computePriceTrend([
      { unitPrice: 26.24, observedAt: "2026-02-13" },
      { unitPrice: 29.99, observedAt: "2026-02-11" },
    ]);
    expect(t.firstPrice).toBe(29.99);
    expect(t.latestPrice).toBe(26.24);
    expect(t.direction).toBe("FALLING");
  });
});

describe("inferLifecycleStage — ürünün yolculuktaki durağı", () => {
  it("hiç hareket yoksa PURCHASING", () => {
    expect(inferLifecycleStage([row()])).toBe("PURCHASING");
  });

  it("depoda sayıldıysa IN_WAREHOUSE", () => {
    expect(inferLifecycleStage([row({ pshStatus: "DEPO_SAYILDI" })])).toBe("IN_WAREHOUSE");
  });

  it("Amazon'a sevk edildiyse LISTED", () => {
    expect(inferLifecycleStage([row({ pshStatus: "AMAZONA_SEVK" })])).toBe("LISTED");
  });

  it("aktif satıştaysa SELLING", () => {
    expect(inferLifecycleStage([row({ inventoryLabStatus: "AKTIF_SATISTA" })])).toBe("SELLING");
  });

  it("EN İLERİ durak kazanır: bir kez satıldıysa yeni sipariş geri çekmez", () => {
    expect(
      inferLifecycleStage([
        row({ inventoryLabStatus: "AKTIF_SATISTA" }),
        row({ pshStatus: "BEKLIYOR" }),
      ])
    ).toBe("SELLING");
  });
});

describe("extractDomain", () => {
  it("www öneki kaldırılır", () => {
    expect(extractDomain("https://www.homedepot.com/p/x")).toBe("homedepot.com");
  });

  it("bozuk URL çökme sebebi olmaz", () => {
    expect(extractDomain("bu bir url değil")).toBeNull();
    expect(extractDomain(null)).toBeNull();
  });
});
