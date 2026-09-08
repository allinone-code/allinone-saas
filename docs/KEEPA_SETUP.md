# Keepa — anahtar nereye girilir?

Kullanıcı sorusu: _"Keepa anahtarı var — nereye girilecek (Vercel mi?)"_

## Önerilen: Vercel Environment Variables

1. Vercel Dashboard → projeniz → **Settings → Environment Variables**
2. `Add` → **Name:** `KEEPA_API_KEY` **Value:** `...` (keepa.com'dan aldığınız anahtar)
3. Environments: `Production` + `Preview` seçili kalsın → **Save**
4. **Deployments → ⋯ → Redeploy** (env değişikliği repodeploy ister)

Avantajı: anahtar repo dışında, preview/prod ayrımı, log'a düşmez.

## Alternatif: DB (Vercel yoksa)

Admin konsolu → **7. ⚙️ Eşikler & Keepa Ayarları** → Keepa API alanına yapıştır → **Kaydet**.

- Yalnız `ADMIN`/`MANAGER` yazabilir.
- Anahtar `app_settings.keepa_api_key` satırında saklanır, GET ile **geri döndürülmez** (yalnız var/yok).
- Öncelik: `ENV > DB > mock`. ENV boşsa DB devreye girer.
- Silmek için aynı panelde **DB'deki anahtarı sil** (ENV kalır).

## Mock mod

Anahtar yoksa istemci deterministik mock döner (`hash(ASIN)`) — kota harcanmaz, UI/karar zinciri test edilebilir.

## Dosyalar

- `src/lib/keepa/client.ts` — `resolveKeepaKey()` (ENV → DB fallback), `fetchKeepaProduct()`, `mockKeepaData()`
- `src/lib/settings.ts` — `getKeepaKey()`
- `src/app/api/settings/route.ts` — GET/PUT (thresholds + keepa var/yok)
- `src/features/settings/ThresholdSettings.tsx` — panel
- `src/app/api/keepa/analyze/route.ts` — 24 saat `keepa_cache` + audit
