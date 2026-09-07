/**
 * CERBERUS — XLS/XLSX/CSV Matris Ayrıştırıcı (ortak, saf fonksiyonlar)
 *
 * Neden ortak modül? Aynı 40-kolon eşlemesi üç ayrı yerde (import modalı,
 * Drive-URL route'u, yapıştırma paneli) kopyalanmıştı ve kaymıştı:
 *  - CountPerBundle (kolon 33) hiçbir yerde okunmuyordu → veri kaybı
 *  - `String(cell).replace(",", ".")` ön-dönüşümü yalnızca İLK virgülü
 *    çevirdiği için "1.234,56" gibi Türkçe tutarlar bozuluyor ve satır
 *    reddediliyordu (içe aktarmanın kırılmasının ana nedenlerinden biri)
 *  - Gerçek Excel tarih hücreleri seri numarası (ör. 46043) olarak okunup
 *    veritabanına yazılıyordu (sessiz veri bozulması)
 *
 * Bu modül istemcide (dinamik import("xlsx") sonrası) ve sunucuda
 * (import-drive-url route'u) aynı şekilde kullanılır; XLSX kütüphanesine
 * BAĞIMLILIĞI YOKTUR — yalnızca ham 2B matris alır.
 */

/* ------------------------------------------------------------------ */
/* Tarih normalizasyonu                                                */
/* ------------------------------------------------------------------ */

/**
 * Excel'in 1900 tarih sistemi: seri 1 = 1900-01-01. 25569 kaydırması
 * 1970-01-01 Unix epoch'unudur (1900 artık yıl hatası zaten hesaptadır).
 * Makul sipariş tarihi aralığı: 20000 (1954) – 60000 (2064).
 */
const EXCEL_SERIAL_MIN = 20000;
const EXCEL_SERIAL_MAX = 60000;
const EXCEL_EPOCH_OFFSET = 25569;
const DAY_MS = 86_400_000;

const pad2 = (n: number) => String(n).padStart(2, "0");

