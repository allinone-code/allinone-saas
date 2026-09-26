import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { makeFakeDocument, vitaminShoppeJsonLd } from "./fakeDocument";
import { parseCapturedHtml } from "@/lib/crawler/scraper";

/**
 * Chrome eklentisi ↔ sunucu sözleşme testi.
 *
 * Eklenti `extractor.js` ile ham veri toplar, sunucu `parseCapturedHtml` ile
 * ayrıştırır. Aradaki sözleşme test edilmezse eklenti saha denemesinde bozulur —
 * ve kullanıcı bunu "eklenti çalışmıyor" diye yaşar, oysa asıl sorun
 * iki tarafın uyuşmazlığıdır.
 *
 * Bu test, eklentinin gönderdiği verinin sunucunun GERÇEKTEN ürün okuyabildiğini
 * kanıtlar. Üretimde ikisi de çalışmayan zaman aşımına uğramaz.
 */

const require = createRequire(import.meta.url);
// extractor.js tarayıcı için yazıldı (window, module.exports). Test altında
// require edilebilmesi için ortam değişkenleri sağlanır.
const { cerberusExtract } = require("../extractor.js");

const PRODUCT_URL = "https://www.vitaminshoppe.com/p/now-vitamin-d3";

describe("eklenti → sunucu sözleşmesi", () => {
  it("eklentinin topladığı veriden sunucu ürün çıkarır", () => {
    const doc = makeFakeDocument({
      url: PRODUCT_URL,
      title: "NOW Vitamin D-3 | The Vitamin Shoppe",
      jsonLdScripts: [{ textContent: vitaminShoppeJsonLd() }],
    });

    const captured = cerberusExtract(doc);
    expect(captured.url).toBe(PRODUCT_URL);
    expect(captured.jsonLd).toHaveLength(1);

    // Sunucu tarafı: eklentinin gönderdiği biçimi taklit et.
    const html = `<script type="application/ld+json">${captured.jsonLd[0]}</script>${captured.meta}`;
    const result = parseCapturedHtml(html, captured.url);

    expect(result.products).toHaveLength(1);
    expect(result.products[0].title).toContain("Vitamin D-3");
    expect(result.products[0].price).toBe(11.99);
    expect(result.products[0].gtin).toBe("0036000291452");
    expect(result.products[0].sourceSku).toBe("NF_0373");
    expect(result.products[0].availability).toBe("IN_STOCK");
  });

  it("indirimli üründe düşüşü raparlar", () => {
    const doc = makeFakeDocument({
      url: PRODUCT_URL,
      jsonLdScripts: [
        {
          textContent: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "NOW Foods Creatine Monohydrate 500 Gr",
            brand: { name: "NOW" },
            gtin13: "0036000291452",
            offers: { lowPrice: "18.99", highPrice: "34.99", priceCurrency: "USD" },
          }),
        },
      ],
    });

    const captured = cerberusExtract(doc);
    const result = parseCapturedHtml(`<script type="application/ld+json">${captured.jsonLd[0]}</script>`, captured.url);
    expect(result.products[0].isDiscounted).toBe(true);
    expect(result.products[0].discountPct).toBe(46);
  });

  it("JSON-LD olmayan sayfada meta etiketlerini de toplar", () => {
    // Bazı küçük mağazalar JSON-LD kullanmaz; yalnız meta var. Eklenti bu
    // durumda da bir şey göndermeli, sunucu OG fallback'ini çalıştırsın.
    const doc = makeFakeDocument({
      url: "https://kucukmagaza.com/urun/123",
      jsonLdScripts: [],
      metas: [
        { attrs: { property: "og:title", content: "Vitamin C 1000mg" } },
        { attrs: { property: "product:price:amount", content: "8.49" } },
        { attrs: { property: "product:price:currency", content: "USD" } },
      ],
    });

    const captured = cerberusExtract(doc);
    expect(captured.jsonLd).toHaveLength(0);
    expect(captured.meta).toContain("og:title");
    expect(captured.meta).toContain("product:price:amount");

    const result = parseCapturedHtml(captured.meta, captured.url);
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products[0].title).toContain("Vitamin C");
  });

  it("splash screen gibi iskelet sayfayı eler", () => {
    const doc = makeFakeDocument({
      url: "https://www.gnc.com/x/1.html",
      jsonLdScripts: [
        {
          textContent: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "MENA Splash Screen Used by Yotta",
            offers: { price: "1299.00", priceCurrency: "USD" },
          }),
        },
      ],
    });

    const captured = cerberusExtract(doc);
    expect(() =>
      parseCapturedHtml(`<script type="application/ld+json">${captured.jsonLd[0]}</script>`, captured.url)
    ).toThrow();
  });

  it("devasa JSON-LD bloğunu kırpar (istek şişmesin)", () => {
    const doc = makeFakeDocument({
      url: PRODUCT_URL,
      jsonLdScripts: [{ textContent: "x".repeat(500000) }],
    });
    const captured = cerberusExtract(doc);
    expect(captured.jsonLd[0].length).toBeLessThanOrEqual(200000);
  });

  it("çok fazla JSON-LD bloğunu sınırlar", () => {
    const doc = makeFakeDocument({
      url: "https://kategori.com/c/vitamins",
      jsonLdScripts: Array.from({ length: 80 }, () => ({ textContent: vitaminShoppeJsonLd() })),
    });
    const captured = cerberusExtract(doc);
    expect(captured.jsonLd.length).toBeLessThanOrEqual(40);
  });

  it("sayfa URL'sini ve başlığı döner", () => {
    const doc = makeFakeDocument({ url: PRODUCT_URL, title: "Ürün Sayfası" });
    const captured = cerberusExtract(doc);
    expect(captured.url).toBe(PRODUCT_URL);
    expect(captured.title).toBe("Ürün Sayfası");
  });

  it("çerez/oturum bilgisi göndermez — yalnız ürün verisi", () => {
    // Eklenti doğrudan API'ye istek atar; sayfadaki çerezleri okumaya
    // çalışmamalı. Yanlışlıkla `document.cookie` toplanırsa kullanıcının
    // oturumu dışarı sızar.
    const base = makeFakeDocument({ url: PRODUCT_URL, jsonLdScripts: [{ textContent: "{}" }] }) as Record<
      string,
      unknown
    >;
    const doc = { ...base, cookie: "session=secret; datadome=secret" };
    const captured = cerberusExtract(doc);
    expect(JSON.stringify(captured)).not.toContain("secret");
  });
});
