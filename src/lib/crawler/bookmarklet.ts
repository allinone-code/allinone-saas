/**
 * Bookmarklet üreticisi.
 *
 * TASARIM KARARI — AYRIŞTIRMA SUNUCUDA:
 * Bookmarklet yalnız ham JSON-LD bloklarını ve `meta` etiketlerini toplar,
 * sunucuya gönderir. Ürün çıkarımını `parseCapturedHtml` yapar; crawler ile
 * AYNI kod yolu çalışır.
 *
 * Neden: tarayıcıda ikinci bir ayrıştırıcı kopyası yaşasak, GTIN kontrolü,
 * sahte ürün filtresi ve indirim tespiti iki yerde gelişir ve zamanla
 * ayrışır. Ayrışan iki kural, hangisinin doğru olduğu anlaşılmadığı için
 * sessizce yanlış veri üretir.
 *
 * Neden `text/plain`: CORS-safelisted content-type kullanmak PREFLIGHT'ı
 * tetiklemez. Böylece `OPTIONS` handler ve ek CORS yüzeyi gerekmez.
 * Token da gövdede gider; özel header kullanılsaydı preflight zorunlu olurdu.
 */

export interface BookmarkletConfig {
  /** Token metni bookmarklet'e gömülür. */
  token: string;
  /** Cerberus taban adresi. */
  apiBase?: string;
}

/** Varsayılan: aynı origin. Vercel preview dağınımlarında farklı olabilir. */
function defaultApiBase(): string {
  return "";
}

/**
 * `javascript:` URL'ini döndürür. Kullanıcı bunu sürükleyip tarayıcı çubuğuna
 * bırakır veya metni kopyalayıp adres çubuğuna yapıştırır.
 */
export function buildBookmarkletSource(config: BookmarkletConfig): string {
  const apiBase = config.apiBase ?? defaultApiBase();
  // Token'ı gömmek için JSON.stringify: tırnak/özel karakter kaçışı gerekli.
  const payload = JSON.stringify({ captureToken: config.token, apiBase });

  // NOT: `javascript:` URL'leri ~2000 karakter sınırına tabidir (Chrome) ve
  // bazı tarayıcılar `javascript:` çubuğuna yapıştırmayı engeller. Bu yüzden
  // kod okunabilir ama kompakt tutulur; kullanıcı alternatif olarak snippet'a
  // da kaydedebilir.
  return `javascript:(function(){` +
    `var C=${payload};` +
    `var A=C.apiBase||location.origin;` +
    `var S=[].slice.call(document.querySelectorAll('script[type="application/ld+json"]'));` +
    `var L=S.map(function(s){return s.textContent||''}).filter(function(t){return t&&t.trim()});` +
    `var M=[].map.call(document.querySelectorAll('meta'),function(m){` +
      `var o={};['property','name','itemprop'].forEach(function(k){if(m.getAttribute(k))o[m.getAttribute(k)]=m.content||''});` +
      `return o}).filter(function(o){return o.property||o.name||o.itemprop});` +
    `function out(msg,ok){` +
      `var box=document.createElement('div');` +
      `box.setAttribute('style','position:fixed;z-index:2147483647;top:16px;right:16px;max-width:340px;padding:14px 16px;border-radius:10px;font:14px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;color:#fff;box-shadow:0 8px 28px rgba(0,0,0,.28);'` +
        `+(ok?'background:#0f7b4f':'background:#b4232c'));` +
      `box.textContent=msg;` +
      `document.body.appendChild(box);` +
      `setTimeout(function(){box.remove()},ok?4200:9000);` +
    `}` +
    `if(!L.length&&!M.length){out('Bu sayfada ürün verisi yok. Ürün SAYFASI açın (kategori listesi değil).',false);return;}` +
    `out('Cerberus\\'a gönderiliyor…',true);` +
    `fetch(A+'/api/crawler/capture',{method:'POST',` +
      `headers:{'Content-Type':'text/plain;charset=UTF-8'},` +
      `body:JSON.stringify({captureToken:C.captureToken,url:location.href,jsonLd:L,meta:M})})` +
      `.then(function(r){return r.json().then(function(d){return{s:r.status,d:d}})})` +
      `.then(function(res){` +
        `if(res.s>=200&&res.s<300){` +
          `var n=(res.d.products||[]).length,dp=(res.d.priceDrops||[]).length;` +
          `var w=(res.d.warnings||[]);` +
          `out('Kaydedildi: '+n+' ürün'+(dp?' — '+dp+' fiyat düştü!':'')+(w.length?'\\n\\n'+w.slice(0,2).join('\\n'):''),true);` +
        `}else{out('Hata '+(res.s||'?')+': '+(res.d&&res.d.error||'bilinmeyen'),false)}` +
      `})` +
      `.catch(function(e){out('Bağlantı hatası: '+e.message,false)});` +
  `})();`;
}

/**
 * Sürükle-bırak bağlantısı. Tarayıcı çubuğunda `<a href="javascript:...">`
 * çalışmaz, ama bir bağlantıyı sürükleyip çubuğa bırakmak çalışır.
 */
export function buildBookmarkletHref(config: BookmarkletConfig): string {
  return buildBookmarkletSource(config);
}
