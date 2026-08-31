# CERBERUS (allinone-saas) — Yeni İş Planı ve Yol Haritası

| | |
|---|---|
| **Tarih** | 2026-09-01 |
| **Bağlı olduğu rapor** | `01_Mimari_Degerlendirme_Raporu.md` (F-01…F-33 bulgu numaraları referanslı) |
| **Toplam süre** | 16 hafta (8 sprint × 2 hafta) |
| **Önerilen ekip** | Sistem Mimarı (0,5 FTE) • Backend Dev (1) • Frontend Dev (1) • DevOps (0,5) • QA (0,5) • Güvenlik Uzmanı (0,25) • Ürün/İş Analisti (0,25) |
| **Prensipler** | Önce yangın söndür → sonra temel (auth + veri) → sonra kalite/süreç → sonra ürün borcu. Faz 0+1 bitmeden canlı kullanıcı yok. Faz 5 bitmeden "üretim" kelimesi kullanılmaz. |

---

## FAZ 0 — Acil Güvenlik Müdahalesi (Hafta 1) — 🔴 Engelleyici

| ID | Görev | Bulgu | Sorumlu | Efor (kişi-gün) | Kabul Kriteri |
|---|---|---|---|---|---|
| T0.1 | Canlı dağıtımı geçici olarak koruma altına al (Vercel Deployment Protection / IP allowlist / Basic Auth) | F-01..05 | DevOps | 0,5 | Kimliksiz hiçbir istek 200 almıyor |
| T0.2 | `database-reset` route'unu prod build'den koşullu kaldır (`NODE_ENV!=="production"`) — geliştirme için tek seferlik script'e çevir | F-02 | Backend | 1 | Prod'da endpoint 404 |
| T0.3 | Master parola şablonunu ve boş-parola kabulünü login'den sil | F-04 | Backend | 0,5 | Kod tabanında `admin2026` literal'ı kalmadı |
| T0.4 | Tüm bilinen parolaları iptal et; kullanıcılara geçici tek kullanımlık parola üret; README'den test hesabı tablosunu kaldır | F-03/04 | Backend + Ürün | 1 | Eski parolalarla giriş yok; README güncel |
| T0.5 | Git geçmişi risk değerlendirmesi: sırlar döndür (Neon `DATABASE_URL`, Vercel token) — repo private'a alınsın | F-04 | DevOps + Güvenlik | 1 | Eski sırlar geçersiz; repo erişimi kısıtlı |
| T0.6 | Geçici imza bandını uygula: mevcut cookie'nin yanına HMAC imzası ekle (Faz 1'deki kalıcı çözüme köprü) ve proxy'de `/api` için "çerez+imza" zorunluluğu | F-01/05 | Backend + Mimari | 2 | Geçersiz çerez 401; API'ler anonim kapalı |

**Faz çıkışı: mevcut veri ve sistem artık dışarıya kapalı; gösteri ortamı kontrollü.**

---

## FAZ 1 — Kimlik, Oturum ve Yetkilendirme Altyapısı (Hafta 1–3) — 🔴 Engelleyici

