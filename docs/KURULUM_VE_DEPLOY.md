# CERBERUS — Kurulum ve Deploy Rehberi

Bu belge, kodu GitHub'dan Neon + Vercel üzerinde çalışır hale getirmek için
izlenecek sırayı anlatır.

---

## 0. Durum özeti

| Katman | Durum |
|---|---|
| GitHub (`arena/01a05ea7-allinone-saas`) | Tüm çalışma push edilmiş |
| `main` | PR #13 açık, henüz merge edilmedi |
| Vercel | `main`'i deploy ettiği için eski kodu gösterir |
| Neon | Yeni tablolar/migration'lar **uygulanmadı** |

---

# YOL A — Neon konsolundan (terminal gerekmez) ⭐ ÖNERİLEN

Zaten Neon konsolu açıksa en kolayı budur. Bilgisayarınıza hiçbir şey
kurmanız gerekmez.

## A1. SQL dosyasını açın

Depodaki **`docs/neon-kurulum.sql`** dosyasını açın ve **tamamını** kopyalayın
(483 satır).

GitHub'dan da alabilirsiniz: depo → `docs/neon-kurulum.sql` → **Raw** → tümünü
seçip kopyalayın.

## A2. Neon SQL Editor'de çalıştırın

1. Neon konsolu → sol menüden **SQL Editor**
2. Kopyaladığınız SQL'in tamamını yapıştırın
3. **Run** düğmesine basın

> ⚠️ Dosyanın ilk satırları mevcut `public` şemasını **siler**. Korumak
> istediğiniz veri varsa `DROP SCHEMA` satırını silin.

Sonunda şu tabloyu görmelisiniz:

| tablo | adet |
|---|---|
| stores | 4 |
| users | 5 |
| orders | 24 |
| products | **12** |
| supplier_offers | 16 |
| product_lifecycle_events | 12 |

`products` (12) < `orders` (24) olması **doğrudur**: 24 sipariş satırı 12
benzersiz ürüne işaret eder. Eski mimaride bu tekrar görünmezdi.

## A3. Giriş bilgileri

Kurulum şu hesapları oluşturur:

| E-posta | Rol |
|---|---|
| `ahmet@cerberus-commerce.io` | ADMIN |
| `harun@cerberus-commerce.io` | HRN mağazası |
| `selin@cerberus-commerce.io` | SEL mağazası |
| `can@cerberus-commerce.io` | MK mağazası |

**Başlangıç parolası (hepsi için):** `CerberusKurulum2026!`

> 🔐 Bu parola kod deposunda açık yazılıdır, yani herkese açıktır.
> **İlk girişten hemen sonra değiştirin.**

Bu hash bir testle doğrulanır (`src/setup/neonSetupPassword.test.ts`) —
yanlış hash yüzünden "kurulum başarılı ama giriş çalışmıyor" durumu olamaz.

---

# YOL B — Terminalden (bilgisayarınızda)

Node.js kuruluysa ve depoyu klonladıysanız bu yol daha esnektir.

## B1. Hazırlık

```bash
git clone https://github.com/allinone-code/allinone-saas.git
cd allinone-saas
git checkout arena/01a05ea7-allinone-saas
npm install
```

## B2. Önce durumu görün (hiçbir şey değiştirmez)

```bash
DATABASE_URL="postgresql://...neon.tech/db?sslmode=require" \
npm run db:bootstrap -- --inspect
```

Mevcut tabloları, uygulanmış migration sayısını ve ürüne bağlanmamış sipariş
olup olmadığını raporlar; ardından hangi komutu çalıştırmanız gerektiğini
söyler.

## B3. Kurun

```bash
DATABASE_URL="postgresql://..." \
SEED_ADMIN_PASSWORD="güçlü-bir-parola" \
SEED_STORE_PASSWORD="başka-güçlü-parola" \
npm run db:bootstrap
```

Terminal yolunun avantajı: parolayı **siz** belirlersiniz, depoda yazılı olan
ortak parolayı kullanmazsınız.

Tamamen sıfırdan başlamak için sona `-- --reset` ekleyin.

---

## Bağlantı adresi nereden alınır?

Neon konsolu → **Connection Details** → **Connection string**.

