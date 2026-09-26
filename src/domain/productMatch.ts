import { eq } from "drizzle-orm";
import { db } from "@/db";
import { productMatchCandidates, productLifecycleEvents, products } from "@/db/schema";
import {
  resolveAmazonProduct,
  type AmazonProductMatch,
  type MatchConfidence,
} from "@/lib/keepa/client";

/**
 * Perakende ürününü Amazon'daki karşılığına bağlama.
 *
 * GÜVENLİK KURALI — bu modülün en önemli kuralı:
 *   `exact` (GTIN birebir) ve `high` (MPN+marka) adaylar `products.asin`e
 *   YAZILIR. `medium`/`low` adaylar YAZILMAZ; yalnız `product_match_candidates`
 *   tablosunda durur ve kullanıcı onayına bekler.
 *
 *   Neden: YANLIŞ ürüne bağlamak, bağlamamaktan kötüdür. Bağlamazsak kullanıcı
 *   "bulamadım" der ve elle bakar — bu bir kayıp değil, bir uyarıdır.
 *   Bağlarsak ve yanlışsa, sistem o ürünü alınabilir listeye koyar, Keepa
 *   analizini yanlış ürünün verisiyle doldurur ve kullanıcı gerçekten yanlış
 *   ürünü satın alabilir. Sessiz ve pahalı bir hata.
 */

export interface ResolveOutcome {
  productId: number;
  title: string;
  applied: { asin: string; confidence: MatchConfidence; reason: string } | null;
  candidates: AmazonProductMatch[];
  /** Korotu 429 → sonuç değil, kotadır. Ayırt etmek gerekir. */
  quotaExhausted: boolean;
  error?: string;
}

/** `products.asin`e güvenle yazılabilecek güven düzeyleri. */
const APPLYABLE: ReadonlySet<MatchConfidence> = new Set<MatchConfidence>(["exact", "high"]);

function sourceOf(confidence: MatchConfidence, reason: string): string {
  if (reason.toLowerCase().includes("gtin")) return "keepa-gtin";
  if (reason.toLowerCase().includes("mpn") || reason.toLowerCase().includes("sku")) return "keepa-mpn";
  return "keepa-search";
}

export interface ResolveOptions {
  /** Keepa market alanı: 1 = amazon.com. */
  domain?: number;
  actorName: string;
  /** Kota aşımında dur. */
  stopOnQuota?: boolean;
}

export async function resolveProducts(
  productIds: number[],
  options: ResolveOptions
): Promise<ResolveOutcome[]> {
  const domain = options.domain ?? 1;
  const results: ResolveOutcome[] = [];
  const quotaHit = { value: false };

  for (const productId of productIds) {
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) {
      results.push({
        productId,
        title: "",
        applied: null,
        candidates: [],
        quotaExhausted: false,
        error: "Ürün bulunamadı.",
      });
      continue;
    }

    // Zaten gerçek bir ASIN'e bağlıysa tekrar arama yapma: hem kota harcar
    // hem de doğru eşleşmeyi bozma riski doğar.
    const hasRealAsin = /^[A-Z0-9]{10}$/.test(product.asin) && !product.asin.startsWith("SC");
    if (hasRealAsin) {
      results.push({
        productId,
        title: product.title,
        applied: null,
        candidates: [],
        quotaExhausted: false,
        error: "Zaten Amazon ASIN'ine bağlı.",
      });
      continue;
    }

    // GTIN yoksa Keepa'ya gitmenin anlamı yok: arama başlık metniyle yapılır
    // ve düşük güvenle döner, bu da kullanıcıya gürültüden başka bir şey
    // vermez. Kotalar harcanmamalı.
    if (!product.upc) {
      results.push({
        productId,
        title: product.title,
        applied: null,
        candidates: [],
        quotaExhausted: false,
        error: "GTIN yok — Amazon eşleştirmesi için GTIN gerekli.",
      });
      continue;
    }

    let match: AmazonProductMatch | null = null;
    try {
      match = await resolveAmazonProduct(
        { gtin: product.upc, brand: product.brand, title: product.title },
        domain
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isQuota = /kota|429|too many/i.test(message);
      if (isQuota) quotaHit.value = true;
      results.push({
        productId,
        title: product.title,
        applied: null,
        candidates: [],
        quotaExhausted: isQuota,
        error: message,
      });
      if (isQuota && options.stopOnQuota !== false) break;
      continue;
    }

    if (!match) {
      results.push({
        productId,
        title: product.title,
        applied: null,
        candidates: [],
        quotaExhausted: false,
        error: "Keepa'da eşleşme bulunamadı.",
      });
      continue;
    }

    // Adayı kalıcı kaydet (benzersiz index: tekrar aramada çakışmaz).
    const shouldApply = APPLYABLE.has(match.confidence);
    const [saved] = await db
      .insert(productMatchCandidates)
      .values({
        productId,
        asin: match.asin,
        title: match.title,
        brand: match.brand ?? null,
        confidence: match.confidence,
        reason: match.reason,
        source: sourceOf(match.confidence, match.reason),
        isApplied: shouldApply,
      })
      .onConflictDoUpdate({
        target: [productMatchCandidates.productId, productMatchCandidates.asin],
        set: {
          // Yeniden aramada gerekçe/güven güncellenir; uygulanmış aday
          // DÜŞÜRULMEZ — bir kez doğrulanan eşleşme geri alınmaz.
          confidence: match.confidence,
          reason: match.reason,
          title: match.title,
          brand: match.brand ?? null,
        },
      })
      .returning();

    if (shouldApply) {
      const previousAsin = product.asin;
      await db
        .update(products)
        .set({ asin: match.asin, updatedAt: new Date() })
        .where(eq(products.id, productId));

      // Geçici `SC…` kimliğinden gerçek ASIN'e geçiş yaşam döngüsünde
      // kaydedilir: "neden bu ürün alınabilir listede?" sorusunun cevabı
      // altı ay sonra buradan okunur.
      await db.insert(productLifecycleEvents).values({
        productId,
        fromStage: product.lifecycleStage,
        toStage: product.lifecycleStage,
        actorName: options.actorName,
        reason: `GTIN ile Amazon eşleştirildi: ${previousAsin} → ${match.asin} (${match.confidence}, ${match.reason})`,
        contextSnapshot: {
          gtin: product.upc,
          matchedAsin: match.asin,
          confidence: match.confidence,
          reason: match.reason,
          source: sourceOf(match.confidence, match.reason),
        },
      });

      results.push({
        productId,
        title: product.title,
        applied: { asin: match.asin, confidence: match.confidence, reason: match.reason },
        candidates: saved ? [match] : [],
        quotaExhausted: false,
      });
    } else {
      // Düşük güven: products tablosuna DOKUNULMAZ, yalnız aday kaydedilir.
      results.push({
        productId,
        title: product.title,
        applied: null,
        candidates: [match],
        quotaExhausted: false,
        error:
          "Eşleşme bulundu ama güven düşük — onayınız bekliyor. Yanlış ürüne bağlamak, bağlamamaktan kötüdür.",
      });
    }
  }

  return results;
}

/** Bekleyen (uygulanmamış) aday sayısı — portföy rozeti için. */
export async function countPendingCandidates(): Promise<number> {
  const rows = await db
    .select({ id: productMatchCandidates.id })
    .from(productMatchCandidates)
    .where(eq(productMatchCandidates.isApplied, false));
  return rows.length;
}
