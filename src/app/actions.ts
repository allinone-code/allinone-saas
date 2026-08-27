"use server";

import { db } from "@/db";
import { activity, discoveries, products } from "@/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const validStatuses = ["discovered", "screening", "analyzing", "review", "approved", "purchasing", "received", "listing", "active", "paused", "discontinued", "rejected"] as const;
type Status = typeof validStatuses[number];
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const money = (form: FormData, key: string, fallback = "0") => {
  const result = Number(value(form, key) || fallback);
  return Number.isFinite(result) ? result.toFixed(2) : fallback;
};

export async function createDiscovery(form: FormData) {
  const name = value(form, "name");
  const url = value(form, "sourceUrl");
  if (!name || !url) return { ok: false, message: "Ürün adı ve kaynak URL zorunludur." };
  const sourceDomain = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return value(form, "sourceDomain") || "manual-source.com"; } })();
  const sourcePrice = Number(money(form, "sourcePrice"));
  const targetPrice = Number(money(form, "targetPrice"));
  const shipping = Number(money(form, "shipping"));
  const estimatedProfit = Math.max(0, targetPrice * 0.82 - sourcePrice - shipping);
  const roi = sourcePrice + shipping > 0 ? (estimatedProfit / (sourcePrice + shipping)) * 100 : 0;
  const [{ maxId }] = await db.select({ maxId: sql<number>`coalesce(max(${products.id}), 0)` }).from(products);
  const code = `PRD-${2850 + Number(maxId) + 1}`;
  const duplicate = await db.select({ id: products.id }).from(products).where(eq(products.identifier, value(form, "identifier"))).limit(1);
  const [product] = await db.insert(products).values({
    code, name, brand: value(form, "brand") || "Markasız", category: value(form, "category") || "Diğer",
    identifier: value(form, "identifier") || null, status: "discovered", targetPrice: targetPrice.toFixed(2),
    estimatedProfit: estimatedProfit.toFixed(2), roi: roi.toFixed(2), opportunityScore: Math.max(40, Math.min(96, Math.round(55 + roi / 2))),
    riskLevel: duplicate.length ? "medium" : "low",
  }).returning();
  await db.insert(discoveries).values({
    productId: product.id, researcherId: Number(value(form, "researcherId")) || 1, supplierId: Number(value(form, "supplierId")) || null,
    sourceUrl: url, sourceDomain, sourcePrice: sourcePrice.toFixed(2), shipping: shipping.toFixed(2), notes: value(form, "notes"),
    duplicateScore: duplicate.length ? 82 : 0, flagged: duplicate.length > 0,
  });
  await db.insert(activity).values({ userId: Number(value(form, "researcherId")) || 1, productId: product.id, action: "DISCOVERED", detail: `${name} keşif havuzuna eklendi` });
  revalidatePath("/");
  return { ok: true, message: "Ürün keşif havuzuna eklendi." };
}

export async function updateDiscovery(form: FormData) {
  const productId = Number(value(form, "productId"));
  const discoveryId = Number(value(form, "discoveryId"));
  const statusInput = value(form, "status") as Status;
  const status = validStatuses.includes(statusInput) ? statusInput : "review";
  await db.update(products).set({
    name: value(form, "name"), brand: value(form, "brand"), category: value(form, "category"), status,
    targetPrice: money(form, "targetPrice"), opportunityScore: Math.max(0, Math.min(100, Number(value(form, "opportunityScore")) || 50)), updatedAt: new Date(),
  }).where(eq(products.id, productId));
  await db.update(discoveries).set({ sourcePrice: money(form, "sourcePrice"), notes: value(form, "notes"), updatedAt: new Date() }).where(eq(discoveries.id, discoveryId));
  await db.insert(activity).values({ userId: 1, productId, action: "UPDATED", detail: `Ürün ${status} aşamasına taşındı` });
  revalidatePath("/");
  return { ok: true, message: "Ürün başarıyla güncellendi." };
}

export async function setProductStatus(productId: number, status: Status) {
  if (!validStatuses.includes(status)) return { ok: false };
  await db.update(products).set({ status, updatedAt: new Date() }).where(eq(products.id, productId));
  await db.insert(activity).values({ userId: 1, productId, action: status === "approved" ? "APPROVED" : "STATUS", detail: `Durum ${status} olarak değiştirildi` });
  revalidatePath("/");
  return { ok: true };
}

export async function deleteDiscovery(productId: number) {
  await db.delete(products).where(eq(products.id, productId));
  revalidatePath("/");
  return { ok: true };
}

export async function checkIdentifierDuplicate(identifier: string, currentProductId?: number) {
  if (!identifier.trim()) return { duplicate: false };
  const condition = currentProductId ? and(eq(products.identifier, identifier.trim()), ne(products.id, currentProductId)) : eq(products.identifier, identifier.trim());
  const found = await db.select({ id: products.id, name: products.name }).from(products).where(condition).limit(1);
  return { duplicate: found.length > 0, product: found[0] };
}
