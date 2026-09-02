# CERBERUS — Kurulum ve Deploy Rehberi

Bu belge, kodu GitHub'dan Neon + Vercel üzerinde çalışır hale getirmek için
izlenecek sırayı anlatır. Sıra önemlidir; atlanan bir adım sessiz veri
bozulmasına değil, açık bir hataya yol açacak şekilde tasarlandı.

---

## 0. Durum özeti

| Katman | Durum |
|---|---|
| GitHub (`arena/01a05ea7-allinone-saas`) | Tüm çalışma push edilmiş |
| `main` | Henüz merge edilmedi |
| Vercel | `main`'i deploy ettiği için eski kodu gösterir |
| Neon | Yeni tablolar/migration'lar **uygulanmadı** |

Kısacası: kod hazır, veritabanı ve üretim ortamı henüz güncellenmedi.

---

## 1. Neon: veritabanını kur

### Seçenek A — Sıfırdan temiz kurulum (veriyi silmek sorun değilse)

Tek komut her şeyi yapar: şemayı sıfırlar, migration'ları uygular, başlangıç
verisini yükler.

```bash
DATABASE_URL="postgresql://...neon.tech/dbname?sslmode=require" \
SEED_ADMIN_PASSWORD="güçlü-bir-parola" \
SEED_STORE_PASSWORD="başka-güçlü-parola" \
npm run db:bootstrap -- --reset
```

`--reset` **`public` şemasını komple siler**. Geri dönüşü yoktur.

### Seçenek B — Mevcut veriyi koruyarak yükselt

```bash
DATABASE_URL="postgresql://..." \
SEED_ADMIN_PASSWORD="..." SEED_STORE_PASSWORD="..." \
npm run db:bootstrap
```

Bu modda betik, mevcut siparişlerinizi silmez. `0003` migration'ı ürüne
bağlanmamış sipariş yüzünden durursa, betik **otomatik olarak** geri
doldurmayı çalıştırıp göçü tamamlar.

Gerçek bir eski veritabanı üzerinde doğrulandı:

```
[2/5] 0003 durdu: ürüne bağlanmamış siparişler var (beklenen).
[3/5] 2 ürün, 3 fiyat gözlemi, 3 sipariş bağlandı.
      migration yeniden deneniyor... tüm migration'lar uygulandı.
[4/5] yetim sipariş yok — product_id bütünlüğü sağlam.
```

### Beklenen çıktı (temiz kurulum)

```
stores                     4
users                      5
orders                     24
products                   12
supplier_offers            16
product_lifecycle_events   12
```

`products` sayısı `orders`'tan küçüktür — doğru olan budur: 24 sipariş
satırı 12 benzersiz ürüne işaret eder. Eski mimaride bu tekrar görünmezdi.

---

## 2. Vercel: ortam değişkenleri

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

## 3. Kodu üretime al

Bu oturumdaki çalışma `arena/01a05ea7-allinone-saas` dalında. Üretime almak
için `main`'e merge edin:

```bash
gh pr create --base main --head arena/01a05ea7-allinone-saas \
  --title "Ürün merkezli mimari — Aşama 0/1/1.2/2" --fill
# inceleyip merge edin
```

Vercel `main`'e merge sonrası otomatik deploy eder.

**Sıralama önemli:** Önce Neon migration'ları (adım 1), sonra deploy.
Ters sırada yeni kod olmayan tabloları sorgular ve hata verir.

---

## 4. Deploy sonrası doğrulama

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
