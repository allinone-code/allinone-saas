import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Merkezi hata sarmalayıcı (T3.3).
 * - Ham hata mesajı/stack İSTEMCIYE ASLA dönmez (bilgi sızıntısı engeli)
 * - Her 500 için korelasyon ID üretilir; sunucu logu ile istemci yanıtı eşleştirilebilir
 */
export function handleRouteError(scope: string, error: unknown): NextResponse {
  const correlationId = crypto.randomUUID();
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  logger.error({ scope, correlationId, err: { message, stack } }, "Route hatası");

  return NextResponse.json(
    {
      error: "İşlem sırasında beklenmeyen bir hata oluştu.",
      correlationId,
    },
    { status: 500, headers: { "x-correlation-id": correlationId } }
  );
}

/** Standart 4xx hata yanıtı */
export function apiError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Üst sınırı aşan istek gövdeleri için */
export const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024; // 2 MB (T3.4)
