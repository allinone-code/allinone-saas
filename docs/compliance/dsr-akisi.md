# Veri Sahibi (DSR) Talep Akışı — Teknik Karşılık (T7.3)

KVKK m.11 kapsamındaki taleplerin teknik olarak nasıl karşılandığının dokümanıdır.
Hukuki süreç (30 gün, ücretlendirme, ret gerekçeleri) hukuk danışmanı sorumluluğundadır.

## 1. Talep alma

- Başvuru kanalı: **[kvkk@sirket.com]** (aydınlatma metninde ilan edilir).
- Talep tipleri: bilgi edinme / düzeltme / silme / anonimleştirme / dışa aktarım.

## 2. Kimlik doğrulama

- Talep, kayıtlı e-posta adresinden gelmemişse ek kimlik doğrulaması istenir.
- İşlemler yalnızca **ADMIN** rolü tarafından uç üzerinden yürütülür.

## 3. Teknik uçlar

| Talep | Uç | Not |
|---|---|---|
| Verilerimin dökümü | `GET /api/admin/dsr?email=<adres>` | JSON: kullanıcı hesabı (parola özeti hariç), iletişim e-postası geçen siparişler, audit kayıt sayısı |
| Silme / anonimleştirme | `POST /api/admin/dsr` gövde `{ "email": "...", "confirm": "ANONYMIZE" }` | **Geri alınamaz.** İsim/e-posta/avatar maskelenir, parola rastgele yeniden yazılır, siparişlerdeki iletişim e-postası anonimleştirilir |
| Düzeltme | ADMIN paneli / veritabanı üzerinden alan güncelleme + audit kaydı | Otomatik uç yok; işlem denetim kaydına işlenir |

### Anonimleştirmenin kapsamı

1. `users` satırı: `name → "Anonim Kullanıcı #<id>"`, `email → deleted+<id>@redacted.local`, `avatar → null`, `password_hash → rastgele bcrypt`.
2. `orders.order_email` (eşleşen adres) → anonim forma çekilir.
3. `audit_logs` üzerine `DSR_ANONYMIZE` kaydı düşülür (PII içermeyen referansla: `user_id:<id>`).
4. ADMIN hesabı bu uçla anonimleştirilemez (403) — kritik işlem koruması.

### Neden "silme" yerine "anonimleştirme"?

`audit_logs` ve sipariş kayıtları üzerindeki bütünlük (T6.5 append-only + checkpoint zinciri)
bozulmadan KVKK m.7/4'teki "verilerin anonim hâle getirilmesi" yükümlülüğü karşılanır.
Fiziksel silme yalnızca denetim bütünlüğünü etkilemeyen tablolar için değerlendirilir.

## 4. Kayıt ve raporlama

- Her DSR işlemi `audit_logs`'a ve yapısal log'a (PII-maskeli) yazılır.
- Aylık kontrol: `npm run retention:report` çıktısı ile saklama süresi dolan kayıtlar listelenir; silme/anonimleştirme kararı insan onayıyla alınır.

## 5. Bilinen sınırlar (Faz 8 backlog)

- Düzeltme talepleri için self-servis uç yok (ADMIN manuel işlem yapar).
- Audit log'ların yurt dışı kopyalarında arama yalnız sayı raporlanır; tam dışa aktarım ayrı prosedür.
