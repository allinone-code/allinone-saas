/**
 * XLS ham matris ayrıştırıcısı — birim testleri.
 *
 * Kapsanan hata senaryoları (saha gözlemi):
 *  1. Gerçek Excel tarih hücresinin seri numarası ("46043") olarak okunması
 *  2. Türkçe para biçimi "1.234,56"nin istemci ön-dönüşümüyle bozulması
 *  3. Küçük harf "fba" fulfillment değerinin reddedilmesi
 *  4. CountPerBundle (33. kolon) verisinin hiç okunmaması
 *  5. Başlık satırı üstünde title/boş satır olan dosyaların kayması
 */
import { describe, it, expect } from "vitest";
import {
  normalizeExcelDate,
  parseXlsMatrix,
  detectHeaderRow,
} from "./xlsRowParse";

describe("normalizeExcelDate — her temsil YYYY-MM-DD'ye iner", () => {
  it("Excel seri numaraları", () => {
    expect(normalizeExcelDate(46043)).toBe("2026-01-21");
    expect(normalizeExcelDate("46043")).toBe("2026-01-21");
    expect(normalizeExcelDate("46058.5")).toBe("2026-02-05"); // saat kırsmı atılır
    expect(normalizeExcelDate(45000)).toBe("2023-03-15");
    // 1990 öncesi (25569 = 1970) sipariş tarihi olarak makul değil → null
    expect(normalizeExcelDate(25569)).toBeNull();
  });

  it("Date nesneleri (cellDates:true okuması)", () => {
    expect(normalizeExcelDate(new Date(Date.UTC(2026, 0, 21)))).toBe("2026-01-21");
    expect(normalizeExcelDate(new Date("bozuk"))).toBeNull();
  });

  it("ISO biçimleri", () => {
    expect(normalizeExcelDate("2026-01-21")).toBe("2026-01-21");
    expect(normalizeExcelDate("2026/01/05")).toBe("2026-01-05");
    expect(normalizeExcelDate("2026-1-5")).toBe("2026-01-05");
    expect(normalizeExcelDate("2026-01-21T00:00:00.000Z")).toBe("2026-01-21"); // JSON'a serileşmiş Date
  });

  it("Türkçe gün-önce biçimleri", () => {
    expect(normalizeExcelDate("21.01.2026")).toBe("2026-01-21");
    expect(normalizeExcelDate("21/01/2026")).toBe("2026-01-21");
    expect(normalizeExcelDate("5.2.2026")).toBe("2026-02-05");
    expect(normalizeExcelDate("21.01.26")).toBe("2026-01-21"); // iki haneli yıl
  });

  it("ay>12 görünce ABD-ters yazımını düzeltir", () => {
    expect(normalizeExcelDate("01/21/2026")).toBe("2026-01-21");
  });

  it("geçersiz ve saçma değerler null döner", () => {
    expect(normalizeExcelDate("")).toBeNull();
    expect(normalizeExcelDate(null)).toBeNull();
    expect(normalizeExcelDate(undefined)).toBeNull();
    expect(normalizeExcelDate("ocak")).toBeNull();
    expect(normalizeExcelDate("2026-02-31")).toBeNull(); // hayali tarih
    expect(normalizeExcelDate(123)).toBeNull(); // seri aralığı dışı
    expect(normalizeExcelDate("99999")).toBeNull();
  });
});

describe("parseXlsMatrix — konumsal (başlık tespitsiz) geri dönüş", () => {
  // Nötr başlık adları: hiçbiri alias eşleşmesi üretmez → konumsal mod zorlanır
  const neutralHeader = (n: number) => Array.from({ length: n }, (_, i) => `c${i}`);

  const legacyMatrix = [
    neutralHeader(12),
    ["HRN", 46043, "", "FBA", "MegaFood One Daily", "B0TEST001", "MH1", "VS", "A198", "", "", "WO-1"],
  ];

  it("seri numarası tarihi normalize eder", () => {
    const { rows } = parseXlsMatrix(legacyMatrix, { defaultStore: "HRN" });
    expect(rows[0].orderDate).toBe("2026-01-21");
  });

  it("para değerleri HAM bırakılır (istemci ön-dönüşüm yapmaz)", () => {
    const matrix = [
      neutralHeader(18),
      ["HRN", "2026-01-21", "", "FBA", "Ürün", "B0XYZ", "", "", "", "", "", "WO-9", "", 1, 2, "1.234,56", "49,99", "3.703,68"],
    ];
    const { rows } = parseXlsMatrix(matrix);
    expect(rows[0].unitCost).toBe("1.234,56"); // bozulmadan sunucuya gider
    expect(rows[0].sellingPrice).toBe("49,99");
    expect(rows[0].totalCost).toBe("3.703,68");
  });

  it("küçük harf fulfillment kanonikleşir, CountPerBundle (kolon 33) kaybolmaz", () => {
    const cols: unknown[] = Array(40).fill("");
    cols[0] = "HRN"; cols[3] = "fba"; cols[4] = "Ürün X"; cols[5] = "b0abc"; cols[11] = "WO-C"; cols[32] = "4";
    const { rows } = parseXlsMatrix([Array(40).fill("x"), cols]);
    expect(rows[0].fulfillmentType).toBe("FBA");
    expect(rows[0].countPerBundle).toBe("4");
    expect(rows[0].asin).toBe("B0ABC");
  });

  it("sipariş no ve başlık yoksa satır atlanır; boş satırlar elenir", () => {
    const { rows } = parseXlsMatrix([
      ["h1"],
      ["", "", ""],
      ["HRN", "2026-01-21", "", "FBA", "", "", "", "", "", "", "", ""],
    ]);
    expect(rows).toHaveLength(0);
  });

  it("boş sipariş no ama dolu ürün → WO- üretilir", () => {
    const { rows } = parseXlsMatrix([
      ["h"],
      ["HRN", "2026-01-21", "", "FBA", "Ürün Y", "B0GEN01"],
    ]);
    expect(rows).toHaveLength(1);
    expect(String(rows[0].orderNumber)).toMatch(/^WO-\d{8}$/);
  });
});

