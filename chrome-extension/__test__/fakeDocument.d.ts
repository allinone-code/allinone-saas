// `extractor.js` tarayıcı için düz JS olarak yazıldı. TypeScript bu dosyayı
// testlerde import ettiğinde tip bildirimi bulamaz. Burada yalnız TEST için
// imza tanımlıyoruz; çalışma zamanı davranışı `extractor.js`'in kendisidir.

/** Sahte `document` ile `cerberusExtract` çağrılabilir. */
export function makeFakeDocument(spec?: {
  jsonLdScripts?: Array<{ textContent: string }>;
  metas?: Array<{ attrs: Record<string, string> }>;
  title?: string;
  url?: string;
}): unknown;

/** VitaminShoppe tarzı geçerli bir ürün JSON-LD bloğu üretir. */
export function vitaminShoppeJsonLd(overrides?: Record<string, unknown>): string;