function toYmd(y: number, m: number, d: number): string | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Round-trip kontrolü: 31 Şubat gibi hayali tarihleri ele
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    return null;
  }
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function excelSerialToYmd(serial: number): string | null {
  if (serial < EXCEL_SERIAL_MIN || serial > EXCEL_SERIAL_MAX) return null;
  const day = Math.floor(serial);
  const ms = (day - EXCEL_EPOCH_OFFSET) * DAY_MS;
  const d = new Date(ms);
  return toYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Her türlü tarih temsilini `YYYY-MM-DD`'ye çevirir; çevrilemezse `null`.
 *
 * Desteklenen girdiler:
 *  - `Date` örneği (`XLSX.read(..., { cellDates: true })` çıktısı)
 *  - Excel seri numarası (sayı olarak veya "46043" metni olarak)
 *  - ISO: `2026-01-21`, `2026/01/21`, `2026-01-21T10:30:00`
 *  - Türkçe yaygın biçimler: `21.01.2026`, `21/01/2026`, `21-01-26` (GG önce)
 */
export function normalizeExcelDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;

  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return toYmd(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate());
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    return excelSerialToYmd(raw);
  }

  const s = String(raw).trim();
  if (!s) return null;

  // ISO önce: YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD (saat eki serbest)
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (m) return toYmd(Number(m[1]), Number(m[2]), Number(m[3]));

  // GG.AA.YYYY / GG/AA/YYYY / GG-AA-YY (Türkçe dosyalarda gün önce gelir)
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) {
    let day = Number(m[1]);
    let month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    // Ay>12 ise alanlar ters yazılmıştır (ABD biçimi karışmış) — düzelt
    if (month > 12 && day <= 12) [day, month] = [month, day];
    return toYmd(year, month, day);
  }

  // Seri numarası metin olarak gelmiş ("46043", "46043.5")
  if (/^\d{5}(?:\.\d+)?$/.test(s)) {
    return excelSerialToYmd(Number(s));
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Başlık tespiti ve kolon eşleme                                      */
/* ------------------------------------------------------------------ */

/** Türkçe karakterleri sadeleştirip boşluk/noktalama atarak parmak izi üretir. */
function foldHeader(h: unknown): string {
  return String(h ?? "")
    .toLocaleLowerCase("tr")
    .replace(/i̇/g, "i")
    .replace(/[ıİ]/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Alan → olası başlık adları. ARCHITECTURE_AND_DATABASE_SPEC.md'deki resmî
 * 40-kolon tanımı + sahada görülen yaygın varyantlar.
 */
const HEADER_ALIASES: Record<string, string[]> = {
  buyerStore: ["Satın Alan", "Mağaza", "Store", "buyer_store"],
  orderDate: ["Tarih", "Tarih1", "Sipariş Tarihi", "order_date", "Date"],
  imageUrl: ["Ürün resmi", "Ürün resmi linki", "Resim", "Image", "image_url"],
  fulfillmentType: ["FBM/FBA", "FBA/FBM", "Fulfillment", "Gönderim tipi", "fulfillment_type"],
  productTitle: ["Ürün adı Amazon", "Ürün adı", "Ürün", "Title", "product_title"],
  asin: ["ASIN", "asin"],
  msku: ["MSKU", "msku"],
  supplierName: ["Satıcı adı", "Tedarikçi", "Supplier", "supplier_name"],
  supplierCode: ["Satıcı kodu", "Tedarikçi kodu", "supplier_code"],
  supplierUrl: ["Satıcı link", "Satıcı linki", "Tedarikçi link", "supplier_url"],
  amazonUrl: ["Amazon link", "Amazon linki", "amazon_url"],
  orderNumber: ["Orderno", "Order no", "Order No", "Sipariş no", "Sipariş numarası", "order_number"],
  driveLink: ["Order'ın drive linki", "Drive link", "Drive linki", "drive_link"],
  packCount: ["Kaçlı paket", "Kacli paket", "Pack count", "pack_count"],
  quantity: ["Ürün adedi", "Adet", "Qty", "Quantity", "Miktar"],
  unitCost: ["Ürün birim maliyeti", "Ürün birim maliyeti ($)", "Birim maliyet", "Birim maliyeti", "Unit cost", "unit_cost"],
  sellingPrice: ["Ürün satış fiyatı", "Ürün satış fiyatı ($)", "Satış fiyatı", "Satış fiyatı ($)", "Selling price", "selling_price"],
  totalCost: ["Ürün toplam maliyeti", "Ürün toplam maliyeti ($)", "Toplam maliyet", "Toplam maliyeti", "Total cost", "total_cost"],
  orderEmail: ["Mail adresi", "Email", "E-posta", "Mail", "order_email"],
  cargoStatus: ["Kargo durumu", "Kargo", "cargo_status"],
  shippedToAmazon: ["Amazona gönderilen adet", "Gönderilen adet", "Gönderilen", "shipped_to_amazon"],
  p1CancelQty: ["İptal adet-P1", "Iptal adet-P1", "İptal adet P1", "P1", "p1_cancel_qty"],
  p2MissingQty: ["Eksik adet-P2", "Eksik adet P2", "P2", "p2_missing_qty"],
  p3DefectiveQty: ["Defolu adet-P3", "Defolu adet P3", "P3", "p3_defective_qty"],
  p4ExpiredQty: ["Tarihi geçmiş adet-P4", "Tarihi gecmıs adet-P4", "P4", "p4_expired_qty"],
  problemAction: ["Problemle ilgili eylem", "Problem eylem", "Eylem", "problem_action"],
  problemResult: ["Problemle ilgili sonuç", "Problem sonuç", "Sonuç", "problem_result"],
  refundAmount: ["Refund miktarı", "Refund miktari", "Refund", "refund_amount"],
  creditCard: ["Kredi Kartı", "Kredi Kartı son 4 hane", "Kart", "credit_card"],
  isFragile: ["Fragile", "Kırılabilir", "is_fragile"],
  isMultiPack: ["MultiPack", "Multi Pack", "is_multipack"],
  isBundle: ["Bundle", "is_bundle"],
  countPerBundle: ["CountPerBundle", "Count per bundle", "Bundle içi adet", "count_per_bundle"],
  condition: ["Condition", "Kondisyon", "Ürün durumu"],
  brandName: ["Marka adı", "Marka", "Brand", "brand_name"],
  description1: ["Ürünle ilgili açıklama1", "Açıklama1", "Açıklama 1", "description_1"],
  description2: ["Ürünle ilgili açıklama2", "Açıklama2", "Açıklama 2", "description_2"],
  auditNote: ["Denetim için açıklama", "Denetim notu", "Denetim", "audit_note"],
  periodCode: ["Tarih2 (Dönem Kodu)", "Tarih2", "Dönem kodu", "Dönem", "period_code"],
  correctedCost: ["Düzeltilmiş maliyet", "Düzeltilmiş", "Duzeltilmis maliyet", "corrected_cost"],
};

/**
 * Önek eşleşmeye uygun aliaslar (uzundan kısaya, yalnızca ≥6 katlı iz).
 * "Tarih" (5 iz) gibi kısa aliaslar buna DAHİL DEĞİLDİR — yoksa "Tarihi
 * geçmiş adet-P4" kolonu yanlışlıkla tarihe eşlenirdi.
 */
const PREFIX_MIN_LEN = 6;
const PREFIX_INDEX: Array<{ folded: string; field: string }> = (() => {
  const list: Array<{ folded: string; field: string }> = [];
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const folded = foldHeader(alias);
      if (folded.length >= PREFIX_MIN_LEN) list.push({ folded, field });
    }
  }
  return list.sort((a, b) => b.folded.length - a.folded.length);
})();

/** Katlı başlık → alan: önce tam eşleşme, sonra güvenli önek ("birimmaliyet" ⊂ "birimmaliyeti"). */
function fieldForHeader(folded: string): string | undefined {
  if (!folded) return undefined;
  const exact = FOLDED_TO_FIELD.get(folded);
  if (exact) return exact;
  if (folded.length < PREFIX_MIN_LEN) return undefined;
  for (const { folded: alias, field } of PREFIX_INDEX) {
    if (folded.startsWith(alias) || alias.startsWith(folded)) return field;
  }
  return undefined;
}

/** Alan katlamalı parmak izi → alan adı (ilk eşleşme kazanır). */
const FOLDED_TO_FIELD: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const folded = foldHeader(alias);
      if (folded && !map.has(folded)) map.set(folded, field);
    }
  }
  return map;
})();