describe("parseXlsMatrix — başlık tespitli eşleme", () => {
  it("başlık üstündeki title/boş satırlar atlanır, kolonlar başlıktan eşlenir", () => {
    const { rows, headerMapped } = parseXlsMatrix([
      ["CERBERUS SİPARİŞ LİSTESİ — OCAK", "", "", ""], // title satırı
      ["", "", "", ""], // boş satır
      ["Orderno", "Ürün adı Amazon", "ASIN", "Satın Alan", "Tarih", "Ürün adedi"], // başlık 3. sırada, sıra KARIŞIK
      ["WO-H1", "Başlıktan Ürün", "B0HEAD1", "SEL", "05.02.2026", 7],
    ]);
    expect(headerMapped).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      orderNumber: "WO-H1",
      productTitle: "Başlıktan Ürün",
      asin: "B0HEAD1",
      buyerStore: "SEL",
      orderDate: "2026-02-05",
      quantity: "7",
    });
  });

  it("mağaza kolonu boşsa defaultStore kullanılır", () => {
    const { rows } = parseXlsMatrix([
      ["Orderno", "ASIN", "Ürün adı Amazon"],
      ["WO-H2", "B0HEAD2", "Ürün"],
    ], { defaultStore: "MK" });
    expect(rows[0].buyerStore).toBe("MK");
  });

  it("sahte/veri satırları yanlışlıkla başlık seçilmez", () => {
    const { headerMapped } = parseXlsMatrix([
      ["HRN", "2026-01-21", "", "FBA", "Ürün", "B0NOHEAD", "", "", "", "", "", "WO-N"],
    ]);
    expect(headerMapped).toBe(false);
  });

  it("driveLinkFallback satırlara işlenir", () => {
    const { rows } = parseXlsMatrix([
      ["Orderno", "ASIN", "Ürün adı Amazon"],
      ["WO-D1", "B0DRV1", "Ürün"],
    ], { driveLinkFallback: "https://drive.google.com/x" });
    expect(rows[0].driveLink).toBe("https://drive.google.com/x");
  });

  it("Türkçe çekimli başlık varyantları önek eşleşmesiyle yakalanır", () => {
    // "Birim maliyeti"/"Toplam maliyeti" (-i hali) alias'tan uzun; "Gönderilen" kısa
    const { rows } = parseXlsMatrix([
      ["Orderno", "ASIN", "Ürün adı Amazon", "Birim maliyeti", "Toplam maliyeti", "Gönderilen"],
      ["WO-P1", "B0PREF1", "Ürün", "1.234,56", "3.703,68", "5"],
    ]);
    expect(rows[0].unitCost).toBe("1.234,56");
    expect(rows[0].totalCost).toBe("3.703,68");
    expect(rows[0].shippedToAmazon).toBe("5");
  });

  it("kısa alias'lı başlıklar önek tuzağına düşmez ('Tarihi geçmiş adet-P4' tarihe eşlenmez)", () => {
    const { rows } = parseXlsMatrix([
      ["Orderno", "ASIN", "Ürün adı Amazon", "Tarih", "Tarihi geçmiş adet-P4"],
      ["WO-P2", "B0PREF2", "Ürün", "05.02.2026", "3"],
    ]);
    expect(rows[0].orderDate).toBe("2026-02-05");
    expect(rows[0].p4ExpiredQty).toBe("3");
  });
});

describe("detectHeaderRow — eşik davranışı", () => {
  it("3'ten az eşleşme başlık sayılmaz", () => {
    const d = detectHeaderRow([["ASIN", "Orderno"]]);
    expect(d.headerRowIndex).toBe(-1);
  });

  it("boş matris güvenle atlanır", () => {
    expect(detectHeaderRow([]).headerRowIndex).toBe(-1);
    expect(detectHeaderRow([[], null as unknown as unknown[]]).headerRowIndex).toBe(-1);
  });
});
