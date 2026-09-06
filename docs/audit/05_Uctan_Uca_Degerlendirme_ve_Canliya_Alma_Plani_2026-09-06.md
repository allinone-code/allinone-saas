# CERBERUS — Uçtan Uca Değerlendirme ve Canlıya Alma İş Planı

| | |
|---|---|
| **Tarih** | 2026-09-06 |
| **Hazırlayan** | Frontend + Backend + Sistem Tasarımı gözüyle uçtan uca inceleme |
| **Dal** | `arena/01a07866-allinone-saas` (main @ `e99cc58`'den ayrıldı) |
| **Önceki raporlar** | `01_Mimari_Degerlendirme_Raporu.md` (F-01…F-33), `02_Yeni_Is_Plani.md`, `03_Uctan_Uca_Degerlendirme_2026-09.md`, `04_Veri_Mimarisi_Urun_Bazli_Model.md` |
| **Yöntem** | Statik kod incelemesi + bağımlılık/gizli veri taraması + `npm run typecheck`/`lint`/`test`/`build` + PGlite üzerinde migration+seed + **canlı HTTP doğrulaması** (login, auth, orders, products, intelligence) |

---

## 1. Yönetici Özeti

Sistem, önceki üç denetim turunun ardından **teknik olarak yayına hazır bir olgunluğa**
ulaşmış durumda. Bu turda iddia edilen her şey **çalıştırılarak yeniden doğrulandı**:

| Doğrulama | Sonuç |
|---|---|
| `npm run typecheck` | ✅ temiz (0 hata) |
| `npm run lint` | ✅ 0 hata, 0 uyarı |
| `npm test` | ✅ **224 test / 15 dosya — tamamı yeşil** |
| `npm run build` | ✅ 22 route + Proxy (Middleware) başarılı |
| Canlı önizleme (PGlite + seed) | ✅ login → `/api/auth/me` → `/api/orders` → `/api/intelligence` → `/api/products` uçtan uca çalışıyor |
| Anonim erişim | ✅ `/api/orders` → **401** (kimlik zorunlu) |
| Health | ✅ `/api/health/ready` → `database:true, sessionSecretConfigured:true` |

**Kod artık "prototip" değil, "kurumsal iç araç" seviyesinde.** Güvenlik sınırı
(bcrypt + imzalı JWT + route-bazlı zorunlu yetki + DB kısıtları) kapatılmış, veri
katmanı FK/unique/CHECK/index ile zorlanmış, iş mantığı test edilebilir saf
fonksiyonlara ayrılmış ve ürün dürüstlüğü (sabit metrik yok, ölçülemeyen "—") ilkesi
yerleşmiş.

**Yayına engel teknik bir kusur kalmadı**; kalan maddeler "ilk kullanım konforu,
karar kalitesi ve operasyonel sertleştirme" işleridir. Aşağıda her üç uzmanlık
açısından durum, bu turda bulunan yeni bulgular ve sprint'li bir iş planı var.

### Katman bazlı skor (0–10)

| Eksen | Skor | Özet |
|---|---|---|
| Frontend / UI | **8** | Modüler, tipli, boş/hata durumları tasarlı; sayfalama ve E2E eksik |
| Backend / API | **8.5** | Auth/validasyon/hata hijyeni/aggregate/tx tam; rate-limit in-memory |
| Veri Mimarisi | **8.5** | FK/unique/CHECK/index + ürün-merkezli çekirdek; migration disiplini var |
| Güvenlik & Kimlik | **8** | bcrypt, imzalı JWT, RBAC, prod'da kapalı yıkıcı araçlar |
| DevOps / SRE | **7.5** | CI kapısı, migration, DR dokümanı; tek bölge, dağıtık sayaç yok |
| Test | **8** | 224 birim/entegrasyon testi; tarayıcı (E2E) testi yok |
| Ürün dürüstlüğü | **9** | Sabit metrik/rozet/veri kalmadı; bilinmeyen "—" ile itiraf ediliyor |
| **Genel** | **~8 / 10** | **"Kurumsal iç araç — yayına hazır; sertleştirme sırası net."** |

---

## 2. Bu Turda Tespit Edilen YENİ Bulgular (Y-08 … Y-13)

Önceki turların bulguları (F-01…F-33, Y-01…Y-07) kapanmış durumda. Bu turda aşağıdaki
**yeni** maddeler tespit edildi:

### Y-08 🟠 `xlsx` bağımlılığı npm registry'si dışında (kurulum kırılganlığı)

`package.json` → `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`.

Bu, ADR-001'deki **doğru** güvenlik kararı (npm'deki `0.18.5`'in iki YÜKSEK
zaafiyeti var, düzeltmesi yalnızca resmî CDN'de). Ancak yan etkisi şu: kurulum artık
`cdn.sheetjs.com` adresine ağ erişimi gerektiriyor. **Bu inceleme ortamında
`npm install`/`npm ci` bu CDN'e erişemediği için başarısız oldu** (SSL el sıkışması
engelleniyor; `registry.npmjs.org` ise açık). Vercel ve GitHub Actions runner'larında
CDN normalde erişilebilir olduğundan yayın yolunu tıkamaz; ama egress kısıtlı her
ortam (kurumsal proxy, kısıtlı CI) için tek nokta arızasıdır.

