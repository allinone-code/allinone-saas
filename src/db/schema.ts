import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

// 1. Users table (Preserved users with store assignment & role)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("STORE_USER"), // 'ADMIN' | 'MANAGER' | 'STORE_USER'
  storeCode: text("store_code").default("HRN"), // e.g. 'HRN', 'ALL' for admin
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 2. Stores Table (Multi-Store Isolation)
export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  storeCode: text("store_code").notNull().unique(), // e.g. 'HRN', 'SEL', 'MK', 'AMZ-US-01'
  storeName: text("store_name").notNull(), // e.g. 'HRN Amazon Storefront'
  marketplace: text("marketplace").notNull().default("AMAZON"), // 'AMAZON' | 'WALMART' | 'SHOPIFY' | 'WHOLESALE'
  buyerName: text("buyer_name").notNull().default("Harun"),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("ACTIVE"), // 'ACTIVE' | 'PASSIVE'
  totalOrdersCount: integer("total_orders_count").notNull().default(0),
  totalSpend: numeric("total_spend", { precision: 12, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. Orders Master Table (Exact 40-Column Google Drive XLS Structure + PSH & Inventory Lab)
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),

  // Kolon 1-5: Temel & Amazon Kimlikleri
  buyerStore: text("buyer_store").notNull().default("HRN"), // 1. Satın Alan (HRN vb.)
  orderDate: text("order_date").notNull(), // 2. Tarih (YYYY-MM-DD)
  imageUrl: text("image_url"), // 3. Ürün resmi linki
  fulfillmentType: text("fulfillment_type").notNull().default("FBA"), // 4. FBM/FBA
  productTitle: text("product_title").notNull(), // 5. Ürün adı Amazon

  // Kolon 6-11: ASIN, MSKU, Tedarikçi & Linkler
  asin: text("asin").notNull(), // 6. ASIN
  msku: text("msku").notNull(), // 7. MSKU
  supplierName: text("supplier_name").notNull(), // 8. Satıcı adı (THE VITAMINSHOPPE vb.)
  supplierCode: text("supplier_code").default("A198"), // 9. Satıcı kodu
  supplierUrl: text("supplier_url").notNull(), // 10. Satıcı link
  amazonUrl: text("amazon_url").notNull(), // 11. Amazon link

  // Kolon 12-14: Sipariş No, Drive, Paket
  orderNumber: text("order_number").notNull(), // 12. Orderno (WO110074776 vb.)
  driveLink: text("drive_link"), // 13. Order'ın drive linki
  packCount: integer("pack_count").notNull().default(1), // 14. Kaçlı paket

  // Kolon 15-18: Miktarlar ve Finans
  quantity: integer("quantity").notNull().default(1), // 15. Ürün adedi
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }).notNull(), // 16. Ürün birim maliyeti ($)
  sellingPrice: numeric("selling_price", { precision: 10, scale: 2 }).notNull(), // 17. Ürün satış fiyatı ($)
  totalCost: numeric("total_cost", { precision: 12, scale: 2 }).notNull(), // 18. Ürün toplam maliyeti ($)

  // Kolon 19-21: Sipariş Maili, Kargo & Gönderim
  orderEmail: text("order_email").notNull(), // 19. Mail adresi (cerberusnisan@gmail.com vb.)
  cargoStatus: text("cargo_status").notNull().default("Yolda"), // 20. Kargo durumu ('İPTAL', 'Tam Geldi', 'Kayıp Depoya gelmiş', 'Yolda')
  shippedToAmazon: integer("shipped_to_amazon").notNull().default(0), // 21. Amazona gönderilen adet

  // Kolon 22-28: P1-P4 Fire / Problem Yönetimi
  p1CancelQty: integer("p1_cancel_qty").notNull().default(0), // 22. İptal adet-P1
  p2MissingQty: integer("p2_missing_qty").notNull().default(0), // 23. Eksik adet-P2
  p3DefectiveQty: integer("p3_defective_qty").notNull().default(0), // 24. Defolu adet-P3
  p4ExpiredQty: integer("p4_expired_qty").notNull().default(0), // 25. Tarihi geçmiş adet-P4
  problemAction: text("problem_action"), // 26. Problemle ilgili eylem
  problemResult: text("problem_result"), // 27. Problemle ilgili sonuç
  refundAmount: numeric("refund_amount", { precision: 10, scale: 2 }).notNull().default("0.00"), // 28. Refund miktarı (R kodlu)

  // Kolon 29-35: Kredi Kartı ve Ürün Nitelikleri
  creditCard: text("credit_card").default("1753"), // 29. Kredi Kartı son 4 hane
  isFragile: text("is_fragile").notNull().default("NO"), // 30. Fragile (YES/NO)
  isMultiPack: text("is_multipack").notNull().default("NO"), // 31. MultiPack (YES/NO)
  isBundle: text("is_bundle").notNull().default("NO"), // 32. Bundle (YES/NO)
  countPerBundle: integer("count_per_bundle"), // 33. CountPerBundle
  condition: text("condition").notNull().default("New"), // 34. Condition (New)
  brandName: text("brand_name").notNull(), // 35. Marka adı (MegaFood, Vital, FORCE vb.)

  // Kolon 36-40: Açıklamalar, Takip ve Denetim
  description1: text("description_1"), // 36. Ürünle ilgili açıklama1
  description2: text("description_2"), // 37. Ürünle ilgili açıklama2 (Tracking linki / Kargo takip no)
  auditNote: text("audit_note"), // 38. Denetim için açıklama (Depoda kayıp vb.)
  periodCode: text("period_code").default("O26"), // 39. Tarih2 / Dönem kodu (O26, Ş26 vb.)
  correctedCost: numeric("corrected_cost", { precision: 12, scale: 2 }).notNull(), // 40. Düzeltilmiş maliyet

  // PSH & Envanter Takip Entegrasyon Alanları
  pshBatchNo: text("psh_batch_no"), // PSH Batch Numarası (ör: BATCH-2026-01)
  pshStatus: text("psh_status").notNull().default("BEKLIYOR"), // 'BEKLIYOR' | 'BATCH_OLUSTURULDU' | 'DEPO_SAYILDI' | 'AMAZONA_SEVK'
  inventoryLabStatus: text("inventory_lab_status").notNull().default("GIRILMEDI"), // 'GIRILMEDI' | 'GIRILDI' | 'AKTIF_SATISTA'

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 4. PSH Batch Master Table (PSH Programı Ön-Envanter Gruplama)
export const pshBatches = pgTable("psh_batches", {
  id: serial("id").primaryKey(),
  batchNumber: text("batch_number").notNull().unique(), // e.g. 'PSH-2026-01-21'
  storeCode: text("store_code").notNull().default("HRN"),
  title: text("title").notNull(), // e.g. 'Ocak 2026 Vitamin Shoppe FBA Sevkiyatı'
  status: text("status").notNull().default("HAZIRLANIYOR"), // 'HAZIRLANIYOR' | 'DEPODA' | 'SAYILDI' | 'AMAZONA_GONDERILDI'
  totalItemsCount: integer("total_items_count").notNull().default(0),
  totalUnitsCount: integer("total_units_count").notNull().default(0),
  receivedUnitsCount: integer("received_units_count").notNull().default(0),
  missingUnitsCount: integer("missing_units_count").notNull().default(0),
  defectiveUnitsCount: integer("defective_units_count").notNull().default(0),
  inventoryLabSynced: boolean("inventory_lab_synced").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 5. Audit Log (İşlem Denetim İzi)
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorName: text("actor_name").notNull(),
  storeCode: text("store_code").notNull().default("HRN"),
  actionType: text("action_type").notNull(), // 'ORDER_CREATED' | 'CARGO_STATUS_CHANGED' | 'PSH_BATCH_ASSIGNED' | 'PROBLEM_REPORTED'
  targetEntity: text("target_entity").notNull(), // e.g. 'WO110074776 (MegaFood)'
  beforeState: text("before_state"),
  afterState: text("after_state"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type PshBatch = typeof pshBatches.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
