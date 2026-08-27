import { db } from "@/db";
import { activity, discoveries, products, suppliers, users } from "@/db/schema";
import { asc, count, desc, eq, sql } from "drizzle-orm";
import { scryptSync } from "node:crypto";

export function hashPassword(password: string) {
  return scryptSync(password, "cerberus-saas-v1", 64).toString("hex");
}

export async function ensureDemoData() {
  const [{ value }] = await db.select({ value: count() }).from(users);
  if (value > 0) return;

  await db.transaction(async (tx) => {
    const people = await tx.insert(users).values([
      { name: "Mert Yılmaz", email: "mert@cerberus.io", passwordHash: hashPassword("cerberus2026"), role: "admin", initials: "MY" },
      { name: "Elif Kaya", email: "elif@cerberus.io", passwordHash: hashPassword("demo1234"), role: "researcher", initials: "EK" },
      { name: "Can Demir", email: "can@cerberus.io", passwordHash: hashPassword("demo1234"), role: "researcher", initials: "CD" },
      { name: "Zeynep Arslan", email: "zeynep@cerberus.io", passwordHash: hashPassword("demo1234"), role: "analyst", initials: "ZA" },
    ]).returning();

    const vendorRows = await tx.insert(suppliers).values([
      { name: "B&H Photo", domain: "bhphotovideo.com", score: 92, reliability: 95, activeProducts: 38 },
      { name: "Costco Wholesale", domain: "costco.com", score: 88, reliability: 91, activeProducts: 54 },
      { name: "Ulta Beauty", domain: "ulta.com", score: 86, reliability: 89, activeProducts: 29 },
      { name: "iHerb", domain: "iherb.com", score: 84, reliability: 87, activeProducts: 42 },
      { name: "Best Buy", domain: "bestbuy.com", score: 81, reliability: 85, activeProducts: 31 },
    ]).returning();

    const productRows = await tx.insert(products).values([
      { code: "PRD-2849", name: "QuietComfort Ultra Headphones", brand: "Bose", category: "Elektronik", identifier: "ASIN B0CCZ26B5V", imageUrl: "https://images.pexels.com/photos/3394650/pexels-photo-3394650.jpeg?auto=compress&cs=tinysrgb&w=200", status: "review", targetPrice: "429.00", estimatedProfit: "74.82", roi: "28.60", opportunityScore: 91, riskLevel: "low" },
      { code: "PRD-2848", name: "Collagen Peptides Advanced", brand: "Vital Proteins", category: "Sağlık", identifier: "UPC 850232005089", imageUrl: "https://images.pexels.com/photos/29060401/pexels-photo-29060401.jpeg?auto=compress&cs=tinysrgb&w=200", status: "approved", targetPrice: "47.99", estimatedProfit: "12.54", roi: "46.30", opportunityScore: 88, riskLevel: "low" },
      { code: "PRD-2847", name: "Airwrap Multi-Styler Complete", brand: "Dyson", category: "Kişisel Bakım", identifier: "GTIN 008856090285", imageUrl: "https://images.pexels.com/photos/3738349/pexels-photo-3738349.jpeg?auto=compress&cs=tinysrgb&w=200", status: "analyzing", targetPrice: "599.00", estimatedProfit: "88.20", roi: "19.40", opportunityScore: 76, riskLevel: "medium" },
      { code: "PRD-2846", name: "Precision Brewer Thermal", brand: "Breville", category: "Ev & Mutfak", identifier: "ASIN B078RQVQF1", imageUrl: "https://images.pexels.com/photos/6802982/pexels-photo-6802982.jpeg?auto=compress&cs=tinysrgb&w=200", status: "screening", targetPrice: "329.95", estimatedProfit: "51.34", roi: "24.80", opportunityScore: 82, riskLevel: "low" },
      { code: "PRD-2845", name: "Hydro Boost Water Gel", brand: "Neutrogena", category: "Güzellik", identifier: "UPC 070501110478", imageUrl: "https://images.pexels.com/photos/7796455/pexels-photo-7796455.jpeg?auto=compress&cs=tinysrgb&w=200", status: "rejected", targetPrice: "28.49", estimatedProfit: "3.18", roi: "13.10", opportunityScore: 48, riskLevel: "high" },
      { code: "PRD-2844", name: "Smart LED Light Strip 5m", brand: "Govee", category: "Akıllı Ev", identifier: "ASIN B07N1BVVC7", imageUrl: "https://images.pexels.com/photos/577514/pexels-photo-577514.jpeg?auto=compress&cs=tinysrgb&w=200", status: "approved", targetPrice: "49.99", estimatedProfit: "14.90", roi: "52.20", opportunityScore: 89, riskLevel: "low" },
    ]).returning();

    await tx.insert(discoveries).values([
      { productId: productRows[0].id, researcherId: people[1].id, supplierId: vendorRows[0].id, sourceUrl: "https://bhphotovideo.com/bose-qc-ultra", sourceDomain: "bhphotovideo.com", sourcePrice: "269.00", shipping: "0", duplicateScore: 8, notes: "Fiyat son 30 günün en düşük seviyesinde." },
      { productId: productRows[1].id, researcherId: people[2].id, supplierId: vendorRows[1].id, sourceUrl: "https://costco.com/vital-proteins", sourceDomain: "costco.com", sourcePrice: "22.99", shipping: "0", duplicateScore: 12, notes: "İkili paket, bundle ayrıştırma kontrol edildi." },
      { productId: productRows[2].id, researcherId: people[1].id, supplierId: vendorRows[2].id, sourceUrl: "https://ulta.com/dyson-airwrap", sourceDomain: "ulta.com", sourcePrice: "449.99", shipping: "0", duplicateScore: 67, flagged: true, notes: "Benzer varyant mevcut, yönetici incelemesi gerekli." },
      { productId: productRows[3].id, researcherId: people[2].id, supplierId: vendorRows[0].id, sourceUrl: "https://bhphotovideo.com/breville-brewer", sourceDomain: "bhphotovideo.com", sourcePrice: "199.95", shipping: "8.90", duplicateScore: 4 },
      { productId: productRows[4].id, researcherId: people[1].id, supplierId: vendorRows[3].id, sourceUrl: "https://iherb.com/neutrogena-hydro", sourceDomain: "iherb.com", sourcePrice: "19.82", shipping: "3.20", duplicateScore: 22, notes: "Marj eşiğin altında." },
      { productId: productRows[5].id, researcherId: people[2].id, supplierId: vendorRows[4].id, sourceUrl: "https://bestbuy.com/govee-strip", sourceDomain: "bestbuy.com", sourcePrice: "24.99", shipping: "0", duplicateScore: 6 },
    ]);

    await tx.insert(activity).values([
      { userId: people[0].id, productId: productRows[1].id, action: "APPROVED", detail: "Ürün satın alma için onaylandı" },
      { userId: people[3].id, productId: productRows[0].id, action: "SCORED", detail: "Fırsat skoru 91 olarak güncellendi" },
      { userId: people[1].id, productId: productRows[2].id, action: "DUPLICATE", detail: "%67 olası eşleşme tespit edildi" },
    ]);
  });
}

