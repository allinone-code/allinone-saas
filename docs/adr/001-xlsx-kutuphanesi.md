# ADR-001: XLSX Ayrıştırma Kütüphanesi Seçimi (T4.1)

**Tarih:** 2026-09-01 · **Durum:** Kabul edildi · **Bağ:** Audit F-08

## Bağlam

Projedeki `xlsx@0.18.5` (npm registry) paketi iki YÜKSEK zaafiyet taşıyor ve npm akışı güncellenmiyor:

- GHSA-4r6h-8v6p-xvw6 — Prototype Pollution
- GHSA-5pgg-2g8v-p4x9 — ReDoS

`npm audit` çıktısı: "No fix available". Paket kullanıcıdan gelen dosyayı ayrıştırdığı için
saldo yüzeyi gerçek (kötü niyetli XLS yükleme senaryosu).

## Değerlendirilen seçenekler

| Seçenek | Artı | Eksi |
|---|---|---|
| **A. SheetJS resmî CDN sürümü (0.20.3)** | Birebir API uyumu, iki zaafiyet de giderilmiş | npm audit tarball bağımlılıklarını tarayamaz |
| B. ExcelJS'e geçiş | npm akışı, aktif bakım | API yeniden yazımı, CSV modu farklı, ~2x paket boyutu |
| C. Ayrıştırmayı tamamen istemciye taşı + zod | Sunucu saldırı yüzeyi kapanır | Drive-URL akışı sunucuda kalmak zorunda (SSRF sınırlı ama var) |

## Karar

**Seçenek A**, iki sıkılaştırmayla birlikte:
1. `xlsx` bağımlılığı artık resmî SheetJS CDN tarball'ından gelir: `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
2. İstemci tarafında ~800 KB'lık paket **dinamik import** ile yalnızca kullanıcı dosya seçtiğinde yüklenir.

Ek savunma katmanları zaten Faz 3'te alındı: içe aktarım route'larında auth zorunluluğu,
gövde/boyut üst sınırları ve Drive indirmesinde 15 sn timeout.

## Sonuçlar

- `npm audit --omit=dev` çıktısı: 0 zaafiyet (next 16.3.4 yükseltmesiyle birlikte)
- İzleme yükümlülüğü: npm audit tarball'ı taramadığı için, altı ayda bir CDN sürüm notları
  kontrol edilir (bakım takvimi iş planı Faz 8 öğesi)