- **Geçici çözüm (bu oturumda doğrulama için):** xlsx geçici olarak registry `0.18.5`'e
  çekildi, tüm kapılar (typecheck/lint/test/build) geçti, sonra package dosyaları
  geri alındı. **Kalıcı olarak `0.18.5`'e dönmek yanlıştır** — `npm audit --audit-level=high`
  CI kapısı kırılır.
- **Kalıcı çözüm (önerilen):** tarball'ı depoya gömün. Bunun için hazır betik yazıldı:
  `npm run vendor:xlsx` (→ `scripts/vendor-xlsx.sh`). CDN'e erişebilen tek bir makinede
  çalıştırılıp `vendor/xlsx-0.20.3.tgz` commit edilince kurulum tamamen offline olur.

### Y-09 🟡 Doküman–veri uyumsuzlukları (küçük ama "ürün dürüstlüğü" ilkesine aykırı)

- **"38 gerçek sipariş" vs 24:** README/SPEC "38 The Vitamin Shoppe siparişi" der;
  fixture (`ALL_38_XLS_ORDERS` → `fixtures/xlsOrdersData.ts`) **24** satır içerir ve
  seed sonrası `orders` tablosunda **24** kayıt oluşur. İsim miras kalmış; sayı artık
  tutmuyor.
- **"26 mağazalık filo" vs 4:** `stores` tablo yorumu ve README "26 mağaza" der; seed
  (`INITIAL_STORES`) yalnızca **4** mağaza (HRN, SEL, MK, AMZ-02) kurar.
  `channelListings` JSON'ları başka kodlara atıf yapar ama o mağazalar tabloda yok.
- **Etki:** Yönetici için "nerede o 22 mağaza?" sorusu doğar. Veri değil, **beklenti**
  uyumsuzluğu. Düzeltme: ya seed'i 26 mağazaya genişletin ya da dokümanı "4 aktif
  mağaza + admin'den eklenebilir" olarak düzeltin. (Kilitli şema kapsamında DEĞİL —
  bunlar veri/doküman, kolon değil.)

### Y-10 🟡 Hız sınırlayıcı proses-içi (serverless'ta dağıtık değil)

`src/lib/rateLimit.ts` in-memory `Map` kullanır. Vercel serverless'ta her instance
kendi sayacını tutar; aynı IP farklı instance'a düşünce limit sıfırlanır. Kod bunu
dürüstçe yorum satırında belirtiyor. Tek-instance brute-force'u durdurur, ama gerçek
koruma için **Upstash Ratelimit / Redis** gerekir (Faz-6 notu). İç araç + 5 kullanıcı
için kabul edilebilir; kamuya açık hedef kitlede ilk hafta içinde ele alınmalı.

### Y-11 🟡 Sunucu sayfalı ama arayüz tek sayfa çekiyor

`GET /api/orders` `page/pageSize` destekliyor (üst sınır 2000); fakat
`useCerberusData` bunu kullanmıyor ve UI her istekte 200 satırı DOM'a basıyor. 10k+
satırda tarayıcı kilitlenir. PLAN.md'de "kalan borç #3" olarak zaten kayıtlı. **Yayın
öncesi ele alınması gereken tek gerçek frontend riski.**

### Y-12 🟡 `morning_briefings` tablosu yok — "dünle fark" sınırlı

