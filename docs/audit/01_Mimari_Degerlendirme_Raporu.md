# CERBERUS (allinone-saas) — Sistem & Yazılım Mimarisi Değerlendirme Raporu

| | |
|---|---|
| **Proje** | CERBERUS — Decision-Centric Commerce Operating System (`allinone-code/allinone-saas`) |
| **Rapor tarihi** | 2026-09-01 |
| **Hazırlayan** | Sistem & Yazılım Mimarı (Arena.ai Agent Mode) |
| **İncelenen sürüm** | `main` @ `577441b` (12 commit) |
| **Kapsam** | Tam kapsamlı audit: mimari, güvenlik, veri, API, frontend, DevOps, test, dokümantasyon, uyumluluk |
| **Yöntem** | Statik kod incelemesi, bağımlılık taraması (`npm audit`), tip kontrolü (`tsc --noEmit`), lint (`eslint`), üretim derlemesi (`next build`), doküman-kod tutarlılık karşılaştırması |

---

## 1. Yönetici Özeti

Sistem, **iş alanını (domain) iyi modelleyen, modern bir teknoloji yığınıyla (Next.js 16 + React 19 + Drizzle + PostgreSQL/Neon) yazılmış, derlenebilir ve tip açısından temiz** bir prototiptir. Ancak mevcut hâliyle **üretim ortamına çıkarılamaz**: kimlik doğrulama mekanizması tasarımsal olarak çöp durumdadır; oldukça basit yöntemlerle (herhangi bir parola bilmeden, sadece tarayıcıya tek satır cookie yazarak) tam yönetici yetkisi elde edilebilir, hatta **hiç kimlik doğrulamadan** tüm veritabanı okunabilir ve **tüm veriler silinebilir**. Bunun yanında parolalar düz metin saklanmakta, GitHub'daki herkese açık README ve kaynak kodda yayınlanmaktadır.

**Genel durum skoru: 2.7 / 10 — "Prototip/Demo aşaması; üretime hazır değil."**

| Eksen | Skor (0-10) | Durum |
|---|---|---|
| Güvenlik & Kimlik Yönetimi | **1** | 🔴 Kritik zafiyetler (imzasız oturum, düz metin parola, arka kapı) |
| Veri Mimarisi | **4** | 🟠 Şema zengin ancak FK/index/migration yok, veri kod içinde gömülü |
| API Tasarımı | **3** | 🟠 Auth atlanabilir, validasyon yok, sayfalama yok, GET'te yan etki |
| Frontend / UI | **5** | 🟡 Modern ve derleniyor; ancak 1.639 satırlık tek bileşen, mock veri fallback |
| Ölçeklenebilirlik & Performans | **3** | 🟠 Tüm tablo her istekte çekiliyor, istek başına seed, pool=3 |
| DevOps / SRE | **1** | 🔴 CI/CD yok, migration yok, yedekleme/DR dokümante değil |
| Test | **0** | 🔴 0 test dosyası, test script'i bile yok |
| Dokümantasyon | **6** | 🟡 Kapsamlı ancak kod ile ciddi uyumsuzluk (spec drift) |
| KVKK / Uyumluluk | **1** | 🔴 PII korumasız, "değişmez" denilen audit log silinebiliyor |

### Acil Alınması Gereken 5 Aksiyon (ilk 7 gün)

