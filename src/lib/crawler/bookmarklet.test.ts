import { describe, expect, it } from "vitest";
import { buildBookmarkletSource } from "./bookmarklet";

/**
 * Bookmarklet tarayıcıda, kullanıcının oturumu açıkken çalışır. Bu yüzden
 * bot korumasıyla hiç savaşmaz — site gerçek bir tarayıcı isteği görür.
 *
 * Buradaki testler iki şeyi korur:
 *  1. Üretilen kod PARSE EDİLEBİLİR olmalı. Küçük bir sözdizimi hatası
 *     bookmarklet'i sessizce çalışmaz hale getirir ve kullanıcı "çalışmıyor"
 *     sanır — oysa kod bir yazım hatası yüzünden çalışmıyordur.
 *  2. Token JSON kaçışı. Tırnak/özel karakter içeren bir token ham
 *     gömülürse kod kırılır.
 */

const TOKEN = "a".repeat(64);

function assertParses(source: string): void {
  // `new Function` gövdeyi derler ama ÇALIŞTIRMAZ — güvenli doğrulama.
  // Derleme hatası SyntaxError olarak yüzeye çıkar.
  const body = source.replace(/^javascript:/, "");
  expect(() => new Function(body)).not.toThrow();
}

describe("buildBookmarkletSource", () => {
  it("geçerli JavaScript üretir", () => {
    assertParses(buildBookmarkletSource({ token: TOKEN }));
  });

  it("javascript: önekiyle başlar (adres çubuğuna yapıştırma için)", () => {
    expect(buildBookmarkletSource({ token: TOKEN }).startsWith("javascript:")).toBe(true);
  });

  it("token'ı gövdeye gömer", () => {
    const source = buildBookmarkletSource({ token: TOKEN });
    expect(source).toContain(TOKEN);
    expect(source).toContain("captureToken");
  });

  it("tırnak ve özel karakter içeren token'ı kaçışlar", () => {
    // Kaçışsız gömülseydi kod kırılırdı.
    const tricky = 'ab"cd\\ef\'gh;<script>01';
    const source = buildBookmarkletSource({ token: tricky });
    assertParses(source);
  });

  it("çerez göndermez — kimlik doğrulama gövdedeki token ile yapılır", () => {
    // `credentials: 'include'` olsaydı tarayıcı cross-origin istekte
    // HttpOnly oturum çerezini göndermeyi deneyip CORS hatası üretirdi.
    // Token zaten gövdede; ek header da yok (preflight'ı tetiklemesin diye).
    const source = buildBookmarkletSource({ token: TOKEN });
    expect(source).not.toContain("credentials");
    expect(source).not.toMatch(/['"]Authorization['"]/);
  });

  it("CORS preflight tetiklemeyen content-type kullanır", () => {
    // `text/plain` CORS-safelisted; `application/json` preflight uçturur ve
    // `OPTIONS` handler gerektirirdi.
    const source = buildBookmarkletSource({ token: TOKEN });
    expect(source).toContain("text/plain");
    expect(source).not.toContain("application/json");
  });

  it("sunucuya yalnız ham veri gönderir, ayrıştırma sunucuda yapılır", () => {
    const source = buildBookmarkletSource({ token: TOKEN });
    // JSON-LD ve meta toplanır; ürün/GTIN çıkarımı yapılmaz.
    expect(source).toContain("application/ld+json");
    expect(source).toContain("itemprop");
    // Tarayıcıda fiyat/GTIN hesabı yapılmadığının kanıtı: sunucu yanıtı beklenir.
    expect(source).toContain("/api/crawler/capture");
  });

  it("kullanıcıya görünür geri bildirim gösterir", () => {
    const source = buildBookmarkletSource({ token: TOKEN });
    // Sessiz hata en kötü hata türüdür: kullanıcı tıkladığını sanır,
    // kayıt hiç olmaz. Sonuç her durumda ekranda görünmeli.
    expect(source).toContain("out(");
    expect(source).toContain("Kaydedildi");
  });

  it("tarayıcı çubuğu sınırına yaklaşmaz (Chrome ~2000 karakter)", () => {
    // Sınırı aşan bookmarklet sessizce kırpılır/çalışmaz.
    expect(buildBookmarkletSource({ token: TOKEN }).length).toBeLessThan(2000);
  });

  it("apiBase verilirse o adrese gider", () => {
    const source = buildBookmarkletSource({ token: TOKEN, apiBase: "https://cerberus.vercel.app" });
    expect(source).toContain("https://cerberus.vercel.app");
    assertParses(source);
  });
});
