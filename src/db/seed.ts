import { db } from "@/db";
import { users, stores, orders, pshBatches, auditLogs } from "@/db/schema";
import { count } from "drizzle-orm";
import { ALL_38_XLS_ORDERS, INITIAL_STORES, INITIAL_BATCHES } from "@/lib/mockData";

export async function ensureCerberusSeeded() {
  const existingCount = await db.select({ total: count() }).from(orders);
  if (Number(existingCount[0]?.total || 0) >= 30) {
    return;
  }

  // Clear existing dummy orders if fewer to ensure complete 38 rows
  if (Number(existingCount[0]?.total || 0) > 0) {
    await db.delete(orders);
  }

  // 1. Ensure users exist
  const existingUsers = await db.select({ total: count() }).from(users);
  if (Number(existingUsers[0]?.total || 0) === 0) {
    await db.insert(users).values([
      {
        name: "Ahmet Erdem",
        email: "ahmet@cerberus-commerce.io",
        role: "ADMIN",
        storeCode: "ALL",
        avatar: "AE",
      },
      {
        name: "Harun (HRN Store)",
        email: "harun@cerberus-commerce.io",
        role: "STORE_USER",
        storeCode: "HRN",
        avatar: "HRN",
      },
      {
        name: "Selin Yılmaz (SEL Store)",
        email: "selin@cerberus-commerce.io",
        role: "STORE_USER",
        storeCode: "SEL",
        avatar: "SY",
      },
      {
        name: "Can Demir (MK Store)",
        email: "can@cerberus-commerce.io",
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

  // 4. Seed all 38 Real Orders from the XLS data
  await db.insert(orders).values(ALL_38_XLS_ORDERS as any);

  // 5. Initial Audit Log
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
