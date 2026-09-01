# Çerez Bildirimi ve Kullanıcı Sözleşmesi Taslakları (T7.3)

> **Hukuki uyarı:** Aşağıdakiler teknik taslaktır; yayın öncesi hukuk incelemesi zorunludur.

---

## A. Çerez Bildirimi

Bu uygulama **pazarlama veya analitik çerezi kullanmaz**. Kullanılan çerezler yalnızca hizmetin çalışması için zorunludur:

| Çerez | Amaç | Süre | Zorunlu mu? |
|---|---|---|---|
| `cz-session` (veya yapılandırılan oturum adı) | Oturum kimliğinizin doğrulanması (imzalı, httpOnly) | Oturum süresi / yapılandırılan TTL | Evet — zorunlu |
| `NEXT_LOCALE` (kullanılıyorsa) | Dil tercihi | 1 yıl | Evet — işlevsel |

Analitik (Sentry yalnızca sunucu hatası izler, tarayıcı çerezi yerleştirmez) ve pazarlama aracı
bulunmadığından **açık rıza banner'ı gerekmez**; bu bildirim bilgilendirme amaçlıdır.
İleride analitik/pazarlama çerezi eklenirse ekleme öncesi rıza mekanizması tanımlanmalıdır.

---

## B. Kullanıcı Sözleşmesi Taslağı (Platform / Personel)

**1. Taraflar ve kapsam.** Bu sözleşme, [ŞİRKET UNVANI] ("Şirket") ile platformu kullanan yetkili personel ("Kullanıcı") arasında, Cerberus Commerce OS platformunun kullanım şartlarını düzenler.

**2. Hesap ve güvenlik.** Kullanıcı, hesap bilgilerinin gizliliğinden sorumludur. Parolalar yalnızca karma (bcrypt) biçimde saklanır. Şüpheli erişim derhal yöneticiye bildirilir.

**3. Yetki ve erişim.** Kullanıcı yalnızca kendisine atanan rol ve mağaza kapsamındaki verilere erişebilir. Rol dışı veri erişimi denemeleri denetim kaydına alınır ve disiplin sürecine konu olabilir.

**4. Kişisel veriler.** Kullanıcı, platform üzerinden eriştiği müşteri verilerini (özellikle kart referansı ve e-posta bilgilerini) yalnızca görev amacıyla kullanır; üçüncü kişilerle paylaşmaz, kopyalayamaz veya dışa aktaramaz. Bu yükümlülük görev sona erdikten sonra da devam eder.

**5. Denetim kayıtları.** Kullanıcının platformdaki işlemleri, güvenlik ve hesap verebilirlik amacıyla denetim kaydı (audit log) olarak tutulur ve 1 yıl saklanır.

**6. Hizmet seviyesi.** Yedekleme ve felaket kurtarma hedefleri `docs/operations/backup-dr.md` dokümanındaki gibidir (RPO ≤ 5 dk, RTO ≤ 60 dk). Planlı bakımlar önceden duyurulur.

**7. Fesih.** Kullanım sona erdiğinde hesap pasifleştirilir; talep hâlinde kişisel veriler KVKK m.11 kapsamında anonimleştirilir (`docs/compliance/dsr-akisi.md`).

**8. Uyuşmazlık.** İşbu sözleşmeden doğan uyuşmazlıklarda [İL] Mahkemeleri ve İcra Daireleri yetkilidir.

---

*Doldurulacaklar: şirket unvanı, adres, KEP, il, sözleşme tarihi.*
