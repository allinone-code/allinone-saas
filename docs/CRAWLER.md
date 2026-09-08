# Crawler — Scrapling-ilhamlı Mimari

> vitaminshoppe.com ve benzeri kaynak sitelerden otomatik ürün keşfi.
> Geçmişte tek ürün/çağırıda JS render yoktu ve 403 engellerinde başarısız oluyordu.
> V2, JS katmanını Scrapling fikirleriyle güçlendirir ve opsiyonel Python servisiyle tırmanır.

## Neden Scrapling?

[Scrapling](https://github.com/D4Vinci/Scrapling) (79k★):
- **Adaptif parser** — yapı değişirse parser kendiliğinden en sağlam selector stratejisine geçer.
- **StealthyFetcher** — header rotasyonu, `Sec-Ch-Ua`/`Sec-Fetch-*`, `browserforge` UA havuzu, Cloudflare Turnstile bypass.
- **Spider** — eşzamanlı tarama, proxy rotasyonu, pause/resume, otomatik throttling.

Sandbox ağında `curl_cffi` doğrudan `BoringSSL SSL_connect (35)` ile düştüğü için Vercel Node doğrudan Scrapling çalıştıramaz.
Çözüm: **hibrit** — JS crawler varsayılan, Python servis fallback.

```
User URL → /api/crawler/scrape → scrapeUrl()
  ├─ stealth JS fetch (UA rotasyonu + retry + bot-challenge tespiti)
  │    └─ JSON-LD → OG → ham link toplama (adaptif — Scrapling gibi)
  ├─ 403/429 veya Cloudflare tespit → SCRAPLING_SERVICE_URL varsa oraya POST
  └─ yoksa açıklayıcı hata: "SCRAPLING_SERVICE_URL yapılandırın"
       → UI: ürün kartları + uyarılar + engine etiketi
```

## JS stealth neler yapar?

`src/lib/crawler/scraper.ts`

- 4'lü Chrome/Firefox UA havuzu (`pickUA`) — URL seed'li deterministik rotasyon
- `Accept-Language: en-US,en;q=0.9,tr;q=0.6` + `Sec-Ch-Ua` / `Sec-Fetch-*` / `Referer`
- 15 sn timeout, 3 MB içerik sınırı
- `looksLikeBotChallenge()` → `cf-challenge`, `turnstile`, `attention required` tespiti
- 403/429'da 0.8–1.5 sn jitter ile 1 kez retry (farklı UA)
- `tryScraplingService()` → `POST ${SCRAPLING_SERVICE_URL}/scrape`

## Python mikro-servisi (opsiyonel)

`services/scrapling/`

- `StealthyFetcher.get(url, adaptive=True, headless=False)` — Scrapling'in önerdiği haliyle
- Aynı `ScrapedItem` şemasını döner → JS tarafı şeffaf tüketir (`engine: "scrapling-service"`)
- Deploy: Docker / Render / Fly / Railway

```bash
docker build -t cerberus-scrapling ./services/scrapling
docker run -p 8000:8000 cerberus-scrapling
curl -X POST http://localhost:8000/scrape -H 'Content-Type: application/json' \
  -d '{"url":"https://www.vitaminshoppe.com/p/..."}'
```

Vercel: `Settings → Environment Variables → SCRAPLING_SERVICE_URL=https://<host>/` ekle + Redeploy.

Yoksa da sorun değil — JS crawler tek başına çalışır (graceful degradation).

## Drive içe aktarım (tek sheet)

- Kullanıcı teyidi: Drive tablosu **tek sheet**. İthalat her zaman `workbook.SheetNames[0]`'ı okur.
- `/export?format=xlsx` üzerinden 15 sn/20 MB limitli çekim, `xlsx` ile `SheetNames[0]` ayrıştırması.
- İkinci sheet vs. varsa görmezden gelinir — tasarım gereği.

## İlgili dosyalar

- `src/lib/crawler/scraper.ts` — ana scraper + stealth + fallback
- `src/app/api/crawler/scrape/route.ts` — POST throttle + cache + audit
- `src/app/api/crawler/import/route.ts` — seçilen ürünleri `productMasters`/`supplierOffers`'a yazar
- `services/scrapling/main.py` — FastAPI + Scrapling
- `src/lib/settings.ts` — ROI eşikleri (aşağıya bak)
