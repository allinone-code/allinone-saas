/**
 * CERBERUS — Yayın sonrası duman testi (HTTP, kimliksiz + negatif senaryolar).
 *
 * Kullanım:
 *   BASE_URL=https://ornek.app node scripts/smoke.mjs
 *   BASE_URL=http://127.0.0.1:3000 node scripts/smoke.mjs   # yerel doğrulama
 *
 * Kapsam (üretim verisine DOKUNMAZ — yalnızca okur + negatif giriş dener):
 *   1. GET /api/health            → 200 + status=healthy
 *   2. GET /api/health/ready      → 200 + ready=true (tüm checks true)
 *   3. GET /api/orders (çereçsiz) → 401
 *   4. POST /api/auth/login (yanlış parola) → 401, hesap sayımı sızdırmaz
 *   5. GET /login                 → 200 (HTML)
 *   6. GET /yasal/aydinlatma      → 200 (KVKK metni herkese açık)
 *   7. GET /yasal/cerez           → 200
 *   8. GET /robots.txt            → 200
 *   9. GET /olmayan-sayfa-xyz     → /login'e yönlendirir (çereçsiz); oturumluda 404
 *  10. GET /                      → /login'e yönlendirir (çereçsiz)
 *
 * Çıkış kodu: tümü geçerse 0, aksi halde 1.
 */

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const results = [];
let failed = 0;

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (err) {
    failed += 1;
    results.push({ name, ok: false, detail: String(err?.message || err) });
    console.log(`❌ ${name} — ${err?.message || err}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`JSON bekleniyordu, gelen: ${text.slice(0, 120)}`);
  }
}

await check("1. Liveness /api/health", async () => {
  const res = await fetch(`${BASE}/api/health`);
  assert(res.status === 200, `status=${res.status}`);
  const body = await json(res);
  assert(body.status === "healthy", `status=${body.status}`);
  return "200 healthy";
});

await check("2. Readiness /api/health/ready", async () => {
  const res = await fetch(`${BASE}/api/health/ready`);
  const body = await json(res);
  assert(res.status === 200, `status=${res.status} checks=${JSON.stringify(body.checks)}`);
  assert(body.ready === true, `ready=${body.ready}`);
  for (const [k, v] of Object.entries(body.checks || {})) {
    assert(v === true, `check ${k}=false`);
  }
  return `200 ready (${body.detail?.migrations} migration)`;
});

await check("3. Kimliksiz /api/orders → 401", async () => {
  const res = await fetch(`${BASE}/api/orders?pageSize=1`);
  assert(res.status === 401, `status=${res.status}`);
  return "401";
});

await check("4. Yanlış parola → 401 (generic mesaj)", async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "olmayan@ornek.com", password: "yanlis-parola-1234" }),
  });
  assert(res.status === 401, `status=${res.status}`);
  const body = await json(res);
  assert(typeof body.error === "string" && body.error.length > 0, "generic error yok");
  assert(!("user" in body), "kullanıcı sızdı!");
  return "401 generic";
});

await check("5. Giriş sayfası /login → 200", async () => {
  const res = await fetch(`${BASE}/login`);
  assert(res.status === 200, `status=${res.status}`);
  const html = await res.text();
  assert(html.includes("Oturum açın"), "giriş formu bulunamadı");
  return "200";
});

await check("6. KVKK aydınlatma metni public → 200", async () => {
  const res = await fetch(`${BASE}/yasal/aydinlatma`);
  assert(res.status === 200, `status=${res.status}`);
  return "200";
});

await check("7. Çerez bildirimi public → 200", async () => {
  const res = await fetch(`${BASE}/yasal/cerez`);
  assert(res.status === 200, `status=${res.status}`);
  return "200";
});

await check("8. robots.txt → 200", async () => {
  const res = await fetch(`${BASE}/robots.txt`);
  assert(res.status === 200, `status=${res.status}`);
  return "200";
});

await check("9. Bilinmeyen sayfa (çereçsiz) → /login yönlendirme", async () => {
  // Proxy, çereçsiz her özel sayfayı /login'e yönlendirir; oturum açmış
  // kullanıcıda aynı adres özel not-found sayfasıyla 404 döner.
  const res = await fetch(`${BASE}/olmayan-sayfa-xyz-123`, { redirect: "manual" });
  if (res.status === 404) return "404 (özel not-found)";
  assert([307, 308, 302].includes(res.status), `status=${res.status}`);
  const loc = res.headers.get("location") || "";
  assert(loc.includes("/login"), `location=${loc}`);
  return `${res.status} → /login`;
});

await check("10. Çereçsiz / → /login yönlendirme", async () => {
  const res = await fetch(`${BASE}/`, { redirect: "manual" });
  assert([307, 308, 302].includes(res.status), `status=${res.status}`);
  const loc = res.headers.get("location") || "";
  assert(loc.includes("/login"), `location=${loc}`);
  return `${res.status} → /login`;
});

console.log(`\nÖZET: ${results.length - failed}/${results.length} geçti`);
process.exit(failed > 0 ? 1 : 0);