export interface HeaderDetection {
  /** Başlık satırının matris içindeki indeksi; bulunamadıysa -1 */
  headerRowIndex: number;
  /** Kolon indeksi → alan adı (yalnızca başlık bulunduysa dolu) */
  columnMap: Map<number, string>;
}

/** İlk 8 satırda en az 3 bilinen başlık içeren ilk satırı başlık sayar. */
export function detectHeaderRow(matrix: unknown[][]): HeaderDetection {
  const scanLimit = Math.min(matrix.length, 8);
  for (let i = 0; i < scanLimit; i++) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    const columnMap = new Map<number, string>();
    const usedFields = new Set<string>();
    row.forEach((cell, colIdx) => {
      const field = fieldForHeader(foldHeader(cell));
      if (field && !usedFields.has(field)) {
        usedFields.add(field);
        columnMap.set(colIdx, field);
      }
    });
    if (columnMap.size >= 3) return { headerRowIndex: i, columnMap };
  }
  return { headerRowIndex: -1, columnMap: new Map() };
}

/* ------------------------------------------------------------------ */
/* Matris → içe aktarım satırları                                      */
/* ------------------------------------------------------------------ */

export interface ParseXlsMatrixOptions {
  /** Mağaza kolonu boşsa/eksikse kullanılacak varsayılan mağaza kodu */
  defaultStore?: string;
  /** Drive'dan çekilen dosyalar için satırlara işlenecek kaynak linki */
  driveLinkFallback?: string;
}

