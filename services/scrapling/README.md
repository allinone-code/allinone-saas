# Scrapling Mikro-Servisi

`src/lib/crawler/scraper.ts` tek başına çalışır (stealth JS). Bu Python servisi **opsiyoneldir** — yalnız anti-bot engelin aşılamadığı durumlarda devreye girer.

## Neden ayrı servis?

- Scrapling `curl_cffi` + `browserforge` ile Cloudflare Turnstile/JS challenge'ı aşar
- Vercel Node runtime Python çalıştıramaz → ayrı deploy (Render / Fly / Railway / Docker)
- `SCRAPLING_SERVICE_URL` set değilse JS crawler kendi başına çalışmaya devam eder (degrade değil)

## Deploy

```bash
docker build -t cerberus-scrapling ./services/scrapling
docker run -p 8000:8000 cerberus-scrapling
# Health: curl http://localhost:8000/health
# Scrape: curl -X POST http://localhost:8000/scrape -H 'Content-Type: application/json' -d '{"url":"https://www.vitaminshoppe.com/p/..."}'
```

Vercel'de: `SCRAPLING_SERVICE_URL=https://<servisiniz>.onrender.com` ekleyin (Settings → Environment Variables).

Local test JS fallback'i kapatmadan servisli mod:
```bash
SCRAPLING_SERVICE_URL=http://localhost:8000 npm run dev
```
