/**
 * Basit proses-içi (in-memory) hız sınırlayıcı.
 *
 * NOT: Serverless dağıtımda her instance kendi sayacını tutar; kesin sınır için
 * Faz 6'da Upstash Ratelimit gibi dağıtık bir sayaç önerilir. Yine de bu katman
 * tek-instance brute-force denemelerini durdurur ve Vercel'de de caydırıcıdır.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Haritanın sınırsız büyümesini engellemek için periyodik temizlik
const MAX_BUCKETS = 10_000;

function cleanup(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  cleanup(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

/** Başarılı girişte sayaç sıfırlanır; meşru kullanıcı kilitli kalmaz. */
export function clearRateLimit(key: string): void {
  buckets.delete(key);
}
