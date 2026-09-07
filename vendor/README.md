# Vendored Bağımlılıklar

## `xlsx-0.20.3.tgz` — SheetJS Community Edition

**Neden vendor'landı?** SheetJS, npm registry'den 0.18.5 sonrası sürümleri
kaldırdı; 0.20.x yalnızca `https://cdn.sheetjs.com` üzerinden yayınlanıyor.
Egress kısıtlı ortamlarda (CI sandbox, kurumsal proxy, bazı PaaS build
ajanları) bu CDN'e erişilemediğinde `npm ci` / `npm install` tamamen
başarısız oluyor ve **uygulamanın build'i kırılıyordu** — XLS içe aktarma
özelliğinin çalışamaz hale gelmesinin birincil nedeniydi.

**İçerik:** Resmî SheetJS 0.20.3 Community sürümünün bire bir aynası
(`@e965/xlsx@0.20.3` npm aynasından alınan tarball; Apache-2.0 lisanslı,
paket içi sürüm dizesi `0.20.3` olarak doğrulandı). ADR-001'deki güvenlik
kararı korunuyor: CVE-2023-30533 (prototype pollution) ve CVE-2024-22363
(ReDoS) yamalarını içeren 0.20.3 taban çizgisi değişmedi.

**Güncelleme:** `bash scripts/vendor-xlsx.sh` çalıştırın. Script önce resmî
CDN'i dener; erişilemiyorsa npm aynasına (@e965/xlsx) düşer.
