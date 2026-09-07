#!/usr/bin/env bash
#
# CERBERUS — SheetJS (xlsx) bağımlılığını depoya sabitle (vendor)
#
# NEDEN?
#   package.json'daki xlsx bağımlılığı resmî SheetJS CDN'inden
#   (https://cdn.sheetjs.com/...) çekiliyor. Bu, npm registry'si dışında bir
#   ağ bağımlılığıdır: egress kısıtlı ortamlarda (CI sandbox'ları, kurumsal
#   proxy'ler) `npm ci`/`npm install` başarısız olur. ADR-001'deki güvenlik
#   kararı (0.20.3, zaafiyetsiz sürüm) korunarak tarball'ı depoya gömmek,
#   kurulumu CDN'e bağımlılıktan kurtarır.
#
# NE YAPAR?
#   1. vendor/xlsx-0.20.3.tgz dosyasını indirir (yalnızca bir kez)
#   2. package.json'daki xlsx bağımlılığını `file:vendor/xlsx-0.20.3.tgz`
#      olarak yeniden yazar (npm install bu dosyayı kullanır)
#   3. package-lock.json'u günceller
#
# KULLANIM (cdn.sheetjs.com'a erişebilen bir makinede):
#   bash scripts/vendor-xlsx.sh
#   git add vendor/xlsx-0.20.3.tgz package.json package-lock.json
#   git commit -m "chore(deps): SheetJS 0.20.3 tarball'ını vendor'la"
#
set -euo pipefail

VERSION="0.20.3"
URL="https://cdn.sheetjs.com/xlsx-${VERSION}/xlsx-${VERSION}.tgz"
VENDOR_DIR="vendor"
TARBALL="${VENDOR_DIR}/xlsx-${VERSION}.tgz"

cd "$(dirname "$0")/.."

mkdir -p "$VENDOR_DIR"

if [ -f "$TARBALL" ]; then
  echo "✓ $TARBALL zaten mevcut, indirme atlanıyor."
else
  echo "→ $URL indiriliyor..."
  if curl -fSL --retry 3 --connect-timeout 20 -o "$TARBALL" "$URL" 2>/dev/null; then
    echo "✓ resmî CDN'den indirildi: $TARBALL ($(du -h "$TARBALL" | cut -f1))"
  else
    # cdn.sheetjs.com erişilemiyorsa (egress kısıtlı ortamlar) aynı sürümün
    # npm aynasına düş: @e965/xlsx, resmî CE build'inin bire bir kopyasıdır.
    MIRROR="@e965/xlsx@${VERSION}"
    echo "⚠ CDN erişilemedi, npm aynası deneniyor: $MIRROR"
    npm pack "$MIRROR" --pack-destination "$VENDOR_DIR"
    mv "$VENDOR_DIR/e965-xlsx-${VERSION}.tgz" "$TARBALL"
    echo "✓ npm aynasından indirildi: $TARBALL ($(du -h "$TARBALL" | cut -f1))"
  fi
fi

# npm, package.json'daki xlsx girdisini `file:` URL'ine çevirir ve lock'u günceller.
echo "→ package.json xlsx bağımlılığı file: olarak güncelleniyor..."
npm install --save --save-exact "file:${VENDOR_DIR}/xlsx-${VERSION}.tgz"

echo "✓ tamamlandı. Şimdi şunları commit edin:"
echo "    git add vendor/ package.json package-lock.json"
