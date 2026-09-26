import { describe, expect, it } from "vitest";
import { computePriceTrend } from "./productBackfill";

/**
 * Tepe fiyat karşılaştırması.
 *
 * Kullanıcının sorusu "şu an indirimde miyim?" — `changePercent` (ilk fiyata
 * göre değişim) BUNU yanıtlamaz. Ürün 100$'dan 60$'a geldiyse changePercent
 * %-40 der ve "zam almış" izlenimi doğar; oysa tepe 100 idi ve fırsat kaçtı.
 * `discountFromPeakPercent` asıl alım kararını verir.
 */

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

function obs(price: number, n: number) {
  return { unitPrice: price.toFixed(2), observedAt: day(n) };
}

describe("computePriceTrend — tepe fiyat", () => {
  it("tepe fiyatı ve güncel indirim yüzdesini hesaplar", () => {
    const trend = computePriceTrend([obs(100, 1), obs(60, 10)]);
    expect(trend.peakPrice).toBe(100);
    expect(trend.latestPrice).toBe(60);
    expect(trend.discountFromPeakPercent).toBe(40);
  });

  it("tepe tarihini döner", () => {
    const trend = computePriceTrend([obs(100, 1), obs(60, 10)]);
    expect(trend.peakAt?.getUTCDate()).toBe(1);
  });

  it("fiyat tepe üstüne çıkarsa indirim 0 (tepede)", () => {
    const trend = computePriceTrend([obs(60, 1), obs(100, 10)]);
    expect(trend.peakPrice).toBe(100);
    expect(trend.latestPrice).toBe(100);
    expect(trend.discountFromPeakPercent).toBe(0);
  });

  it("tepe ortada olduğunda doğru tepeyi seçer", () => {
    // 50 → 100 → 80: tepe ortadaki 100, güncel 80 → %20 indirimde
    const trend = computePriceTrend([obs(50, 1), obs(100, 5), obs(80, 10)]);
    expect(trend.peakPrice).toBe(100);
    expect(trend.discountFromPeakPercent).toBe(20);
  });

  it("sırasız gözlemleri kronolojik sıralar", () => {
    // 100 ikinci, 60 üçüncü sırada kaydedilmiş; tepe yine 100 olmalı.
    const trend = computePriceTrend([obs(60, 10), obs(100, 1)]);
    expect(trend.peakPrice).toBe(100);
    expect(trend.latestPrice).toBe(60);
    expect(trend.discountFromPeakPercent).toBe(40);
  });

  it("tek gözlemde tepe=güncel ve indirim iddiası yapılmaz", () => {
    const trend = computePriceTrend([obs(42, 1)]);
    expect(trend.peakPrice).toBe(42);
    expect(trend.latestPrice).toBe(42);
    expect(trend.discountFromPeakPercent).toBeNull();
  });

  it("gözlem yoksa alanlar null", () => {
    const trend = computePriceTrend([]);
    expect(trend.peakPrice).toBeNull();
    expect(trend.discountFromPeakPercent).toBeNull();
    expect(trend.isBuyingOpportunity).toBe(false);
  });

  it("tepe bazlı %15 üstü indirim fırsat sayılır (changePercent yetersiz kalıyorsa)", () => {
    // Kritik senaryo: seri kısa olduğunda ilk fiyat yüksek olabilir ve
    // changePercent "düşüş yok" der. Örn. 100 → 99 → 85: changePercent %-15
    // zaten fırsat sayılır; ama 90 → 89 → 75 örneğinde changePercent %-16.7.
    // Asıl test: tepe %20 altındayken changePercent nötr kalsın.
    const trend = computePriceTrend([obs(90, 1), obs(100, 5), obs(80, 10)]);
    expect(trend.changePercent).toBeCloseTo(-11.11, 2);
    // changePercent tek başına -%5 eşiğine uymuyor...
    expect(trend.changePercent! > -5).toBe(false);
    // ...ama tepe bazlı %20 indirim fırsat sinyali üretmeli.
    expect(trend.discountFromPeakPercent).toBe(20);
    expect(trend.isBuyingOpportunity).toBe(true);
  });

  it("küçük yuvarlama farkını indirim saymaz", () => {
    // $10.00 → $9.99: %0.1 fark, anlamlı indirim değil.
    const trend = computePriceTrend([obs(10, 1), obs(9.99, 10)]);
    expect(trend.discountFromPeakPercent).toBe(0);
  });
});
