/**
 * Cerberus Ürün Yakalayıcı — popup mantığı.
 *
 * KİMLİK: Bu eklenti capture TOKEN kullanmaz. `host_permissions` sayesinde
 * tarayıcı, eklenti isteğinde gerçek oturum çerezini gönderir; sunucu
 * `requireUser()` ile doğrulamayı yapar. Bookmarklet yolunda token gerekiyordu
 * çünkü sayfa farklı origin'de çalışıyordu. Eklenti sunucu tarafından
 * güvenilir sayıldığı için bu karmaşıklık tamamen gereksiz.
 *
 * AKIŞ:
 *   1. Aktif sekmenin URL'si ve içeriği `extractor.js` ile okunur.
 *   2. Ham veri Cerberus'a POST edilir.
 *   3. Sunucu AYNI ayrıştırıcıyı çalıştırır (GTIN, indirim, sahte ürün
 *      filtresi tek yerde) ve sonucu döner.
 */

const DEFAULT_API_BASE = "https://allinone-saas-allinone-code.vercel.app";

const el = (id) => document.getElementById(id);
const statusEl = el("status");
const resultEl = el("result");
const listEl = el("resultList");
const warnEl = el("warnList");
const captureBtn = el("capture");
const apiInput = el("apiBase");

/** Alan adı -> okunabilir site adı. */
function prettyHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "?";
  }
}

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = "status" + (kind ? " " + kind : "");
}

async function apiBase() {
  const stored = await chrome.storage.local.get("apiBase");
  const value = (stored.apiBase || "").trim() || DEFAULT_API_BASE;
  apiInput.value = value;
  return value.replace(/\/$/, "");
}

async function setApiBase(value) {
  await chrome.storage.local.set({ apiBase: value.trim() });
  setStatus("Sunucu adresi kaydedildi.", "ok");
}

function tag(text, cls) {
  const span = document.createElement("span");
  span.className = "tag" + (cls ? " " + cls : "");
  span.textContent = text;
  return span;
}

function render(payload) {
  const products = payload.products || [];
  const drops = payload.priceDrops || [];
  const warnings = payload.warnings || [];

  listEl.textContent = "";
  warnEl.textContent = "";

  const badge = el("resultBadge");
  badge.className = "badge" + (drops.length ? " drop" : "");
  badge.textContent = drops.length ? `🔻 ${drops.length} fiyat düştü` : `${products.length} ürün`;

  el("resultCount").textContent = payload.sourceDomain || "";

  for (const p of products.slice(0, 6)) {
    const li = document.createElement("li");
    li.className = "item";

    const title = document.createElement("div");
    title.className = "item-title";
    title.textContent = p.title || "(başlıksız)";
    li.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "item-meta";

    if (p.price !== null && p.price !== undefined) meta.appendChild(tag("$" + Number(p.price).toFixed(2), "price"));
    if (p.gtin) meta.appendChild(tag("GTIN " + p.gtin, "gtin"));
    else meta.appendChild(tag("GTIN yok", "gtin missing"));
    if (p.sourceSku) meta.appendChild(tag("SKU " + p.sourceSku));
    if (p.availability === "IN_STOCK") meta.appendChild(tag("Stokta"));
    if (p.availability === "OUT_OF_STOCK") meta.appendChild(tag("Tükendi"));

    const drop = drops.find((d) => d.title === p.title);
    if (drop) meta.appendChild(tag("%" + drop.pct + " indirim", "drop"));

    li.appendChild(meta);
    listEl.appendChild(li);
  }

  for (const w of warnings.slice(0, 4)) {
    const li = document.createElement("li");
    li.textContent = w;
    warnEl.appendChild(li);
  }

  resultEl.classList.remove("hidden");
}

async function capture() {
  captureBtn.disabled = true;
  setStatus("Sayfa okunuyor…");
  resultEl.classList.add("hidden");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("Aktif sekme bulunamadı.");

    // 1) Sayfadan ham veri topla.
    //    Önce extractor.js'i enjekte et, sonra çağır: fonksiyonu executeScript
    //    içine yazarsak test edemeyiz (bkz. __test__/extensionContract.test.ts).
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["extractor.js"] });
    const [injected] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.__cerberusExtract(document),
    });

    const captured = injected?.result;
    if (!captured || (!captured.jsonLd?.length && !captured.meta)) {
      throw new Error(
        "Bu sayfada ürün verisi yok. Ürün SAYFASını açın (kategori listesi değil) — GTIN orada bulunur."
      );
    }

    // 2) Sunucuya gönder.
    setStatus("Cerberus'a gönderiliyor…");
    const base = await apiBase();
    const res = await fetch(base + "/api/crawler/capture", {
      method: "POST",
      // text/plain CORS-safelisted; ayrıca eklenti origin'i CORS dışında
      // olduğu için zaten preflight olmaz. Sunucu gövdeyi text olarak okuyup
      // JSON.parse ediyor — iki yol da aynı gövdeyi kabul eder.
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      // Gerçek oturum çerezi. Eklenti host_permissions sayesinde gönderilir.
      credentials: "include",
      body: JSON.stringify({
        url: captured.url,
        jsonLd: captured.jsonLd,
        meta: captured.meta,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("Oturum yok. Cerberus'ta giriş yapıp tekrar deneyin.");
      }
      throw new Error(data.error || `Sunucu hatası ${res.status}`);
    }

    render(data);
    setStatus("Kaydedildi.", "ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(message, /oturum|giriş/i.test(message) ? "err" : "err");
  } finally {
    captureBtn.disabled = false;
  }
}

async function init() {
  const base = await apiBase();
  apiInput.value = base;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    el("siteName").textContent = prettyHost(tab?.url || "");
  } catch {
    /* sekme bilgisi yoksa sessiz geç */
  }

  captureBtn.addEventListener("click", () => void capture());
  el("saveApi").addEventListener("click", () => void setApiBase(apiInput.value));
}

void init();