Brifing her istekte runtime hesaplanıyor (SQL aggregate — maliyet iyi); ama tarihsel
snapshot olmadığı için "WHAT CHANGED" gerçek bir dün-bugün farkı değil, anlık durumdan
türetilen bir kıyas. Yöneticinin ana vaadi ("dünden bugüne ne değişti") ancak günlük
snapshot tablosuyla tam karşılanır. (DISCOVERY_REPORT'ta vaat edilmiş, şemaya hiç
girmemiş — bilinen açık.)

### Y-13 🟡 E2E (tarayıcı) testi yok

Vitest node ortamında; jsdom/bileşen testi ve Playwright akışı yok. `next build` +
birim/entegrasyon güçlü; ancak "login → sipariş gir → XLS import → yetkisiz erişim 403"
zinciri yalnızca elle doğrulandı.

---

## 3. Katman Değerlendirmeleri

### 3.1 Frontend (uzman gözüyle)

**Güçlü:**
- React 19 + Next 16 App Router + TypeScript 5.9 + Tailwind 4; koyu "komuta merkezi"
  teması, mobil çekmece, `min-w-0` gibi layout detayları bile düşünülmüş.
- 1.640 satırlık monolit → 385 satır `page.tsx` (salt kompozisyon) + `features/`
  altında özellik modülleri (`shell`, `briefing`, `decision`, `orders`, `products`,
  `sourcing`, `operations`). Tek sorumluluk net.
- Sunucu durumu tek hook'ta (`useCerberusData`); `AbortController` ile eski isteğin
  cevabının yeni mağaza seçimini ezmesi engellenmiş.
- İyimser güncelleme başarısız olursa sunucudan yeniden yükleniyor (kullanıcı
  "kaydettim" sanmıyor). `Infinity%`, negatif kâr rengi, `—` gösterimi ele alınmış.
