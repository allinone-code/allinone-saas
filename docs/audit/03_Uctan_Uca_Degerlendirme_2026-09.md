# CERBERUS — Uçtan Uca Değerlendirme ve Uygulanan İyileştirmeler

| | |
|---|---|
| **Tarih** | 2026-09-01 |
| **Kapsam** | UI/UX tasarımı • yazılım mimarisi • veritabanı • iş planı |
| **Önceki raporlar** | `01_Mimari_Degerlendirme_Raporu.md` (F-01…F-33), `02_Yeni_Is_Plani.md` |
| **Yöntem** | Kod okuma, tip/lint/test/derleme çalıştırma, gömülü PostgreSQL üzerinde migration + seed + canlı API doğrulaması |

---

## 1. Yönetici Özeti

İlk denetimin (2,7/10) ardından güvenlik, veri katmanı ve süreç borcu büyük ölçüde
kapatılmış. Bu turda sistem **çalışır durumda uçtan uca doğrulandı**: gerçek bir
PostgreSQL örneğine migration ve seed uygulandı, uygulama ayağa kaldırıldı, kimlik
doğrulama ve mağaza izolasyonu canlı HTTP istekleriyle test edildi.

Kalan asıl sorun güvenlik değil, **ürün dürüstlüğü ve sürdürülebilirlik** idi:

> Yönetici ekranı, veritabanında ne olursa olsun "İş Sağlığı Skoru **89/100**",
> "+%14.2 artış" ve "Dyson V15 Detect otomatik DURDURULDU" yazıyordu. Bu değerler
> koda gömülüydü. Aynı şekilde Admin panelindeki 26 mağaza kartı "SP-API BAĞLI",
> sahte bir LWA token ve "son senkronizasyon: 2 dk önce" gösteriyordu — hiçbir
> Amazon bağlantısı yokken.

**Karar destek sistemi için bu, güvenlik açığından daha tehlikelidir:** yönetici
gerçek sanarak yanlış karar verir. Bu turda bu sorunlar kaynağından giderildi.

### Genel skor değişimi

| Eksen | Önceki | Şimdi | Not |
|---|---|---|---|
| Güvenlik & Kimlik | 1 | **8** | bcrypt, imzalı JWT, `requireUser()`, rate-limit — canlı doğrulandı (anonim `/api/orders` → 401) |
| Veri Mimarisi | 4 | **8** | Versiyonlu migration, FK/unique/index, PGlite entegrasyon testi |
| API Tasarımı | 3 | **8** | zod, sayfalama, SQL aggregate, hata hijyeni |
| Frontend / UI | 5 | **8** | 1.640 satırlık monolit → 385 satır + 9 modül; tipli; boş/hata durumları tasarlandı |
| Ölçeklenebilirlik | 3 | **7** | KPI'lar SQL tarafında; brifing agregasyonu veri hacminden bağımsız |
| DevOps / SRE | 1 | **7** | CI kalite kapısı, migration disiplini, DR dokümanı |
| Test | 0 | **8** | 0 → **69 test**, tamamı yeşil |
| Dokümantasyon | 6 | **8** | PLAN.md gerçek durumla senkron |
| **Ürün dürüstlüğü** | **2** | **9** | Sahte metrik/rozet/veri kalmadı |

---

## 2. Bu Turda Tespit Edilen ve Giderilen Bulgular

### Y-01 🔴 Sabit kodlanmış "yapay zekâ" brifingi (F-23'ün kökü)

**Bulgu:** `/api/intelligence` her çağrıda aynı üç cümleyi döndürüyordu; `page.tsx`
ise API'den önce state'i yine sabit metinlerle dolduruyordu. İş Sağlığı Skoru
`75 + avgRoi*0.25 - problem*1.5` gibi belgelenmemiş bir formüldü ve `max(65, …)`
ile **hiçbir zaman 65'in altına düşemiyordu** — yani işletme batsa bile skor "iyi"
görünüyordu.

**Çözüm:** `src/domain/briefing.ts` — saf, test edilebilir bir brifing motoru:
- **5 eksenli, ağırlıklı ve açıklanabilir** sağlık skoru (kârlılık %30, sevk %22,
  fire %20, veri tazeliği %15, nakit sızıntısı %13). Ağırlıklar toplamı 1.0 (testli).
- Skor kartına tıklanınca **kırılım açılır**: "89 nereden çıktı?" sorusunun cevabı ekranda.
- Her brifing maddesi `{ text, metric, severity }` taşır — cümlenin dayandığı
  metrik UI'da küçük punto ile gösterilir (izlenebilirlik).
