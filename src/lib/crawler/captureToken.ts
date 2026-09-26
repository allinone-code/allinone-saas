import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
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
 * Neden ŞİFRELİ saklanıyor, düz metin değil:
 *   Token ekipteki 10 kişinin her biri kendi tarayıcısına kuracak. Token
 *   düz metin saklansaydı görüntülemek kolay olurdu; ama token'ı gösteremediğimiz
 *   için herkes "yenile"ye basar ve BİRBİRLERİNİN bookmarklet'ini geçersiz
 *   kılardı. Hash-only saklama da aynı sorunu yaratır (tek seferlik gösterim).
 *   AES-GCM ile şifreli saklıyoruz: tekrar gösterilebilir, ama veritabanı
 *   sızıntısında işe yaramaz — anahtar (SESSION_SECRET) kod deposunda değil,
 *   ortam değişkeninde.
 *
 * Neden hash de tutuluyor:
 *   Doğrulama şifre çözme yapmadan, sabit zamanlı hash karşılaştırmasıyla
 *   yapılır. Şifre çözme + karşılaştırma zincirinde bir hata, kimlik
 *   doğrulamayı kırılganlaştırır; ayrıca `last_used_at` güncellemesi her
 *   istekte yazma gerektirmesin diye hash üzerinden tek sorgu yeterli.
 *
 * Kapsam: yalnız ürün verisi EKLEME. Okuma, silme, başka mağazaya erişim yok —
 * mağaza kapsamı route içinde sunucu tarafında zorlanır.
 */

const TOKEN_BYTES = 32;
const MIN_TOKEN_LENGTH = 32;
const ENCRYPTION_VERSION = "v1";

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function keyFor(userEmail: string): string {
  return userEmail.toLowerCase();
}

/** AES anahtarı — SESSION_SECRET'tan türetilir. Ayrı env gerektirmez. */
function encryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    // Sessizce düşmemek kritik: üretimde session secret zaten zorunlu, ama
    // eksikse açık bir hata vermek, token'ı farklı bir anahtarla şifrelemekten
    // (ve sonra çözememekten) iyidir.
    throw new Error("SESSION_SECRET tanımlı değil veya 32 karakterden kısa; capture token şifrelenemiyor.");
  }
  return createHash("sha256").update(`cerberus-capture-token:${secret}`, "utf8").digest();
}

/** token → `v1:<iv-b64>:<tag-b64>:<cipher-b64>` */
function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    ENCRYPTION_VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

function decryptToken(stored: string): string | null {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== ENCRYPTION_VERSION) return null;
  try {
    const iv = Buffer.from(parts[1], "base64");
    const tag = Buffer.from(parts[2], "base64");
    const data = Buffer.from(parts[3], "base64");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    // SESSION_SECRET değişmiş veya veri bozulmuş. Sessizce null: eski token
    // geçersiz sayılır, kullanıcı yenileyebilir.
    return null;
  }
}

/** Token yoksa üretir. Varsa şifresini çözüp döner. */
export async function ensureCaptureToken(userEmail: string): Promise<{ token: string; created: boolean }> {
  const key = keyFor(userEmail);
  const existing = await db
    .select()
    .from(crawlerCaptureTokens)
    .where(eq(crawlerCaptureTokens.userEmail, key))
    .limit(1);

  if (existing.length) {
    const decrypted = decryptToken(existing[0].tokenEncrypted);
    if (decrypted) return { token: decrypted, created: false };
    // Şifre çözülemedi (secret değişmiş olabilir) → yeni token üret.
  }

  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const row = {
    tokenHash: hashToken(token),
    tokenEncrypted: encryptToken(token),
  };
  if (existing.length) {
    await db
      .update(crawlerCaptureTokens)
      .set({ ...row, rotatedAt: new Date(), lastUsedAt: null })
      .where(eq(crawlerCaptureTokens.userEmail, key));
  } else {
    await db.insert(crawlerCaptureTokens).values({ userEmail: key, ...row });
  }
  return { token, created: !existing.length };
}

/** Yeni token üretir ve eskisini geçersizleştirir. */
export async function rotateCaptureToken(userEmail: string): Promise<string> {
  const token = await ensureCaptureToken(userEmail);
  // Rotasyon her zaman YENİ token demektir; mevcut varsa değiştir.
  if (!token.created) {
    const fresh = randomBytes(TOKEN_BYTES).toString("hex");
    await db
      .update(crawlerCaptureTokens)
      .set({
        tokenHash: hashToken(fresh),
        tokenEncrypted: encryptToken(fresh),
        rotatedAt: new Date(),
        lastUsedAt: null,
      })
      .where(eq(crawlerCaptureTokens.userEmail, keyFor(userEmail)));
    return fresh;
  }
  return token.token;
}

/** Şifreli token'ı çözer — kullanıcı bookmarklet'ini tekrar görebilsin diye. */
export async function revealCaptureToken(userEmail: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(crawlerCaptureTokens)
    .where(eq(crawlerCaptureTokens.userEmail, keyFor(userEmail)))
    .limit(1);
  if (!rows.length) return null;
  return decryptToken(rows[0].tokenEncrypted);
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
 * Doğrulama. Hash üzerinde sabit zamanlı karşılaştırma — şifre çözme YOK.
 * `lastUsedAt` yazımı en iyi çaba: doğrulama bunun başarısına BAĞLI OLMAMALI,
 * aksi halde bir yazma hatası kullanıcıyı kilitler.
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
