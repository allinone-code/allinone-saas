/**
 * Readiness'in beklediği migration head'i.
 * Yeni migration üretildiğinde bu değerler aynı PR'da güncellenmelidir;
 * migrationManifest.test.ts journal ve SQL hash'iyle drift'i yakalar.
 */
export const MIGRATION_MANIFEST = {
  count: 15,
  latestTag: "0014_yellow_klaw",
  latestHash: "4f3ed1f24c20b007c6a1f34ca29de2d0a80306cf218dfb438b7b14417b263b8c",
} as const;
