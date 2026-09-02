# CERBERUS — MASTER IMPLEMENTATION PLAN (PLAN.md)

> **Bu dosya kodun gerçek durumunu yansıtır.** Bir madde ancak (a) kodda uygulanmış,
> (b) en az bir testle kanıtlanmış ve (c) CI kapısından geçmişse `[x]` işaretlenir.
> Son senkronizasyon: **2026-09-02** (Aşama 3 — keşif/puanlama hattı).

## Durum Özeti

| Ölçüt | Değer |
|---|---|
| Test | **256 test / 17 dosya — tamamı yeşil** (`npm test`) |
| Lint | `eslint .` → **0 hata, 0 uyarı** |
| Tipler | `tsc --noEmit` → Aşama 3 kodu temiz |
| Migration | Versiyonlu (`drizzle/0000` … `0004_asama3_discovery`), PGlite ile entegrasyon testli |

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
- [x] **Ürün merkezli mimari Aşama 0–3:** CHECK ağı, `products` çekirdeği,
      `product_id NOT NULL`, yolculuk arayüzü, keşif→puanlama→onay hattı
      (`docs/DEVIR_VE_ASAMA3_PLANI.md`)
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
| F-17, F-18, F-19 (test/CI/lint) | ✅ 256 test, GitHub Actions kalite kapısı, 0 lint hatası |
| F-21 (1.640 satırlık bileşen) | ✅ **2026-09-01:** `src/features/*` altında modülerleştirildi |
| F-23 (spec drift / sahte vaatler) | ✅ **2026-09-01:** sahte SP-API rozetleri, uydurma KPI delta'ları ve sabit brifing metinleri kaldırıldı |
| F-28, F-29 (DR / başlıklar) | ✅ Yedekleme dokümanı + güvenlik başlıkları |

---

## Kalan Ürün Borcu (öncelik sırasıyla)

1. **SP-API entegrasyonu** — karar verildi, uygulanmadı. Ürün vaadi ile kod artık tutarlı.
2. **E2E testleri (Playwright)** — birim/entegrasyon var; tarayıcı akışı yok.
3. **Sunucu tarafı sayfalama UI'ı** — API sayfalı, arayüz hâlâ tek sayfa çekiyor
   (10k+ satırda sanallaştırma veya sayfa kontrolü gerekir).
4. **i18n (tr-TR → en-US)** — karar ADR'de, iskelet yok.
5. **Erişilebilirlik denetimi** — kontrast ve klavye navigasyonu için WCAG AA taraması.

---

## DOĞRULAMA KOMUTLARI

```bash
npm run lint        # 0 hata
npm run typecheck   # temiz
npm test            # 256 test yeşil
npm run build       # production derlemesi
```
