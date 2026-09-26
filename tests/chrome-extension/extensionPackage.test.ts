import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Chrome eklenti paketinin YÜKLENEBİLİRLİĞİNİ doğrular.
 *
 * Saha hatası: eklenti klasörünün içine `__test__` konulmuştu. Chrome
 * "Cannot load extension with file or directory name __test__. Filenames
 * starting with "_" are reserved for use by the system." diyerek yüklemeyi
 * reddetti. Bu, kodla ilgisi olmayan ama kurulumu durduran bir hataydı ve
 * yalnız kullanıcı deneyiminde görünürdü.
 *
 * Bu test, aynı sınıftaki hataları (alt çizgi öneki, eksik manifest girdisi,
 * yanlış izin şeması) tarayıcı açmadan yakalar. Chrome Web Store da aynı
 * kuralları uygular — yani bu test aynı zamanda mağazaya gönderilebilirliği
 * de korur.
 */

const EXT_DIR = resolve(import.meta.dirname, "../../chrome-extension");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    // node_modules / gizli klasörler yüklemeye dahil değil.
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe("chrome-extension paketi", () => {
  it("alt çizgiyle başlayan dosya veya klasör içermez", () => {
    // Chrome bunları reddeder: '_' sistem için ayrılmıştır.
    const offenders = walk(EXT_DIR).filter((f) => f.split("/").some((seg) => seg.startsWith("_")));
    expect(offenders, `Chrome bu adları reddeder:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("manifest.json mevcut ve geçerli JSON", () => {
    const manifestPath = join(EXT_DIR, "manifest.json");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBeTruthy();
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("manifest'te atıf yapılan her dosya diskte var", () => {
    // Yanlış yol yazılmış ikon/popup yükleme sırasında "Could not load"
    // hatası verir; test bunu önceden yakalar.
    const manifest = JSON.parse(readFileSync(join(EXT_DIR, "manifest.json"), "utf8"));
    const referenced: string[] = [
      manifest.action?.default_popup,
      ...Object.values(manifest.action?.default_icon ?? {}),
      ...Object.values(manifest.icons ?? {}),
    ].filter(Boolean) as string[];

    expect(referenced.length).toBeGreaterThan(0);
    for (const rel of referenced) {
      expect(existsSync(join(EXT_DIR, rel)), `manifest'te var ama diskte yok: ${rel}`).toBe(true);
    }
  });

  it("izinler minimal ve gerekçelendirilmiş", () => {
    const manifest = JSON.parse(readFileSync(join(EXT_DIR, "manifest.json"), "utf8"));
    // MV3'te `<all_urls>` veya `*://*/*` gibi geniş izinler Web Store'da
    // incelemeye takılır ve kullanıcı güvenini zedeler.
    const broad = [...(manifest.permissions ?? []), ...(manifest.host_permissions ?? [])].filter(
      (p: string) => p === "<all_urls>" || /^\*:\/\/\*\//.test(p) || p === "*://*/*"
    );
    expect(broad, "Aşırı geniş izin istemeyin — yalnız ihtiyaç duyulan host").toEqual([]);
  });

  it("host_permissions yalnız kendi Cerberus sunucusuna tanır", () => {
    const manifest = JSON.parse(readFileSync(join(EXT_DIR, "manifest.json"), "utf8"));
    const hosts: string[] = manifest.host_permissions ?? [];
    expect(hosts.length).toBeGreaterThan(0);

    for (const pattern of hosts) {
      // Perakende sitelere KALICI erişim istenmemeli. Onlara yalnız kullanıcı
      // simgeye tıklayınca `activeTab` ile erişilir; sürekli izin hem Web Store
      // incelemesinde takılır hem de kullanıcının gizliliğini zedeler.
      const host = new URL(pattern.replace(/\*$/, "")).hostname;
      expect(host).not.toMatch(/^(www\.)?(amazon|vitaminshoppe|walgreens|gnc|iherb)\./i);
      // Kendi alan adımız dışında hiçbir yere izin verilmemeli.
      expect(host.endsWith("vercel.app")).toBe(true);
    }
  });

  it("kaynak dosyalar Chrome tarafından enjekte edilebilir", () => {
    // popup.js `extractor.js` dosyasını enjekte eder; dosya adı birebir tutmalı
    // (büyük/küçük harf farkı Linux'ta sessizce çalışmaz).
    const popup = readFileSync(join(EXT_DIR, "popup.js"), "utf8");
    const match = popup.match(/files:\s*\["([^"]+)"\]/);
    expect(match, "popup.js içinde files: [...] yok").not.toBeNull();
    expect(existsSync(join(EXT_DIR, match![1]))).toBe(true);
  });

  it("extractor.js tarayıcı ve Node tarafında çalışabilir", () => {
    // Hem `window.__cerberusExtract` ataması (tarayıcı) hem `module.exports`
    // (test) içermeli. Biri eksikse ya eklenti ya test kırılır.
    const src = readFileSync(join(EXT_DIR, "extractor.js"), "utf8");
    expect(src).toContain("__cerberusExtract");
    expect(src).toContain("module.exports");
    // `document` parametre alınmalı; global'e doğrudan erişilirse test edilemez.
    expect(src).toContain("function cerberusExtract(doc)");
  });

  it("extractor çerez okumaz", () => {
    // Kullanıcının oturumu sayfadan sızmasın. Sözleşmenin parçası.
    const src = readFileSync(join(EXT_DIR, "extractor.js"), "utf8");
    expect(src).not.toMatch(/document\.cookie/);
    expect(src).not.toMatch(/localStorage|sessionStorage/);
  });
});
