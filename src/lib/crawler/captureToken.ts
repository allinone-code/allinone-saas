import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { crawlerCaptureTokens } from "@/db/schema";

/**
 * Bookmarklet yakalama token'ı.
 *
 * Neden oturum çerezi değil:
 *   Bookmarklet Cerberus'un değil PERAKENDE SİTENİN sayfasında çalışır
 *   (vitaminshoppe.com). Tarayıcı o origin'den Cerberus'a istek atar ve
 *   HttpOnly oturum çerezi GÖNDERİLMEZ. Bu yüzden taşınabilir bir sır gerekir.
 *
 * Neden hash'li saklanıyor:
 *   Veritabanı sızıntısında düz token'lar tüm bookmarklet'leri geçerli kılar.
 *   SHA-256 saklıyoruz; doğrulama sabit zamanlı karşılaştırma ile yapılıyor.
 *   Token'ın kendisi yalnız üretildiği anda bir kez kullanıcıya gösterilir.
 *
 * Kapsam: yalnız ürün verisi EKLEME. Okuma, silme, başka mağazaya erişim yok —
 * mağaza kapsamı route içinde sunucu tarafında zorlanır.
 */

const TOKEN_BYTES = 32;
const MIN_TOKEN_LENGTH = 32;

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function keyFor(userEmail: string): string {
  return userEmail.toLowerCase();
}

/** Token yoksa üretir, varsa mevcut hash'i döner. Token metni bir kez verilir. */
export async function ensureCaptureToken(userEmail: string): Promise<{ token: string; created: boolean }> {
  const key = keyFor(userEmail);
  const existing = await db
    .select()
    .from(crawlerCaptureTokens)
    .where(eq(crawlerCaptureTokens.userEmail, key))
    .limit(1);

  if (existing.length) {
    // Mevcut token'ın metnini geri getiremiyoruz (hash'li saklanıyor). Bu yüzden
    // çağıran taraf önce "token var mı" diye sorar; yoksa `create` çağırır ve
    // yeni token üretir — eski geçersizleştirilerek rotasyon yapılır.
    return { token: "", created: false };
  }

  const token = randomBytes(TOKEN_BYTES).toString("hex");
  await db.insert(crawlerCaptureTokens).values({
    userEmail: key,
    tokenHash: hashToken(token),
  });
  return { token, created: true };
}

/** Yeni token üretir ve eskisini geçersizleştirir. */
export async function rotateCaptureToken(userEmail: string): Promise<string> {
  const key = keyFor(userEmail);
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const now = new Date();
  const existing = await db
    .select({ userEmail: crawlerCaptureTokens.userEmail })
    .from(crawlerCaptureTokens)
    .where(eq(crawlerCaptureTokens.userEmail, key))
    .limit(1);

  if (existing.length) {
    await db
      .update(crawlerCaptureTokens)
      .set({ tokenHash: hashToken(token), rotatedAt: now, lastUsedAt: null })
      .where(eq(crawlerCaptureTokens.userEmail, key));
  } else {
    await db.insert(crawlerCaptureTokens).values({ userEmail: key, tokenHash: hashToken(token) });
  }
  return token;
}

export async function hasCaptureToken(userEmail: string): Promise<boolean> {
  const rows = await db
    .select({ userEmail: crawlerCaptureTokens.userEmail })
    .from(crawlerCaptureTokens)
    .where(eq(crawlerCaptureTokens.userEmail, keyFor(userEmail)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Doğrulama. Hash'ler karşılaştırıldığı için `timingSafeEqual` kullanılır.
 * `lastUsedAt` yazımı en iyi çaba (best-effort) — doğrulama bunun başarısına
 * BAĞLI OLMAMALIDIR, aksi halde bir yazma hatası kullanıcıyı kilitler.
 */
export async function verifyCaptureToken(
  userEmail: string,
  provided: string | undefined | null
): Promise<boolean> {
  if (!provided || provided.length < MIN_TOKEN_LENGTH) return false;

  const rows = await db
    .select()
    .from(crawlerCaptureTokens)
    .where(eq(crawlerCaptureTokens.userEmail, keyFor(userEmail)))
    .limit(1);
  if (!rows.length) return false;

  const expected = Buffer.from(rows[0].tokenHash, "hex");
  const actual = Buffer.from(hashToken(provided), "hex");
  if (expected.length !== actual.length || expected.length === 0) return false;
  if (!timingSafeEqual(expected, actual)) return false;

  void db
    .update(crawlerCaptureTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(crawlerCaptureTokens.userEmail, keyFor(userEmail)))
    .catch(() => undefined);

  return true;
}