export interface ParsedXlsMatrix {
  rows: Record<string, unknown>[];
  /** Başlık satırı bulunup kolonlar başlıktan mı eşlendi? */
  headerMapped: boolean;
}

/** Sipariş numarası boş satırlar için öngörülemez ama izlenebilir üretim. */
export function generateOrderNumber(): string {
  return `WO-${Math.floor(10000000 + Math.random() * 90000000)}`;
}

const cellStr = (v: unknown): string => String(v ?? "").trim();

/**
 * Fulfillment tipini kanonik forma getirir ("fba" → "FBA"). Bilinmeyen
 * değerler olduğu gibi bırakılır — sunucu doğrulaması onları raporlar.
 */
function normalizeFulfillment(raw: string): string {
  const up = raw.trim().toUpperCase();
  return up === "FBA" || up === "FBM" ? up : raw.trim();
}

/** Verilen kolon değerinin "tamamen boş" olup olmadığı. */
const isBlankRow = (cols: unknown[]): boolean =>
  cols.every((c) => c == null || String(c).trim() === "");

/**
 * 2B ham matrisi içe aktarım satır nesnelerine çevirir.
 *
 * İki strateji:
 *  1) Başlık satırı bulunursa kolonlar BAŞLIKTAN eşlenir (kolon sırası
 *     değişmiş/eksik dosyalara dayanıklıdır; başlık üstündeki boş/title
 *     satırları otomatik atlanır).
 *  2) Bulunamazsa resmî 40-kolon sabit konum eşlemesine geri düşer
 *     (ilk satır başlık varsayılır — eski davranış).
 *
 * ÖNEMLİ: Para değerleri burada SAYIYA ÇEVRİLMEZ. Ham hâlde bırakılır;
 * tek doğruluk noktası sunucudaki `normalizeMoney`'dir. İstemci tarafında
 * yapılan `.replace(",", ".")` ön-dönüşümü "1.234,56" gibi Türkçe
 * tutarları "1.234.56" haline getirip satırı düşürüyordu.
 */
