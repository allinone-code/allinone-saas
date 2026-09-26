/**
 * Readiness'in beklediği migration head'i.
 * Yeni migration üretildiğinde bu değerler aynı PR'da güncellenmelidir;
 * migrationManifest.test.ts journal ve SQL hash'iyle drift'i yakalar.
 */
export const MIGRATION_MANIFEST = {
  count: 14,
  latestTag: "0013_youthful_juggernaut",
  latestHash: "0634e88a0a62e112dd53ee25351bbfdaf603f218aafc989e38d7b9f0336db50f",
} as const;