1. **Uygulamayı kamuya açık trafikten kapatın** veya önüne zorunlu bir koruma (Vercel Protection / Basic Auth / IP allowlist) koyun.
2. **Tüm parolaları iptal edin** — `admin2026` / `store2026` / `cerberus2026` herkese açık GitHub'da yayında; Neon veritabanı erişim bilgilerini de kontrol edin, git geçmişi temizlense bile sızmış sayılmalıdır.
3. **Oturum çerezini imzalı hâle getirin** (JWT/JWE veya iron-session) — mevcut base64-JSON cookie'si herkes tarafından üretilebilir.
4. **API route'lardaki `if (currentUser && ...)` kalıbını kaldırın** — anonim istek şu an yetki kontrolünü atlıyor; özellikle `/api/admin/database-reset` anonim çağrıyla tüm tabloları silebiliyor.
5. **`database-reset` (silme/geri yükleme) uçlarını üretimde tamamen devre dışı bırakın** (`RESET-CERBERUS` onay kodu README'de herkese açık).

---

## 2. İncelenen Sistem — Teknik Envanter

| Ölçüt | Değer |
|---|---|
| Teknoloji | Next.js 16.2.6 (App Router), React 19.2.6, TypeScript 5.9, Drizzle ORM 0.45, `pg` 8.20, Neon PostgreSQL, Tailwind 4, SheetJS (`xlsx` 0.18.5) |
| Kaynak boyutu | ~9.420 satır TS/TSX, 34 dosya (`src/`) |
| API uçları | 16 route (8 admin/depo, 3 auth, orders CRUD + 2 import, intelligence, batches, health) |
| Veritabanı | 8 tablo: `users, stores, researchers, research_sessions, product_masters, orders, psh_batches, audit_logs` |
| Derleme | ✅ `tsc --noEmit` temiz • ✅ `next build` başarılı (18 route) • ❌ ESLint: 22 hata, 1 uyarı |
| Test | ❌ 0 test dosyası |
| CI/CD | ❌ `.github/` yok |
| Migration | ❌ `drizzle/` migration klasörü yok — şema `drizzle-kit push` ile yönetiliyor |
| Bağımlılık güvenliği | ❌ npm audit: **5 yüksek** açık (SheetJS: Prototype Pollution + ReDoS — "no fix available") |

---

## 3. Bulgu Özeti

**Toplam 33 bulgu: 5 Kritik, 11 Yüksek, 12 Orta, 5 Düşük**

| ID | Seviye | Kategori | Bulgu |
|---|---|---|---|
| F-01 | 🔴 Kritik | Güvenlik | İmzasız/şifrelenmemiş base64 oturum çerezi — kimlik sahteciliği (forgery) |
| F-02 | 🔴 Kritik | Güvenlik | Yetki kontrolleri `currentUser && ...` kalıbıyla atlanabilir; admin uçları anonim çalışıyor |
| F-03 | 🔴 Kritik | Güvenlik | Parolalar düz metin saklanıyor (`password_hash` alanında `"admin2026"`) |
| F-04 | 🔴 Kritik | Güvenlik | Master parola arka kapısı + boş parola kabulü; parolalar herkese açık repoda yayınlanmış |
| F-05 | 🔴 Kritik | Güvenlik | `/api/*` proxy'den tamamen muaf; API'lerde sunucu tarafı auth yok → tüm veri anonim okunur |
| F-06 | 🟠 Yüksek | Güvenlik | Oturum yönetimi yok: sona erme/imza/rotasyon/sunucu taraflı geçersiz kılma yok |
| F-07 | 🟠 Yüksek | Güvenlik | Login'de rate-limit / brute-force koruması yok |
| F-08 | 🟠 Yüksek | Bağımlılık | `xlsx@0.18.5`: GHSA-4r6h-8v6p-xvw6 (Prototype Pollution) + GHSA-5pgg-2g8v-p4x9 (ReDoS); npm akışında düzeltme yok |
| F-09 | 🟠 Yüksek | Veri/Uyum | "Değiştirilemez audit log" iddiası geçersiz — reset ve master-crud, `audit_logs` kayıtlarını silebiliyor |
| F-10 | 🟠 Yüksek | DevOps | Versiyonlu veritabanı migration'ı yok; README prod'da `drizzle-kit push` öneriyor (yıkıcı olabilir) |
| F-11 | 🟠 Yüksek | Güvenlik | Mağaza izolasyonu (RBAC) sahte cookie ile bypass edilebilir; anonim kullanıcı `ALL` kapsam görür |
| F-12 | 🟠 Yüksek | API | Girdi doğrulaması (zod vb.) hiç yok; tüm POST/PATCH gövdeleri doğrulanmadan DB'ye yazılıyor |
| F-13 | 🟠 Yüksek | Ölçek | Sayfalama yok: `GET /api/orders` tüm tablo + 4 ek tabloyu her istekte çekiyor; pool `max: 3` |
| F-14 | 🟠 Yüksek | Mimari | GET isteklerinde yan etki: `ensureCerberusSeeded()` login/GET rotalarında INSERT yapıyor |
| F-15 | 🟠 Yüksek | Mimari | 1.608 satır gömülü demo veri prod kodunda; API hata verince UI sessizce mock veri gösteriyor |
| F-16 | 🟠 Yüksek | KVKK | PII (personel e-posta/isim, kart son-4, sipariş e-postaları) korumasız; maskeleme/saklama/onay yok |
| F-17 | 🟡 Orta | Test | Test altyapısı tamamen yok |
| F-18 | 🟡 Orta | DevOps | CI/CD pipeline yok; lint/typegate zorlanmıyor |
| F-19 | 🟡 Orta | Kalite | ESLint 22 hata (JSX kaçışları), 1 React hook uyarısı |
| F-20 | 🟡 Orta | Kalite | `package.json` adı hâlâ `nextjs-postgresql-template` |
| F-21 | 🟡 Orta | Frontend | `page.tsx` 1.639 satır tek `"use client"` bileşeni; tüm state client'ta |
| F-22 | 🟡 Orta | Veri | FK yok, index yok, enum yerine serbest text, `orderNumber` unique değil → mükerrer import |
| F-23 | 🟡 Orta | Doküman | Spec drift: PLAN'da FAZ 2-15 açık ama README "tamam" diyor; `morning_briefings` tablosu şemada yok; SP-API sadece etiket |
| F-24 | 🟡 Orta | API | Ham `error.message` istemciye dönüyor (bilgi sızıntısı); loglama sadece `console` |
| F-25 | 🟡 Orta | Veri | `numeric` ↔ `Number()` dönüşümlerinde hassasiyet/tutarlılık riski; toplamlar uygulama katmanında |
| F-26 | 🟡 Orta | Config | `.env.example` yalnızca `DATABASE_URL`; `SESSION_SECRET` vb. yok |
| F-27 | 🟡 Orta | Operasyon | "38 gerçek XLS geri yükle" aracı prod verisinin üstüne kod içi demo veri basıyor; tek sabit onay stringi |
| F-28 | 🟡 Orta | Operasyon | Yedekleme/DR, ortam ayrımı (dev/stage/prod) dokümante değil; tek bölge |
| F-29 | ⚪ Düşük | Güvenlik | Güvenlik başlıkları (CSP, X-Frame-Options vb.) yok; `next.config.ts` boş |
| F-30 | ⚪ Düşük | Frontend | i18n yok; SheetJS statik import → ana bundle şişkinliği |
| F-31 | ⚪ Düşük | Config | `DATABASE_URL` yoksa localhost'a "fail-open" fallback |
| F-32 | ⚪ Düşük | API | `GET /api/health` hata detayı sızdırıyor |
| F-33 | ⚪ Düşük | Mimari | Transaction yok: import çoklu INSERT'i tek transaction'sız; kısmi hata → tutarsız veri |

---

## 4. Kritik Bulgular (Detay ve Kanıt)

### F-01 — İmzasız oturum çerezi: herkes herkes olabilir

**Kanıt** — `src/lib/auth.ts` (`getCurrentUser`) ve `src/app/api/auth/login/route.ts`:

```ts
const decoded = Buffer.from(sessionCookie, "base64").toString("utf-8");
return JSON.parse(decoded) as SessionUser;   // imza doğrulaması YOK
```

Oturum, kullanıcı nesnesinin **base64 ile kodlanmış JSON**'udur. İmza (HMAC/JWT) ya da şifreleme yoktur; `decrypt` edilecek bir "giz" de yoktur. Saldırganın yapması gereken tek şey tarayıcısına şu cookie'yi yazmak:

```
cerberus_session = base64({"id":1,"name":"Saldirgan","email":"x@x","role":"ADMIN","storeCode":"ALL"})
```

**Etki:** Tüm RBAC (mağaza izolasyonu dahil) tek hamlede bypass; tam yönetici yetkisi. Sunucu, çerezin içeriğine körü körüne güvenir (`/api/orders` GET'te `currentUser` olarak aynen kullanılıyor).
**Çözüm:** `iron-session` ya da imzalı/JWE session (Auth.js v5 / jose), `SESSION_SECRET` env'i, kısa ömür + rotasyon, sunucu tarafı oturum deposu veya `sid` ile iptal edebilme.

### F-02 — Yetki kontrolü "isteğe bağlı": anonim çağrı admin uçlarını çalıştırıyor

**Kanıt kalıbı** (5+ rotada tekrarlanıyor) — örn. `src/app/api/admin/database-reset/route.ts`:

```ts
const currentUser = await getCurrentUser();
if (currentUser && currentUser.role !== "ADMIN") {   // currentUser === null → blok ATLANIR
  return 403;
}
// ... burada tüm tablolar siliniyor
```

`getCurrentUser()` çerez yoksa `null` döner → `currentUser &&` koşulu `false` → **403 fırlatılmaz** → işlem anonim olarak çalışır. Üstelik yanılgıyı büyütmek için aktör adı `currentUser?.name || "Ahmet Erdem (ADMIN)"` olarak loglanıyor (anonim işlem admin adına yazılıyor).

**Etkilenen uçlar (anonim erişilebilir):**

- `POST /api/admin/database-reset` — tüm sipariş/batch/ürün/audit silme, fabrika sıfırlaması (tek "koruma": README'de yazan sabit string `RESET-CERBERUS`)
- `DELETE /api/admin/master-crud` — orders/users/stores/productMasters/**auditLogs** silme
- `POST/PATCH /api/admin/users`, `POST/PATCH/DELETE /api/admin/stores` (aynı kalıp)
- `PATCH/DELETE /api/orders/[id]` — yetki kontrolü hiç yok; finansal alanlar herkesçe değiştirilebilir
- `POST /api/orders`, `POST /api/orders/import-xls`, `POST /api/orders/import-drive-url`, `POST /api/batches` — anonim veri zehirleme (istenen `buyerStore` kabul ediliyor; izolasyon yalnız çerez varsa uygulanıyor)
- `GET /api/admin/users` — tüm personel listesi anonim döner

**Etki:** Tek HTTP isteğiyle tüm şirket verisi okunur/silinir. İş açısından en yüksek risk.
**Çözüm:** Tüm route'lar zorunlu `requireUser()` / `requireRole("ADMIN")` ile başlasın; "kullanıcı yoksa 401" varsayılan olsun. Merkezi bir yetki yardımcısı + route bazlı policy tablosu.

### F-03 — Parolalar düz metin

**Kanıt:** `src/lib/auth.ts` → `passwordHash: "admin2026"`; seed (`src/db/seed.ts`) bunları DB'ye aynen yazıyor; login `cleanPassword === user.passwordHash` ile **string eşitliği** yapıyor. `users` tablosunun `password_hash` kolonu `text` (bcrypt/argon2 hiç kullanılmamış).

**Etki:** DB sızıntısı = tüm parolalar açık; ayrıca çalışanlar aynı parolayı başka yerde kullanıyorsa yayılır. OWASP ASVS 2.4 ihlali.
**Çözüm:** `bcrypt` (cost≥10) veya `argon2id`; mevcut kullanıcılar için zorunlu parola sıfırlama; yeni kullanıcı akışında hash'leme (PATCH `/api/admin/users` da düz metin yazıyor).

### F-04 — Arka kapı parolaları ve boş parola kabulü; sırlar herkese açık repoda

**Kanıt** — `src/app/api/auth/login/route.ts`:

```ts
const isValidPassword =
  !cleanPassword ||                        // boş parola KABUL
  cleanPassword === user.passwordHash ||
  cleanPassword === "admin2026" ||         // HER hesap için master parola
  cleanPassword === "store2026" ||
  cleanPassword === "cerberus2026";
```

E-posta adresini bilmek yeterli: herhangi bir hesap `admin2026` ile açılır; hatta parola alanını boş bırakmak bile geçerlidir. Bu parolalar ayrıca **README.md'de ve git geçmişinde herkese açık** durumda.

**Etki:** F-01/F-02 olmasaydı bile korumasız tam erişim.
**Çözüm:** Master parola kalıbını tamamen kaldır; boş parola reddet; repodaki tüm demo parolaları iptal et; README'den test hesabı tablosunu kaldır; gerekirse geçmişi temizle (BFG/git-filter-repo) ve sızmış kabul ederek tüm sırları döndür.

### F-05 — Tüm API'ler proxy'den muaf; sunucu tarafında da kapı yok

**Kanıt** — `src/proxy.ts`:

```ts
if (pathname.startsWith("/login") || pathname.startsWith("/api") || ...) {
  return NextResponse.next();     // /api/* için çerez bile aranmıyor
}
```

Next.js 16 konvansiyonu gereği `proxy.ts` doğru dosya (derleme çıktısında `ƒ Proxy (Middleware)` olarak doğrulandı) — **ancak** yalnızca sayfaları koruyor ve `pathname.startsWith("/api")` ile tüm API'leri koşulsuz geçiriyor. API'lerde de F-02'deki atlanabilir kontroller olduğundan, örneğin `GET /api/orders` anonim çağrıldığında **tüm siparişler + mağazalar + kullanıcı listesi + son 40 audit kaydı** döner (kodda `currentUser` yoksa varsayılan `ADMIN` nesnesi bile üretiliyor). Proxy çerez varlığını kontrol etse bile F-01 nedeniyle sahte çerezle geçilir.

**Etki:** Kurumsal ticari veri (maliyetler, tedarikçiler, kart son-4, personel e-postaları) internete açık.
**Çözüm:** API'leri proxy düzeyinde değil route düzeyinde zorunlu auth ile koru (Next 16 proxy'si "ince kapı" olmalı; asıl karar route'da). `GET /api/orders` dahil tüm uçlara `requireUser()`.

---

## 5. Yüksek Bulgular — Özet Detay

- **F-06 Oturum yaşam döngüsü:** 7 gün sabit `maxAge`, imza yok, rotasyon yok, sunucu tarafı iptal yok; `POST /api/auth/logout` yalnızca istemci çerezini siler — çalınmış/üretilmiş çerez sonsuza dek geçerli. → İmzalı token + `sid` kara listesi/depo + kayma süreli yenileme.
- **F-07 Brute-force:** Login'de limit yok; üstüne master parolalar var. → IP+hesap bazlı rate limit (ör. Upstash Ratelimit), üstel gerileme, kilitleme, WAF.
- **F-08 SheetJS (`xlsx@0.18.5`):** `npm audit`: GHSA-4r6h-8v6p-xvw6 (Prototype Pollution), GHSA-5pgg-2g8v-p4x9 (ReDoS) — **"No fix available"** (npm'deki akış güncellenmiyor). Kullanıcının yüklediği dosyayı bu kütüphane ayrıştırıyor. → SheetJS güncel sürümü (cdn.sheetjs.com) veya ExcelJS'e geçiş; dosya boyutu/tip limiti; ayrıştırmayı mümkünse istemciye taşı + zod doğrulama.
- **F-09 Audit bütünlüğü:** `database-reset` → `NUKE_ALL_KEEP_ADMIN` tüm `audit_logs`'u siliyor; `master-crud` DELETE, `auditLogs` tablosunu hedef alabiliyor. README'deki "Değiştirilemez Denetim İzi" vaadiyle çelişiyor. → Audit tablosu uygulama rolünde DELETE/UPDATE yetkisiz (RLS/ayrı DB rolü), silme uçlarından çıkarılsın; append-only + periyodik hash-zinciri (imzalı checkpoint) düşünün.
- **F-10 Migration yok:** `drizzle/` klasörü yok; README prod şeması için `drizzle-kit push` diyor (push, uyumsuz şemada veri kaybettirebilir). → `drizzle-kit generate` ile versiyonlu SQL migration, CI'da `migrate`, push yalnız geliştirmede.
- **F-11 İzolasyon bypass:** `STORE_USER` kısıtı `currentUser` cookie'sinden geliyor (sahtesi yapılabilir) ve cookie yoksa istenen `storeCode=ALL` uygulanıyor. → Mağaza kapsamı JWT claim'inden sunucuda çözümlensin; sorgular sunucuda zorunlu filtrelensin.
- **F-12 Validasyon yok:** Hiçbir route'ta şema doğrulama yok; `Number("abc")` → `NaN` DB'ye numeric string olarak gönderiliyor; uzunluk/aralık/tip kontrolü yok; gövde boyut limiti yok. → zod şemaları + merkezi `parseBody()`, hata 422 formatı, `req` boyut limiti.
- **F-13 Sayfalama/N+1:** `GET /api/orders` tüm tabloyu + stores + batches + logs + users'ü her istekte çekiyor; KPI'lar bellekte reduce ile; `stores` GET'te mağaza başına ayrı COUNT/SUM sorgusu (N+1); pg pool `max: 3`. → sunucuda `LIMIT/OFFSET` veya imleç, SQL-side aggregate, tek sorguluk store stats (GROUP BY), Neon HTTP driver değerlendirmesi.
- **F-14 GET'te yan etki:** `ensureCerberusSeeded()` → `GET /api/orders`, `POST /api/auth/login` içinde INSERT yapıyor: HTTP semantiği ihlali, yarış durumu, prod'da beklenmedik veri belirmesi. → Seed sadece bir defaya mahsus script/migration'a taşınsın; GET'ler salt-okunur olsun.
- **F-15 Mock veri sızdırması:** `src/lib/xlsOrdersData.ts` (1.103 satır) + `src/lib/mockData.ts` (505 satır) üretim bundle'ında; `page.tsx` state'i `INITIAL_ORDERS` ile başlatıyor ve API hatasında sessizce bu veriyi gösteriyor → yönetici "gerçek" ciro ekranında demo verisi görebilir. → Mock'lar `dev`-only fixture'a taşınsın; hata durumunda açık "veri alınamadı" gösterimi.
- **F-16 KVKK:** Personel ad/e-posta, alıcı e-postaları, kart son-4'ler loglarla birlikte anonim uçlardan sızıyor (F-05 ile birleşir). Aydınlatma, saklama süresi, silme talebi akışı, loglarda PII minimizasyonu yok. → Faz 7 uyum paketi.

---

## 6. Katman Bazlı Mimari Değerlendirme

**Güçlü yönler (adil bir değerlendirme için):**

- Alan modeli ciddi biçimde düşünülmüş: 40 kolonluk sipariş kontratı, P1–P4 fire tipolojisi, PSH batch yaşam döngüsü, `Product ≠ Listing` ayrımı, karar aksiyonları (`BUY|TEST|WAIT|...`) — dokümantasyon (`docs/data-model.md`, `entity-relationships.md`, `data-dictionary.md`) gerçekten mevcut.
- Tip sistemi tutarlı: `tsc --noEmit` temiz; Drizzle ile şema-tipi uyumu; Next 16 `proxy.ts` konvansiyonu doğru kullanılmış.
- Niyet düzeyinde doğru desenler: audit log kavramı, RBAC kavramı, mağaza izolasyonu kavramı, health endpoint — hepsi var, ancak uygulamaları kırık.

**Zayıf iskelet:**

- **Güvenlik sınırı yok.** Sistem "çerez varsa güven" modeli üzerine kurulu; F-01…F-05 zinciri sistemi korumasız bırakıyor. Bu düzeltilmeden diğer hiçbir iyileştirme üretime taşınamaz.
- **Veri katmanı sözleşmesiz.** FK yok (ör. `orders.buyerStore → stores.storeCode` yalnızca metin eşleşmesi), indeks yok (`buyerStore`, `orderDate`, `asin` filtrelerinde full scan), benzersizlik yok (`orderNumber` unique değil → aynı XLS iki kez import edilirse mükerrer), enum'lar serbest metin (`cargoStatus: "Yolda" / "Tam Geldi"` Türkçe string'ler). İş kuralları DB'de değil, uygulama kodunda varsayım olarak duruyor.
- **İş mantığı dağınık:** karar motoru ve landed-cost hesabı route içinde fonksiyonlar (`intelligence/route.ts`), KPI hesabı `orders GET` içinde, seed herkesin içinde — test edilemeyen, yeniden kullanılamayan yapı. `src/domain/` (hesap motorları) + `src/server/services/` ayrıştırması önerilir.
- **Mimari vaat–kod uçurumu:** `docs/PLAN.md`'de FAZ 2–15 işaretsiz (yapılmadı), buna karşılık README tüm özellikleri "kilitli şema / tamam" olarak sunuyor. `DISCOVERY_REPORT.md`'de vaat edilen `morning_briefings` tablosu şemada yok. UI'daki "SP-API BAĞLI" rozeti ve "senkronizasyon tetiklendi" butonu arkasında hiçbir Amazon entegrasyonu yok (`AdminDashboard.tsx` ~706-728: yalnızca etiket ve toast). Bütçe sağlık skoru, AI radar vb. UI'da var ama besleyen servisler mock.

---

## 7. Risk Değerlendirmesi (İş Etkisi)

| Risk | Olasılık | Etki | Seviye |
|---|---|---|---|
| İnternete açık dağıtımda tüm verinin okunması/silinmesi (F-01/02/04/05) | Yüksek (trivial exploit) | Yıkıcı (ticari veri, itibar, KVKK ihlali) | 🔴 **Kabul edilemez** |
| Parola sızıntısı üzerinden başka sistemlere yayılma (F-03/04) | Orta-Yüksek | Yüksek | 🔴 Yüksek |
| Prod şema güncellemesinde veri kaybı (`drizzle-kit push`, F-10) | Orta | Yüksek | 🟠 Yüksek |
| Yöneticinin mock veriyi gerçek sanıp karar vermesi (F-15) | Orta | Yüksek (finansal karar riski) | 🟠 Yüksek |
| Mükerrer/tutarsız sipariş verisi (F-22/33) | Yüksek | Orta | 🟠 Orta-Yüksek |
| Kötü amaçlı XLS ile zaafiyet tetiklenmesi (F-08) | Orta | Orta | 🟠 Orta |

---

## 8. Doğrulama Notları (Tekrarlanabilir)

```bash
git clone https://github.com/allinone-code/allinone-saas
npm ci
npx tsc --noEmit          # ✅ temiz
npx eslint .              # ❌ 22 hata, 1 uyarı
npm audit --omit=dev      # ❌ 5 yüksek (xlsx: fix yok)
npx next build            # ✅ başarılı, 18 route; "ƒ Proxy (Middleware)" kayıtlı
```

Oturum sahteciliği PoC (yerel, eğitim amaçlı tek satır):
`printf '%s' '{"id":1,"name":"X","email":"x@x","role":"ADMIN","storeCode":"ALL"}' | base64` → `cerberus_session` cookie'si.

---

*Bu rapor, `02_Yeni_Is_Plani.md` dosyasındaki faz planıyla birlikte okunmalıdır.*