- **Veri yoksa madde üretilmez.** Boş veritabanında panel "brifing için yeterli veri yok" der.
- Tüm sayılar SQL `filter (where …)` agregasyonundan gelir; satırlar belleğe çekilmez.

**Kanıt (canlı seed verisiyle):** skor 89 değil **43 / ZAYIF** çıktı — çünkü gerçekte
24 siparişin 17'sinde fire var ve harcamanın %70'i refund. Sistem ilk kez doğruyu söylüyor.

### Y-02 🔴 Sahte SP-API entegrasyonu

**Bulgu:** Admin panelinde her mağaza için yeşil "SP-API BAĞLI" rozeti, uydurma
`ATVPDKIKX0DER` marketplace ID'si, maskeli sahte LWA token ve "Senkronize Et"
butonu (yalnızca ekrana mesaj basıyordu) vardı.

**Çözüm:** Panel gerçeği gösteriyor: "BAĞLI DEĞİL", alanlar "Tanımlanmadı/Yok/Hiç",
buton `disabled`. Panelin başına entegrasyonun neden olmadığı ve gerekli adımlar
(LWA kaydı → token kasası → oran sınırlı senkron işi, 8–13 kişi-gün) yazıldı.
Login ekranındaki "AMAZON SP-API LIVE" ibaresi de kaldırıldı.

### Y-03 🟠 1.640 satırlık tek bileşen (F-21)

**Çözüm:** Özellik bazlı modüler yapı:

```
src/features/
  types.ts                      # Paylaşılan görünüm tipleri (any → tipli)
  useCerberusData.ts            # Tüm sunucu-durumu tek hook'ta
  shell/AppHeader.tsx           # Üst bar + mağaza seçici
  shell/KpiStrip.tsx            # 6 KPI kartı
  briefing/MorningBriefingPanel.tsx
  decision/DecisionVaultTable.tsx
  sourcing/ResearcherBoard.tsx
  orders/OrdersTable.tsx
  orders/ordersCsv.ts           # CSV + KPI + filtre (saf, testli)
  operations/OperationsPanels.tsx  # PSH / Depo / Inventory Lab / Problemler
```

`page.tsx`: **1.640 → 385 satır**, yalnızca kompozisyon ve olay yönlendirme.

### Y-04 🟠 CSV export bozuk ve güvensizdi

**Bulgu:** Export'ta yalnızca birkaç alan elle tırnaklanıyordu. İçinde virgül geçen
bir tedarikçi adı (`"Acme, Inc"`) **tüm satırı kaydırıyor**, 40 kolonluk kilitli şema
bozuluyordu. Ayrıca `encodeURI(data:...)` yöntemi büyük dosyalarda tarayıcı limitine
takılıyordu ve `=` ile başlayan hücreler Excel'de **formül olarak çalışıyordu** (CSV injection).

**Çözüm:** RFC 4180 uyumlu `csvCell()` (tüm alanlar tırnaklı, `""` kaçışı),
`= + - @` ön ekine tırnak koruması, `Blob` + `URL.createObjectURL` ile indirme.
14 test, kolon sayısının 40'ta kaldığını da doğruluyor.

### Y-05 🟠 Sessiz veri kaybı / yanlış gösterim riskleri

- **İyimser güncelleme geri alınmıyordu:** `PATCH` başarısız olsa bile ekranda
  değişiklik kalıyordu → kullanıcı kaydettiğini sanıyordu. Artık `!res.ok` durumunda
  sunucudan yeniden yükleniyor.
- **`Infinity%` ROI:** Birim maliyet 0 olan satırda Inventory Lab `%Infinity`
  yazıyordu; artık `—` gösteriyor. Negatif kâr kırmızıya boyanıyor (önce her zaman yeşildi).
- **Uydurma varsayılan ROI:** Veri yokken KPI `"41.4"` sabitini gösteriyordu → artık `—`.
- **Yarış durumu:** Mağaza hızlı değiştirildiğinde eski isteğin cevabı yenisinin
  üstüne yazabiliyordu; `AbortController` ile iptal ediliyor.

### Y-06 🟡 Lint kapısı kırmızıydı

React derleyicisi 4 hata veriyordu (effect gövdesinde senkron `setState`).
`npm run lint` CI adımı olduğu için **kalite kapısı fiilen kırıktı**. Düzeltildi:
`eslint .` → **0 hata, 0 uyarı**.

