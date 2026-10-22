import { describe, expect, it } from "vitest";
import { readSat26Rows, XRAY_HEADERS } from "./sat26XrayRead";

const REQUIRED = [
  "Tarih",
  "ASIN",
  "MSKU",
  "Orderno",
  "Ürün adedi",
  "Ürün birim maliyeti",
  "Ürün toplam maliyeti",
  "Kargo durumu",
  "Kredi Kartı",
];

const sample = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  "Satın Alan": "HRN",
  Tarih: 46043,
  ASIN: "\nB00LAK1MGU",
  MSKU: "\nFCRB00LAK1MGU",
  Orderno: "WO110074776",
  "Ürün adedi": 4,
  "Ürün birim maliyeti": 46.36,
  "Ürün toplam maliyeti": "$185.44",
  "Kargo durumu": "Tam Geldi",
  "Kredi Kartı": 1753,
  ...over,
});

const day = (d: Date | null) => d?.toISOString().slice(0, 10);

describe("readSat26Rows", () => {
  it("boş girdide dokuz zorunlu başlığı eksik olarak bildirir", () => {
    const r = readSat26Rows([]);
    expect(r.rows).toEqual([]);
    expect(r.missingHeaders).toEqual(REQUIRED);
  });

  it("ASIN/MSKU'yu temizler, ham değeri korur, parayı ve tarihi çözer", () => {
    const { rows, missingHeaders } = readSat26Rows([sample()]);
    expect(missingHeaders).toEqual([]);
    expect(rows[0]).toMatchObject({
      rowNo: 2,
      buyer: "HRN",
      asinRaw: "\nB00LAK1MGU",
      asin: "B00LAK1MGU",
      msku: "FCRB00LAK1MGU",
      orderNo: "WO110074776",
      qty: 4,
      unitCost: 46.36,
      totalCost: 185.44,
      cargoStatus: "Tam Geldi",
      card: "1753",
    });
    expect(day(rows[0].date)).toBe("2026-01-21");
  });

  it("Date nesnesi, ISO metin ve dd.mm.yyyy metni aynı güne çıkar; çözülemeyen null olur", () => {
    const { rows } = readSat26Rows([
      sample({ Tarih: new Date("2026-03-03T00:00:00.000Z") }),
      sample({ Tarih: "2026-03-03T00:00:00.000Z" }),
      sample({ Tarih: "03.03.2026" }),
      sample({ Tarih: "abc" }),
    ]);
    expect(rows.map((r) => day(r.date))).toEqual(["2026-03-03", "2026-03-03", "2026-03-03", undefined]);
    expect(rows[3].date).toBeNull();
  });

  it("adet 0 ise birim maliyet null olur", () => {
    const { rows } = readSat26Rows([sample({ "Ürün adedi": 0 })]);
    expect(rows[0].unitCost).toBeNull();
  });

  it("başlık büyük/küçük harf ve boşluk farkını tolere eder", () => {
    const { rows, missingHeaders } = readSat26Rows([
      { " tarih ": 46043, asin: "B00LAK1MGU", msku: "HRN-B00LAK1MGU", ORDERNO: "WO1", "ÜRÜN ADEDİ": 2, "ürün birim maliyeti": 5, "Ürün Toplam Maliyeti": 10, "kargo durumu": "", "kredi kartı": "" },
    ]);
    expect(missingHeaders).toEqual([]);
    expect(rows[0]).toMatchObject({ orderNo: "WO1", qty: 2, totalCost: 10, cargoStatus: "", card: "" });
  });

  it("isteğe bağlı kolonlar yoksa 0 ve boş metin olur", () => {
    const { rows } = readSat26Rows([sample()]);
    expect(rows[0]).toMatchObject({ shipped: 0, p1: 0, p2: 0, p3: 0, p4: 0, label: "" });
  });
});

describe("XRAY_HEADERS", () => {
  it("zorunlu 9 + isteğe bağlı 7 başlığı verir (ekran yalnız bunları gönderir)", () => {
    expect(XRAY_HEADERS).toHaveLength(16);
    expect(XRAY_HEADERS).toEqual(expect.arrayContaining([...REQUIRED, "Tarih2", "Amazona göndilen adet"]));
  });
});

describe("boş satırlar ve satır numarası", () => {
  const blank = { Tarih: "", ASIN: "", MSKU: "", Orderno: "", "Ürün adedi": "", "Ürün birim maliyeti": "", "Ürün toplam maliyeti": "", "Kargo durumu": "", "Kredi Kartı": "" };

  it("ASIN, order, adet ve toplam maliyeti boş olan satırları atlar", () => {
    const { rows } = readSat26Rows([sample(), blank, blank]);
    expect(rows).toHaveLength(1);
  });

  it("anahtar kolonlardan biri doluysa satırı korur", () => {
    expect(readSat26Rows([{ ...blank, Orderno: "WO1" }]).rows).toHaveLength(1);
  });

  it("__rowNum__ varsa rowNo onu kullanır (boşluktan sonra da doğru Excel satırı)", () => {
    const { rows } = readSat26Rows([{ ...sample(), __rowNum__: 1 }, { ...sample(), __rowNum__: 3 }]);
    expect(rows.map((r) => r.rowNo)).toEqual([2, 4]);
  });

  it("atlanan boş satır sonraki satırların numarasını kaydırmaz", () => {
    const { rows } = readSat26Rows([sample(), blank, sample()]);
    expect(rows.map((r) => r.rowNo)).toEqual([2, 4]);
  });
});

describe("ASIN içindeki <br>", () => {
  it("<br> temizlenir ve temiz ASIN ile aynı ASIN olur", () => {
    const { rows } = readSat26Rows([sample({ ASIN: "B00LAK1MGU<br>" })]);
    expect(rows[0].asin).toBe("B00LAK1MGU");
    expect(rows[0].asinRaw).toBe("B00LAK1MGU<br>");
  });
});
