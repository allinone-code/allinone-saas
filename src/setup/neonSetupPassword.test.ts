/**
 * Kurulum parolasının hash'i gerçekten o parolayla eşleşiyor mu?
 *
 * Yanlış hash hiçbir hata üretmez — kurulum başarılı görünür, giriş çalışmaz.
 * Sessiz başarısızlık en kötüsüdür; burada kilitliyoruz.
 */
import { describe, it, expect } from "vitest";
import { verifyPassword } from "@/lib/passwords";
import { SETUP_PASSWORD, SETUP_PASSWORD_HASH } from "./neonSetupPassword";

describe("Neon kurulum parolası", () => {
  it("gömülü hash, belgelenen parolayla eşleşir", async () => {
    const result = await verifyPassword(SETUP_PASSWORD, SETUP_PASSWORD_HASH);
    expect(result.ok).toBe(true);
  });

  it("yanlış parola kabul edilmez", async () => {
    const result = await verifyPassword("yanlis-parola", SETUP_PASSWORD_HASH);
    expect(result.ok).toBe(false);
  });

  it("hash bcrypt biçimindedir", () => {
    expect(SETUP_PASSWORD_HASH).toMatch(/^\$2[aby]\$\d{2}\$/);
  });
});
