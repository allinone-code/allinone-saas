import { describe, expect, it, beforeEach } from "vitest";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Capture token şifreleme davranışı.
 *
 * Neden şifreli (hash-only değil): token'ı hash'li saklarsak bir kez gösterip
 * kaybolmasına yol açarız. Ekipte 10 kişi var, herkes kendi tarayıcısına kuracak;
 * "yenile"ye basmak zorunda kalsalardı BİRBİRLERİNİN bookmarklet'ini
 * geçersiz kılarlardı. Bu yüzden şifreli saklıyoruz: tekrar gösterilebilir,
 * ama veritabanı sızıntısında işe yaramaz.
 *
 * Bu test saf kriptografik yordamları `captureToken.ts`'ten DEĞİL, aynı
 * formülü burada yeniden kurarak doğrular — modül DB'ye bağlı olduğu için
 * doğrudan birim testi çalıştırılamıyor. Formül tek yerde yaşamalı.
 */

const SESSION_SECRET = "ci-only-build-secret-min-32-characters!!";
const VERSION = "v1";

/**
 * Gerçek `encryptionKey()` ile aynı davranış: SESSION_SECRET'ı ENV'DEN okur.
 * Test daha önce sabiti okuyordu ve "anahtar değişince çözme başarısız olur"
 * iddiasını gerçekten doğrulamıyordu — sahte güven veriyordu.
 */
function encKey(): Buffer {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET tanımlı değil veya 32 karakterden kısa");
  }
  return createHash("sha256").update(`cerberus-capture-token:${secret}`, "utf8").digest();
}

function encrypt(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

function decrypt(stored: string): string | null {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", encKey(), Buffer.from(parts[1], "base64"));
    decipher.setAuthTag(Buffer.from(parts[2], "base64"));
    return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

describe("capture token şifreleme", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = SESSION_SECRET;
  });

  it("şifrele → çöz turu birebir aynı token'ı verir", () => {
    const token = randomBytes(32).toString("hex");
    expect(decrypt(encrypt(token))).toBe(token);
  });

  it("şifreli metin düz token'ı İÇERMEZ", () => {
    const token = "abc123def456abc123def456abc123def456abc123def456abc123def456abcd";
    const stored = encrypt(token);
    expect(stored).not.toContain(token);
  });

  it("her şifrelemede farklı IV kullanır (aynı token iki kez aynı görünmez)", () => {
    const token = "a".repeat(64);
    expect(encrypt(token)).not.toBe(encrypt(token));
  });

  it("anahtar değişince çözme BAŞARISIZ olur ve null döner", () => {
    // SESSION_SECRET rotasyonu eski token'ları geçersiz kılar; kod bunu
    // crash olarak değil "yeniden üret" olarak ele almalı.
    const stored = encrypt("secret-token-value-1234");
    const original = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "farkli-bir-secret-en-az-32-karakter-uzunlugu!!";
    // Bu satır gerçekten null dönmeli; aksi halde env okunmuyor demektir.
    expect(decrypt(stored)).toBeNull();
    process.env.SESSION_SECRET = original;
    // Kontrol: eski anahtarla yine çözülüyor mu? (testin kendi doğruluğu)
    expect(decrypt(stored)).toBe("secret-token-value-1234");
  });

  it("eksik SESSION_SECRET hata verir (sessizce zayıf anahtara düşmez)", () => {
    const original = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "cok-kisa";
    expect(() => encKey()).toThrow(/32 karakter/);
    process.env.SESSION_SECRET = original;
  });

  it("bozuk veri çözmeye çalışınca null döner, exception değil", () => {
    expect(decrypt("")).toBeNull();
    expect(decrypt("v1:xxx")).toBeNull();
    expect(decrypt("v1:a:b:c:d")).toBeNull();
    expect(decrypt("v2:abc:def:ghi")).toBeNull();
  });

  it("migration varsayılanı ('') güvenli şekilde 'bilinmiyor' anlamına gelir", () => {
    // ADD COLUMN NOT NULL DEFAULT '' — tablo doluysa migration PATLAMAZ.
    // Boş string geçerli şifreli değer olmadığı için çözme null döner ve
    // token yeniden üretilir.
    expect(decrypt("")).toBeNull();
  });

  it("format sürüm etiketi taşır (ileride rotasyon için)", () => {
    const stored = encrypt("x".repeat(64));
    expect(stored.startsWith(`${VERSION}:`)).toBe(true);
    expect(stored.split(":")).toHaveLength(4);
  });
});
