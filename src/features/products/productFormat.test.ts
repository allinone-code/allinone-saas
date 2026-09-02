import { describe, it, expect } from "vitest";
import {
  money,
  percent,
  shortDate,
  trendTone,
  trendLabel,
  journeyIndex,
  compareByUrgency,
  VERDICT_TONE,
  VERDICT_LABEL,
  STAGE_LABEL,
  JOURNEY_ORDER,
  OFF_JOURNEY,
} from "./productFormat";

describe("money", () => {
  it("pozitif değeri dolar biçiminde verir", () => {
    expect(money(1234.5)).toBe("$1.234,50");
  });

  it("negatif değerde işaret parantez değil eksi olur", () => {
    expect(money(-99.9)).toBe("-$99,90");
  });

  it("null/geçersiz girdiyi çökmeden karşılar", () => {
    expect(money(null)).toBe("$0,00");
    expect(money("abc")).toBe("—");
  });
});

describe("percent — ölçülemedi ile sıfır karıştırılmaz", () => {
  it("sayıyı yüzde olarak biçimler", () => {
    expect(percent(35.176)).toBe("%35.2");
  });

  it("sıfır gerçek bir değerdir", () => {
    expect(percent(0)).toBe("%0.0");
  });

  it("null 'ölçülemedi' anlamındadır ve tire döner", () => {
    expect(percent(null)).toBe("—");
    expect(percent(undefined)).toBe("—");
  });
});

describe("shortDate", () => {
  it("geçerli tarihi biçimler", () => {
    expect(shortDate("2026-03-15")).toMatch(/2026/);
  });

  it("boş/geçersiz tarihte tire döner", () => {
    expect(shortDate(null)).toBe("—");
    expect(shortDate("saçma")).toBe("—");
  });
});

describe("trendTone — tedarikçi fiyatının düşmesi BİZİM için iyidir", () => {
  it("alım fırsatı her zaman olumlu tonda", () => {
    expect(trendTone("DOWN", true)).toBe("positive");
  });

  it("yükselen tedarikçi fiyatı tehlikedir", () => {
    expect(trendTone("UP", false)).toBe("danger");
  });

  it("düşen fiyat olumludur", () => {
    expect(trendTone("DOWN", false)).toBe("positive");
  });

  it("bilinmeyen trend nötrdür", () => {
    expect(trendTone("UNKNOWN", false)).toBe("neutral");
  });

  it("etiketler Türkçedir", () => {
    expect(trendLabel("UP")).toBe("Yükseliyor");
    expect(trendLabel("DOWN")).toBe("Düşüyor");
    expect(trendLabel("FLAT")).toBe("Sabit");
  });
});

describe("yolculuk sırası", () => {
  it("ana yolculuk duraklarının indeksi bulunur", () => {
    expect(journeyIndex("DISCOVERED")).toBe(0);
    expect(journeyIndex("SELLING")).toBe(JOURNEY_ORDER.indexOf("SELLING"));
  });

  it("yolculuk dışı duraklar ilerleme çubuğunda yer almaz", () => {
    for (const s of OFF_JOURNEY) {
      expect(journeyIndex(s)).toBe(-1);
    }
  });

  it("her ana durak sıralamada tektir", () => {
    expect(new Set(JOURNEY_ORDER).size).toBe(JOURNEY_ORDER.length);
  });
});

describe("compareByUrgency — en acil ürün en üstte", () => {
  const p = (severity: string, netProfit: number) => ({ severity, pnl: { netProfit } });

  it("kritik olan yükseği geçer", () => {
    expect(compareByUrgency(p("CRITICAL", 10), p("HIGH", 9999))).toBeLessThan(0);
  });

  it("aynı aciliyette parasal etkisi büyük olan önce gelir", () => {
    expect(compareByUrgency(p("HIGH", 100), p("HIGH", 5000))).toBeGreaterThan(0);
  });

  it("zarar da bir etkidir: -5000, +100'ün önüne geçer", () => {
    expect(compareByUrgency(p("HIGH", -5000), p("HIGH", 100))).toBeLessThan(0);
  });

  it("sıralama gerçek bir listede beklendiği gibi çalışır", () => {
    const list = [
      { severity: "LOW", pnl: { netProfit: 10 } },
      { severity: "CRITICAL", pnl: { netProfit: -2000 } },
      { severity: "MEDIUM", pnl: { netProfit: 500 } },
    ];
    const sorted = [...list].sort(compareByUrgency);
    expect(sorted[0].severity).toBe("CRITICAL");
    expect(sorted[2].severity).toBe("LOW");
  });
});

describe("etiket sözlükleri eksiksiz", () => {
  it("her yargının Türkçe etiketi ve tonu var", () => {
    for (const key of Object.keys(VERDICT_LABEL)) {
      expect(VERDICT_TONE[key]).toBeDefined();
      expect(VERDICT_LABEL[key].length).toBeGreaterThan(0);
    }
  });

  it("12 durağın tamamı Türkçeleştirilmiş", () => {
    expect(Object.keys(STAGE_LABEL)).toHaveLength(12);
    for (const label of Object.values(STAGE_LABEL)) {
      expect(label).toMatch(/[a-zçğıöşü]/i);
    }
  });
});
