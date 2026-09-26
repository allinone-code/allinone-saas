/**
 * Sayfadaki ürün verisini toplayan SAF fonksiyon.
 *
 * Neden saf ve test edilebilir: bu dosya hem tarayıcıya enjekte edilir hem de
 * Node altında sahte bir `document` ile test edilir. Tarayıcıya özgü kod
 * (chrome.*) burada YOKTUR; `document` parametre olarak alınır. Aksi halde
 * test edilemezdi ve bu eklentinin çalışıp çalışmadığını yalnız saha denemesi
 * öğrenirdik.
 *
 * AYRIŞTIRMA SUNUCUDA: burada yalnız ham JSON-LD ve meta toplanır. Ürün/GTIN/
 * fiyat çıkarımını Cerberus'un `parseCapturedHtml` fonksiyonu yapar — eklenti ile
 * sunucu crawler'ı aynı kuralları uygular. Tarayıcıda ikinci bir ayrıştırıcı
 * kopyası yaşasak iki yol zamanla farklı veri üretirdi.
 */

/** Sayfa bağlamında çalıştırılabilen sarmalayıcı. */
function cerberusExtract(doc) {
  const jsonLd = Array.prototype.slice
    .call(doc.querySelectorAll('script[type="application/ld+json"]'))
    .map(function (s) {
      return (s.textContent || "").trim();
    })
    .filter(function (t) {
      return t.length > 0;
    })
    // Aşırı büyük JSON-LD blokları (nadir) isteği şişirir.
    .slice(0, 40)
    .map(function (t) {
      return t.slice(0, 200000);
    });

  // JSON-LD yoksa microdata'yı da kapsayacak şekilde tüm meta etiketleri.
  const meta = Array.prototype.slice
    .call(doc.querySelectorAll("meta"))
    .map(function (m) {
      const o = {};
      const keys = ["property", "name", "itemprop", "http-equiv"];
      for (let i = 0; i < keys.length; i++) {
        const k = m.getAttribute(keys[i]);
        if (k) o[k] = m.content || "";
      }
      return o;
    })
    .filter(function (o) {
      return o.property || o.name || o.itemprop || o["http-equiv"];
    })
    .map(function (o) {
      return { k: o.property || o.name || o.itemprop, c: o.property || o.name || o.itemprop ? (o[o.property || o.name || o.itemprop] || "") : "" };
    })
    .filter(function (x) {
      return x.k && x.c;
    })
    .map(function (x) {
      // Sunucudaki `pickGtin` meta etiketlerini `itemprop` üzerinden arıyor;
      // biçimi korumak için ham `<meta>` dizisini de gönderiyoruz.
      return x.k + "=" + x.c;
    });

  const metaAttrs = Array.prototype.slice
    .call(doc.querySelectorAll("meta"))
    .map(function (m) {
      return m.outerHTML || "";
    })
    .filter(function (h) {
      return h.length > 0;
    })
    .slice(0, 400);

  const title =
    (doc.querySelector && doc.querySelector("title") && doc.querySelector("title").textContent) || "";

  return {
    url: (doc.location && doc.location.href) || "",
    title: (title || "").slice(0, 300),
    jsonLd: jsonLd,
    meta: metaAttrs.join("\n"),
    metaPairs: meta,
  };
}

if (typeof window !== "undefined") {
  window.__cerberusExtract = cerberusExtract;
}
// Node altında test için.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { cerberusExtract: cerberusExtract };
}