export async function getDashboardData() {
  await ensureDemoData();
  const rows = await db.select({ product: products, discovery: discoveries, researcher: users, supplier: suppliers })
    .from(discoveries)
    .innerJoin(products, eq(discoveries.productId, products.id))
    .innerJoin(users, eq(discoveries.researcherId, users.id))
    .leftJoin(suppliers, eq(discoveries.supplierId, suppliers.id))
    .orderBy(desc(discoveries.discoveredAt));
  const team = await db.select({ id: users.id, name: users.name, initials: users.initials }).from(users).orderBy(asc(users.name));
  const vendorList = await db.select().from(suppliers).orderBy(desc(suppliers.score));
  const recentActivity = await db.select({ item: activity, user: users, product: products }).from(activity)
    .leftJoin(users, eq(activity.userId, users.id)).leftJoin(products, eq(activity.productId, products.id))
    .orderBy(desc(activity.createdAt)).limit(5);
  const [metrics] = await db.select({
    total: count(),
    avgRoi: sql<string>`round(avg(${products.roi}), 1)`,
    avgScore: sql<number>`round(avg(${products.opportunityScore}))`,
    approved: sql<number>`count(*) filter (where ${products.status} = 'approved')`,
  }).from(products);
  return { rows, team, vendorList, recentActivity, metrics };
}
