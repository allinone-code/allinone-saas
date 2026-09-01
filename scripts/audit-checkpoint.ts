/**
 * T6.5 — Değiştirilemez denetim izi checkpoint'i.
 *
 * audit_logs tablosunun id-sıralı SHA-256 zincir özeti çıkarılır ve
 * `ops/audit-checkpoints/YYYY-MM.json` dosyasına yazılır. Sonraki her çalıştırma
 * periyodik olarak (öneri: günlük cron) önceki checkpoint hash'ini de içerdiğinden
 * zincir bütünlüğü dosya bazında kanıtlanabilir.
 *
 * Kullanım: DATABASE_URL=... npm run audit:checkpoint
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "../src/db";
import { auditLogs } from "../src/db/schema";
import { asc, gt } from "drizzle-orm";

interface CheckpointFile {
  generatedAt: string;
  previousChainHash: string | null;
  fromId: number;
  toId: number;
  rowCount: number;
  chainHash: string;
  algorithm: "sha256-chain-v1";
}

const outDir = path.join(process.cwd(), "ops", "audit-checkpoints");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("HATA: DATABASE_URL tanımlı değil.");
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  // Önceki checkpoint'i bul (zincir başlangıcı)
  const existing = fs
    .readdirSync(outDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  let previousChainHash: string | null = null;
  let lastId = 0;
  if (existing.length > 0) {
    const prev = JSON.parse(
      fs.readFileSync(path.join(outDir, existing[existing.length - 1]), "utf-8")
    ) as CheckpointFile;
    previousChainHash = prev.chainHash;
    lastId = prev.toId;
  }

  const rows = await db
    .select()
    .from(auditLogs)
    .where(gt(auditLogs.id, lastId))
    .orderBy(asc(auditLogs.id));

  let chain = previousChainHash ?? "GENESIS";
  for (const r of rows) {
    chain = crypto
      .createHash("sha256")
      .update(
        chain +
          "|" +
          [r.id, r.actorName, r.storeCode, r.actionType, r.targetEntity, r.beforeState ?? "", r.afterState ?? "", r.details ?? "", r.createdAt.toISOString()].join("|")
      )
      .digest("hex");
  }

  const checkpoint: CheckpointFile = {
    generatedAt: new Date().toISOString(),
    previousChainHash,
    fromId: rows.length > 0 ? rows[0].id : lastId,
    toId: rows.length > 0 ? rows[rows.length - 1].id : lastId,
    rowCount: rows.length,
    chainHash: chain,
    algorithm: "sha256-chain-v1",
  };

  const file = path.join(outDir, `${new Date().toISOString().slice(0, 7)}.json`);
  fs.writeFileSync(file, JSON.stringify(checkpoint, null, 2) + "\n");

  console.log(`Checkpoint yazıldı: ${file}`);
  console.log(`  Satır: ${checkpoint.rowCount} | Zincir: ${chain.slice(0, 16)}...`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Checkpoint başarısız:", err);
  process.exit(1);
});
