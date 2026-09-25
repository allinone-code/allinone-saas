# CERBERUS — MASTER IMPLEMENTATION PLAN (PLAN.md)

> **Bu dosya kodun gerçek durumunu yansıtır.** Bir madde ancak (a) kodda uygulanmış,
> (b) en az bir testle kanıtlanmış ve (c) CI kapısından geçmişse `[x]` işaretlenir.
> Son senkronizasyon: **2026-09-25** (PM uçtan uca yayın denetimi).

## Durum Özeti

| Ölçüt | Değer |
|---|---|
| Test | **297 test / 26 dosya — tamamı yeşil** (`npm test`: Vitest + Python + OpenAPI lint) |
| Lint | `eslint .` → **0 hata, 0 uyarı** |
| Tipler | `tsc --noEmit` → **temiz** |
| Derleme | `next build` → **30+ route başarılı** |
| Migration | Versiyonlu, 8 migration (`0000` → `0007_icy_payback`), manifest + head-hash drift kilitli |
| Fixture | **24 sipariş / 4 mağaza** geliştirme verisi; dürüstlük testleriyle kilitli |
| OpenAPI | `redocly lint` → **0 uyarı** (operationId + license + 4xx tamamlandı) |
| Duman testi | `npm run smoke` → **10/10** (canlıya dokunmayan HTTP kontrolleri) |

---

## FAZ DÖNGÜSÜ

- [x] **FAZ 0:** Discovery Report & Repository Freeze
- [x] **FAZ 1:** Data Contract (`data-model.md`, `entity-relationships.md`, `data-dictionary.md`)
- [x] **FAZ 2:** Database Foundation — versiyonlu migration, FK/unique/index, seed script'e taşındı
- [x] **FAZ 3:** Sourcing MVP + Researcher Scorecard (`researchers`, `research_sessions`)
- [x] **FAZ 4–5:** Product Master Vault + Decision Engine + 6-eksenli radar + Evidence Chain
- [x] **FAZ 6–7:** Executive Morning Briefing + Business Health Score
      → **2026-09-01'de yeniden yazıldı:** artık sabit metin değil, SQL agregasyonundan
      üretilen açıklanabilir 5 eksenli skor (`src/domain/briefing.ts`, 15 test)
- [x] **FAZ 8–11:** 40-Kolon XLS Orders Master + CSV Export + PSH Batches + Depo Sayım + Inventory Lab
      → CSV üretimi RFC 4180 uyumlu ve CSV-injection korumalı hâle getirildi (14 test)
- [x] **FAZ 12–15:** Admin Komuta Merkezi (RBAC mağaza izolasyonu, audit log)
- [ ] **SP-API:** Gerçek Amazon entegrasyonu **yapılmadı** — UI artık dürüstçe
      "BAĞLI DEĞİL" gösteriyor (sahte token/rozet kaldırıldı). Tahmini efor: 8–13 kişi-gün.

---

## Denetim Bulgularının Durumu (F-01 … F-33)

| Grup | Durum |
|---|---|
| F-01…F-07, F-11 (kimlik/oturum/RBAC) | ✅ Kapandı — bcrypt, imzalı JWT, `requireUser()`, rate-limit, sunucu taraflı kapsam |
| F-08 (xlsx zafiyeti) | ✅ SheetJS resmî dağıtımına geçildi (ADR-001) |
| F-09 (audit bütünlüğü) | ✅ Silme uçlarından çıkarıldı + hash-checkpoint |
| F-10, F-14, F-22, F-25, F-33 (veri katmanı) | ✅ Migration, FK/index, seed ayrımı, SQL aggregate, transaction |
| F-12, F-13, F-24, F-32 (API) | ✅ zod, sayfalama, hata hijyeni |
| F-15 (mock veri sızması) | ✅ Fixture'a taşındı; **UI artık hata durumunda sessizce demo veri göstermiyor** |
| F-16 (KVKK) | ✅ Envanter, maskeleme, DSR akışı |
| F-17, F-18, F-19 (test/CI/lint) | ✅ 69 test, GitHub Actions kalite kapısı, 0 lint hatası |
| F-21 (1.640 satırlık bileşen) | ✅ **2026-09-01:** `src/features/*` altında modülerleştirildi |
| F-23 (spec drift / sahte vaatler) | ✅ **2026-09-01:** sahte SP-API rozetleri, uydurma KPI delta'ları ve sabit brifing metinleri kaldırıldı |
| F-28, F-29 (DR / başlıklar) | ✅ Yedekleme dokümanı + güvenlik başlıkları |

---

## Kalan Ürün Borcu (öncelik sırasıyla)

1. **SP-API entegrasyonu** — karar verildi, uygulanmadı. UI dürüstçe
   "BAĞLI DEĞİL — PLANLANAN ÖZELLİK" gösterir (Admin SP-API sekmesi +
   Ayarlar entegrasyon durumu). Tahmini efor: 8–13 kişi-gün.
2. **Tarayıcı E2E (Playwright)** — birim/entegrasyon + HTTP duman testi var;
   gerçek tarayıcı akış testi yok. Kritik akışlar (giriş, sipariş CRUD, içe
   aktarma) canlı PGlite doğrulamasıyla elle kanıtlandı.
3. **i18n (tr-TR → en-US)** — karar ADR'de, iskelet yok. Arayüz dili Türkçe.
4. **WCAG AA resmi taraması** — klavye/ESC/odak/dialog altyapısı eklendi;
   bağımsız kontrast + ekran okuyucu taraması yapılmadı.
5. **Dağıtık rate-limit** — login/first-password proses-içi sayaç kullanır;
   çok instance'lı yayında platform rate-limit'i de açılmalıdır (runbook).

Çözülen eski borçlar: sunucu tarafı sayfalama UI'ı ✅ (OrdersTable sayfalı),
erişilebilirlik temeli ✅ (skip-link, odak halkası, ESC, dialog semantikleri).

---

## DOĞRULAMA KOMUTLARI

```bash
npm run lint        # 0 hata
npm run typecheck   # temiz
npm test            # 297 test yeşil (Vitest + Python + OpenAPI)
npm run build       # 30+ route
BASE_URL=<adres> npm run smoke  # 10/10 duman testi
```
