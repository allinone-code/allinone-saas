import type { NextConfig } from "next";

/**
 * T6.2 — Güvenlik başlıkları (tüm rotalar).
 * next.config.ts artık boş değil; header politikası burada yaşar.
 */
const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  // Clickjacking engeli.
  // Geliştirmede kaldırılır: yerel önizleme panelleri uygulamayı iframe içinde
  // gösterir; üretimde DENY olarak uygulanır.
  ...(isProd ? [{ key: "X-Frame-Options", value: "DENY" }] : []),
  // MIME sniffing engeli
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Referrer minimizasyonu (bağlantılarımızda tedarikçi ROI verisi sızmasın)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Tarayıcı özellikleri kapat
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // HTTPS zorlaması (üretim TLS arkasında)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    // CSP: Next.js inline script/style gerektirir; harici kaynaklar ürün görselleri
    // (Amazon/Unsplash CDN) için https img-src'te açık. Eval: yalnız geliştirme.
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss:",
      isProd ? "frame-ancestors 'none'" : "frame-ancestors *",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // PGlite WASM/veri dosyalarını taşır; bundler'a girerse yolu bozulur.
  // Yalnızca yerel geliştirme sürücüsü için gereklidir (bkz. src/db/index.ts).
  serverExternalPackages: ["@electric-sql/pglite"],

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
