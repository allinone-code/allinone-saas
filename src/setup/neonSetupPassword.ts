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
