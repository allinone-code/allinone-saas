import { describe, it, expect } from "vitest";
import { buildMorningBriefing } from "./morningBriefing";

const NOW = new Date("2026-09-01T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe("T8.3 buildMorningBriefing — sabit metin yerine gerçek veri", () => {
  it("boş veri setinde güvenli varsayılanlar üretir", () => {
    const b = buildMorningBriefing({ orders: [], masters: [], researcherCount: 0, storeCount: 0, generatedFor: NOW });
    expect(b.businessHealthScore).toBeGreaterThanOrEqual(65);
    expect(b.whatChanged[0]).toContain("konsolide ciro");
    expect(b.whatChanged[2]).toContain("hesaplanamadı");
    expect(b.whatMatters[0]).toContain("uyarısı yok");
    expect(b.whatShouldIDo[0]).toContain("Kritik aksiyon yok");
  });

  it("ciro, FBA oranı ve 30 gün deltasını GERÇEK siparişlerden hesaplar", () => {
    const b = buildMorningBriefing({
      orders: [
        { sellingPrice: 100, quantity: 2, shippedToAmazon: 2, cargoStatus: "Tam Geldi", p2MissingQty: 0, orderNumber: "W1", createdAt: daysAgo(5) },   // $200, son 30 gün
        { sellingPrice: 50, quantity: 1, shippedToAmazon: 0, cargoStatus: "Yolda", p2MissingQty: 0, orderNumber: "W2", createdAt: daysAgo(40) },     // $50, önceki dönem
      ],
      masters: [{ asin: "B0X", title: "Ürün", researcherName: "Ali", roiPercent: 40, decisionAction: "BUY", duplicateScore: 0 }],
      researcherCount: 3,
      storeCount: 2,
      generatedFor: NOW,
    });
    expect(b.whatChanged[0]).toContain("$250.00"); // 200 + 50 toplam ciro
    expect(b.whatChanged[0]).toContain("+300.0"); // 200 vs 50 → +%300
    expect(b.whatChanged[0]).toContain("2 mağaza");
    expect(b.whatChanged[2]).toContain("%66.7"); // 2/3 birim FBA
    expect(b.whatChanged[2]).not.toContain("%94.2"); // eski sabit değer gitmiş olmalı
  });

  it("problem siparişlerini gerçek sayılarıyla raporlar", () => {
    const b = buildMorningBriefing({
      orders: [
        { sellingPrice: 10, quantity: 1, shippedToAmazon: 0, cargoStatus: "İPTAL", p2MissingQty: 0, orderNumber: "C1", createdAt: daysAgo(1) },
        { sellingPrice: 10, quantity: 3, shippedToAmazon: 0, cargoStatus: "Yolda", p2MissingQty: 2, orderNumber: "M1", createdAt: daysAgo(2) },
      ],
      masters: [],
      researcherCount: 1,
      storeCount: 1,
      generatedFor: NOW,
    });
    expect(b.whatMatters[0]).toContain("1 siparişte toplam 2 birim P2 eksik");
    expect(b.whatMatters[0]).toContain("1 iptal");
    expect(b.whatMatters[2]).toContain("Policy Engine durdurması yok");
  });

  it("REJECT ürününü whatMatters'a, BUY ürününü aksiyonlara taşır (sabit ASIN yok)", () => {
    const b = buildMorningBriefing({
      orders: [],
      masters: [
        { asin: "B0REJECT", title: "Kötü Ürün", researcherName: "Selin", roiPercent: 10, decisionAction: "REJECT", duplicateScore: 0 },
        { asin: "B0BUY", title: "İyi Ürün", researcherName: "Ali", roiPercent: 55, decisionAction: "BUY", duplicateScore: 0 },
      ],
      researcherCount: 2,
      storeCount: 1,
      generatedFor: NOW,
    });
    expect(b.whatMatters[2]).toContain("Kötü Ürün");
    expect(b.whatMatters[2]).toContain("B0REJECT");
    expect(b.whatMatters[2]).toContain("DURDURULDU");
    expect(b.whatShouldIDo[0]).toContain("İyi Ürün");
    expect(b.whatShouldIDo[0]).toContain("%55.0 ROI");
  });

  it("P2 eksik sipariş ve duplicate alarmı aksiyon listesine girer", () => {
    const b = buildMorningBriefing({
      orders: [
        { sellingPrice: 10, quantity: 5, shippedToAmazon: 0, cargoStatus: "Yolda", p2MissingQty: 3, orderNumber: "WO-99", createdAt: daysAgo(3) },
      ],
      masters: [
        { asin: "B0DUP", title: "Kopya Ürün", researcherName: "Selin", roiPercent: 45, decisionAction: "WAIT", duplicateScore: 96 },
      ],
      researcherCount: 1,
      storeCount: 1,
      generatedFor: NOW,
    });
    const joined = b.whatShouldIDo.join(" ");
    expect(joined).toContain("WO-99");
    expect(joined).toContain("3 birim eksik");
    expect(joined).toContain("%96 duplicate");
    expect(joined).toContain("Selin");
    expect(b.whatShouldIDo.length).toBeLessThanOrEqual(3);
  });

  it("skor her zaman 65-99 bandında kalır", () => {
    const terrible = buildMorningBriefing({
      orders: Array.from({ length: 50 }, (_, i) => ({
        sellingPrice: 1, quantity: 1, shippedToAmazon: 0, cargoStatus: "İPTAL",
        p2MissingQty: 5, orderNumber: `X${i}`, createdAt: daysAgo(1),
      })),
      masters: [], researcherCount: 0, storeCount: 1, generatedFor: NOW,
    });
    expect(terrible.businessHealthScore).toBe(65);
    const stellar = buildMorningBriefing({
      orders: [],
      masters: [{ asin: "A", title: "Süper", researcherName: "X", roiPercent: 200, decisionAction: "BUY", duplicateScore: 0 }],
      researcherCount: 5, storeCount: 3, generatedFor: NOW,
    });
    expect(stellar.businessHealthScore).toBe(99);
  });
});