**`-pooler`** içeren adresi seçin. Serverless ortamda doğrudan bağlantı,
her fonksiyon çağrısında yeni bağlantı açarak Neon limitini tüketir.

```
postgresql://kullanici:parola@ep-xxx-pooler.bolge.aws.neon.tech/dbname?sslmode=require
```

---

# Sonraki adımlar

## 1. Vercel: ortam değişkenleri

Vercel → Project → Settings → Environment Variables:

| Değişken | Zorunlu | Not |
|---|---|---|
| `DATABASE_URL` | Evet | Neon **pooler** adresi, `?sslmode=require` ile |
| `SESSION_SECRET` | Evet | `openssl rand -base64 48` — en az 32 karakter |
| `SEED_ADMIN_PASSWORD` | İlk kurulumda | Yoksa varsayılan hesaplar oluşturulmaz |
| `SEED_STORE_PASSWORD` | İlk kurulumda | Aynı |
| `SENTRY_DSN` | Hayır | Tanımlanmazsa SDK yüklenmez |

Serverless ortamda **pooler** adresini kullanın (`-pooler` içeren host);
doğrudan bağlantı, fonksiyon başına yeni bağlantı açarak Neon limitini
tüketir.

`SESSION_SECRET` üretimde tanımlı değilse tüm oturumlar reddedilir
(fail-closed) — bu bilinçli bir güvenlik davranışıdır.

---

## 2. Kodu üretime al

Bu oturumdaki çalışma `arena/01a05ea7-allinone-saas` dalında. Üretime almak
için `main`'e merge edin:

```bash
gh pr create --base main --head arena/01a05ea7-allinone-saas \
  --title "Ürün merkezli mimari — Aşama 0/1/1.2/2" --fill
# inceleyip merge edin
```

Vercel `main`'e merge sonrası otomatik deploy eder.

**Sıralama önemli:** Önce Neon kurulumu (Yol A veya B), sonra merge.
Ters sırada yeni kod olmayan tabloları sorgular ve hata verir.

---

## 3. Deploy sonrası doğrulama

```bash
curl -s https://<site>/api/health/ready
```

Ardından arayüzde:

1. Giriş yapın (`SEED_ADMIN_PASSWORD` ile belirlediğiniz parola).
2. Sol menü → **Ürün → Ürün Portföyü**: 12 ürün listelenmeli.
3. Bir satıra tıklayın: fiyat serisi, tedarikçi kıyası, olay defteri görünmeli.
4. Bir ürünün durağını değiştirmeyi deneyin — gerekçe zorunludur.

---

## Komut özeti

| Komut | Ne yapar |
|---|---|
| `npx tsx scripts/generate-neon-sql.ts` | `docs/neon-kurulum.sql` dosyasını yeniden üretir |
| `npm run db:bootstrap -- --inspect` | **Hiçbir şey yazmaz**, mevcut durumu raporlar |
| `npm run db:bootstrap` | Şema + geri doldurma + seed (veri korunur) |
| `npm run db:bootstrap -- --reset` | **Her şeyi siler**, sıfırdan kurar |
| `npm run db:bootstrap -- --no-seed` | Şema kurar, başlangıç verisi yüklemez |
| `npm run db:migrate` | Yalnızca migration (elle kontrol için) |
| `npx tsx scripts/backfill-products.ts --dry-run` | Yazmadan analiz |
| `npm test` | 221 test |

---

## Sık karşılaşılan durumlar

**`Gecis durduruldu: N adet siparis henuz bir urune bagli degil`**
Beklenen davranış. `npm run db:bootstrap` bunu otomatik çözer; elle
çalıştırıyorsanız önce `npx tsx scripts/backfill-products.ts` deyin.

**Giriş yapılamıyor, kullanıcı yok**
`SEED_ADMIN_PASSWORD` tanımlı değilken seed çalıştırılmıştır. Değişkeni
tanımlayıp `npm run db:bootstrap -- --no-seed` sonrası `npm run db:seed`
çalıştırın.

**Ürün Portföyü boş**
Migration'lar uygulanmış ama geri doldurma yapılmamıştır:
`npx tsx scripts/backfill-products.ts`

**Neon'da "too many connections"**
Doğrudan bağlantı adresi kullanılmıştır; `-pooler` içeren adrese geçin.
