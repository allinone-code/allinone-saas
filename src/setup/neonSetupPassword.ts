/**
 * Neon tek dosyalık kurulum SQL'inde kullanılan başlangıç parolası.
 *
 * Ayrı bir modülde tutulur çünkü hem SQL üreticisi (scripts/generate-neon-sql.ts)
 * hem de doğrulama testi buna ihtiyaç duyar. Hash elle yazılmış bir sabittir;
 * yanlış olursa kurulum "başarılı" görünür ama kullanıcı giriş YAPAMAZ.
 * Bu sessiz başarısızlığı önlemek için testle kilitlenmiştir.
 */
export const SETUP_PASSWORD = "CerberusKurulum2026!";

/** bcrypt(12) — SETUP_PASSWORD'ün hash'i. src/lib/passwords.ts ile üretildi. */
export const SETUP_PASSWORD_HASH =
  "$2b$12$REUfg5IZyJgw.Wp3d9ECau0JnNOx/JarFNPyBcJOjEPqH8MQgjF2K";

/**
 * Yer tutucu (placeholder) parola kontrolü.
 *
 * Neon tek dosyalık kurulum, tüm başlangıç hesaplarına depoda yayınlanmış
 * bilinen bir parolanın hash'ini yazar. Bu hash ile girişe izin VERİLMEZ;
 * kullanıcı `/api/auth/first-password` üzerinden ilk parolasını belirlemek
 * zorundadır. Hash değiştiği anda bu koşul kendiliğinden ortadan kalkar
 * (tek kullanımlık mekanizma — ek bayrak/migration gerekmez).
 */
export function isPlaceholderPasswordHash(storedHash: string): boolean {
  return storedHash === SETUP_PASSWORD_HASH;
}
