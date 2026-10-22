# Karşılaştırma bölümü: alım listesi röntgeni ve PSH karşılaştırması

Tarih: 2026-10-22. Durum: onay bekliyor.

## Amaç ve neden

Alım yapılınca depoya eksik, hasarlı veya yanlış ürün gelebiliyor; order bazında fiyat da yanlış girilebiliyor. Bugün bunlar elle, Excel formülleriyle aranıyor. Mevcut karşılaştırma ekranı veritabanındaki siparişleri Amazon/Inventory Lab raporlarıyla ASIN bazında kıyaslıyor; kullanıcının asıl ihtiyacı olan "alım listem ile PSH'ın saydığı aynı mı" sorusuna cevap vermiyor.

Hedef iş akışı, aşama aşama:

1. **Röntgen:** Kullanıcı alım listesini (.xlsx veya Google Drive) yükler; sistem dosyayı kendi içinde analiz eder.
2. **PSH karşılaştırma:** Kullanıcı PSH'tan indirdiği dosyayı yükler; iki dosya order+ASIN bazında karşılaştırılır.
3. **Inventory Lab karşılaştırma:** Mevcut iLab karşılaştırması bu akışa taşınır (bu belgenin kapsamı dışı, sonra).

Başarı ölçütü: kullanıcı iki dosyayı yükleyip birkaç saniyede "şu order'da şu ürün eksik, şu order'da fiyat farklı, etkisi şu kadar dolar" listesini görür ve elle formül kurmaz.

## Hedefler

- Alım listesinin (`Sat26` sayfası) ASIN, order, MSKU, kart ve ay bazlı özetleri ve hata listesi.
- PSH dosyasıyla order+ASIN bazında adet, hasar, durum ve birim maliyet karşılaştırması.
- Her bulgunun dolar etkisi; liste en yüksek etkiden başlar.
- Henüz karşılaştırılamayan satırların hata sayılmadan ayrı grupta gösterilmesi.

## Hedef olmayanlar

- Veritabanına yazmak veya veriyi otomatik düzeltmek. Ekran salt okunur; bulgular yalnız gösterilir.
- Inventory Lab karşılaştırmasını yeniden yazmak (üçüncü aşama).
- Drive linklerindeki (order dosyaları) içeriği okumak.
- Tüm projenin renk/yazı temasını değiştirmek.

## Kötü sonuç (başarısızlık sayılır)

- Zaman farkından doğan sahte alarm: PSH'a henüz girmemiş ya da yoldaki ürünler "eksik" diye işaretlenirse kullanıcı ekrana güvenmez.
- Sessiz düzeltme: veride `WO`/`W0` gibi şüpheli farklar kendiliğinden birleştirilirse gerçek hata gizlenir.

## Gerçek dosyalardan öğrenilenler

Örnek dosyalar: `Cerberus_Yedek_21Ags.xlsx` ve `psh1016.xlsx` (depoda, takip edilmiyor).

**Alım dosyası** (`Sat26` sayfası, 194 satır): 57 ASIN, 155 order, 58 MSKU, 1.492 adet, 30.600,50 $. Adet × birim = toplam her satırda tutuyor.
- `Depo26` sayfası `Sat26`'dan türetilmiş PrepShip yükleme şablonudur (194/194 satır birebir aynı). PSH'ın gerçek sayımı DEĞİLDİR; karşılaştırmada kullanılmaz.
- `Data` sayfası seçenek listeleridir; kullanılmaz.
- Hijyen sorunları: 4 ASIN'in başında `\n`; 10 satırda kargo durumu boş; 21 satırda kart boş; 107 satırda mail boş; 4 kart tek satırlık; 1 satır Mart 2025 tarihli; `Tarih2` etiketi ile `Tarih` ayı tutmuyor.

**PSH dosyası** (`Sayfa1`, 135 satır): `Order Number, ASIN, MSKU, Quantity, Received, Damaged, Shipped, Status, Cost, Sale Price, Purchase Date, Ship Date, Supplier` ve diğerleri. Durumlar: `fulfilled` 97, `intransit` 33, `partially_delivered` 4, `delivered` 1. Purchase Date aralığı 17.02.2026 – 19.06.2026.

**İlk karşılaştırma sonucu:** 134/135 satır order+ASIN ile eşleşti, MSKU'lar tuttu. `Sat26`'da olup PSH'ta olmayan 60 satır tamamen 23.06 – 29.07.2026 tarihli, yani PSH dosyasının bitiminden sonra.

## Kararlar (kullanıcının dediği)

