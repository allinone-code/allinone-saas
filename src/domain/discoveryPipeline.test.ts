import { describe, it, expect } from "vitest";
import {
  stageAfterDecision,
  transitionPath,
  canReach,
  scoringWalk,
  purchasingWalk,
  shouldAdvanceToPurchasingOnOrder,
  isPrePurchaseStage,
} from "./discoveryPipeline";

describe("stageAfterDecision — karar durağa çevrilir", () => {
  it("BUY ve TEST onaydır", () => {
    expect(stageAfterDecision("BUY")).toBe("APPROVED");
    expect(stageAfterDecision("TEST")).toBe("APPROVED");
  });

  it("REJECT elenir", () => {
    expect(stageAfterDecision("REJECT")).toBe("REJECTED");
  });

  it("WAIT yönetici bekler — SCORED'da kalır, onay uydurulmaz", () => {
    expect(stageAfterDecision("WAIT")).toBe("SCORED");
  });
});

describe("transitionPath — durak makinesi tek kapı", () => {
  it("aynı durak boş yoldur", () => {
    expect(transitionPath("SCORED", "SCORED")).toEqual([]);
  });

  it("DISCOVERED → SCORED ara durakları atlamaz", () => {
    expect(transitionPath("DISCOVERED", "SCORED")).toEqual(["ANALYZING", "SCORED"]);
  });

  it("DISCOVERED → APPROVED tam keşif hattıdır", () => {
    expect(transitionPath("DISCOVERED", "APPROVED")).toEqual([
      "ANALYZING",
      "SCORED",
      "APPROVED",
    ]);
  });

  it("DISCOVERED → PURCHASING siparişle kapanır", () => {
    expect(transitionPath("DISCOVERED", "PURCHASING")).toEqual([
      "ANALYZING",
      "SCORED",
      "APPROVED",
      "PURCHASING",
    ]);
  });

  it("SCORED → REJECTED tek hop", () => {
    expect(transitionPath("SCORED", "REJECTED")).toEqual(["REJECTED"]);
  });

  it("SELLING → DISCOVERED imkânsızdır (geri gitmek yok)", () => {
    expect(transitionPath("SELLING", "DISCOVERED")).toBeNull();
    expect(canReach("SELLING", "DISCOVERED")).toBe(false);
  });

  it("APPROVED → REJECTED yasal değildir — durdurma PAUSED üzerinden", () => {
    expect(transitionPath("APPROVED", "REJECTED")).toBeNull();
  });

  it("REJECTED yeniden analize alınabilir", () => {
    expect(transitionPath("REJECTED", "APPROVED")).toEqual([
      "ANALYZING",
      "SCORED",
      "APPROVED",
    ]);
  });

  it("DISCONTINUED'dan çıkış yoktur", () => {
    expect(transitionPath("DISCONTINUED", "SELLING")).toBeNull();
  });
});

describe("scoringWalk", () => {
  it("yeni keşif + BUY: üç hop, gerekçeler karar içerir", () => {
    const hops = scoringWalk("DISCOVERED", "BUY", 53.18);
    expect(hops.map((h) => h.to)).toEqual(["ANALYZING", "SCORED", "APPROVED"]);
    expect(hops[2]!.reason).toContain("BUY");
    expect(hops[2]!.reason).toContain("53.2");
  });

  it("yeni keşif + REJECT: DISCOVERED'dan doğrudan elenir (analiz uydurulmaz)", () => {
    const hops = scoringWalk("DISCOVERED", "REJECT", 12);
    expect(hops.map((h) => h.to)).toEqual(["REJECTED"]);
    expect(hops.at(-1)!.reason).toContain("REJECT");
  });

  it("WAIT onay uydurmaz — SCORED'da durur", () => {
    const hops = scoringWalk("DISCOVERED", "WAIT", 80);
    expect(hops.map((h) => h.to)).toEqual(["ANALYZING", "SCORED"]);
    expect(hops.at(-1)!.reason).toContain("yönetici");
  });

  it("yönetici WAIT→BUY: SCORED → APPROVED", () => {
    expect(scoringWalk("SCORED", "BUY", 40).map((h) => h.to)).toEqual(["APPROVED"]);
  });

  it("zaten APPROVED olan ürüne BUY boş yürüyüştür", () => {
    expect(scoringWalk("APPROVED", "BUY", 40)).toEqual([]);
  });

  it("SELLING ürüne REJECT sessizce boş döner (geri gitmez)", () => {
    expect(scoringWalk("SELLING", "REJECT", 10)).toEqual([]);
  });
});

describe("sipariş durak yürütmesi", () => {
  it("ön-satın-alma duraklarından PURCHASING'e çekilir", () => {
    for (const s of ["DISCOVERED", "ANALYZING", "SCORED", "APPROVED", "REJECTED"]) {
      expect(shouldAdvanceToPurchasingOnOrder(s)).toBe(true);
      expect(isPrePurchaseStage(s)).toBe(true);
    }
  });

  it("PURCHASING ve sonrası geri gitmez", () => {
    for (const s of ["PURCHASING", "IN_WAREHOUSE", "LISTED", "SELLING", "MONITORING"]) {
      expect(shouldAdvanceToPurchasingOnOrder(s)).toBe(false);
    }
  });

  it("APPROVED → PURCHASING tek hop", () => {
    expect(purchasingWalk("APPROVED").map((h) => h.to)).toEqual(["PURCHASING"]);
  });

  it("SELLING'den PURCHASING yolu yoktur", () => {
    expect(purchasingWalk("SELLING")).toEqual([]);
  });
});
