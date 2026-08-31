import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// 1. Users table (Preserved users with password_hash, store assignment & role)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  // Varsayılan parola kaldırıldı (F-03/F-04): her kayıt açıkça bcrypt hash'iyle yazılmalı
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("STORE_USER"), // 'ADMIN' | 'MANAGER' | 'STORE_USER'
  storeCode: text("store_code").notNull().default("HRN"), // e.g. 'HRN', 'ALL' for admin
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 2. Stores Table (26 Multi-Store Fleet & Admin Management)
export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  storeCode: text("store_code").notNull().unique(), // e.g. 'HRN', 'SEL', 'MK', 'AMZ-US-01'
  storeName: text("store_name").notNull(), // e.g. 'HRN Amazon Storefront'
  marketplace: text("marketplace").notNull().default("AMAZON"), // 'AMAZON' | 'WALMART' | 'SHOPIFY' | 'WHOLESALE'
  buyerName: text("buyer_name").notNull().default("Harun"),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("ACTIVE"), // 'ACTIVE' | 'PASSIVE'
  defaultCard: text("default_card").default("1753"),
  defaultEmail: text("default_email"),
  notes: text("notes"),
  accountHealthScore: integer("account_health_score").notNull().default(98),
  totalOrdersCount: integer("total_orders_count").notNull().default(0),
  totalSpend: numeric("total_spend", { precision: 12, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. 10-Person US Sourcing Specialists (Quality-Adjusted Researcher Score)
export const researchers = pgTable("researchers", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // e.g. 'SRC-01'
  name: text("name").notNull(),
  email: text("email").notNull(),
  specialtyDomain: text("specialty_domain").notNull(), // e.g. 'Home Depot & Lowe's Clearance Arbitrage'
  discoveryVolume: integer("discovery_volume").notNull().default(0),
  approvalRate: numeric("approval_rate", { precision: 5, scale: 2 }).notNull().default("0.00"),
  purchaseConversion: numeric("purchase_conversion", { precision: 5, scale: 2 }).notNull().default("0.00"),
  averageRoi: numeric("average_roi", { precision: 6, scale: 2 }).notNull().default("0.00"),
  averageNetProfit: numeric("average_net_profit", { precision: 10, scale: 2 }).notNull().default("0.00"),
  problemRate: numeric("problem_rate", { precision: 5, scale: 2 }).notNull().default("0.00"),
  researcherScore: integer("researcher_score").notNull().default(85), // Quality-adjusted 0-100 score
  activeListingsCount: integer("active_listings_count").notNull().default(0),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 4. Research Sessions (Phase 5 Sourcing Engine Tracking)
export const researchSessions = pgTable("research_sessions", {
  id: serial("id").primaryKey(),
  sessionCode: text("session_code").notNull().unique(), // e.g. 'SES-2026-0827-01'
  researcherCode: text("researcher_code").notNull(),
  researcherName: text("researcher_name").notNull(),
  sourceDomain: text("source_domain").notNull(), // 'homedepot.com', 'ulta.com'
  productsFound: integer("products_found").notNull().default(0),
  productsApproved: integer("products_approved").notNull().default(0),
  sessionQualityScore: integer("session_quality_score").notNull().default(90),
  startedAt: timestamp("started_at").defaultNow().notNull(),
});

// 5. Product Master Decision Vault (Product ≠ Listing + Decision Engine + Evidence Chain)
export const productMasters = pgTable("product_masters", {
  id: serial("id").primaryKey(),
  productCode: text("product_code").notNull().unique(), // e.g. 'CRB-2026-9041'
  title: text("title").notNull(),
  brand: text("brand").notNull(),
  category: text("category").notNull(),
  upc: text("upc").notNull(),
  asin: text("asin").notNull(),
  msku: text("msku").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceDomain: text("source_domain").notNull(),
  supplierName: text("supplier_name").notNull(),
  researcherCode: text("researcher_code").notNull().default("SRC-01"),
  researcherName: text("researcher_name").notNull(),

  // 13-Stage Cerberus Lifecycle
  lifecycleStage: text("lifecycle_stage").notNull().default("APPROVED"),

  // Data Quality & Freshness Engine (Gap Phase 7 & 8)
  dataQualityStatus: text("data_quality_status").notNull().default("VALID"),
  // 'VALID' | 'INVALID' | 'MISSING' | 'STALE' | 'CONFLICTING'
  dataFreshnessStatus: text("data_freshness_status").notNull().default("FRESH"),
  // 'FRESH' | 'AGING' | 'STALE' | 'EXPIRED'
  observedAt: timestamp("observed_at").defaultNow().notNull(),

  // Commercial Decision Intelligence Engine (Gap Phase 12 & 13)
  decisionAction: text("decision_action").notNull().default("BUY"),
  // 'BUY' | 'TEST' | 'WAIT' | 'REJECT' | 'REPRICE' | 'REORDER' | 'PAUSE' | 'LIQUIDATE'
  confidenceScore: integer("confidence_score").notNull().default(88), // 0-100%
  riskLevel: text("risk_level").notNull().default("LOW"), // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  policyStatus: text("policy_status").notNull().default("APPROVED_BY_POLICY"),
  // 'APPROVED_BY_POLICY' | 'REQUIRES_MANAGER_APPROVAL' | 'FLAGGED_IP_RISK'

  // Landed Cost & Profitability
  sourcePrice: numeric("source_price", { precision: 10, scale: 2 }).notNull(),
  prepCost: numeric("prep_cost", { precision: 10, scale: 2 }).notNull().default("1.35"),
  marketplaceFee: numeric("marketplace_fee", { precision: 10, scale: 2 }).notNull().default("0.00"),
  fulfillmentFee: numeric("fulfillment_fee", { precision: 10, scale: 2 }).notNull().default("0.00"),
  landedCost: numeric("landed_cost", { precision: 10, scale: 2 }).notNull(),
  sellingPrice: numeric("selling_price", { precision: 10, scale: 2 }).notNull(),
  estimatedNetProfit: numeric("estimated_net_profit", { precision: 10, scale: 2 }).notNull(),
  roiPercent: numeric("roi_percent", { precision: 7, scale: 2 }).notNull(),
  actualRoiPercent: numeric("actual_roi_percent", { precision: 7, scale: 2 }), // Actual vs Estimated Engine

  // Duplicate Detection Score (0-100)
  duplicateScore: integer("duplicate_score").notNull().default(12),
  duplicateStatus: text("duplicate_status").notNull().default("CLEAR"),

  // AI Opportunity Radar Sub-Scores (0-100)
  profitabilityScore: integer("profitability_score").notNull().default(88),
  demandScore: integer("demand_score").notNull().default(92),
  competitionScore: integer("competition_score").notNull().default(78),
  priceStabilityScore: integer("price_stability_score").notNull().default(85),
  supplierRiskScore: integer("supplier_risk_score").notNull().default(94),
  operationalRiskScore: integer("operational_risk_score").notNull().default(90),
  opportunityScore: integer("opportunity_score").notNull().default(88),

  // Evidence Chain JSONB (Phase 30)
  evidenceChain: jsonb("evidence_chain").notNull().default([]),
  // Multi-Store channel allocations JSONB
  channelListings: jsonb("channel_listings").notNull().default([]),
  // Cost & Price History JSONB
  costHistory: jsonb("cost_history").notNull().default([]),

  notes: text("notes"),
  discoveredAt: timestamp("discovered_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 6. Orders Master Table (Exact 40-Column Google Drive XLS Structure + PSH & Inventory Lab)
export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),

    // Kolon 1-5: Temel & Amazon Kimlikleri
    // T2.2: Mağaza referansı artık FK ile DB seviyesinde zorlanır
    buyerStore: text("buyer_store")
      .notNull()
      .default("HRN")
      .references(() => stores.storeCode), // 1. Satın Alan (HRN vb.)
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
  // T2.2: Batch referansı FK ile zorlanır (nullable — batch'e bağlanmamış sipariş olabilir)
  pshBatchNo: text("psh_batch_no").references(() => pshBatches.batchNumber), // PSH Batch Numarası (ör: BATCH-2026-01)
  pshStatus: text("psh_status").notNull().default("BEKLIYOR"), // 'BEKLIYOR' | 'BATCH_OLUSTURULDU' | 'DEPO_SAYILDI' | 'AMAZONA_SEVK'
  inventoryLabStatus: text("inventory_lab_status").notNull().default("GIRILMEDI"), // 'GIRILMEDI' | 'GIRILDI' | 'AKTIF_SATISTA'

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
},
// T2.3: Sorgu desenlerine gore indexler + mukerrer import engeli
(t) => [
  uniqueIndex("orders_order_number_store_uq").on(t.orderNumber, t.buyerStore),
  index("orders_buyer_store_date_idx").on(t.buyerStore, t.orderDate),
  index("orders_asin_idx").on(t.asin),
]);

// 7. PSH Batch Master Table (PSH Programı Ön-Envanter Gruplama)
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

// 8. Audit Log (Değiştirilemez Denetim İzi & AI Kanıt Zinciri)
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorName: text("actor_name").notNull(),
  storeCode: text("store_code").notNull().default("HRN"),
  actionType: text("action_type").notNull(), // 'DECISION_APPROVED' | 'ORDER_CREATED' | 'XLS_BATCH_IMPORT' | 'STORE_CREATED'
  targetEntity: text("target_entity").notNull(),
  beforeState: text("before_state"),
  afterState: text("after_state"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type Researcher = typeof researchers.$inferSelect;
export type ResearchSession = typeof researchSessions.$inferSelect;
export type ProductMaster = typeof productMasters.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type PshBatch = typeof pshBatches.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