| ID | Görev | Bulgu | Sorumlu | Efor | Kabul Kriteri |
|---|---|---|---|---|---|
| T1.1 | Parolaları `argon2id` (veya bcrypt≥10) ile hash'leyen servis + mevcut kullanıcılar için zorunlu sıfırlama akışı | F-03 | Backend | 3 | DB'de düz metin parola yok; login hash doğrulamalı |
| T1.2 | `iron-session` / Auth.js v5 ile **imzalı, şifreli, süreli** oturum; `SESSION_SECRET` env zorunluluğu; 8 saat ömür + kayma yenileme; sunucu tarafı `sid` ile iptal | F-01/06 | Backend + Mimari | 4 | Sahte çerez 401; logout sunucuda da geçersiz kılar |
| T1.3 | Merkezi `requireUser()` / `requireRole()` guard'ı; **tüm 16 route'un** auth matrisinin çıkarılması ve uygulanması (`docs/auth-matrix.md`) | F-02/05 | Backend | 3 | Anonim tüm korumalı uçlardan 401; matris dokümanda onaylı |
| T1.4 | Mağaza izolasyonunu sunucuya taşı: kapsam (scope), token claim'inden; tüm sorgularda zorunlu `storeCode` filtresi (yardımcı sorgu katmanı) | F-11 | Backend | 2 | STORE_USER kendi mağazası dışına cookie/API ile erişemez (testli) |
| T1.5 | Login rate-limit (IP + hesap bazlı, üstel gerileme) + hesap kilitleme + denetim kaydı | F-07 | Backend | 2 | 5 başarısız denemede 429 + audit log |
| T1.6 | Parola politikası (min 12, sözlük kontrolü) + kullanıcı parola değiştirme ekranı; varsayılan parolayla ilk girişte zorunlu değişim | F-03/04 | Backend + Frontend | 2 | E2E test ile doğrulandı |

**Faz çıkışı: F-01..F-07 ve F-11 kapanmış; bağımsız güvenlik gözden geçirmesi (0,5 gün) ve temel penetrasyon testi.**

---

## FAZ 2 — Veri Katmanı ve Migration Disiplini (Hafta 3–5)

