/**
 * Fixture dürüstlük kilitleri.
 *
 * - Geliştirme fixture'ı 24 sipariş + 4 mağazadır; dokümanlar bu sayıyı söyler.
 * - Bilinmeyen kartlar "1753" gibi uydurma değer taşıyamaz (0007 migration'ı
 *   şema varsayılanını kaldırdı; fixture da aynı kurala uyar).
 */
import { describe, it, expect } from "vitest";
import { ALL_XLS_ORDERS, ALL_38_XLS_ORDERS, INITIAL_STORES } from "@fixtures/mockData";

describe("fixture dürüstlüğü", () => {
  it("geliştirme sipariş seti 24 satırdır", () => {
    expect(ALL_XLS_ORDERS.length).toBe(24);
  });

  it("tarihsel alias aynı seti gösterir", () => {
    expect(ALL_38_XLS_ORDERS).toBe(ALL_XLS_ORDERS);
  });

  it("başlangıç mağazası 4 tanedir", () => {
    expect(INITIAL_STORES.length).toBe(4);
  });

  it("fixture'da uydurma 1753 kart değeri yoktur", () => {
    const fabricated = ALL_XLS_ORDERS.filter((o) => o.creditCard === "1753");
    expect(fabricated).toEqual([]);
  });

  it("sipariş numaraları tektir", () => {
    const numbers = ALL_XLS_ORDERS.map((o) => o.orderNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});