- Düzen: **A**, yani üstte özet kartları, hemen altında "bakılacaklar" listesi (dolar etkisine göre sıralı), altta röntgen tabloları açılır bölümler olarak.
- "Bekleniyor" satırları (yoldakiler ve PSH'a henüz girmemişler) hata sayılmaz, ayrı grupta tutulur.
- Renk: yalnız bu ekranda, projenin mevcut temasının yerine **arduvaz + camgöbeği**: zemin `#0f1517`, kart `#151d20`, çizgi `#243035`, ana yazı `#e8f0f2`, ikincil yazı `#84979d`, vurgu `#06b6d4`. Uyarı sarısı (`#FBBF24`), tehlike (`#FB7185`) ve olumlu yeşil (`#34D399`) projedeki gibi kalır. Projenin diğer ekranları değişmez.

## Davranış

### Aşama 1: Röntgen

Girdi: `.xlsx` (Drive linki sonraki iş; bkz. "Builder'a bırakılanlar"). `Sat26` sayfası bulunur; yoksa kullanıcıya sayfa seçtirilir.

Çıktı:
- **Kartlar:** satır, order, ASIN, MSKU, toplam adet, toplam maliyet, ortalama birim maliyet, iptal oranı.
- **Kırılımlar** (her biri: satır, adet, maliyet, ortalama birim, iptal): ASIN, order, MSKU, kart, ay.
- **Hata listesi:**
  - Bozuk ASIN/MSKU (başında/sonunda boşluk, `\n`, `<br>`).
  - ASIN geçerli biçimde değil.
  - Aynı ASIN'in medyan birim maliyetinden %25'ten fazla sapan satır (fiyat yanlış girilmiş adayı).
  - Adet × birim ≠ toplam.
  - Gönderilen adet + fire > adet.
  - Boş kargo durumu, boş kart, tek satırlık kart, şüpheli tarih (diğerlerinden bir yıl farklı).
  - `Tarih` ayı ile `Tarih2` etiketinin tutmaması.
  - Aynı order+ASIN'in tekrarı.

### Aşama 2: PSH karşılaştırması

Girdi: alım dosyası + PSH dosyası. Eşleşme anahtarı **Order No + ASIN**, ikisi de boşluk/satır sonu temizlenip büyük harfe çevrilerek. Aynı anahtarın birden çok satırı toplanır.

Her eşleşen satır için kontroller:

| Bulgu | Kural |
|---|---|
| Eksik teslim | PSH durumu `intransit` ve `partially_delivered` DEĞİLSE (yani `fulfilled`/`delivered`) ve `Quantity − Received − Damaged > 0` |
| Hasarlı | `Damaged > 0` |
| Adet farkı | alım adedi ≠ PSH `Quantity` |
| İptal çelişkisi | alımda İPTAL ama PSH `Received > 0` |
| Fiyat farkı | `|PSH Cost − alım birim maliyeti|` > %10; küçük farklar listede gri |
| MSKU farkı | iki dosyada MSKU ayrı |
| PSH'ta yok | alım satırının tarihi PSH'ın kapsadığı aralıktaysa ve PSH'ta yoksa |
| Alımda yok | PSH'ta olup alımda olmayan |

**Dolar etkisi:** eksik/hasarlı için adet × alım birim maliyeti; fiyat farkı için (PSH − alım) × adet; adet farkı için fark adedi × birim maliyet.

**Bekleniyor grubu** (hata sayılmaz, ayrı kartta ve ayrı listede):
- PSH durumu `intransit` olan satırlar (örnek dosyada 33).
- PSH durumu `partially_delivered` olan satırlar (örnek dosyada 4 satır, 9 adet, 254,75 $). Kullanıcı kararı: teslimat sürüyor kabul edilir, hata sayılmaz. Ekranda "Bekleniyor" grubunun içinde ayrı alt etiketle ("kısmi teslim") ve eksik adet/tutarıyla görünür; böylece unutulmaz. Bu satırlar yine de "İptal çelişkisi" ve "Fiyat farkı" kontrollerine girer.
- Alım tarihi PSH dosyasındaki en yeni Purchase Date'ten sonra olan ve PSH'ta bulunmayan satırlar (örnek dosyada 60).

Şüpheli order numarası (örn. `WO` yerine `W0`): otomatik birleştirilmez. Anahtarı aynıysa eşleşir; bir tarafta eşleşmeyip diğer tarafta benzeri varsa "olası yazım hatası" bulgusu olarak gösterilir.

## Kısıtlar

- Mevcut yığın: Next.js (projedeki sürüm; kod yazmadan önce `node_modules/next/dist/docs/` okunmalı, AGENTS.md), `xlsx` paketi, Vitest. Alım dosyasını `openpyxl` okuyamadı (stil hatası); `xlsx` okuyabiliyor.
- Saf fonksiyonlar `src/domain` altında, testli (projedeki mevcut desen). Ekran `src/features/analytics` altında, diğer ekranlar gibi `globals.css` tokenlarını kullanır; arduvaz paleti yalnız bu ekranın kapsayıcısında yerel değişken olarak tanımlanır.

## Benim kararlarım (kullanıcı onaylamadı, kontrol edin)

1. Fiyat sapma eşikleri: röntgende %25, PSH karşılaştırmada %10. Ekranda ayarlanabilir olmalı.
2. `Depo26` ve `Data` sayfaları kullanılmaz.
3. Dosyalar sunucuda işlenir (mevcut `/api/reconciliation/compare` deseni) ve veritabanına yazılmaz; hesap saf fonksiyonlarda.
4. Mevcut Amazon-kabul ve Inventory Lab karşılaştırmaları şimdilik yerinde kalır; yeni akış aynı menü girişinde yeni bölüm olarak eklenir.
5. Bekleniyor kuralı için PSH dosyasının en yeni `Purchase Date`'i referans alınır.

## Okuyucu kontrolünden gelen netleştirmeler

Veriden ya da projeden cevabı çıkanlar:

- **Hangi tarih:** Alım tarafında `Tarih` kolonu kullanılır (`Tarih2` yalnız etiket, tutarlılık kontrolünde kullanılır). Örnek dosyalarda PSH `Purchase Date`, alımın `Tarih`inden genellikle 4–14 gün sonra (135 eşleşmenin 77'si 4–14 gün, 39'u 0–3 gün, 18'i 15–60 gün). Bu yüzden "PSH'a henüz girmemiş" sınırı = PSH'ın en yeni `Purchase Date`i **eksi 14 gün**. Bu sınırdan sonraki tarihli ve PSH'ta olmayan satır "Bekleniyor"; sınırdan önceki tarihli ve PSH'ta olmayan satır "PSH'ta yok" bulgusu. 14 gün ekranda ayarlanabilir.
- **Kolonlar:** Örnek dosya sözleşme kabul edilir. Başlıklar mevcut `normalizeHeaderLabel` ile (büyük/küçük harf, boşluk toleransı) eşlenir. Zorunlu kolonlar eksikse ekran hangi başlıkların bulunamadığını listeler. Order no: `Orderno`; gönderilen: `Amazona göndilen adet`; iptal: `Kargo durumu` = `İPTAL` ve `İptal adet-P1`.
- **Yetki:** Mevcut route `requireUser` + `resolveStoreScope` kullanıyor. Alım dosyası kart numarası ve e-posta içerdiği için yeni route ADMIN/MANAGER ile sınırlanır.
- **Tek ASIN, iki MSKU:** Örnek dosyada 1 ASIN (`B00L87YFL4`) hem çıplak hem `HRN-` önekli. MSKU karşılaştırması büyük/küçük harf ve boşluk temizlenerek satır bazında yapılır; önek farkı düşük önemli (gri) bulgudur.

Benim kararlarım:

- **İptal satırlar:** Toplamlara dahil, ayrıca "iptal hariç" değeri de gösterilir. "Eksik teslim" ve "Adet farkı" kontrollerinden hariç tutulur; yalnız "İptal çelişkisi" kuralıyla bakılır.
- **Etki hesabı:** Her bulgu listede kendi satırında, kendi dolar etkisiyle görünür. Özet kartlarında kategori toplamları ayrı ayrı gösterilir, genel toplam alınmaz (çift sayım olur). Formülü olmayanlar ("MSKU farkı", "olası yazım hatası") etkisiz listelenir; "PSH'ta yok" ve "Alımda yok" için etki satırın adet × birim maliyetidir.
- **Aynı anahtarın birden çok satırı:** Adet ve maliyet toplanır, birim maliyet ağırlıklı ortalamadır. Aynı order+ASIN'in tekrarı her iki tarafta da "tekrar eden anahtar" bulgusu olarak gösterilir (örnek dosyada alım tarafında 0, PSH tarafında 1).
- **Boyut:** 10 MB ve 50.000 satırdan büyük dosya reddedilir, mesajda neden yazar.
- **Sayfa yoksa:** `Sat26` yoksa kullanıcı sayfa seçer; zorunlu başlıklar bulunamazsa hangileri eksik olduğu gösterilir.

## Builder'a bırakılanlar

- Google Drive linkinden okuma: ilk sürümde yalnız dosya yükleme; Drive eklenecekse ayrı iş.
- Tabloların sütun sıralaması, sayfalama, CSV dışa aktarma ayrıntıları.
- Aşama 1'in `Sat26` dışındaki ay/yıl adlı sayfaları (örn. `Sat25`) ilerde desteklenmesi.