| ID | Görev | Bulgu | Sorumlu | Efor | Kabul Kriteri |
|---|---|---|---|---|---|
| T2.1 | `drizzle-kit generate` ile versiyonlu migration klasörü; CI adımı `drizzle-kit migrate`; prod'da `push` yasağı (README düzelt) | F-10 | Backend + DevOps | 2 | Migration'lar git'te; prod pipeline migrates |
| T2.2 | FK'ler (`orders.buyerStore→stores.storeCode`, `orders.pshBatchNo→psh_batches.batchNumber`, vb.), NOT NULL düzeltmeleri, enum'lara `pgEnum` geçiş (cargoStatus, isFragile, lifecycleStage…) | F-22 | Backend + Mimari | 3 | Geçersiz referans insert'ininde DB hatası; şema dokumanı güncel |
| T2.3 | Benzersizlik + indexler: `orders(orderNumber, buyerStore)` unique, `(buyerStore, orderDate)`, `asin`, `psh_batches.batchNumber` unique | F-22 | Backend | 1 | Aynı XLS'in ikinci import'u mükerrer üretmez (test) |
| T2.4 | Seed'i request-time'dan sök: tek seferlik `npm run db:seed` script'i; `ensureCerberusSeeded` çağrıları route'lardan kaldır | F-14 | Backend | 2 | GET'ler salt-okunur (log ile kanıtlanır) |
| T2.5 | Göömülü demo veriyi koddan çıkar (`xlsOrdersData.ts`, `mockData.ts` → `fixtures/` + yalnız dev seed); UI'da mock fallback'i kaldır, boş/hata durumu tasarla | F-15 | Frontend + Backend | 3 | Prod bundle'da fixture yok; API hatasında açık hata ekranı |
| T2.6 | Parasal tutarlılık: numeric string ↔ number dönüşüm standardı (ör. map'e tek tip dönüştürücü) + toplamların SQL tarafında hesaplanması | F-25/13 | Backend | 2 | KPI testleri SQL aggregate ile yeşil |
| T2.7 | Çoklu INSERT/UPDATE'lerde transaction (özellikle XLS import) | F-33 | Backend | 1 | Kısmi hata senaryosunda rollback testi yeşil |

**Faz çıkışı: F-10/14/15/22/25/33 kapanmış; veri sözleşmesi gerçekten "kilitli" — ancak bu kez DB seviyesinde.**

---

## FAZ 3 — API Sertleştirme ve Sözleşmeler (Hafta 5–7)

| ID | Görev | Bulgu | Sorumlu | Efor | Kabul Kriteri |
|---|---|---|---|---|---|
| T3.1 | Tüm route gövdelerine **zod** şemaları (+ ortak `parseBody` helper, 422 hata formatı); sayı aralıkları, e-posta, enum, uzunluk limitleri | F-12 | Backend | 4 | Hatalı gövde 400/422 alıyor (route testleri) |
| T3.2 | Sayfalama standardı: `GET /api/orders` cursor/limit (varsayılan 50), KPI'lar ayrı `/api/orders/summary` altında SQL aggregate ile | F-13 | Backend | 3 | 10k kayıtta p95 < 500 ms (lokal ölçüm raporu) |
| T3.3 | Hata hijyeni: istemciye `error.message` dönme yasağı; merkezi hata sarmalayıcı + korelasyon ID | F-24/32 | Backend | 2 | Hata yanıtlarında iç detay yok |
| T3.4 | İstek boyutu/dosya limitleri (import route'ları), içerik tipi kontrolü, Google Drive import'a timeout + boyut üst sınırı | F-12/08 | Backend | 1 | 10 MB üstü istek 413 |
| T3.5 | OpenAPI/Swagger taslağı (`docs/api-contract.md` → openapi.yaml) — frontend ile sözleşme | — | Mimari + Backend | 2 | 16 uç dokümante |

**Faz çıkışı: F-12/13/24/32 kapanmış.**

---

## FAZ 4 — Bağımlılık ve Paket Hijyeni (Hafta 6–8, paralel)

| ID | Görev | Bulgu | Sorumlu | Efor | Kabul Kriteri |
|---|---|---|---|---|---|
| T4.1 | `xlsx` çıkışı: karar analizi (SheetJS'in npm dışı güncel sürümü mü, ExcelJS mi, yoksa parse'ı istemciye taşı + zod mu) | F-08 | Mimari + Backend | 1 (analiz) | ADR yazıldı |
| T4.2 | Seçilen çözümün uygulanması + dinamik import ile bundle bölme | F-08/30 | Fullstack | 3 | `npm audit` prod bağımlılıklarında 0 yüksek |
| T4.3 | Dependabot/Renovate + `npm audit` CI gate'i (high → build kır) | F-08/18 | DevOps | 1 | CI kırmızıyken merge yok |
| T4.4 | `package.json` kimlik düzeltme (ad, lisans, repo), `.env.example`'a `SESSION_SECRET` vb. ekleme; `DATABASE_URL` fail-open fallback'ini kaldır (yoksa açık hata) | F-20/26/31 | DevOps | 0,5 | Config eksikse açıklı başlangıç hatası |

**Faz çıkışı: F-08/18(gate)/20/26/31 kapanmış.**

---

## FAZ 5 — Test Piramidi ve CI/CD (Hafta 7–10)

| ID | Görev | Bulgu | Sorumlu | Efor | Kabul Kriteri |
|---|---|---|---|---|---|
| T5.1 | Vitest kurulumu; domain fonksiyonlarının (landed-cost, karar motoru, ROI) route'tan saf fonksiyonlara çıkarılması (`src/domain/`) + birim testleri | F-17 | Backend + Mimari | 4 | Domain coverage ≥ %90 |
| T5.2 | Route entegrasyon testleri (testcontainers veya pg-mem): auth matrisi, izolasyon, validasyon, import transaction'ı | F-17/02/11 | Backend + QA | 5 | Kritik 20 senaryo yeşil |
| T5.3 | Playwright E2E: login, sipariş oluşturma, XLS import, admin CRUD, yetkisiz erişim redleri | F-17 | QA + Frontend | 4 | CI'da headless koşu |
| T5.4 | GitHub Actions: `lint + typecheck + unit + integration + audit + build` zinciri, branch protection, PR zorunlu review | F-18/19 | DevOps | 2 | Kırmızı CI merge edilemez |
| T5.5 | ESLint temizliği (22 hata) + hook dependency düzeltmesi; `lint` ve `typecheck`'i CI'a bağla | F-19 | Frontend | 1 | `eslint .` 0 hata |

**Faz çıkışı: F-17/18/19 kapanmış. Bu fazdan itibaren her PR kalite kapısından geçer.**

---

## FAZ 6 — Gözlemlenebilirlik, Güvenlik Başlıkları ve Operasyonel Dayanıklılık (Hafta 9–11)

| ID | Görev | Bulgu | Sorumlu | Efor | Kabul Kriteri |
|---|---|---|---|---|---|
| T6.1 | Yapısal loglama (pino) + Sentry hata izleme; `console` kullanım yasağı (lint kuralı) | F-24 | DevOps + Backend | 2 | Hatalar Sentry'de korelasyon ID ile |
| T6.2 | Güvenlik başlıkları: CSP, X-Frame-Options/frame-ancestors, Referrer-Policy, HSTS; `next.config.ts` dağıtım ayarları | F-29 | DevOps | 1 | securityheaders.com taraması A |
| T6.3 | Sağlık/derin sağlık uçları; uptime ve alarm; health'i bilgi sızdırmaz hâle getir | F-32 | DevOps | 1 | Status page + alarm |
| T6.4 | Yedekleme/DR: Neon PITR penceresi kararı, geri yükleme tatbikatı, RPO/RTO dokümanı; ortam ayrımı (dev/staging/prod env) | F-28 | DevOps + Mimari | 2 | Tatbikat raporu + geri yükleme kanıtı |
| T6.5 | Audit log bütünlüğü: uygulama rolüne `audit_logs` UPDATE/DELETE yasağı; silme uçlarından çıkar; aylık hash-imzalı checkpoint dosyası | F-09 | Backend + Güvenlik | 2 | Audit satırı hiçbir uçtan silinemez (test) |

**Faz çıkışı: F-09/24/28/29/32 kapanmış.**

---

## FAZ 7 — KVKK / Uyumluluk Paketi (Hafta 10–13, Hukuk danışmanlığıyla)

| ID | Görev | Bulgu | Sorumlu | Efor | Kabul Kriteri |
|---|---|---|---|---|---|
| T7.1 | Kişisel veri envanteri ve VERBİS/rol analizi (işveren/çalışan verisi, sipariş e-postaları, kart son-4) | F-16 | Ürün + Hukuk + Mimari | 2 | Envanter tablosu onaylı |
| T7.2 | Veri minimizasyonu: loglarda PII maskeleme, UI'da rol-bazlı maske (kart son-4 sadece ADMIN), saklama süresi politikası + arşivleme işi | F-16 | Backend | 2 | Log örneklerinde PII yok |
| T7.3 | Aydınlatma metni, çerez bildirimi, kullanıcı sözleşmesi; veri sahibi talep (silme/düzeltme) akışının teknik karşılığı | F-16 | Ürün + Hukuk + Fullstack | 2 | Yayınlanmış metinler + çalışan talep akışı |

**Faz çıkışı: F-16 kapanmış.**

---

## FAZ 8 — Mimari Borç Kapatma ve Ürün Dürüstlüğü (Hafta 11–16)

| ID | Görev | Bulgu | Sorumlu | Efor | Kabul Kriteri |
|---|---|---|---|---|---|
| T8.1 | **SP-API kararı:** Gerçek Amazon SP-API entegrasyonu (OAuth + token kasası + sync job) **veya** UI'daki tüm "SP-API BAĞLI" rozet/butonlarının kaldırılması | F-23 | Mimari + Ürün | 2 (karar) / +8–13 (entegrasyon) | Rozet, gerçek durumu gösteriyor |
| T8.2 | `morning_briefings` tablosu + hesap işinin route'lara bağlanması (PLAN FAZ 6–7 vadinin gerçeklenmesi) — ya da vaat dokümandan çıkarılır | F-23 | Backend + Frontend | 4 | Brifing verisi DB'den; spec güncel |
| T8.3 | `page.tsx` (1.639 satır) ayrıştırması: route segment Server Component veri yüklemesi, özellik bazlı klasörler (`features/orders`, `features/admin`…), state stratejisi (URL state + server state) | F-21 | Frontend + Mimari | 5 | Tek dosya < 400 satır; bundle raporu |
| T8.4 | Doküman disiplini: PLAN.md gerçek durumla senkron; "kilitli şema" değişiklik süreci (ADR + migration zorunluluğu); README vaatleri = test edilmiş davranış | F-23 | Mimari + Ürün | 2 | Doküman-kod farkı kalmadı (gözden geçirme) |
| T8.5 | Performans bütçesi: bundle, sayfa p95, sorgu sayısı limitleri; Lighthouse/preview ölçüm düzeni | F-13/30 | Frontend + DevOps | 2 | Bütçe CI'da zorlanır |
| T8.6 | i18n yol planı (tr-TR → en-US) kararı ve iskeleti | F-30 | Ürün + Frontend | 1 (iskelet) | Karar ADR'de |

---

## 9. Sprint Takvimi (Özet Gantt)

| Hafta | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FAZ 0 Güvenlik Acil | █ | | | | | | | | | | | | | | | |
| FAZ 1 Auth/Oturum/RBAC | █ | █ | █ | | | | | | | | | | | | | |
| FAZ 2 Veri + Migration | | | █ | █ | █ | | | | | | | | | | | |
| FAZ 3 API Sertleştirme | | | | | █ | █ | █ | | | | | | | | | |
| FAZ 4 Paket Hijyeni | | | | | | █ | █ | █ | | | | | | | | |
| FAZ 5 Test + CI/CD | | | | | | | █ | █ | █ | █ | | | | | | |
| FAZ 6 Observability/DR | | | | | | | | | █ | █ | █ | | | | | |
| FAZ 7 KVKK | | | | | | | | | | █ | █ | █ | █ | | | |
| FAZ 8 Mimari Borç + Ürün | | | | | | | | | | | █ | █ | █ | █ | █ | █ |

> FAZ 0+1 bitmeden hiçbir dış kullanıcı sisteme sokulmaz; FAZ 5 çıkışı olmadan "üretim" ilanı yapılmaz.

## 10. Başarı KPI'ları (Kapanış Kriterleri)

| KPI | Başlangıç (bugün) | 16. hafta hedefi |
|---|---|---|
| Kritik açık güvenlik bulgusu | 5 | 0 |
| Anonim erişilebilen korumalı uç | ≥ 12 / 16 | 0 / 16 (auth matrisi testli) |
| npm audit (prod, high) | 5 | 0 |
| Test: route entegrasyon senaryosu | 0 | ≥ 20 kritik senaryo CI'da yeşil |
| Domain birim testi coverage | %0 | ≥ %90; `eslint` 0 hata |
| DB migration disiplini | yok (push) | tüm değişiklik versiyonlu migration |
| Audit log değişmezliği | silinebilir | uygulama rolünde UPDATE/DELETE yok (testli) |
| `GET /api/orders` p95 (10k kayıt) | tüm tablo (ölçülemedi) | < 500 ms (sayfalı) |
| README/doküman vaadi ↔ test kapsamı | örtüşmüyor | her vaat ≥1 test ile kanıtlı |
| KVKK artefaktları | yok | envanter + aydınlatma + talep akışı yayında |

## 11. En Büyük Kalan Riskler (plan sonrası)

1. **SP-API entegrasyonunun kapsam riski** — Amazon onay süreçleri takvimi uzatabilir; FAZ 8'de karar kapısı kondu (T8.1).
2. **40 kolonluk XLS kontratının iş değişikliklerine kırılganlığı** — importer'a versiyonlu başlık haritası (mapping profili) eklenmesi FAZ 3 sonrası iyileştirme olarak önerilir.
3. **Tek geliştirici/AI-hızlı-prototip kültürü** — bulguların çoğu süreç eksikliğinden (gate'siz ilerleme) kaynaklı; FAZ 5'in CI/preview disiplini kalıcı davranış değişikliğidir.
4. **Neon/Vercel tek-sağlayıcı bağımlılığı** — DR tatbikatı (T6.4) ile yönetilebilir düzeye indirilir.