export function parseXlsMatrix(
  rawMatrix: unknown[][],
  opts: ParseXlsMatrixOptions = {}
): ParsedXlsMatrix {
  const { defaultStore = "HRN", driveLinkFallback = "" } = opts;
  if (!rawMatrix || rawMatrix.length === 0) return { rows: [], headerMapped: false };

  const detection = detectHeaderRow(rawMatrix);
  const headerMapped = detection.headerRowIndex >= 0;
  const startIndex = headerMapped ? detection.headerRowIndex + 1 : 1;

  /** Konumsal geri dönüşüm: resmî 40-kolon sabit indeksleri */
  const at = (cols: unknown[], idx: number): unknown => (idx < cols.length ? cols[idx] : "");

  const fieldOf = (cols: unknown[], field: string, legacyIdx: number): unknown => {
    if (headerMapped) {
      for (const [colIdx, f] of detection.columnMap) {
        if (f === field) return at(cols, colIdx);
      }
      return "";
    }
    return at(cols, legacyIdx);
  };

  const rows: Record<string, unknown>[] = [];

  for (let r = startIndex; r < rawMatrix.length; r++) {
    const cols = rawMatrix[r];
    if (!Array.isArray(cols) || isBlankRow(cols)) continue;

    const productTitle = cellStr(fieldOf(cols, "productTitle", 4)) || cellStr(at(cols, 2));
    const orderNumberCell = cellStr(fieldOf(cols, "orderNumber", 11));
    // Satırın boş olmadığını anlamak için ASIN'e de bakılır ama ASIN ASLA
    // sipariş numarası yerine yazılmaz — eski kodun `cols[11] || cols[5]`
    // zinciri Orderno boşken sipariş no olarak ASIN yazıyordu.
    const asinCell = cellStr(fieldOf(cols, "asin", 5));
    if (!productTitle && !orderNumberCell && !asinCell) continue;
    const orderNumber = orderNumberCell || generateOrderNumber();

    const rawDate = fieldOf(cols, "orderDate", 1);
    const orderDate = normalizeExcelDate(rawDate) ?? cellStr(rawDate);

    const totalCostRaw = fieldOf(cols, "totalCost", 17);
    const correctedRaw = fieldOf(cols, "correctedCost", 39);

    rows.push({
      buyerStore: cellStr(fieldOf(cols, "buyerStore", 0)) || defaultStore,
      orderDate: orderDate || new Date().toISOString().split("T")[0],
      imageUrl: cellStr(fieldOf(cols, "imageUrl", 2)),
      fulfillmentType: normalizeFulfillment(cellStr(fieldOf(cols, "fulfillmentType", 3)) || "FBA"),
      productTitle: productTitle || "Excel Siparişi",
      asin: asinCell.toUpperCase(),
      msku: cellStr(fieldOf(cols, "msku", 6)),
      supplierName: cellStr(fieldOf(cols, "supplierName", 7)) || "THE VITAMINSHOPPE",
      supplierCode: cellStr(fieldOf(cols, "supplierCode", 8)) || "A198",
      supplierUrl: cellStr(fieldOf(cols, "supplierUrl", 9)),
      amazonUrl: cellStr(fieldOf(cols, "amazonUrl", 10)),
      orderNumber,
      driveLink: cellStr(fieldOf(cols, "driveLink", 12)) || driveLinkFallback,
      // Sayaç alanları ham bırakılır; sunucu normalizeCount ile doğrular
      packCount: cellStr(fieldOf(cols, "packCount", 13)) || "1",
      quantity: cellStr(fieldOf(cols, "quantity", 14)) || "1",
      // Para alanları HAM — "1.234,56" bozulmadan sunucuya gider
      unitCost: cellStr(fieldOf(cols, "unitCost", 15)) || "0",
      sellingPrice: cellStr(fieldOf(cols, "sellingPrice", 16)) || "0",
      totalCost: cellStr(totalCostRaw) || "0",
      orderEmail: cellStr(fieldOf(cols, "orderEmail", 18)),
      cargoStatus: cellStr(fieldOf(cols, "cargoStatus", 19)) || "Tam Geldi",
      shippedToAmazon: cellStr(fieldOf(cols, "shippedToAmazon", 20)) || "0",
      p1CancelQty: cellStr(fieldOf(cols, "p1CancelQty", 21)) || "0",
      p2MissingQty: cellStr(fieldOf(cols, "p2MissingQty", 22)) || "0",
      p3DefectiveQty: cellStr(fieldOf(cols, "p3DefectiveQty", 23)) || "0",
      p4ExpiredQty: cellStr(fieldOf(cols, "p4ExpiredQty", 24)) || "0",
      problemAction: cellStr(fieldOf(cols, "problemAction", 25)),
      problemResult: cellStr(fieldOf(cols, "problemResult", 26)),
      refundAmount: cellStr(fieldOf(cols, "refundAmount", 27)) || "0",
      creditCard: cellStr(fieldOf(cols, "creditCard", 28)) || "1753",
      isFragile: cellStr(fieldOf(cols, "isFragile", 29)) || "NO",
      isMultiPack: cellStr(fieldOf(cols, "isMultiPack", 30)) || "NO",
      isBundle: cellStr(fieldOf(cols, "isBundle", 31)) || "NO",
      // Kolon 33 (indeks 32): eski kodda ATLANIYORDU → veri kaybıydı
      countPerBundle: cellStr(fieldOf(cols, "countPerBundle", 32)),
      condition: cellStr(fieldOf(cols, "condition", 33)) || "New",
      brandName: cellStr(fieldOf(cols, "brandName", 34)) || "General",
      description1: cellStr(fieldOf(cols, "description1", 35)),
      description2: cellStr(fieldOf(cols, "description2", 36)),
      auditNote: cellStr(fieldOf(cols, "auditNote", 37)),
      periodCode: cellStr(fieldOf(cols, "periodCode", 38)) || "O26",
      correctedCost: cellStr(correctedRaw) || cellStr(totalCostRaw) || "0",
    });
  }

  return { rows, headerMapped };
}
