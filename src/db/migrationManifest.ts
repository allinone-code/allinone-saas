/**
 * Readiness'in beklediği migration head'i.
 * Yeni migration üretildiğinde bu değerler aynı PR'da güncellenmelidir;
 * migrationManifest.test.ts journal ve SQL hash'iyle drift'i yakalar.
 */
export const MIGRATION_MANIFEST = {
  count: 13,
  latestTag: "0012_slim_anita_blake",
  latestHash: "4f3b42c224742916083cd6f9f25dad73d07c1ed98753e1d1e766233243362123",
} as const;
