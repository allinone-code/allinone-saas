import { describe, expect, it } from "vitest";
import { parseCapturedHtml } from "./scraper";

/**
 * Bookmarklet → sunucu ayrıştırma zinciri.
 *
 * Bookmarklet ham JSON-LD + meta gönderir; ürün çıkarımı SUNUCUDA yapılır.
 * Burada test edilen kritik soru: bookmarklet'in gönderdiği biçimdeki veri
 * gerçekten aynı ürünleri üretiyor mu? Eğer bu kopmuşsa, saha çalışırken
 * her yakalama boş döner ve kullanıcı nedenini anlamaz.
 *
 * Bunun ikinci bir ayrıştırıcı yazmak yerine aynı fonksiyonu çağırmak yerine
 * test edilmesinin nedeni: bu, "iki yol aynı sonucu veriyor" sözünün kanıtı.
 */

const VITAMINSHOPPE_PRODUCT = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "NOW Foods Vitamin D-3 5,000 IU 240 Softgels",
  brand: { "@type": "Brand", name: "NOW" },
  sku: "NF_0373",
  gtin13: "0036000291452",
  image: ["https://cdn.vitaminshoppe.com/img/now-vitamin-d3.jpg"],
  offers: {
    "@type": "Offer",
    price: "11.99",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
};

const DISCOUNTED_PRODUCT = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "NOW Foods Creatine Monohydrate 500 Gr",
  brand: { "@type": "Brand", name: "NOW" },
  mpn: "CREATINE-500",
  gtin13: "0036000291452",
  offers: {
    "@type": "Offer",
    lowPrice: "18.99",
    highPrice: "34.99",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
};

/** Bookmarklet'in gönderdiği biçimi taklit eder. */
function capturePayload(products: unknown[]): string {
  return [
    ...products.map(
      (p) => `<script type="application/ld+json">${JSON.stringify(p)}</script>`
    ),
    `<meta property="og:title" content="VitaminShoppe">`,
  ].join("\n");
}

describe("bookmarklet yakalama ayrıştırması", () => {
  it("tek ürün sayfasından ürün çıkarır", () => {
    const html = capturePayload([VITAMINSHOPPE_PRODUCT]);
    const result = parseCapturedHtml(html, "https://www.vitaminshoppe.com/p/now-vitamin-d3", "https://www.vitaminshoppe.com/p/now-vitamin-d3");

    expect(result.products).toHaveLength(1);
    const p = result.products[0];
    expect(p.title).toContain("Vitamin D-3");
    expect(p.brand).toBe("NOW");
    expect(p.price).toBe(11.99);
    expect(p.gtin).toBe("0036000291452");
    expect(p.sourceSku).toBe("NF_0373");
    expect(p.availability).toBe("IN_STOCK");
  });

  it("perakende sayfasında ASIN uydurmaz — GTIN'e güvenilir", () => {
    const html = capturePayload([VITAMINSHOPPE_PRODUCT]);
    const result = parseCapturedHtml(html, "https://www.vitaminshoppe.com/p/now-vitamin-d3");
    // Perakende URL'sinden ASIN gelmez; Amazon eşleştirmesi GTIN ile yapılır.
    expect(result.products[0].asinCandidate).toBeNull();
  });

  it("liste fiyatı varsa indirimi raporlar", () => {
    const html = capturePayload([DISCOUNTED_PRODUCT]);
    const result = parseCapturedHtml(html, "https://www.vitaminshoppe.com/p/now-creatine-500");
    const p = result.products[0];

    expect(p.price).toBe(18.99);
    expect(p.listPrice).toBe(34.99);
    expect(p.isDiscounted).toBe(true);
    expect(p.discountPct).toBe(46);
  });

  it("kategori sayfasındaki çoklu ürünü işler", () => {
    const html = capturePayload([VITAMINSHOPPE_PRODUCT, DISCOUNTED_PRODUCT]);
    const result = parseCapturedHtml(html, "https://www.vitaminshoppe.com/c/vitamins");
    expect(result.products.length).toBeGreaterThanOrEqual(2);
  });

  it("splash screen / iskelet verisini eler", () => {
    // SPA iskeleti: sahte ürün başlığı, sahte fiyat. Sessizce geçirilirse
    // kullanıcı yanlış ürünü gerçek sanar.
    const skeleton = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "MENA Splash Screen Used by Yotta",
      offers: { "@type": "Offer", price: "1299.00", priceCurrency: "USD" },
    };
    const html = capturePayload([skeleton]);
    expect(() => parseCapturedHtml(html, "https://www.gnc.com/x/1.html")).toThrow();
  });

  it("kontrol hanesi bozuk GTIN'i kabul etmez", () => {
    const bad = { ...VITAMINSHOPPE_PRODUCT, gtin13: "0036000291453" };
    const result = parseCapturedHtml(
      capturePayload([bad]),
      "https://www.vitaminshoppe.com/p/now-vitamin-d3"
    );
    // Yanlış EAN ile eşleştirme yapmak, eşleşme yapmamaktan kötüdür.
    expect(result.products[0].gtin).toBeNull();
  });

  it("ham veri yoksa anlaşılır hata verir", () => {
    expect(() => parseCapturedHtml("", "https://www.vitaminshoppe.com/p/x")).toThrow(
      /ürün bilgisi çıkarılamadı|Ürün SAYFASI/i
    );
  });

  it("sayfa adresini kaynak URL olarak korur", () => {
    const url = "https://www.vitaminshoppe.com/p/now-vitamin-d3?utm_source=newsletter";
    const result = parseCapturedHtml(capturePayload([VITAMINSHOPPE_PRODUCT]), url);
    // Utm parametreleri temizlenmeli; izleme kodu kalıcı kayda girmemeli.
    expect(result.sourceUrl).not.toContain("utm_source");
  });
});
