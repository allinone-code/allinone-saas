import { describe, it, expect } from "vitest";
import {
  computeFreshness,
  computeFreshnessScore,
  summarizeFreshness,
} from "./dataFreshness";

const NOW = new Date("2026-09-02T12:00:00Z");

/** NOW'dan n gün önceye ait tarih üretir */
function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86_400_000);
}

describe("computeFreshness — tazelik elle değil, zamandan hesaplanır", () => {
  it("bugün gözlenen kayıt FRESH ve 100 puan", () => {
    const r = computeFreshness(NOW, NOW);
    expect(r.status).toBe("FRESH");
    expect(r.ageInDays).toBe(0);
    expect(r.score).toBe(100);
  });

  it("7 güne kadar FRESH kalır", () => {
    expect(computeFreshness(daysAgo(7), NOW).status).toBe("FRESH");
  });

  it("8. günde AGING'e düşer", () => {
    const r = computeFreshness(daysAgo(8), NOW);
    expect(r.status).toBe("AGING");
    expect(r.score).toBeLessThan(100);
  });

  it("21 gün AGING sınırı, 22 gün STALE", () => {
    expect(computeFreshness(daysAgo(21), NOW).status).toBe("AGING");
    expect(computeFreshness(daysAgo(22), NOW).status).toBe("STALE");
  });

  it("45 günden sonra EXPIRED ve 0 puan", () => {
    const r = computeFreshness(daysAgo(60), NOW);
    expect(r.status).toBe("EXPIRED");
    expect(r.score).toBe(0);
  });

  it("skor yaşla birlikte monoton azalır", () => {
    const scores = [0, 5, 10, 20, 30, 44, 60].map(
      (d) => computeFreshness(daysAgo(d), NOW).score
    );
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it("gözlem tarihi yoksa EXPIRED — varsayılan olarak taze SAYILMAZ", () => {
    const r = computeFreshness(null, NOW);
    expect(r.status).toBe("EXPIRED");
    expect(r.score).toBe(0);
  });

  it("geçersiz tarih EXPIRED sayılır", () => {
    expect(computeFreshness("bozuk-tarih", NOW).status).toBe("EXPIRED");
  });

  it("gelecek tarihli kayıt 0 gün yaşındadır (saat farkına dayanıklı)", () => {
    const future = new Date(NOW.getTime() + 5 * 86_400_000);
    const r = computeFreshness(future, NOW);
    expect(r.ageInDays).toBe(0);
    expect(r.status).toBe("FRESH");
  });

  it("ISO metin girdisi kabul edilir", () => {
    expect(computeFreshness(daysAgo(3).toISOString(), NOW).status).toBe("FRESH");
  });
});

describe("computeFreshnessScore — küme ortalaması", () => {
  it("boş küme 0 döner", () => {
    expect(computeFreshnessScore([], NOW)).toBe(0);
  });

  it("hepsi taze ise 100", () => {
    expect(computeFreshnessScore([daysAgo(1), daysAgo(2)], NOW)).toBe(100);
  });

  it("karışık küme ortalamayı yansıtır", () => {
    const score = computeFreshnessScore([daysAgo(1), daysAgo(90)], NOW);
    expect(score).toBe(50);
  });
});

describe("summarizeFreshness — rozet dağılımı", () => {
  it("durumları doğru sayar", () => {
    const counts = summarizeFreshness(
      [daysAgo(1), daysAgo(3), daysAgo(10), daysAgo(30), daysAgo(100), null],
      NOW
    );
    expect(counts.FRESH).toBe(2);
    expect(counts.AGING).toBe(1);
    expect(counts.STALE).toBe(1);
    expect(counts.EXPIRED).toBe(2); // 100 gün + null
  });
});
