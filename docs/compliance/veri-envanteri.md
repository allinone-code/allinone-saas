# Kişisel Veri Envanteri ve VERBİS Analizi (T7.1)

> **Hukuki uyarı:** Bu doküman teknik ekip tarafından hazırlanmış bir **taslaktır**;
> bağlayıcı olması için KVKK konusunda uzman bir hukuk danışmanının incelemesi zorunludur.
> Son güncelleme: 2026-09-01 — Faz 7 denetimi.

## 1. İşlenen Kişisel Veriler

| # | Veri kategorisi | Alanlar (tablo.alan) | Veri sahibi | İşleme amacı | Hukuki sebep (taslak) |
|---|---|---|---|---|---|
| 1 | Kimlik / iletişim (üye) | `users.name`, `users.email`, `users.avatar` | Platform kullanıcıları (personel) | Hesap oluşturma, kimlik doğrulama, görev atama | Sözleşmenin icrası (m.5/2-c) |
| 2 | Kimlik bilgisi (müşteri) | `users.password_hash` (bcrypt) | Personel | Parola doğrulama | Meşru menfaat / sözleşme |
| 3 | İletişim (sipariş alıcısı) | `orders.order_email` | Mağaza müşterileri | Sipariş onay/bilgilendirme, iade süreçleri | Sözleşmenin icrası |
| 4 | Ödeme referansı | `orders.credit_card` (yalnız son-4) | Mağaza müşterileri | Ödeme/iade eşleştirmesi | Sözleşmenin icrası. **Not:** tam kart numarası ASLA tutulmaz; PCI DSS kapsamı dışında kalmak için yalnız son-4 |
| 5 | İşlem güvenliği | `audit_logs.*` (aktör adı, mağaza, işlem) | Personel | Hesap verebilirlik, hata/ihlal incelemesi | Meşru menfaat + hukuki yükümlülük |
| 6 | Oturum verisi | Oturum çerezi (`cz-session`, imzalı JWT) | Personel | Oturum yönetimi | Sözleşmenin icrası |
| 7 | İş operasyonu (kişisel bağlam içerir) | `research_sessions.*`, `shipments.*` | Personel | Operasyon planlama | Sözleşmenin icrası |

## 2. Veri Aktarımı (Alıcı Grupları)

| Alıcı | Aktarılan veri | Gerekçe | Konum |
|---|---|---|---|
| Neon (PostgreSQL) | Tüm uygulama verisi | Hizmet alma (veri işleyen) | AB (Neon bölge ayarına göre) |
| Sentry (opsiyonel, T6.3) | Hata bağlamı — `sendDefaultPii: false` ile PII kapalı | Hizmet alma | ABD — **devreye alınmadan önce** standart sözleşme maddeleri (KVKK m.9) kontrol edilmeli |
| Vercel (hosting, eğer kullanılıyorsa) | Sunucu log'ları, istek metadatası | Hizmet alma | ABD/AB |

## 3. Saklama Süreleri (T7.2 politikası)

| Tablo | Süre | Yöntem |
|---|---|---|
| `audit_logs` | 365 gün canlı → arşiv (T6.5 checkpoint hash'i alındıktan sonra) | `npm run retention:report` ile aday listesi |
| `orders` (iade süreci kapanmış) | 365 gün → arşiv adayı | retention:report (salt-okunur) |
| `research_sessions` | 180 gün → arşiv adayı | retention:report |
| `users` (ayrılan personel) | Talep/ayrılık üzerine anonimleştirme | `POST /api/admin/dsr` |
| Silme talebi | Azami 30 gün içinde sonuçlandırma (m.13) | `docs/compliance/dsr-akisi.md` |

## 4. VERBİS Analizi

**VERBİS kayıt yükümlülüğü değerlendirmesi (taslak):**
- Yurt dışı merkezli değiliz; çalışan + müşteri sayısı eşikleri yıllık Kurul kararlarına göre değişir.
- **2025 kararı** çerçevesinde yıllık çalışan sayısı < 50 VE yıllık mali bilanço toplamı < 100 milyon TL ise ve ana faaliyet konusu kişisel veri işleme değilse **muafiyet** söz konusu olabilir.
- Ana faaliyetimiz e-ticaret operasyonu olduğundan kişisel veri işleme "ana faaliyet" değil — ancak bu değerlendirme **hukuk danışmanınca teyit edilmelidir**.
- Muafiyet yoksa: VERBİS kaydı, envanterin sisteme girişi ve yıllık güncelleme yükümlülüğü doğar.

**Kontrol listesi (hukuk danışmanına iletilecek):**
- [ ] Envanter tablosu (bölüm 1) doğrulandı
- [ ] Aydınlatma metni taslağı gözden geçirildi (`aydinlatma-metni.md`)
- [ ] Açık rıza gerektiren işlem var mı? (şu an teknik olarak açık rıza gerektiren akış tespit edilmedi; pazarlama e-postası eklenirse durum değişir)
- [ ] Sentry/Analytics gibi ABD aktarımı olacaksa m.9 değerlendirmesi
- [ ] VERBİS muafiyet analizi ve gerekirse kayıt

## 5. Riskler ve Azaltımlar (mevcut durum)

| Risk | Azaltım | Durum |
|---|---|---|
| Log'lara PII karışması | pino redact (password/cookie/sessionToken → `[MASKLENDI]`) | ✅ Faz 6 |
| Non-ADMIN'in kart/e-posta görmesi | `maskOrderForRole` / `minimizeUsersForRole` (API katmanı) | ✅ Faz 7 |
| Süresiz veri tutma | Saklama politikası + kuru-çalıştırma raporu | ✅ politika tanımlı; arşivleme otomasyonu Faz 8 backlog |
| Veri sahibi taleplerinin karşılanamaması | `/api/admin/dsr` (export + anonimleştirme) | ✅ Faz 7 |
| `audit_logs` üzerinde geriye dönük değişiklik | T6.5 append-only SQL + aylık checkpoint zinciri | ✅ Faz 6 (SQL manuel uygulanacak) |
