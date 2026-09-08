/**
 * Cerberus Crawler — vitaminshoppe.com + genel siteler için dayanıklı scraper
 *
 * İlke: Basit, etik, idempotent. JS render yok (ilk sürüm).
 * - 12 sn timeout, 2 MB limit, private IP/SSRF koruması
 * - vitaminshoppe.com için özel parser, diğerleri için generic JSON-LD / OG fallback
 * - Her istek loglanır, 6 saat cache (uygulama seviyesinde DB cache ile)
 */

export interface ScrapedItem {
  sourceUrl: string;
  sourceDomain: string;
  title: string;
  brand: string;
  price: number | null;
  currency: string;
  imageUrl: string | null;
  availability: "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
  asinCandidate: string | null;
}

export interface ScrapeResult {
  sourceUrl: string;
  sourceDomain: string;
  products: ScrapedItem[];
  warnings: string[];
  fetchedAt: string;
  isListingPage: boolean;
}

// SSRF koruması — private IP'ler, localhost, metadata endpointi engelli
const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "169.254.169.254"]);
const BLOCKED_PREFIXES = ["10.", "192.168.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31."];

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(h)) return true;
  if (h === "metadata.google.internal") return true;
  if (BLOCKED_PREFIXES.some((p) => h.startsWith(p))) return true;
  if (h.endsWith(".internal") || h.endsWith(".local")) return true;
  return false;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function normalizeUrl(url: string): string {
  const u = new URL(url);
  u.hash = "";
  // utm parametrelerini at
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"].forEach((k) => u.searchParams.delete(k));
  return u.toString();
}

// --------- HTML yardımcıları (cheerio olmadan, regex + string) ---------

function extractMetaContent(html: string, property: string): string | null {
  // <meta property="og:title" content="...">  veya <meta name="...">
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']`, "i");
  const m = html.match(re);
  if (m) return decodeHtml(m[1]);
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*?(?:property|name)=["']${property}["']`, "i");
  const m2 = html.match(re2);
  return m2 ? decodeHtml(m2[1]) : null;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function extractJsonLdProducts(html: string): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    try {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const obj of arr) {
        const o = obj as Record<string, unknown>;
        if (o["@type"] === "Product" || o["@type"] === "ItemList" || Array.isArray(o["@graph"])) {
          results.push(o);
        }
        if (Array.isArray(o["@graph"])) {
          for (const g of o["@graph"] as unknown[]) {
            const gg = g as Record<string, unknown>;
            if (gg["@type"] === "Product") results.push(gg);
          }
        }
      }
    } catch {
      // bozuk JSON-LD atla
    }
  }
  return results;
}

function extractFirstPrice(text: string): { amount: number; currency: string } | null {
  // $29.99, USD 29.99, 29.99 USD
  const m = text.match(/\$[\s]*([\d,]+\.?\d*)/);
  if (m) return { amount: Number(m[1].replace(/,/g, "")), currency: "USD" };
  const m2 = text.match(/([\d,]+\.?\d*)\s*USD/i);
  if (m2) return { amount: Number(m2[1].replace(/,/g, "")), currency: "USD" };
  return null;
}

