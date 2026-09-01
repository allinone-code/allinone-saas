# Aydınlatma Metni Taslağı (KVKK m.10)

> **Hukuki uyarı:** Bu metin teknik taslaktır. Yayınlanmadan önce KVKK uzmanı bir
> hukukçu tarafından incelenip şirket unvanı/adresi gibi alanlar doldurulmalıdır.

---

**Veri Sorumlusu:** [ŞİRKET UNVANI] — [ADRES] — [KEP/E-POSTA]
**İlgili kişi başvuru adresi:** [kvkk@sirket.com]

### 1. Hangi kişisel verilerinizi işliyoruz?

- **Çalışan/personel hesabı:** ad-soyad, e-posta, profil görseli, rol ve mağaza kodu, parola özeti (açık parola asla saklanmaz).
- **Müşteri sipariş bilgisi:** sipariş iletişim e-postası, ödeme kartının yalnızca son 4 hanesi.
- **İşlem kayıtları:** sistem içindeki işlemleriniz (kim, ne zaman, hangi kayıt üzerinde) denetim amacıyla kaydedilir.

### 2. Hangi amaçlarla işliyoruz?

- Hesabınızın oluşturulması ve oturumunuzun güvenli şekilde yönetilmesi,
- Mağaza/sipariş operasyonlarının yürütülmesi (sipariş takibi, iade ve kargo süreçleri),
- Sistem güvenliğinin sağlanması, hataların ve olası ihlallerin incelenmesi,
- Yasal yükümlülüklerin yerine getirilmesi.

### 3. Hukuki sebepler

Kişisel verileriniz; sözleşmenin kurulması/ifası, veri sorumlusunun hukuki yükümlülükleri ve meşru menfaatleri (KVKK m.5/2) kapsamında işlenmektedir. Açık rıza gerektiren bir işleme faaliyeti bulunması hâlinde rızanız ayrıca alınır.

### 4. Aktarım

Verileriniz; barındırma (veritabanı/bulut) ve hata izleme hizmeti sağlayıcılarına, hizmetin gerektirdiği ölçüde aktarılabilir. Yurt dışına aktarım söz konusu olduğunda KVKK m.9 kapsamında gerekli güvenceler sağlanır.

### 5. Saklama

Veriler, işleme amacının gerektirdiği sürelerle sınırlı tutulur: denetim kayıtları 1 yıl, tamamlanmış sipariş kayıtları 1 yıl canlı + arşiv; süre dolan kayıtlar silinir, yok edilir veya anonim hâle getirilir.

### 6. Haklarınız (KVKK m.11)

Kişisel verilerinize ilişkin olarak; işlenip işlenmediğini öğrenme, düzeltilmesini veya silinmesini isteme, aktarıldığı üçüncü kişileri öğrenme ve işlemeye itiraz etme haklarına sahipsiniz. Başvurularınızı **[kvkk@sirket.com]** adresine iletebilirsiniz; talebiniz azami 30 gün içinde sonuçlandırılır.

### 7. Bu metindeki teknik karşılıklar

- Silme/anonimleştirme: `POST /api/admin/dsr` (yalnız ADMIN; işlem denetim kaydına işlenir)
- Verilerinizin dışa aktarımı: `GET /api/admin/dsr?email=...` (yalnız ADMIN)
- Roller arası veri görünürlüğü: kart son-4 ve sipariş e-postası yalnızca ADMIN rolüne açık gösterilir.
