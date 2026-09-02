/**
 * CERBERUS — Veri Tazeliği (Data Freshness) Motoru
 *
 * ÖNCEKİ DURUM (teknik borç): `dataFreshnessStatus` elle set edilen bir metin
 * alanıydı ve yeni kayıtlarda daima "FRESH" yazılıyordu. İş sağlığı skorunun
 * **%15'i**, kimsenin güncellemeyi hatırlamadığı bir alana bağlıydı. Pratikte
 * bu eksen her zaman yapay olarak yüksek kalıyordu.
 *
 * ŞİMDİ: Tazelik, kaydın `observedAt` zaman damgasından **hesaplanır**.
 * Bir sayı elle "taze" ilan edilemez; taze olmayı zamanla kaybeder.
 *
 * Eşikler tedarik döngüsüne göre seçildi: ABD kaynak fiyatları haftalar
 * içinde oynar, bu yüzden 7 gün sonra kayıt "yaşlanmaya" başlar.
 */

export type FreshnessStatus = "FRESH" | "AGING" | "STALE" | "EXPIRED";

/** Gün cinsinden eşikler — tek kaynak, hem hesap hem arayüz buradan okur */
export const FRESHNESS_THRESHOLDS = {
  /** 0–7 gün: karar için güvenilir */
  FRESH_MAX_DAYS: 7,
  /** 8–21 gün: kullanılabilir ama doğrulanmalı */
  AGING_MAX_DAYS: 21,
  /** 22–45 gün: karar için riskli */
  STALE_MAX_DAYS: 45,
  /** 45+ gün: karara sokulmamalı */
} as const;

export interface FreshnessResult {
  status: FreshnessStatus;
  ageInDays: number;
  /** Skorlamada kullanılan 0–100 tazelik puanı */
  score: number;
  /** Kullanıcıya gösterilecek Türkçe açıklama */
  label: string;
}

const MS_PER_DAY = 86_400_000;

/**
 * Bir kaydın gözlem tarihinden tazelik durumunu hesaplar.
 *
 * @param observedAt Verinin kaynaktan gözlendiği an
 * @param now Referans an (test edilebilirlik için enjekte edilir)
 */
export function computeFreshness(
  observedAt: Date | string | null | undefined,
  now: Date = new Date()
): FreshnessResult {
  if (!observedAt) {
    return {
      status: "EXPIRED",
      ageInDays: Infinity,
      score: 0,
      label: "Gözlem tarihi yok — karara sokulmamalı",
    };
  }

  const observed = observedAt instanceof Date ? observedAt : new Date(observedAt);

  if (Number.isNaN(observed.getTime())) {
    return {
      status: "EXPIRED",
      ageInDays: Infinity,
      score: 0,
      label: "Gözlem tarihi geçersiz — karara sokulmamalı",
    };
  }

  // Gelecek tarihli kayıt saat farkı/veri hatasıdır; 0 gün sayılır.
  const ageInDays = Math.max(0, Math.floor((now.getTime() - observed.getTime()) / MS_PER_DAY));

  if (ageInDays <= FRESHNESS_THRESHOLDS.FRESH_MAX_DAYS) {
    return {
      status: "FRESH",
      ageInDays,
      score: 100,
      label: `${ageInDays} gün önce doğrulandı`,
    };
  }

  if (ageInDays <= FRESHNESS_THRESHOLDS.AGING_MAX_DAYS) {
    // 8–21 gün arası 100'den 60'a doğrusal iner
    const span = FRESHNESS_THRESHOLDS.AGING_MAX_DAYS - FRESHNESS_THRESHOLDS.FRESH_MAX_DAYS;
    const progress = (ageInDays - FRESHNESS_THRESHOLDS.FRESH_MAX_DAYS) / span;
    return {
      status: "AGING",
      ageInDays,
      score: Math.round(100 - progress * 40),
      label: `${ageInDays} gündür güncellenmedi — yeniden doğrulayın`,
    };
  }

  if (ageInDays <= FRESHNESS_THRESHOLDS.STALE_MAX_DAYS) {
    const span = FRESHNESS_THRESHOLDS.STALE_MAX_DAYS - FRESHNESS_THRESHOLDS.AGING_MAX_DAYS;
    const progress = (ageInDays - FRESHNESS_THRESHOLDS.AGING_MAX_DAYS) / span;
    return {
      status: "STALE",
      ageInDays,
      score: Math.round(60 - progress * 40),
      label: `${ageInDays} gündür bayat — fiyat teyidi gerekli`,
    };
  }

  return {
    status: "EXPIRED",
    ageInDays,
    score: 0,
    label: `${ageInDays} gündür güncellenmedi — karara sokulmamalı`,
  };
}

/**
 * Bir kayıt kümesinin ağırlıklı tazelik skoru (0–100).
 * Sağlık skorunun "Veri Tazeliği" ekseni bunu kullanır.
 */
export function computeFreshnessScore(
  observedDates: Array<Date | string | null | undefined>,
  now: Date = new Date()
): number {
  if (!observedDates || observedDates.length === 0) return 0;

  const total = observedDates.reduce(
    (sum, d) => sum + computeFreshness(d, now).score,
    0
  );

  return Math.round(total / observedDates.length);
}

/** Durum sayımlarını üretir — arayüzdeki rozet dağılımı için */
export function summarizeFreshness(
  observedDates: Array<Date | string | null | undefined>,
  now: Date = new Date()
): Record<FreshnessStatus, number> {
  const counts: Record<FreshnessStatus, number> = {
    FRESH: 0,
    AGING: 0,
    STALE: 0,
    EXPIRED: 0,
  };

  for (const d of observedDates) {
    counts[computeFreshness(d, now).status] += 1;
  }

  return counts;
}
