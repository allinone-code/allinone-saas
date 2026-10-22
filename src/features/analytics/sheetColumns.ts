import { normalizeHeaderLabel } from "@/lib/importFieldSchema";

/**
 * Yalnız verilen başlıklara ait kolonları tutar: istek küçük kalır, kart/e-posta
 * gibi gereksiz veri sunucuya gitmez. Başlıklar `normalizeHeaderLabel` ile eşlenir.
 */
export function pickColumns(rows: Record<string, unknown>[], headers: readonly string[]): Record<string, unknown>[] {
  const wanted = new Set(headers.map(normalizeHeaderLabel));
  return rows.map((r) => ({
    ...Object.fromEntries(Object.entries(r).filter(([k]) => wanted.has(normalizeHeaderLabel(k)))),
    // sheet_to_json bunu numaralandırılamaz alan olarak ekler; satır numarası için açıkça taşınır.
    __rowNum__: (r as { __rowNum__?: number }).__rowNum__,
  }));
}
