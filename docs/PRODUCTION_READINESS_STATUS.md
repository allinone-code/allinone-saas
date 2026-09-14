# CERBERUS Üretim Hazırlığı — Güncel Durum

**Son güncelleme:** 14 Eylül 2026

**Branch:** `arena/01a09cb2-allinone-saas`

**Durum:** Uygulama kalite kapıları geçiyor; staging ve son dokümantasyon işleri devam ediyor.

## Tamamlanan ana iyileştirmeler

- [x] Sipariş server-side arama, filtreleme ve pagination
- [x] Filtrelenmiş tüm veri üzerinden SQL KPI'ları
- [x] 10.000 kayıt güvenlik sınırlı, stream CSV export
- [x] CSV loading ve kullanıcıya görünür hata geri bildirimi
- [x] P1–P4 fire, sevkiyat, quantity, bundle ve batch invariant'ları
- [x] Batch oluşturma transaction/race/store-scope koruması
- [x] Tedarikçi refund semantiğinin maliyet mahsup olarak düzeltilmesi
- [x] ROI, P&L, analytics ve briefing hesaplarının refund ile uyumlu hâle getirilmesi
- [x] Outbound HTTP için protokol, port, DNS, IP, redirect ve stream limitleri
- [x] Crawler cache mağaza izolasyonu ve DB tabanlı kullanıcı rate limit'i
- [x] Python Scrapling shared-token, URL/IP politikası ve HTML sınırı
- [x] Generic admin silme rotasının ADMIN + tek sipariş + audit ile daraltılması
- [x] Mağaza listeleme endpoint'inde STORE_USER izolasyonu, hassas alan maskelemesi ve N+1 sorgu kaldırma
- [x] Bilinmeyen ödeme kartını `1753` olarak uyduran varsayılanların kaldırılması ve migration'ı
- [x] MANAGER arayüzünde ADMIN-only kullanıcı/reset/hassas mağaza alanlarının gizlenmesi
- [x] Admin sipariş yönetiminde server-side arama, mağaza filtresi ve 50 satırlık pagination
- [x] Kritik sipariş silmelerinin audit'li transaction'a alınması
- [x] Kullanıcı rol/mağaza/parola değişikliklerinin canlı oturum doğrulamasına bağlanması
- [x] Database reset işlemlerinin FK sıralı transaction'a taşınması
- [x] Fixture gerçeklerinin düzeltilmesi: 24 sipariş, 4 başlangıç mağazası
- [x] Migration count + head hash drift kontrolü
- [x] README ve yaşayan mimari sözleşmesinin güncellenmesi
- [x] XLSX üçüncü taraf provenance ve checksum dokümantasyonu
- [x] OpenAPI pagination/export/admin/readiness sözleşmesinin güncellenmesi
- [x] Python Scrapling URL/token güvenlik testleri ve CI kalite adımı
- [x] Go/no-go, yayın, smoke test, incident ve rollback runbook'u
- [x] Üretim hazırlığı değişikliklerinin session branch'inde sürümlenmesi

## Son doğrulama sonuçları

| Kontrol | Sonuç |
|---|---|
| TypeScript (`npm run typecheck`) | PASS |
| ESLint (`npm run lint`) | PASS |
| Vitest | PASS — 25 dosya / 286 test |
| Next.js production build | PASS |
| Production dependency audit | PASS — 0 açık |
| Python URL/token güvenlik testleri | PASS — 7/7 |
| Python syntax (`py_compile`) | PASS |
| OpenAPI structural lint | PASS — geçerli sözleşme, dokümantasyon uyarıları açık |
| Git whitespace kontrolü | PASS |
| GitHub Actions quality job | PASS — PR #23 |
| Vercel preview deployment | PASS |
| Preview liveness `/api/health` | PASS — 200 |
| Preview readiness `/api/health/ready` | BLOCKED — DB ledger 4, beklenen 8 migration |

## Açık işler

- [ ] OpenAPI'de kalan operationId/4xx dokümantasyon uyarılarını aşamalı kapatmak
- [ ] Gerçek browser içeren Scrapling container smoke testi yapmak
- [ ] Preview/staging PostgreSQL migration ledger'ını güvenli release adımıyla 4'ten 8'e taşımak; ardından readiness'i tekrar doğrulamak
- [ ] Son kullanıcı akışlarını tarayıcı üzerinden erişilebilirlik ve responsive davranış açısından doğrulamak

## Yayın engeli: migration ledger

Vercel preview deployment'ı çalışıyor ve liveness sağlıklı; ancak bağlı veritabanında migration ledger **4**, bu sürümün beklediği değer **8** olduğu için readiness doğru biçimde `503` dönüyor. Veritabanının 0004–0007 etkilerini kısmen elle/`db:push` ile alıp almadığı doğrulanmadan migration'lar körlemesine uygulanmamalıdır. Backup/PITR alındıktan sonra release runbook'u izlenmelidir.

## Bilinen, engelleyici olmayan konu

Tam bağımlılık audit'inde yalnız geliştirme araç zincirinden gelen 4 adet **moderate** seviye bildirim kalmıştır. Zincir `drizzle-kit → @esbuild-kit → esbuild` kaynaklıdır. npm'in önerdiği otomatik çözüm güncel `drizzle-kit` sürümünü eski ve kırıcı `0.18.1` sürümüne düşürdüğü için uygulanmamıştır. Bu paketler production dependency setinde değildir; `npm audit --omit=dev` sıfır açık vermektedir.

## Canlıya çıkış kararı

Kod kalite kapıları yeşildir; ancak staging migration/readiness ve tarayıcı smoke testleri tamamlanmadan “canlıya hazır” kararı verilmemelidir.