function parseVitaminShoppe(html: string, baseUrl: string, domain: string): ScrapedItem[] {
  const items: ScrapedItem[] = [];
  // 1) JSON-LD dene
  const ld = extractJsonLdProducts(html);
  for (const p of ld) {
    if (p["@type"] === "Product") {
      const name = (p.name as string) || (p["name"] as string) || "";
      if (!name) continue;
      const brandRaw = p.brand;
      const brand = typeof brandRaw === "string" ? brandRaw : (brandRaw as Record<string, unknown>)?.name as string || "THE VITAMINSHOPPE";
      const offers = p.offers as Record<string, unknown> | undefined;
      let price: number | null = null;
      let currency = "USD";
      let availability: ScrapedItem["availability"] = "UNKNOWN";
      let image: string | null = null;
      if (offers) {
        const po = offers.price as string | number | undefined;
        if (po !== undefined) price = Number(String(po).replace(/,/g, ""));
        currency = (offers.priceCurrency as string) || "USD";
        const av = String(offers.availability || "").toLowerCase();
        if (av.includes("instock")) availability = "IN_STOCK";
        else if (av.includes("outofstock")) availability = "OUT_OF_STOCK";
      }
      const imgRaw = p.image;
      if (typeof imgRaw === "string") image = imgRaw;
      else if (Array.isArray(imgRaw) && imgRaw[0]) image = String(imgRaw[0]);
      // URL: p.url veya base
      let productUrl = (p.url as string) || baseUrl;
      try {
        productUrl = new URL(productUrl, baseUrl).toString();
      } catch { productUrl = baseUrl; }
      // ASIN adayı: vitaminshoppe SKU'su veya URL'deki /p/... kısmı
      const asinCandidate = extractAsinCandidate(productUrl, html);
      items.push({
        sourceUrl: productUrl,
        sourceDomain: domain,
        title: decodeHtml(String(name).trim()),
        brand: decodeHtml(String(brand).trim()) || "THE VITAMINSHOPPE",
        price: price !== null && Number.isFinite(price) ? price : null,
        currency,
        imageUrl: image,
        availability,
        asinCandidate,
      });
    }
  }
  if (items.length) return items;

  // 2) VitaminShoppe özel HTML fallback — product tile'ları
  // Örnek: class="product-tile" veya data-product
  const tileRe = /<a[^>]+href=["']([^"']*\/p\/[^"']+)["'][^>]*>[\s\S]*?<\/a>/gi;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  // Sayfa başlığı ve fiyatı tek ürün sayfası ise
  const ogTitle = extractMetaContent(html, "og:title");
  const ogImage = extractMetaContent(html, "og:image");
  const priceText = html.match(/["']price["']\s*:\s*["']?\$?([\d.,]+)["']?/i)?.[1] || html.match(/class="[^"]*price[^"]*"[^>]*>\s*\$([\d.,]+)/i)?.[1];
  if (ogTitle && priceText) {
    const price = Number(priceText.replace(/,/g, ""));
    items.push({
      sourceUrl: normalizeUrl(baseUrl),
      sourceDomain: domain,
      title: ogTitle,
      brand: extractMetaContent(html, "og:brand") || html.match(/"brand"\s*:\s*"([^"]+)"/i)?.[1] || "THE VITAMINSHOPPE",
      price: Number.isFinite(price) ? price : null,
      currency: "USD",
      imageUrl: ogImage,
      availability: /out of stock/i.test(html) ? "OUT_OF_STOCK" : /in stock/i.test(html) ? "IN_STOCK" : "UNKNOWN",
      asinCandidate: extractAsinCandidate(baseUrl, html),
    });
    if (items.length) return items;
  }

  // 3) Liste sayfası tile'ları
  while ((m = tileRe.exec(html)) !== null) {
    const href = m[1];
    if (seen.has(href)) continue;
    seen.add(href);
    let full = href;
    try {
      full = new URL(href, baseUrl).toString();
    } catch { continue; }
    if (items.length >= 30) break;
    // Başlığı tile içinden çıkarmaya çalış
    const titleMatch = m[0].match(/title=["']([^"']+)["']/i) || m[0].match(/alt=["']([^"']+)["']/i);
    const title = titleMatch ? decodeHtml(titleMatch[1]) : `VitaminShoppe Ürünü ${items.length + 1}`;
    items.push({
      sourceUrl: full,
      sourceDomain: domain,
      title,
      brand: "THE VITAMINSHOPPE",
      price: null,
      currency: "USD",
      imageUrl: null,
      availability: "UNKNOWN",
      asinCandidate: extractAsinCandidate(full, html),
    });
  }
  return items;
}

function extractAsinCandidate(url: string, html: string): string | null {
  // Amazon ASIN 10 haneli, VitaminShoppe SKU'su VS-123 gibi olabilir
  const m = url.match(/\/p\/([^/?#]+)/i);
  if (m) return m[1].slice(0, 32).toUpperCase();
  const m2 = url.match(/\b(B0[A-Z0-9]{8})\b/i);
  if (m2) return m2[1].toUpperCase();
  const m3 = html.match(/\b(VS-\d+|VS\d+)\b/i);
  if (m3) return m3[1].toUpperCase();
  return null;
}

function parseGeneric(html: string, baseUrl: string, domain: string): ScrapedItem[] {
  const items: ScrapedItem[] = [];
  const ld = extractJsonLdProducts(html);
  for (const p of ld) {
    if (p["@type"] === "Product") {
      const name = String(p.name || p.title || "").trim();
      if (!name) continue;
      const brandRaw = p.brand;
      const brand = typeof brandRaw === "string" ? brandRaw : (brandRaw as Record<string, unknown>)?.name as string || domain.split(".")[0].toUpperCase();
      const offers = p.offers as Record<string, unknown> | undefined;
      let price: number | null = null;
      let currency = "USD";
      let availability: ScrapedItem["availability"] = "UNKNOWN";
      let image: string | null = null;
      if (offers) {
        const po = offers.price as string | number | undefined;
        if (po !== undefined) price = Number(String(po).replace(/,/g, ""));
        currency = (offers.priceCurrency as string) || "USD";
        const av = String(offers.availability || "").toLowerCase();
        if (av.includes("instock")) availability = "IN_STOCK";
        else if (av.includes("outofstock")) availability = "OUT_OF_STOCK";
      }
      const imgRaw = p.image;
      if (typeof imgRaw === "string") image = imgRaw;
      else if (Array.isArray(imgRaw) && imgRaw[0]) image = String(imgRaw[0]);
      let productUrl = (p.url as string) || baseUrl;
      try {
        productUrl = new URL(productUrl, baseUrl).toString();
      } catch { productUrl = baseUrl; }
      items.push({
        sourceUrl: productUrl,
        sourceDomain: domain,
        title: decodeHtml(name),
        brand: decodeHtml(String(brand)),
        price: price !== null && Number.isFinite(price) ? price : null,
        currency,
        imageUrl: image,
        availability,
        asinCandidate: extractAsinCandidate(productUrl, html),
      });
    }
    // ItemList ise iç ürünler
    if (p["@type"] === "ItemList" && Array.isArray(p.itemListElement)) {
      for (const el of p.itemListElement as unknown[]) {
        const e = el as Record<string, unknown>;
        const item = (e.item as Record<string, unknown>) || e;
        if (item["@type"] === "Product" && item.name) {
          items.push({
            sourceUrl: baseUrl,
            sourceDomain: domain,
            title: decodeHtml(String(item.name)),
            brand: String((item.brand as Record<string, unknown>)?.name || domain.split(".")[0].toUpperCase()),
            price: null,
            currency: "USD",
            imageUrl: (item.image as string) || null,
            availability: "UNKNOWN",
            asinCandidate: null,
          });
        }
      }
    }
  }
  if (items.length) return items;

  // OG fallback — tek ürün
  const ogTitle = extractMetaContent(html, "og:title") || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "";
  if (ogTitle) {
    const ogImage = extractMetaContent(html, "og:image");
    const ogPrice = extractMetaContent(html, "product:price:amount") || extractMetaContent(html, "og:price:amount") || html.match(/["']price["']\s*:\s*["']?\$?([\d.,]+)/i)?.[1];
    const price = ogPrice ? Number(String(ogPrice).replace(/,/g, "").replace("$", "")) : null;
    const cleaned = decodeHtml(ogTitle.trim());
    if (cleaned && cleaned.length > 5) {
      items.push({
        sourceUrl: normalizeUrl(baseUrl),
        sourceDomain: domain,
        title: cleaned,
        brand: extractMetaContent(html, "product:brand") || extractMetaContent(html, "og:brand") || domain.split(".")[0].toUpperCase(),
        price: price !== null && Number.isFinite(price) ? price : null,
        currency: extractMetaContent(html, "product:price:currency") || "USD",
        imageUrl: ogImage,
        availability: /out of stock/i.test(html) ? "OUT_OF_STOCK" : /in stock/i.test(html) ? "IN_STOCK" : "UNKNOWN",
        asinCandidate: extractAsinCandidate(baseUrl, html),
      });
    }
  }
  return items;
}

/**
 * Ana tarama fonksiyonu — URL'i çeker, parser'ları sırayla dener.
 */
export async function scrapeUrl(rawUrl: string): Promise<ScrapeResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Geçersiz URL: ${rawUrl}`);
  }
  if (!url.protocol.startsWith("http")) throw new Error("Yalnızca http/https URL'leri taranabilir.");
  if (isBlockedHostname(url.hostname)) throw new Error("Bu host taranamaz (güvenlik politikası).");

  const sourceDomain = extractDomain(rawUrl);
  const normalized = normalizeUrl(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  let response: Response;
  try {
    response = await fetch(normalized, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CerberusCommerceBot/1.0; +https://cerberus-commerce.io/bot)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,tr;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });
  } catch (e: unknown) {
    clearTimeout(timeout);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("aborted") || msg.includes("AbortError")) throw new Error("Site 12 saniyede yanıt vermedi (timeout).");
    throw new Error(`Ağ hatası: ${msg}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Site hatası ${response.status} ${response.statusText}. URL'yi kontrol edin.`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    throw new Error(`Bu URL HTML değil (${contentType}). Ürün/kategori sayfası deneyin.`);
  }
  const contentLength = Number(response.headers.get("content-length") || "0");
  if (contentLength > 2 * 1024 * 1024) {
    throw new Error("Sayfa çok büyük (>2 MB), taranamadı.");
  }

  const html = await response.text();
  if (html.length > 2_500_000) throw new Error("Sayfa çok büyük, taranamadı.");
  if (html.length < 500) throw new Error("Sayfa boş veya erişim engellendi.");

  const warnings: string[] = [];
  let products: ScrapedItem[] = [];
  let isListingPage = false;

  // VitaminShoppe özel
  if (sourceDomain.includes("vitaminshoppe")) {
    products = parseVitaminShoppe(html, normalized, sourceDomain);
    // Liste sayfası heuristiği: çok ürün + kategori kelimesi
    isListingPage = products.length > 3 || /\/c\//.test(normalized) || /category/i.test(html.slice(0, 5000));
  }

  if (!products.length) {
    products = parseGeneric(html, normalized, sourceDomain);
  }

  if (!products.length) {
    // Son çare: sayfadaki tüm ürün linklerini ham topla
    const linkRe = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html)) !== null) {
      const href = m[1];
      if (!href.includes("/p/") && !href.includes("/product") && !href.includes("/dp/")) continue;
      let full: string;
      try {
        full = new URL(href, normalized).toString();
      } catch { continue; }
      if (seen.has(full)) continue;
      seen.add(full);
      if (products.length >= 10) break;
      products.push({
        sourceUrl: full,
        sourceDomain,
        title: `Keşfedilen Ürün ${products.length + 1}`,
        brand: sourceDomain.split(".")[0].toUpperCase(),
        price: null,
        currency: "USD",
        imageUrl: null,
        availability: "UNKNOWN",
        asinCandidate: extractAsinCandidate(full, html),
      });
    }
    if (products.length) warnings.push("Sayfadan yapılandırılmış ürün verisi çıkarılamadı, ham linkler toplandı. Tek ürün sayfası daha isabetlidir.");
  }

  if (!products.length) {
    throw new Error("Bu sayfadan ürün bilgisi çıkarılamadı. Lütfen tek ürün sayfasını (örn. /p/...) deneyin veya sayfanın herkese açık olduğunu kontrol edin.");
  }

  // Fiyatı null olanlara uyarı
  const withoutPrice = products.filter((p) => p.price === null).length;
  if (withoutPrice) warnings.push(`${withoutPrice} üründe fiyat bulunamadı; ürün sayfasından tekrar tarayın.`);

  // Kırp ve temizle
  const cleaned = products.slice(0, 30).map((p) => ({
    ...p,
    title: p.title.slice(0, 300),
    brand: p.brand.slice(0, 80),
  }));

  return {
    sourceUrl: normalized,
    sourceDomain,
    products: cleaned,
    warnings,
    fetchedAt: new Date().toISOString(),
    isListingPage,
  };
}
