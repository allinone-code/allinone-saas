import type { MetadataRoute } from "next";

/**
 * Kurumsal iç panel: arama motorlarına kapalı.
 * Herkese açık pazarlama sitesi eklenirse bu dosya güncellenmelidir.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: ["/"] }],
  };
}
