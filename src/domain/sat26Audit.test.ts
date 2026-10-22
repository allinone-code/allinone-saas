import { describe, expect, it } from "vitest";
import { auditSat26Orders, type AuditOrderRow } from "./sat26Audit";

const base: AuditOrderRow = {
  id: 1,
  buyerStore: "HRN",
  orderNumber: "WO110074776",
  asin: "B00014DAJ8",
  msku: "HRN-B00014DAJ8",
  cargoStatus: "Tam Geldi",
  quantity: 4,
  totalCost: 185.44,
  refundAmount: 0,
  correctedCost: 185.44,
  p1CancelQty: 0,
  p2MissingQty: 0,
  p3DefectiveQty: 0,
  p4ExpiredQty: 0,
};

describe("auditSat26Orders", () => {
  it("temiz kayıtta bulgu üretmez", () => {
    const r = auditSat26Orders([base]);
    expect(r.findings).toEqual([]);
    expect(r.overstatedCost).toBe(0);
    expect(r.scanned).toBe(1);
  });

  it("Sat26 satır 2: İPTAL + P1 boş → P1=4, maliyet 185,44 → 0, fazla gösterim 185,44", () => {
    const r = auditSat26Orders([{ ...base, cargoStatus: "İPTAL" }]);
    expect(r.counts.CANCEL_P1_EMPTY).toBe(1);
    expect(r.findings[0].proposed).toEqual({ p1CancelQty: 4, correctedCost: 0 });
    expect(r.overstatedCost).toBe(185.44);
  });

  it("P1 doluysa iptal bulgusu üretmez", () => {
    const r = auditSat26Orders([{ ...base, cargoStatus: "İPTAL", p1CancelQty: 4, correctedCost: 0 }]);
    expect(r.counts.CANCEL_P1_EMPTY).toBe(0);
  });

  it("kirli MSKU için temizlenmiş öneri verir, kalıp dışı için öneri vermez", () => {
    const r = auditSat26Orders([
      { ...base, id: 2, msku: "\nHRN-B0D19FGYZG" },
      { ...base, id: 3, msku: "HRN1-B010M8ZBTY" },
    ]);
    expect(r.counts.MSKU_DIRTY).toBe(1);
    expect(r.counts.MSKU_UNKNOWN_PATTERN).toBe(1);
    expect(r.findings.find((f) => f.orderId === 2)?.proposed).toEqual({ msku: "HRN-B0D19FGYZG" });
    expect(r.findings.find((f) => f.orderId === 3)?.proposed).toBeUndefined();
  });

  it("birden çok iptal satırın fazla gösterimini toplar", () => {
    const r = auditSat26Orders([
      { ...base, id: 1, cargoStatus: "İPTAL" },
      { ...base, id: 2, cargoStatus: "İPTAL", quantity: 6, totalCost: 205.58, correctedCost: 205.58 },
    ]);
    expect(r.overstatedCost).toBe(391.02);
  });
});

describe("elle girilmiş düzeltilmiş maliyet", () => {
  it("formülden farklı correctedCost ezilmez; yalnız P1 önerilir", () => {
    const o: AuditOrderRow = { ...base, cargoStatus: "İPTAL", correctedCost: 120 };
    const r = auditSat26Orders([o]);
    expect(r.findings[0].proposed).toEqual({ p1CancelQty: 4 });
    expect(r.manualCostKept).toBe(1);
    expect(r.overstatedCost).toBe(0);
  });
  it("formül değerindeki correctedCost otomatik düzeltilir", () => {
    const o: AuditOrderRow = { ...base, cargoStatus: "İPTAL" };
    const r = auditSat26Orders([o]);
    expect(r.findings[0].proposed?.correctedCost).toBe(0);
    expect(r.manualCostKept).toBe(0);
  });
});
