import { NextResponse } from "next/server";
import { db } from "@/db";
import { productMatchCandidates, products } from "@/db/schema";
import { requireUser, isDenied } from "@/lib/guards";
import { parseBody, productMatchReviewSchema, productMatchSchema } from "@/lib/validation";
import { handleRouteError } from "@/lib/apiResponse";
import { resolveProducts } from "@/domain/productMatch";
import { and, eq, isNull } from "drizzle-orm";

/**
 * POST /api/products/resolve-amazon
 *
 * Perakende ürününü Amazon'daki karşılığına bağlar (GTIN → Keepa → ASIN).
 * Kullanıcının ilk tarif ettiği hattın son adımı: SKU'yu bul → Amazon'daki
 * doğru ürünü bul → ASIN ve linki kaydet.
 *
 * GÜVEN KURALI: yalnız `exact` (GTIN birebir) ve `high` (MPN+marka) eşleşme
 * `products.asin`e yazılır. Düşük güvenli adaylar kaydedilir ama UYGULANMAZ;
 * kullanıcı `reviewCandidates` ile onaylar. Yanlış ürüne bağlamak, bağlamamaktan
 * kötüdür.
 */

/** Tek ürün veya toplu çözümleme. */
export async function POST(req: Request) {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;
    const user = gate.user;

    const parsed = await parseBody(req, productMatchSchema);
    if ("response" in parsed) return parsed.response;
    const { productIds, domain } = parsed.data;

    if (!productIds.length) {
      return NextResponse.json({ error: "Çözümlenecek ürün seçilmedi." }, { status: 400 });
    }

    // Kota sınırı: Keepa token başına ücretlidir. Tek istekte 50 ürün sınırı
    // koyuyoruz ki bir hata, kotanın tamamını yemesin.
    const limited = productIds.slice(0, 50);

    const outcomes = await resolveProducts(limited, {
      domain: domain ?? 1,
      actorName: user.name,
    });

    const applied = outcomes.filter((o) => o.applied !== null);
    const needsReview = outcomes.filter((o) => o.applied === null && o.candidates.length > 0);
    const failed = outcomes.filter((o) => o.error && o.candidates.length === 0);
    const quotaExhausted = outcomes.some((o) => o.quotaExhausted);

    return NextResponse.json({
      requested: productIds.length,
      processed: outcomes.length,
      appliedCount: applied.length,
      needsReviewCount: needsReview.length,
      failedCount: failed.length,
      quotaExhausted,
      outcomes: outcomes.map((o) => ({
        productId: o.productId,
        title: o.title,
        applied: o.applied,
        candidates: o.candidates.map((c) => ({
          asin: c.asin,
          title: c.title,
          brand: c.brand,
          confidence: c.confidence,
          reason: c.reason,
          amazonUrl: c.amazonUrl,
        })),
        error: o.error ?? null,
        quotaExhausted: o.quotaExhausted,
      })),
    });
  } catch (error: unknown) {
    return handleRouteError("POST /api/products/resolve-amazon", error);
  }
}

/**
 * PATCH /api/products/resolve-amazon
 *
 * Düşük güvenli adayı kullanıcı onayıyla uygular (veya reddeder).
 * Onaysız uygulama yapılmaz — bu, "yanlış ürünü satma" riskinin tek
 * kontrol noktasıdır ve insan kararı gerektirir.
 */
export async function PATCH(req: Request) {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;
    const user = gate.user;

    const parsed = await parseBody(req, productMatchReviewSchema);
    if ("response" in parsed) return parsed.response;
    const { candidateId, decision } = parsed.data;

    const [candidate] = await db
      .select()
      .from(productMatchCandidates)
      .where(eq(productMatchCandidates.id, candidateId))
      .limit(1);
    if (!candidate) {
      return NextResponse.json({ error: "Aday bulunamadı." }, { status: 404 });
    }

    if (decision === "reject") {
      await db
        .update(productMatchCandidates)
        .set({ reviewedAt: new Date(), reviewedBy: user.name, isApplied: false })
        .where(eq(productMatchCandidates.id, candidateId));
      return NextResponse.json({ ok: true, decision, asin: null });
    }

    // Onaylandı: adayı uygula ve ürünün ASIN'ini güncelle.
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, candidate.productId))
      .limit(1);
    if (!product) {
      return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });
    }
    // Zaten başka bir gerçek ASIN'e bağlıysa üzerine yazma: kullanıcının
    // emeğini sessizce silmektense çakışmayı bildir.
    if (/^[A-Z0-9]{10}$/.test(product.asin) && !product.asin.startsWith("SC")) {
      return NextResponse.json(
        {
          error: `Bu ürün zaten ${product.asin} ASIN'ine bağlı. Önce onu değiştirmelisiniz.`,
        },
        { status: 409 }
      );
    }

    const previousAsin = product.asin;
    await db
      .update(products)
      .set({ asin: candidate.asin, updatedAt: new Date() })
      .where(eq(products.id, product.id));
    await db
      .update(productMatchCandidates)
      .set({ reviewedAt: new Date(), reviewedBy: user.name, isApplied: true })
      .where(eq(productMatchCandidates.id, candidateId));

    return NextResponse.json({
      ok: true,
      decision,
      asin: candidate.asin,
      previousAsin,
      amazonUrl: `https://www.amazon.com/dp/${candidate.asin}`,
    });
  } catch (error: unknown) {
    return handleRouteError("PATCH /api/products/resolve-amazon", error);
  }
}

/** GET — bekleyen adayları listeler (onay ekranı için). */
export async function GET(req: Request) {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    const rows = await db
      .select({
        candidate: productMatchCandidates,
        productTitle: products.title,
        productAsin: products.asin,
      })
      .from(productMatchCandidates)
      .innerJoin(products, eq(products.id, productMatchCandidates.productId))
      // `reviewedAt IS NULL` şart: REDDEDİLEN aday `isApplied:false` kaldığı
      // için yalnız `isApplied:false` filtresi onu tekrar listeye döndürürdü.
      // Kullanıcı reddedip aynı adayı tekrar görüyor, tekrar reddediyordu —
      // kuyruk tıkanıyor ve "reddet" işlevi görünmez hâle geliyordu.
      // Reddedilen kayıt veritabanında kalır (denetim izi), yalnız kuyruktan çıkar.
      .where(
        productId
          ? and(
              eq(productMatchCandidates.productId, Number(productId)),
              eq(productMatchCandidates.isApplied, false),
              isNull(productMatchCandidates.reviewedAt)
            )
          : and(
              eq(productMatchCandidates.isApplied, false),
              isNull(productMatchCandidates.reviewedAt)
            )
      )
      .limit(100);

    return NextResponse.json({
      count: rows.length,
      candidates: rows.map(({ candidate, productTitle, productAsin }) => ({
        id: candidate.id,
        productId: candidate.productId,
        productTitle,
        productAsin,
        asin: candidate.asin,
        title: candidate.title,
        brand: candidate.brand,
        confidence: candidate.confidence,
        reason: candidate.reason,
        source: candidate.source,
        amazonUrl: `https://www.amazon.com/dp/${candidate.asin}`,
        createdAt: candidate.createdAt,
      })),
    });
  } catch (error: unknown) {
    return handleRouteError("GET /api/products/resolve-amazon", error);
  }
}
