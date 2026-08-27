import { db } from "@/db";
import { users, stores, orders, pshBatches, auditLogs } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import { ALL_38_XLS_ORDERS, INITIAL_STORES, INITIAL_BATCHES } from "@/lib/mockData";

export async function ensureCerberusSeeded() {
  // 1. Ensure users exist with passwords and store codes
  const existingUsers = await db.select({ total: count() }).from(users);
  if (Number(existingUsers[0]?.total || 0) === 0) {
    await db.insert(users).values([
      {
        name: "Ahmet Erdem (Sistem Yöneticisi)",
        email: "ahmet@cerberus-commerce.io",
        passwordHash: "admin2026",
        role: "ADMIN",
        storeCode: "ALL",
        avatar: "AE",
      },
      {
        name: "Harun (HRN Store Yöneticisi)",
        email: "harun@cerberus-commerce.io",
        passwordHash: "store2026",
        role: "STORE_USER",
        storeCode: "HRN",
        avatar: "HRN",
      },
      {
        name: "Selin Yılmaz (SEL Store Yöneticisi)",
        email: "selin@cerberus-commerce.io",
        passwordHash: "store2026",
        role: "STORE_USER",
        storeCode: "SEL",
        avatar: "SY",
      },
      {
        name: "Can Demir (MK Store Yöneticisi)",
        email: "can@cerberus-commerce.io",
        passwordHash: "store2026",
        role: "STORE_USER",
        storeCode: "MK",
        avatar: "CD",
      },
    ]);
  }

  // 2. Stores Table (Multi-Store Fleet)
  const existingStores = await db.select({ total: count() }).from(stores);
  if (Number(existingStores[0]?.total || 0) === 0) {
    await db.insert(stores).values(
      INITIAL_STORES.map((s) => ({
        storeCode: s.storeCode,
        storeName: s.storeName,
        marketplace: s.marketplace,
        buyerName: s.buyerName,
        currency: s.currency,
        status: s.status,
        defaultCard: "1753",
        defaultEmail: `${s.storeCode.toLowerCase()}@cerberus-commerce.io`,
        notes: `${s.storeName} ana operasyon mağazası`,
        totalOrdersCount: s.totalOrdersCount,
        totalSpend: s.totalSpend,
      }))
    );
  }

  // 3. Seed PSH Batches
  const existingBatches = await db.select({ total: count() }).from(pshBatches);
  if (Number(existingBatches[0]?.total || 0) === 0) {
    await db.insert(pshBatches).values(
      INITIAL_BATCHES.map((b) => ({
        batchNumber: b.batchNumber,
        storeCode: b.storeCode,
        title: b.title,
        status: b.status,
        totalItemsCount: b.totalItemsCount,
        totalUnitsCount: b.totalUnitsCount,
        receivedUnitsCount: b.receivedUnitsCount,
        missingUnitsCount: b.missingUnitsCount,
        defectiveUnitsCount: b.defectiveUnitsCount,
        inventoryLabSynced: b.inventoryLabSynced,
        notes: b.notes,
      }))
    );
  }

  // 4. Seed all 38 Real Orders from the XLS data if not yet present
  const existingCount = await db.select({ total: count() }).from(orders);
  if (Number(existingCount[0]?.total || 0) === 0) {
    await db.insert(orders).values(ALL_38_XLS_ORDERS as any);
  }

  // 5. Initial Audit Log
  const existingLogs = await db.select({ total: count() }).from(auditLogs);
  if (Number(existingLogs[0]?.total || 0) === 0) {
    await db.insert(auditLogs).values([
      {
        actorName: "Harun (HRN Store)",
        storeCode: "HRN",
        actionType: "XLS_BATCH_IMPORT",
        targetEntity: `HRN Master XLS (${ALL_38_XLS_ORDERS.length} Sipariş)`,
        beforeState: "GOOGLE_DRIVE_XLS",
        afterState: "CERBERUS_DATABASE",
        details:
          "Google Drive XLS tablosundaki 40 kolonlu gerçek siparişler aktarıldı. PSH ve Inventory Lab entegrasyonu sağlandı.",
      },
    ]);
  }
}
