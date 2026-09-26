/**
 * extractor.js'i test edebilmek için minimal sahte `document`.
 *
 * Gerçek bir DOM kütüphanesi (jsdom) projede yok ve bu eklenti için gerek de
 * değil: extractor yalnız `querySelectorAll`, `querySelector` ve
 * `location` kullanıyor. Burada tam olarak bunları taklit ediyoruz.
 *
 * Amaç şu: eklentinin sayfadan NE toplayacağını tarayıcı açmadan test etmek.
 * Bu test olmadan "eklenti çalışıyor mu" sorusunun tek cevabı saha denemesi
 * olurdu — ki o sırada ekip zaten iş yapıyor olur.
 */

function makeElement(attrs, textContent) {
  const a = attrs || {};
  return {
    textContent: textContent || "",
    outerHTML:
      a.tag === "meta"
        ? `<meta${Object.keys(a.attrs || {})
            .map((k) => ` ${k}="${a.attrs[k]}"`)
            .join("")}>`
        : "",
    getAttribute: (name) => (a.attrs ? a.attrs[name] ?? null : null),
    content: a.attrs ? a.attrs.content ?? "" : "",
  };
}

/**
 * @param {object} spec
 * @param {Array<{attrs:object,textContent?:string}>} spec.jsonLdScripts
 * @param {Array<{attrs:object}>} spec.metas
 * @param {string} spec.title
 * @param {string} spec.url
 */
export function makeFakeDocument(spec = {}) {
  const jsonLdScripts = spec.jsonLdScripts || [];
  const metas = spec.metas || [];
  const title = spec.title || "";

  return {
    location: { href: spec.url || "" },
    querySelectorAll(selector) {
      if (selector === 'script[type="application/ld+json"]') {
        return jsonLdScripts.map((s) => makeElement({ tag: "script" }, s.textContent));
      }
      if (selector === "meta") {
        return metas.map((m) => makeElement({ tag: "meta", attrs: m.attrs }));
      }
      return [];
    },
    querySelector(selector) {
      if (selector === "title") return title ? { textContent: title } : null;
      return null;
    },
  };
}

/** VitaminShoppe tarzı gerçek bir ürün JSON-LD bloğu üretir. */
export function vitaminShoppeJsonLd(overrides = {}) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: "NOW Foods Vitamin D-3 5,000 IU 240 Softgels",
    brand: { "@type": "Brand", name: "NOW" },
    sku: "NF_0373",
    gtin13: "0036000291452",
    offers: {
      "@type": "Offer",
      price: "11.99",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    ...overrides,
  });
}
