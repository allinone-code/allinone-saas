import bcrypt from "bcryptjs";
import crypto from "crypto";

const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$/;
const BCRYPT_ROUNDS = 12;

// Kamuya açık repoda yayınlanmış oldukları için kalıcı olarak iptal edilen
// eski demo parolaları. Bu parolalar ANCAK yeni parola atamasıyla değiştirilebilir.
const REVOKED_LEGACY_PASSWORDS: ReadonlySet<string> = new Set([
  "admin2026",
  "store2026",
  "cerberus2026",
]);

export function isRevokedLegacyPassword(plain: string): boolean {
  return REVOKED_LEGACY_PASSWORDS.has(plain.trim());
}

export function isBcryptHash(value: string): boolean {
  return BCRYPT_PATTERN.test(value);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export interface PasswordVerifyResult {
  ok: boolean;
  /** true ise kayıt düz metin (legacy) ve ilk fırsatta yeniden hash'lenmelidir */
  needsUpgrade: boolean;
}

/**
 * bcrypt ile doğrular. Geçiş penceresi: veritabanında hâlâ düz metin duran
 * eski kayıtlar için sabit-zamanlı (timing-safe) karşılaştırma yapar ve
 * needsUpgrade=true işaretler — çağıran taraf hemen yeniden hash'leyip kaydetmelidir.
 */
export async function verifyPassword(plain: string, stored: string): Promise<PasswordVerifyResult> {
  if (isBcryptHash(stored)) {
    return { ok: await bcrypt.compare(plain, stored), needsUpgrade: false };
  }

  // Legacy düz metin: uzunluk/timing sızdırmamak için iki tarafın da SHA-256 özetini
  // sabit-zamanlı karşılaştır.
  const a = crypto.createHash("sha256").update(plain).digest();
  const b = crypto.createHash("sha256").update(stored).digest();
  return { ok: crypto.timingSafeEqual(a, b), needsUpgrade: true };
}