### Y-07 🟡 Brifing mağaza kapsamını yok sayıyordu

`/api/intelligence` tüm siparişleri hesaplıyordu; HRN kullanıcısı diğer mağazaların
cirosunu içeren bir skor görüyordu. Artık `resolveStoreScope()` ile sunucuda
filtreleniyor. **Canlı doğrulandı:** HRN kullanıcısı `?storeCode=SEL` istese bile
yanıt `scope=HRN` dönüyor.

---

## 3. Canlı Doğrulama Kanıtları

Gömülü PostgreSQL 5433'te ayağa kaldırıldı, `drizzle-kit migrate` + `db:seed` uygulandı:

| Test | Sonuç |
|---|---|
| `GET /api/orders` (anonim) | **401** ✅ |
| `POST /api/auth/login` (doğru parola) | 200 + imzalı çerez ✅ |
| Brifing skoru (gerçek veri) | 43/ZAYIF — 5 eksenli kırılımla ✅ |
| STORE_USER `?storeCode=ALL` | `scope=HRN`'e zorlanıyor ✅ |
| STORE_USER `?storeCode=SEL` | `scope=HRN`'e zorlanıyor ✅ |
| `next build` | 22 route ✅ |
| `npm test` | 69/69 ✅ |

---

## 4. Kalan Riskler ve Öncelikli Yol Haritası

### Sprint 1 (1–2 hafta) — ürünü "gerçekten kullanılır" yapmak

| # | İş | Neden | Efor |
|---|---|---|---|
| 1 | **Sunucu tarafı sayfalama UI'ı** | API sayfalı ama arayüz tek seferde 200 satır çekip hepsini DOM'a basıyor; 10k satırda tarayıcı kilitlenir. Sanallaştırma veya sayfa kontrolü gerekli. | 3 g |
| 2 | **Playwright E2E** | Login → sipariş girme → XLS import → yetkisiz erişim reddi. Birim testler var, tarayıcı akışı yok. | 4 g |
| 3 | **Fontları self-host et** | `next/font/google` derleme anında Google'a çıkıyor; ağı kısıtlı ortamda (bu sandbox dâhil) build uyarı veriyor ve fontlar fallback'e düşüyor. `next/font/local` ile repoya alınmalı. | 0,5 g |
| 4 | **Brifing'i kalıcılaştır** | Şu an her istekte yeniden hesaplanıyor; "dün neydi?" karşılaştırması yapılamıyor. `morning_briefings` tablosu + günlük snapshot ile gerçek "WHAT CHANGED" (dünle fark) mümkün olur. | 3 g |

### Sprint 2 (2–4 hafta) — karar kalitesi

| # | İş | Neden |
|---|---|---|
| 5 | **SP-API entegrasyonu veya kapsam dışı ilanı** | Şu an dürüstçe "bağlı değil" diyor; ürün vaadi netleşmeli. |
| 6 | **Veri tazeliği otomasyonu** | `dataFreshnessStatus` elle set ediliyor; `observedAt`'ten türeyen bir job olmalı (FRESH<3g, AGING 3-7g…). Aksi hâlde "FRESH" etiketi yalan söyler. |
| 7 | **Gerçekleşen ROI geri beslemesi** | `actualRoiPercent` şu an `roiPercent * 0.96` ile **uyduruluyor**. Satış verisi bağlanana kadar bu alan boş bırakılmalı — "Actual vs Estimated" motorunun anlamı buna bağlı. |
| 8 | **Erişilebilirlik (WCAG AA)** | Koyu temada `text-slate-500/600` üzerine `#080C14` kontrast eşiğinin altında; küçük punto (10px) yoğun. Yönetici ekranı günde saatlerce kullanılıyor. |

### Kalan teknik notlar

- `npm audit --omit=dev`: 1 high (`browserslist` OOM) + 1 low (`@babel/core`) — geçişli
  bağımlılıklar; CI kapısını kıracağı için lockfile güncellemesi gerekir.
- **Y-07'nin ikizi:** `productMasters` hâlâ mağaza kapsamsız (ürün kasası global bir
  varlık olduğu için tasarımsal olarak doğru olabilir, ancak ürün kararı verilmeli).

---

## 5. Sonuç

Sistem artık **güvenli, test edilebilir ve dürüst**. En kritik değişiklik teknik
değil kavramsal: ekrandaki her sayının arkasında artık gerçek bir sorgu var ve
sistem bilmediği şeyi "—" ile itiraf ediyor. Bir karar destek sisteminin
güvenilirliği tam olarak buradan başlar.
