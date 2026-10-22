import { describe, expect, it } from "vitest";
import {
  applyCancelRule,
  cleanMsku,
  computeCorrectedCost,
  describeMsku,
  isCancelledStatus,
  isKnownMskuPattern,
} from "./sat26Hygiene";

// Gerçek Sat26 yedeğinden (Cerberus_Yedek_21Ags.xlsx) alınan örnekler.
describe("cleanMsku", () => {
  it("başındaki satır sonunu temizler (Sat26!G9)", () => {
    expect(cleanMsku("\nHRN-B0D19FGYZG")).toBe("HRN-B0D19FGYZG");
  });
  it("<br> kalıntısını temizler", () => {
    expect(cleanMsku("<br>HRN-B0D19FGYZG")).toBe("HRN-B0D19FGYZG");
  });
  it("null/undefined için boş döner", () => {
    expect(cleanMsku(null)).toBe("");
  });
});

describe("isKnownMskuPattern", () => {
  it.each(["HRN-B01CQ3E6HG", "KHRN-B00AJRKQDU", "MHB00014DAJ8", "FCRB00V7COK0G", "L7-FTOK-K9TZ"])(
    "%s kabul edilir",
    (m) => expect(isKnownMskuPattern(m)).toBe(true)
  );
  it.each(["HRN1-B010M8ZBTY", "B00L87YFL4", ""])("%s reddedilir", (m) =>
    expect(isKnownMskuPattern(m)).toBe(false)
  );
});

describe("describeMsku", () => {
  it("temizlenen MSKU için uyarı üretir, kalıba uyuyorsa başka uyarı vermez", () => {
    const r = describeMsku("\nHRN-B0D19FGYZG");
    expect(r.msku).toBe("HRN-B0D19FGYZG");
    expect(r.warnings.map((w) => w.code)).toEqual(["MSKU_CLEANED"]);
  });
  it("kalıp dışı MSKU'yu işaretler ama değiştirmez", () => {
    const r = describeMsku("HRN1-B010M8ZBTY");
    expect(r.msku).toBe("HRN1-B010M8ZBTY");
    expect(r.warnings.map((w) => w.code)).toEqual(["MSKU_PATTERN"]);
  });
});

describe("isCancelledStatus", () => {
  it.each(["İPTAL", "iptal", " İptal ", "IPTAL"])("%j iptal sayılır", (s) =>
    expect(isCancelledStatus(s)).toBe(true)
  );
  it.each(["Tam Geldi", "Yolda", "", null])("%j iptal sayılmaz", (s) =>
    expect(isCancelledStatus(s)).toBe(false)
  );
});

describe("applyCancelRule", () => {
  const base = { quantity: 4, p1CancelQty: 0, p2MissingQty: 0, p3DefectiveQty: 0, p4ExpiredQty: 0 };

  it("Sat26 satır 2: İPTAL, P1 boş, adet 4 → P1 = 4", () => {
    const { row, applied } = applyCancelRule({ ...base, cargoStatus: "İPTAL" });
    expect(applied).toBe(true);
    expect(row.p1CancelQty).toBe(4);
  });
  it("diğer fire adetlerini düşerek kalan kadar doldurur (DB kısıtı bozulmaz)", () => {
    const { row } = applyCancelRule({ ...base, cargoStatus: "İPTAL", p2MissingQty: 1 });
    expect(row.p1CancelQty).toBe(3);
    expect(row.p1CancelQty + row.p2MissingQty).toBeLessThanOrEqual(row.quantity);
  });
  it("P1 zaten doluysa dokunmaz", () => {
    const { row, applied } = applyCancelRule({ ...base, cargoStatus: "İPTAL", p1CancelQty: 2 });
    expect(applied).toBe(false);
    expect(row.p1CancelQty).toBe(2);
  });
  it("iptal olmayan satıra dokunmaz", () => {
    expect(applyCancelRule({ ...base, cargoStatus: "Tam Geldi" }).applied).toBe(false);
  });
  it("girdi nesnesini değiştirmez", () => {
    const input = { ...base, cargoStatus: "İPTAL" };
    applyCancelRule(input);
    expect(input.p1CancelQty).toBe(0);
  });
});

describe("computeCorrectedCost", () => {
  const z = { p1CancelQty: 0, p2MissingQty: 0, p3DefectiveQty: 0, p4ExpiredQty: 0, refundAmount: 0 };

  it("fire yoksa toplam maliyeti verir (Sat26 satır 2 öncesi)", () => {
    expect(computeCorrectedCost({ ...z, totalCost: 185.44, quantity: 4 })).toBe(185.44);
  });
  it("tamamı iptalse 0 olur (Sat26 satır 2 sonrası)", () => {
    expect(computeCorrectedCost({ ...z, totalCost: 185.44, quantity: 4, p1CancelQty: 4 })).toBe(0);
  });
  it("kısmi fire + refund: R − P×fire + AB", () => {
    // 100/4 = 25 birim; 1 defolu → 75; refund 10 → 85
    expect(
      computeCorrectedCost({ ...z, totalCost: 100, quantity: 4, p3DefectiveQty: 1, refundAmount: 10 })
    ).toBe(85);
  });
  it("birim maliyet yuvarlanmaz, yalnız sonuç yuvarlanır (R5)", () => {
    // 205.58/6 = 34.2633… ; 1 eksik → 171.3166… → 171.32
    expect(computeCorrectedCost({ ...z, totalCost: 205.58, quantity: 6, p2MissingQty: 1 })).toBe(171.32);
  });
  it("adet 0 ise sıfıra bölmez", () => {
    expect(computeCorrectedCost({ ...z, totalCost: 50, quantity: 0 })).toBe(50);
  });
});

describe("cleanMsku iç boşluk", () => {
  it("iç boşluğu silmez, yalnız baş/son boşluğu temizler", () => {
    expect(cleanMsku("  HRN B0ABC12345\n")).toBe("HRN B0ABC12345");
  });
});
