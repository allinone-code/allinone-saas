# Cerberus — Commerce Intelligence

Ürün İstihbaratı, Sourcing, Marketplace ve Operasyon Platformu.
Next.js 16 (App Router) + PostgreSQL (Drizzle ORM) + Tailwind 4.

---

## 🚀 Ücretsiz Canlıya Alma Rehberi (Vercel + Neon)

Aşağıdaki 3 adımı takip ederek Cerberus'u **kredi kartı istemeden**, ücretsiz olarak yayınlayabilirsiniz. Toplam süre: ~15 dakika.

### 🎯 Kullanılacak Servisler

| Katman | Servis | Ücretsiz Limit | Kayıt |
|---|---|---|---|
| Uygulama | **Vercel** | 100 GB bandwidth/ay, sınırsız süre | [vercel.com/signup](https://vercel.com/signup) |
| Veritabanı | **Neon** | 0.5 GB storage, sonsuz süre | [neon.tech](https://neon.tech) |
| Kod deposu | **GitHub** | Sınırsız private repo | [github.com](https://github.com) |

---

## 📋 ADIM 1 — Kodu GitHub'a yükle

Terminal'de proje kökünde:

```bash
# 1) Git repo'sunu başlat
git init
git add .
git commit -m "Initial commit: Cerberus MVP"

# 2) GitHub'da yeni bir boş repo aç: https://github.com/new
#    (Adı: cerberus-saas, private seç)
#    README/gitignore/license EKLEME.

# 3) Local repo'yu GitHub'a bağla ve push et
git branch -M main
git remote add origin https://github.com/KULLANICI_ADIN/cerberus-saas.git
git push -u origin main
```

> ⚠️ `.env` dosyası `.gitignore`'da olduğu için GitHub'a gitmez. Bu doğru davranış — sırları asla commit'lemeyin.

---

## 📋 ADIM 2 — Neon üzerinde PostgreSQL veritabanı oluştur

1. **[neon.tech](https://neon.tech)** adresine gidin ve GitHub ile giriş yapın (free plan, kart yok).
2. **"Create Project"** butonuna tıklayın:
   - **Project name:** `cerberus`
   - **Postgres version:** 16 (varsayılan)
   - **Region:** `AWS Europe (Frankfurt)` — Türkiye kullanıcıları için en düşük gecikme
3. Proje oluşunca **Dashboard > Connection Details** ekranı açılır. Şunları seçin:
   - **Connection type:** `Pooled connection` (önemli — serverless için gerekli)
   - **Role:** `neondb_owner`
4. Ekranda görünen connection string'i kopyalayın. Şu formatta olur:
   ```
   postgresql://neondb_owner:XXXXX@ep-XXXX-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
5. **Şemayı Neon'a yükleyin** — local terminal'de proje kökünde:

   ```bash
   # Neon URL'ini geçici olarak export edin (kopyaladığınız string)
   export DATABASE_URL="postgresql://neondb_owner:XXX@ep-XXX-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"

   # Şemayı push edin
   npx drizzle-kit push
   ```

   Çıktı `[✓] Changes applied` görürseniz tablolar Neon'da oluşturuldu demektir.

   > İlk seed verisi (demo kullanıcılar, ürünler, tedarikçiler) uygulama ilk açıldığında `ensureDemoData()` fonksiyonu tarafından otomatik yüklenir.

---

## 📋 ADIM 3 — Vercel'e deploy et

1. **[vercel.com](https://vercel.com)** adresine gidin, **"Sign Up with GitHub"** ile giriş yapın.
2. Sağ üstteki **"Add New... > Project"** butonuna tıklayın.
3. Az önce oluşturduğunuz `cerberus-saas` repo'sunu seçin ve **"Import"** deyin.
4. **Configure Project** ekranında:
   - **Framework Preset:** Next.js (otomatik algılanır)
   - **Root Directory:** `./` (değiştirmeyin)
   - **Build/Output settings:** varsayılan bırakın
5. **Environment Variables** bölümünü açın ve şunu ekleyin:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Neon'dan kopyaladığınız pooled connection string |

6. **"Deploy"** butonuna basın. ~2 dakika sürer.
7. Deploy bitince Vercel size `https://cerberus-saas-xxx.vercel.app` gibi bir URL verir.
   Bu URL'i tarayıcıda açın 🎉

---

## 🔐 İlk Giriş

Site açıldığında `/login` sayfasına yönlendirilirsiniz:

- **E-posta:** `mert@cerberus.io`
- **Parola:** `cerberus2026`

İlk istek geldiğinde demo veri otomatik olarak Neon'a seed edilir (128 keşif, 5 tedarikçi, 6 ürün, aktivite geçmişi).

---

## 🔄 Sonraki Deploy'lar

Bundan sonra her `git push` otomatik olarak Vercel'e deploy olur:

```bash
git add .
git commit -m "feat: yeni özellik"
git push
```

Vercel'in dashboard'unda deploy'un ilerleyişini canlı görebilirsiniz.

---

## 🌍 (Opsiyonel) Kendi Domain'inizi Bağlama

1. Vercel dashboard > proje > **Settings > Domains**
2. `cerberus.senindomain.com` girin
3. Vercel size DNS kaydı verir (CNAME veya A record)
4. Domain sağlayıcınızda (Cloudflare/GoDaddy/Namecheap) DNS ayarlarını ekleyin
5. SSL sertifikası Vercel tarafından otomatik alınır (ücretsiz Let's Encrypt)

---

## 🛠️ Local Geliştirme

```bash
# 1) Bağımlılıkları yükle
npm install

# 2) .env oluştur
cp .env.example .env
# .env içine local Postgres URL'ini yaz:
# DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db

# 3) Şemayı DB'ye uygula
npx drizzle-kit push

# 4) Dev server'ı başlat
npm run dev
```

Uygulama `http://localhost:3000` adresinde çalışır.

---

## 📊 Ücretsiz Limitler ve Ne Zaman Aşarsınız?

| Servis | Free Limit | Aşarsa |
|---|---|---|
| Vercel Bandwidth | 100 GB/ay | Hobby → Pro ($20/ay) |
| Vercel Serverless | 100 GB-hours/ay | Genelde MVP için fazlasıyla yeter |
| Neon Storage | 0.5 GB | Yaklaşık 500K keşif kaydı |
| Neon Compute | 191 saat/ay | Kesintisiz çalışır |

Cerberus MVP tipik olarak aylarca free tier'da kalabilir. Trafik artınca önce Neon'u ($19/ay) yükseltmeniz gerekir.

---

## 🔧 Alternatif Ücretsiz Platformlar

Vercel + Neon yerine kullanabileceğiniz kombinasyonlar:

| Uygulama | Veritabanı | Notlar |
|---|---|---|
| Netlify | Neon | Vercel benzeri, biraz daha az Next.js entegrasyonu |
| Cloudflare Pages | Neon | Çok hızlı, ama edge runtime kısıtları var |
| Render (free) | Supabase | Render 15 dk inaktivite sonrası uyur |
| Railway | Railway PG | Free trial $5 kredi, sonrası ücretli |

**Neden Vercel + Neon önerdim?** İkisi de gerçekten ömür boyu ücretsiz, uyku moduna girmez, Next.js için optimize edilmiştir.

---

## 🆘 Sorun Giderme

**"connection refused" veya "DATABASE_URL is required" hatası**
→ Vercel > Settings > Environment Variables'a `DATABASE_URL` eklediğinizden ve deploy'u tekrar tetiklediğinizden emin olun.

**"too many connections" hatası**
→ Neon'un **pooled** URL'ini kullandığınıza emin olun (URL'de `-pooler` geçmeli).

**Sayfa açılıyor ama veri yok**
→ İlk istekte seed çalışır, sayfayı yenileyin. Devam ederse `npx drizzle-kit push`'un başarılı olduğunu kontrol edin.

**Build fail: "Type error"**
→ Local'de `npm run build` çalıştırıp hatayı orada görün ve düzeltip tekrar push edin.

---

## 📖 Proje Yapısı

```
src/
├── app/
│   ├── page.tsx              # Ana dashboard (server component)
│   ├── login/page.tsx        # Giriş ekranı
│   ├── actions.ts            # Server actions (CRUD)
│   └── api/
│       ├── auth/             # Login / logout endpoint'leri
│       └── health/           # Healthcheck
├── components/
│   └── dashboard.tsx         # Ana UI (client component)
├── db/
│   ├── index.ts              # Drizzle + pg pool
│   └── schema.ts             # Tablolar
└── lib/
    └── data.ts               # Query'ler + demo seed
```

---

Başarılar! 🚀
