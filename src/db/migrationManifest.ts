/**
 * Readiness'in beklediği migration head'i.
 * Yeni migration üretildiğinde bu değerler aynı PR'da güncellenmelidir;
 * migrationManifest.test.ts journal ve SQL hash'iyle drift'i yakalar.
 */
export const MIGRATION_MANIFEST = {
  count: 16,
  latestTag: "0015_normal_crystal",
  latestHash: "fb7a0d29035acb2411bdb30d67d4825717f65cb45d352cca48b722dd6623d3e0",
} as const;