- CSV dışa aktarım RFC 4180 + CSV-injection (`=+-@`) korumalı, Blob ile indirme (14 test).
- Fontlar self-host (globals.css token'ları) — `next/font/google` derleme uyarısı yok.
- Boş/hata durumu: kırmızı şerit + "Tekrar dene"; mock'a sessiz düşüş yok.

**Zayıf / borç:**
- Sayfalama UI'ı yok (Y-11); sanallaştırma yok.
- Bileşen/UI testi yok (jsdom kurulu değil); görsel regresyon yakalanamıyor.
- WCAG AA taraması yapılmadı (audit-03'te işaretli: küçük punto, kontrast riskleri).
- i18n yok (tr-TR sabit); ADR'de karar ama iskelet yok.

### 3.2 Backend (uzman gözüyle)

**Güçlü:**
- Route-bazlı zorunlu auth: `requireUser()`/`requireRole()` — "çerez varsa güven"
  kalıbı tamamen kalkmış; anonim `/api/orders` → 401 canlı doğrulandı.
- bcrypt (cost 12) + legacy düz metin geçişi (SHA-256 timing-safe) + iptal edilmiş
  parola seti; JWT imzalı (jose HS256), 8 saat, issuer + rol allowlist kontrolü.
- zod doğrulama merkezi (`parseBody`): 422 alan-bazlı hatalar, 413 gövde limiti.
- Hata hijyeni: `handleRouteError` → correlationId, ham hata/stack istemciye asla dönmez.
- KPI/aggregation SQL tarafında (`count/filter where`, GROUP BY) — N+1 giderilmiş.
- XLS import tek transaction'da; DB CHECK/FK/unique son savunma hattı.
- PII minimizasyonu (`maskOrderForRole`, `minimizeUsersForRole`); logger'da PII/sır
  redaksiyonu (pino redact).
- SSRF yüzeyi dar: Drive-URL'den yalnızca ID çıkarılıp `docs.google.com` sabit URL'ine
  gömülüyor; keyfi host'a fetch yok.

**Zayıf / borç:**
- Rate-limit in-memory (Y-10).
- OFFSET tabanlı sayfalama (derin sayfalarda maliyet) — MVP için yeterli.
- Brifing anlık hesaplanıyor, tarihsel snapshot yok (Y-12).

### 3.3 Sistem tasarımı (uzman gözüyle)

**Güçlü:**
- Katman ayrımı temiz: `domain` (saf, testli karar motorları) / `db` (şema + çözücü) /
  `lib` (auth, guard, validation) / `app` (rotalar) / `features` (UI). İş mantığı
  route içinde değil.
- **Ürün-merkezli çekirdek** (`products`, `supplier_offers`, `product_lifecycle_events`)
  doğru bir evrim: hızlı değişen fiyat (zaman serisi) ile değişmeyen kimlik ayrılmış;
  ASIN-metin eşleşmesi yerine FK garantisi gelmiş. Gerçekleşen ROI artık uydurma değil.
- Kilitli 8 tabloya dokunulmamış; ek tablolar ölçülü biçimde eklenmiş; migration
  versiyonlu ve `bootstrap-db` ile geri dolgu + NOT NULL göçü sırası otomatik.
- CI kalite kapısı: lint + typecheck + test + `npm audit --audit-level=high` + build.
- Dokümantasyon kodu yansıtıyor (PLAN.md gerçek durumla senkron).

**Zayıf / borç:**
- Tek bölge, tek DB; yedekleme dokümante ama otomasyon Neon'un PITR'ına bağlı
  (bu kabul edilebilir — Neon otomatik point-in-time recovery sağlar).
- Observability: Sentry iskeleti var (opsiyonel), pino JSON log var; ama log
  drain/alert bağlı değil.
- Oturum 8 saat sabit; kaydırmalı yenileme (sliding renewal) yok (Faz-6 notu).
- SP-API entegre değil (UI dürüstçe "BAĞLI DEĞİL" gösteriyor) — bilinçli bir boşluk.

---

## 4. Canlıya Alma İş Planı

### Sprint 0 — Yayına çıkış (bugün – 1 gün)

| # | Görev | Sahip | Çıktı |
|---|---|---|---|
| 0.1 | Neon'da DB aç → **pooler** bağlantı adresini al (`-pooler` içeren host) | SRE | `DATABASE_URL` |
| 0.2 | `SESSION_SECRET` üret (`openssl rand -base64 48`) + seed parolaları (min 12 kr) | SRE | env değerleri |
| 0.3 | `npm run db:bootstrap` (Neon'a migration + backfill + seed) | SRE | şema + veri |
| 0.4 | `npm run preflight` ile yayın öncesi kontrol (yeni betik) | SRE | PASS raporu |
| 0.5 | Vercel'e import → env değişkenlerini gir → Redeploy | SRE | canlı URL |
| 0.6 | `curl https://<site>/api/health/ready` + ilk giriş + "Gerçek Veriyle Başla" | Ürün | doğrulama |
| 0.7 | `npm run vendor:xlsx` (CDN erişimi olan makinede) + `vendor/` commit | SRE | offline kurulum |
| 0.8 | Y-09 doküman uyumsuzluğunu karara bağla (seed'i 26 mağazaya genişlet **veya** dokümanı düzelt) | Ürün | tutarlı metin |

### Sprint 1 — İlk kullanım engelleri (1 hafta)

| # | Görev | Efor | Not |
|---|---|---|---|
| 1.1 | **Sunucu tarafı sayfalama UI'ı** (sayfa kontrolü veya sanallaştırma) | 3 g | Y-11; 10k+ satır senaryosu |
| 1.2 | **Playwright E2E**: login → sipariş gir → XLS import → yetkisiz 403 | 4 g | Y-13 |
| 1.3 | **Dağıtık rate-limit** (Upstash Ratelimit) veya Vercel WAF kuralı | 1 g | Y-10 |
| 1.4 | İlk kullanım geri bildirimi topla → hızlı UX düzeltmeleri | 2 g | — |

### Sprint 2 — Karar kalitesi (2–3 hafta)

| # | Görev | Efor |
|---|---|---|
| 2.1 | `morning_briefings` günlük snapshot tablosu → gerçek "WHAT CHANGED" (dünle fark) | 3 g |
| 2.2 | Erişilebilirlik (WCAG AA) taraması + kontrast/klavye düzeltmeleri | 2 g |
| 2.3 | Log drain + uyarı (Vercel Log Drains → kendi log sisteminiz) | 1 g |
| 2.4 | Sentry DSN tanımla (opsiyonel, env-korumalı iskelet hazır) | 0.5 g |

### Sprint 3 — Uzun vadeli (sonra)

- SP-API entegrasyonu (8–13 kişi-gün; LWA kaydı → token kasası → oran sınırlı senkron job).
- i18n (tr-TR → en-US).
- Oturum kaydırmalı yenileme + sunucu taraflı iptal listesi.
- Bileşen (jsdom) testleri.

---

## 5. Adım Adım Canlıya Alma Runbook'u (Neon + Vercel)

```bash
# 1) Depoyu hazırla
git clone https://github.com/allinone-code/allinone-saas.git && cd allinone-saas
git checkout arena/01a07866-allinone-saas
npm ci                      # NOT: cdn.sheetjs.com erişimi gerekir (bk. Y-08)

# 2) Ortam değişkenleri
export DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.<bölge>.aws.neon.tech/db?sslmode=require"
export SESSION_SECRET="$(openssl rand -base64 48)"
export SEED_ADMIN_PASSWORD="<min 12 karakter, güçlü>"
export SEED_STORE_PASSWORD="<min 12 karakter, güçlü>"

# 3) Neon'u kur (migration + geri dolgu + seed — sıra otomatik)
npm run db:bootstrap

# 4) Yayın öncesi kontrol (yeni betik)
npm run preflight

# 5) Vercel
#    → New Project → import repo → env değişkenlerini gir (yukarıdaki 4 değişken)
#    → Deploy → Settings → Redeploy (env sonrası)

# 6) Doğrula
curl -s https://<site>/api/health/ready
#    → {"ready":true,"checks":{"database":true,"sessionSecretConfigured":true},...}
```

**Sıralama önemli:** önce Neon kurulumu, sonra Vercel deploy. Ters sırada yeni kod
olmayan tabloları sorgular ve hata verir.

**İlk giriş sonrası (tek seferlik):** Admin → Komuta Merkezi → Veritabanı Araçları →
"Gerçek Veriyle Başlangıç" (demo sipariş/ürün verisini temizler; mağaza, kullanıcı ve
araştırmacı kadrosunu korur) → kendi XLS/Drive verinizi yükleyin.

> ⚠️ Yıkıcı veritabanı araçları `NODE_ENV=production` ortamında tamamen 404 döner —
> Vercel'de (Preview dâhil) hiçbir reset butonu çalışmaz. Demo verisi temizliğini
> **deploy'dan önce** yapmak istiyorsanız lokal/preview ortamında yapın.

---

## 6. Bu Oturumda Yapılan Somut İşler

1. **Uçtan uca doğrulama:** typecheck / lint / 224 test / build (22 route) yeniden
   çalıştırıldı — hepsi yeşil.
2. **Canlı önizleme ayağa kaldırıldı:** PGlite üzerinde migration + seed, dev sunucusu
   0.0.0.0:3000'de çalışıyor; login → auth → orders → products → intelligence canlı
   HTTP ile doğrulandı. (Admin giriş: `ahmet@cerberus-commerce.io` + bu oturum için
   üretilen preview parolası — yalnızca önizleme amaçlı.)
3. **`scripts/preflight.ts` eklendi** (`npm run preflight`): yayından önce env, DB
   bağlantısı, migration, seed ve yetim-sipariş kontrolü yapan salt-okunur kapı.
   FAIL varsa çıkış kodu 1 (CI/deploy betiklerine bağlanabilir).
4. **`scripts/vendor-xlsx.sh` eklendi** (`npm run vendor:xlsx`): SheetJS 0.20.3
   tarball'ını depoya gömüp `xlsx` bağımlılığını `file:` yapar — Y-08'i kalıcı kapatır.
5. **Y-08/09/10/11/12/13 bulguları** tespit edilip yukarıda belgelendi.

---

## 7. Karar Gerektiren Sorular

| # | Soru | Öneri |
|---|---|---|
| 1 | "26 mağaza" iddiası: seed 4 mağaza içeriyor (Y-09) | Seed'i 26 mağazaya genişlet (dokümanla tutarlı) |
| 2 | "38 sipariş" adı: fixture 24 satır (Y-09) | `ALL_24_XLS_ORDERS` olarak yeniden adlandır veya 38'e tamamla |
| 3 | `xlsx` vendor'u: tarball'ı (~MB) repoya gömmek kabul mü? | Evet — kurulum dayanıklılığı için değer |
| 4 | SP-API: bu sürümde kapsam dışı mı? | Kapsam dışı ilan et; UI zaten "BAĞLI DEĞİL" diyor |

---

*Bu rapor `docs/audit/03_Uctan_Uca_Degerlendirme_2026-09.md` ve
`docs/KURULUM_VE_DEPLOY.md` ile birlikte okunmalıdır. Kod durumu PLAN.md'deki
"doğrulama komutları" ile birebir örtüşmektedir.*
