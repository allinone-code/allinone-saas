import { describe, it, expect } from "vitest";
import { mockKeepaData, summarizeKeepa } from "./client";

describe("Keepa client mock", () => {
  it("aynı ASIN deterministik aynı mock döner", () => {
    const a = mockKeepaData("B0TEST1234");
    const b = mockKeepaData("B0TEST1234");
    expect(a.salesRank).toBe(b.salesRank);
    expect(a.amazonPrice).toBe(b.amazonPrice);
  });
  it("farklı ASIN farklı değer", () => {
    const a = mockKeepaData("B0AAAA0001");
    const b = mockKeepaData("B0BBBB0002");
    expect(a.salesRank).not.toBe(b.salesRank);
  });
  it("özet etiketler doğru", () => {
    const k = mockKeepaData("B0TEST1234");
    const s = summarizeKeepa(k);
    expect(s.demandLabel).toBeDefined();
    expect(s.competitionLabel).toBeDefined();
  });
  it("price history 90 gün", () => {
    const k = mockKeepaData("B0TEST1234");
    expect(k.priceHistory.length).toBe(90);
    expect(k.priceVolatility).not.toBeNull();
  });
});
