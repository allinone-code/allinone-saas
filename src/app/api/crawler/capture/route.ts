import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, scrapeJobs } from "@/db/schema";
import { requireUser, isDenied, resolveStoreScope } from "@/lib/guards";
import { validateOutboundUrlSyntax } from "@/lib/httpSafety";
import { handleRouteError } from "@/lib/apiResponse";
import { parseCapturedHtml } from "@/lib/crawler/scraper";
import { describePriceDrops, persistScrapedProducts } from "@/lib/crawler/persistProducts";
import { verifyCaptureToken } from "@/lib/crawler/captureToken";
import { eq } from "drizzle-orm";

/**
 * POST /api/crawler/capture — bookmarklet'in gönderdiği ürün verisi.
 *
 * NEDEN AYRI UÇ: `/api/crawler/scrape` sunucudan indirme yapar; bot
 * koruması olan perakende sitelerinde bu imkânsızdır. Bookmarklet ise
 * KULLANICININ KENDİ tarayıcısından, oturumu açıkken çalışır. Site gerçek bir
 * tarayıcı isteği gördüğü için engellemez.
 *
 * AYRIŞTIRMA SUNUCUDA: bookmarklet ham JSON-LD + meta gönderir, ürün
 * çıkarımını `parseCapturedHtml` yapar. Böylece GTIN doğrulama, sahte ürün
 * filtresi ve indirim tespiti TEK yerde kalır; tarayıcıda ikinci bir kopya
 * yaşarsa iki yol zamanla farklı veri üretir.
 *
 * CORS: Gövde `text/plain` ile gönderilir (CORS-safelisted) ve özel header
 * kullanılmaz. Bu sayede tarayıcı PREFLIGHT uçmaz, `OPTIONS` handler'a ve
 * ek CORS yüzeyine gerek kalmaz. Yanıtta perakende origin'e izin verilir.
 */

/** Veri gönderimi için izin verilen kökler. */
const ALLOWED_ORIGINS = [
  "https://www.vitaminshoppe.com",
  "https://vitaminshoppe.com",
  "https://www.iherb.com",
  "https://www.walgreens.com",
  "https://www.gnc.com",
  "https://www.lifesupplementstore.com",
  "https://www.amazon.com",
];

const MAX_BODY_BYTES = 512 * 1024;

function corsHeaders(origin: string | null): Record<string, string> {
  // `*` kullanmıyoruz: istek zaten kimlik doğrulamalı, ama açık liste
  // saldırı yüzeyini daraltır ve beklenmeyen originlerden veri alınmasını
  // engeller.
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : null;
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": allowed } : {}),
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
}

interface CaptureBody {
  captureToken?: string;
  url?: string;
  /** Tarayıcıdan toplanan ham JSON-LD blokları. */
  jsonLd?: string[];
  /** og:* ve itemprop meta etiketleri. */
  meta?: string;
  storeCode?: string;
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  try {
    const gate = await requireUser();
    if (isDenied(gate)) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401, headers: cors });
    const user = gate.user;

    // Gövde boyut sınırı — bookmarklet sayfa boyutunda veri göndermemeli.
    const declared = Number(req.headers.get("content-length") || "0");
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Gönderilen veri çok büyük. Ürün sayfasından tekrar deneyin." },
        { status: 413, headers: cors }
      );
    }
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Gönderilen veri çok büyük." },
        { status: 413, headers: cors }
      );
    }

    let body: CaptureBody;
    try {
      body = JSON.parse(raw) as CaptureBody;
    } catch {
      return NextResponse.json({ error: "Geçersiz gövde." }, { status: 400, headers: cors });
    }

    // Token, oturum çerezinin yerine geçer: bookmarklet perakende sayfasından
    // çalıştığı için HttpOnly oturum çerezi gönderilemez.
    const tokenOk = await verifyCaptureToken(user.email, body.captureToken);
    if (!tokenOk) {
      return NextResponse.json(
        { error: "Capture token geçersiz veya eksik. Cerberus → İndirim Takip Masası ekranından yeni token alın." },
        { status: 401, headers: cors }
      );
    }

    const storeCode = resolveStoreScope(user, body.storeCode || "HRN");

    // Sayfa URL'si kaydedilecek ve ileride sunucu crawler'ı tarafından
    // tekrar çekilebileceği için aynı outbound politikasından geçirilir.
    let sourceUrl: string;
    try {
      sourceUrl = validateOutboundUrlSyntax(body.url || "").toString();
    } catch {
      return NextResponse.json(
        { error: "Geçersiz sayfa adresi. Ürün sayfasının adresini gönderin." },
        { status: 400, headers: cors }
      );
    }

    const jsonLd = Array.isArray(body.jsonLd) ? body.jsonLd.slice(0, 40) : [];
    const meta = typeof body.meta === "string" ? body.meta.slice(0, 100_000) : "";
    if (!jsonLd.length && !meta) {
      return NextResponse.json(
        { error: "Sayfada ürün verisi bulunamadı. Ürün sayfasında (kategori listesi değil) tekrar deneyin." },
        { status: 422, headers: cors }
      );
    }

    // Sunucu tarafı ayrıştırma — bookmarklet ile crawler aynı kuralları kullanır.
    const syntheticHtml = [
      ...jsonLd.map(
        (block) => `<script type="application/ld+json">${block.replace(/<\/script/gi, "<\\/script")}</script>`
      ),
      meta,
    ].join("\n");

    let parsed;
    try {
      parsed = parseCapturedHtml(syntheticHtml, sourceUrl, sourceUrl, "js-stealth");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sayfa çözümlenemedi.";
      return NextResponse.json({ error: message }, { status: 422, headers: cors });
    }

    // Denetim izi için iş kaydı — `scraped_products.job_id` foreign key.
    const domain = parsed.sourceDomain;
    const [job] = await db
      .insert(scrapeJobs)
      .values({
        sourceUrl,
        sourceDomain: domain,
        storeCode,
        status: "PENDING",
        createdBy: user.email,
      })
      .returning();

    const now = new Date();
    const persisted = await persistScrapedProducts({
      products: parsed.products,
      sourceDomain: domain,
      jobId: job.id,
      now,
    });

    await db
      .update(scrapeJobs)
      .set({ status: "DONE", productCount: persisted.rows.length, completedAt: now })
      .where(eq(scrapeJobs.id, job.id));

    const warnings = [...parsed.warnings];
    const dropLine = describePriceDrops(persisted.priceDrops);
    if (dropLine) warnings.unshift(dropLine);

    await db.insert(auditLogs).values({
      actorName: user.name,
      storeCode,
      actionType: "CRAWL_CAPTURE",
      targetEntity: `${domain} (${persisted.rows.length} ürün)`,
      beforeState: sourceUrl,
      afterState: "CAPTURED",
      details: `Bookmarklet: ${sourceUrl} → ${persisted.rows.length} ürün, ${persisted.priceDrops.length} fiyat düşüşü`,
    });

    return NextResponse.json(
      {
        ok: true,
        sourceUrl,
        sourceDomain: domain,
        products: persisted.rows,
        priceDrops: persisted.priceDrops,
        warnings,
        capturedAt: now.toISOString(),
      },
      { status: 200, headers: cors }
    );
  } catch (error: unknown) {
    return handleRouteError("POST /api/crawler/capture", error, cors);
  }
}
