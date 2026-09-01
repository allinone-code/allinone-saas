# Yedekleme ve Felaket Kurtarma (DR) Runbook'u — T6.4

| | |
|---|---|
| **RPO** (kabul edilebilir veri kaybı) | ≤ 5 dakika (Neon PITR nokta-zaman kurtarma) |
| **RTO** (hedef dönüş süresi) | ≤ 60 dakika |
| **Yedekleme stratejisi** | Neon otomatik PITR (managed) + aylık audit checkpoint dosyaları (git) |
| **Sorumlu** | DevOps + Sistem Mimarı |

---

## 1. Neon PITR (Birincil Kurtarma Mekanizması)

Neon, WAL tabanlı sürekli yedekleme sunar; ayrıca dump gerekmez.

**Geri yükleme (point-in-time):**
1. https://console.neon.tech → proje → **Branches**
2. **Create branch** → **History** → hata anından ÖNCE bir zamana ait branch oluştur
   (ör. silme 14:32'de olduysa 14:30 branch'i)
3. Yeni branch'in connection string'ini al → Vercel'de `DATABASE_URL`'i geçici olarak
   yeni branche çevir → veri doğrula
4. Doğrulanırsa bu branch'i ana branch yap (**Set as primary**) veya fark verisini
   tek tablo bazında ana branch'e geri yaz

**Sınırlama:** Free tier'da PITR penceresi sınırlıdır (genelde 24 saat / plan göre 7 gün).
Karar: planı en az **7 gün pencere** sunan seviyeye yükselt (maliyet onayı gerekir).

## 2. Geri Yükleme Tatbikatı (Ayda 1 — 30 dk)

- [ ] Gerçekliği olan bir "hata anı" üret (test branch'inde bilerek satır sil)
- [ ] PITR branch'i oluştur, silinen satırın geri geldiğini doğrula
- [ ] Süreyi not et → RTO içinde mi?
- [ ] Tatbikat kaydını `ops/dr-drills/YYYY-MM.md` olarak git'e işle
- [ ] Bulguları iş planına yansıt

## 3. Ortam Ayrımı

| Ortam | DB | Deploy | Amaç |
|---|---|---|---|
| production | Neon `main` branch | Vercel production | Gerçek iş |
| staging | Neon `staging` branch | Vercel preview (develop) | E2E + DR prova verisi |
| local | yerel Postgres / PGlite | `npm run dev` | geliştirme |

> Neon branch'leri kopya-on-yazma ile saniyeler içinde açılır; staging ücretsizdir.
> E2E testleri (T5.3, ertelenen) staging + preview ile çalıştırılacak.

## 4. Audit Log Arşivi

`npm run audit:checkpoint` (T6.5) aylık zincir hash'i üretir ve `ops/audit-checkpoints/`
altında git'e yazılır — veritabanı tamamen kaybolsa bile denetim izi bütünlüğü tarihsel
olarak doğrulanabilir.
