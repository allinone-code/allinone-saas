# Cerberus Ürün Yakalayıcı — Chrome Eklentisi

Perakende sitesindeki ürün sayfasından **fiyat, GTIN/UPC, marka ve stok** verisini
alıp Cerberus'a kaydeder. Bot korumasıyla hiç savaşmaz — eklenti sizin tarayıcınızdan,
oturumunuz açıkken çalışır.

## Neden eklenti, bookmarklet değil

Bookmarklet sürükle-bırak gerektirir ve 10 kişilik ekip için kırılgan. Eklenti iki
kritik avantaj verir:

1. **Capture token gerekmez.** `host_permissions` sayesinde tarayıcı gerçek oturum
   çerezini gönderir; sunucu `requireUser()` ile doğrular. "Token yenile" derdi,
   kaybolan token, "şifreli saklanıyor" uyarısı — hiçbiri yok.
2. **Tek tıkla kurulur.** Eklenti güncellemelerde otomatik gelir.

## Kurulum (geliştirici modunda)

1. Chrome'da `chrome://extensions` adresini açın
2. Sağ üstte **"Geliştirici modu"** anahtarını açın
3. **"Paketlenmemiş öğe yükle"** → bu klasörü seçin:
   ```
   chrome-extension/
   ```
4. Araç çubuğunda uzantı simgesi (puzzle ikonu) belirir. **"Cerberus — Ürünü Yakala"**
   simgesini sürükleyip çubuğa sabitleyin.

> Kurumsal dağıtım için: eklenti klasörünü `.zip` yapıp Chrome Web Store'a
> yükleyin. Merkezi yönetim (GPO) kullanıyorsanız `ExtensionInstallForcelist`
> ile dağıtılabilir.

## Kullanım

1. Cerberus'ta giriş yapın (tarayıcınızda açık olması yeterli)
2. VitaminShoppe'da bir **ürün sayfası** açın (kategori listesi değil)
3. Araç çubuğundaki simgeye tıklayın
4. **"Bu sayfadaki ürünü kaydet"**

Sonuç: kaç ürün kaydedildi, GTIN var mı, stok durumu, ve **fiyat düştüyse yüzdesiyle**.

## Sunucu adresi değişirse

Popup'ta **"Sunucu adresi"** bölümünü açıp adresi değiştirin ve kaydedin.
Varsayılan: `https://allinone-saas-allinone-code.vercel.app`

## Yetkilendirme (neden bu kadar az izin)

| İzin | Neden |
|---|---|
| `activeTab` | Kullanıcı simgeye tıklayınca o an bulunulan sayfayı okumak için |
| `scripting` | Sayfadaki JSON-LD/meta etiketlerini okumak için |
| `storage` | Sunucu adresi tercihini saklamak için |
| `host_permissions` | Cerberus'a oturum çereziyle istek atabilmek için |

Eklenti **hiçbir siteye otomatik olarak veri göndermez.** Yalnız kullanıcı butona
tıklayınca, yalnız o sayfanın verisini, yalnız Cerberus'a gönderir.

## Güvenlik notları

- Sayfanın **çerezleri okunmaz ve gönderilmez** (`document.cookie` toplanmaz) —
  bu davranışın sözleşme testi var.
- İstek yalnız `text/plain` gövdeyle yapılır; özel header yok.
- Eklenti hiçbir yerde token saklamaz, çünkü kullanmaz.

## Geliştirme

```bash
# sözleşme testleri: eklentinin topladığı veriyi sunucu gerçekten okuyabiliyor mu
npx vitest run chrome-extension

# tüm kapı
npm run typecheck && npm run lint && npm test
```

### Dosya düzeni

| Dosya | Rol |
|---|---|
| `manifest.json` | MV3 tanımı, izinler |
| `extractor.js` | Sayfadan ham veri toplar — **saf fonksiyon**, `document` parametre alır |
| `popup.html` / `.css` / `.js` | Araç çubuğu arayüzü ve API çağrısı |
| `icons/` | Uzantı simgeleri |
| `__test__/extensionContract.test.ts` | Eklenti ↔ sunucu sözleşme testleri |
| `__test__/fakeDocument.js` | Test için minimal sahte DOM |

### Neden `extractor.js` ayrı ve saf

`extractor.js` içinde `chrome.*` yoktur; `document` parametre olarak alınır. Bu
sayede aynı dosya hem tarayıcıya enjekte edilir hem Node altında sahte bir
`document` ile test edilir. Tarayıcıya özgü kod içine karıştırılsaydı bu eklenti
yalnız saha denemesiyle doğrulanabilirdi — ki o sırada ekip işe başlamış olur.

## Sınırlar

- **Tek ürün sayfası.** Kategori sayfasındaki tüm ürünleri toplu göndermez.
  (Sunucu crawler'ı bunu yapabilir ama bot korumalı sitelerde çalışmaz.)
- **Sitenin JSON-LD ya da `og:` meta verisi olmalı.** Yoksa hata verir — sessizce
  boş kaydetmez.
- **Liste fiyatı gelmezse indirim hesaplanmaz.** `%` göstermek için
  `offers.highPrice` veya eşdeğeri gerekir.
