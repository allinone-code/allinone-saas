import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("MANAGER"), // 'MANAGER' | 'LEAD_SOURCER' | 'RESEARCHER'
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const researchers = pgTable("researchers", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // e.g. 'SRC-01'
  name: text("name").notNull(),
  email: text("email").notNull(),
  specialtyDomain: text("specialty_domain").notNull(), // e.g. 'US Retail Arbitrage / Home Depot & Target'
  discoveryVolume: integer("discovery_volume").notNull().default(0),
  approvalRate: numeric("approval_rate", { precision: 5, scale: 2 }).notNull().default("0.00"),
  purchaseConversion: numeric("purchase_conversion", { precision: 5, scale: 2 }).notNull().default("0.00"),
  averageRoi: numeric("average_roi", { precision: 6, scale: 2 }).notNull().default("0.00"),
  averageNetProfit: numeric("average_net_profit", { precision: 10, scale: 2 }).notNull().default("0.00"),
  problemRate: numeric("problem_rate", { precision: 5, scale: 2 }).notNull().default("0.00"),
  researcherScore: integer("researcher_score").notNull().default(85), // out of 100
  activeListingsCount: integer("active_listings_count").notNull().default(0),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  storeCode: text("store_code").notNull().unique(), // e.g. 'AMZ-US-01'
  storeName: text("store_name").notNull(), // e.g. 'Apex Frontier Amazon US #01'
  marketplace: text("marketplace").notNull(), // 'AMAZON' | 'WALMART' | 'SHOPIFY' | 'WHOLESALE'
  region: text("region").notNull().default("US"),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("ACTIVE"), // 'ACTIVE' | 'WARNING' | 'SUSPENDED'
  activeListings: integer("active_listings").notNull().default(0),
  monthlyGrossRevenue: numeric("monthly_gross_revenue", { precision: 12, scale: 2 }).notNull().default("0.00"),
  monthlyNetProfit: numeric("monthly_net_profit", { precision: 12, scale: 2 }).notNull().default("0.00"),
  accountHealthScore: integer("account_health_score").notNull().default(98),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  supplierCode: text("supplier_code").notNull().unique(), // e.g. 'SUP-HD-US'
  name: text("name").notNull(),
  website: text("website").notNull(),
  country: text("country").notNull().default("USA"),
  supplierScore: integer("supplier_score").notNull().default(88), // 0-100 composite
  priceStabilityScore: integer("price_stability_score").notNull().default(85),
  stockReliabilityScore: integer("stock_reliability_score").notNull().default(90),
  deliveryReliabilityScore: integer("delivery_reliability_score").notNull().default(92),
  returnRatePercent: numeric("return_rate_percent", { precision: 5, scale: 2 }).notNull().default("1.80"),
  totalProductsSourced: integer("total_products_sourced").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productDiscoveries = pgTable("product_discoveries", {
  id: serial("id").primaryKey(),
  productCode: text("product_code").notNull().unique(), // e.g. 'CRB-2026-8941'
  title: text("title").notNull(),
  brand: text("brand").notNull(),
  category: text("category").notNull(),
  upc: text("upc").notNull(),
  asin: text("asin").notNull(),
  msku: text("msku").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceDomain: text("source_domain").notNull(), // e.g. 'homedepot.com', 'bestbuy.com'
  supplierId: integer("supplier_id"),
  supplierName: text("supplier_name").notNull(),
  researcherId: integer("researcher_id"),
  researcherName: text("researcher_name").notNull(),

  // 13-stage Cerberus Lifecycle
  lifecycleStage: text("lifecycle_stage").notNull().default("DISCOVERED"),
  // 'DISCOVERED' | 'SCREENING' | 'DUPLICATE_CHECK' | 'ANALYZING' | 'REVIEW' | 'APPROVED' | 'PURCHASING' | 'RECEIVED' | 'LISTING' | 'ACTIVE' | 'MONITORING' | 'PAUSED' | 'DISCONTINUED'

  // Landed Cost & Profitability Engine
  sourcePrice: numeric("source_price", { precision: 10, scale: 2 }).notNull(),
  sourceShipping: numeric("source_shipping", { precision: 10, scale: 2 }).notNull().default("0.00"),
  intlShipping: numeric("intl_shipping", { precision: 10, scale: 2 }).notNull().default("0.00"),
  prepCost: numeric("prep_cost", { precision: 10, scale: 2 }).notNull().default("1.25"),
  marketplaceFee: numeric("marketplace_fee", { precision: 10, scale: 2 }).notNull().default("0.00"),
  fulfillmentFee: numeric("fulfillment_fee", { precision: 10, scale: 2 }).notNull().default("0.00"),
  otherCost: numeric("other_cost", { precision: 10, scale: 2 }).notNull().default("0.00"),
  landedCost: numeric("landed_cost", { precision: 10, scale: 2 }).notNull(),

  sellingPrice: numeric("selling_price", { precision: 10, scale: 2 }).notNull(),
  estimatedNetProfit: numeric("estimated_net_profit", { precision: 10, scale: 2 }).notNull(),
  roiPercent: numeric("roi_percent", { precision: 7, scale: 2 }).notNull(),
  monthlyEstimatedUnits: integer("monthly_estimated_units").notNull().default(45),

  // Duplicate Detection Engine
  duplicateScore: integer("duplicate_score").notNull().default(12), // 0-100
  duplicateStatus: text("duplicate_status").notNull().default("CLEAR"),
  // 'CLEAR' | 'POSSIBLE_MATCH' | 'REVIEW_REQUIRED' | 'EXACT_DUPLICATE'
  matchedProductCode: text("matched_product_code"),

  // AI Opportunity Radar Sub-Scores (0-100)
  profitabilityScore: integer("profitability_score").notNull().default(85),
  demandScore: integer("demand_score").notNull().default(80),
  competitionScore: integer("competition_score").notNull().default(75),
  priceStabilityScore: integer("price_stability_score").notNull().default(82),
  supplierRiskScore: integer("supplier_risk_score").notNull().default(90),
  operationalRiskScore: integer("operational_risk_score").notNull().default(88),
  opportunityScore: integer("opportunity_score").notNull().default(84), // weighted overall
  aiRecommendation: text("ai_recommendation").notNull().default("HIGH_MARGIN_SCALER"),
  aiAnalysisNotes: text("ai_analysis_notes"),

  // Multi-Store channel allocations JSON
  channelListings: jsonb("channel_listings").notNull().default([]),
  // e.g. [{ storeCode: "AMZ-US-01", price: 54.99, status: "ACTIVE", stock: 120 }]

  // Cost & Price History JSON
  costHistory: jsonb("cost_history").notNull().default([]),
  // e.g. [{ date: "2026-02-01", sourcePrice: 19.50, landedCost: 28.15, sellingPrice: 54.99, roi: 95.3 }]

  notes: text("notes"),
  discoveredAt: timestamp("discovered_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const problems = pgTable("problems", {
  id: serial("id").primaryKey(),
  problemCode: text("problem_code").notNull().unique(), // e.g. 'P1-AMZ-089'
  severity: text("severity").notNull(), // 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM' | 'P4_LOW'
  problemType: text("problem_type").notNull(), // 'PRICE_CHANGE' | 'COST_CHANGE' | 'LOW_MARGIN' | 'ACCOUNT_ALERT' | 'SUPPLIER_PRICE_INCREASE' | 'OUT_OF_STOCK'
  storeCode: text("store_code").notNull(),
  storeName: text("store_name").notNull(),
  productCode: text("product_code"),
  productTitle: text("product_title").notNull(),
  status: text("status").notNull().default("OPEN"), // 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED'
  financialImpact: numeric("financial_impact", { precision: 10, scale: 2 }).notNull().default("0.00"),
  rootCause: text("root_cause").notNull(),
  actionTaken: text("action_taken"),
  assignedTo: text("assigned_to").notNull(),
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorName: text("actor_name").notNull(),
  actorRole: text("actor_role").notNull(),
  actionType: text("action_type").notNull(), // 'STAGE_TRANSITION' | 'PRODUCT_DISCOVERY' | 'PRICE_UPDATE' | 'PROBLEM_RESOLVED' | 'XLS_IMPORT'
  targetEntity: text("target_entity").notNull(), // e.g. 'CRB-2026-8941'
  beforeState: text("before_state"),
  afterState: text("after_state"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type Researcher = typeof researchers.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type ProductDiscovery = typeof productDiscoveries.$inferSelect;
export type NewProductDiscovery = typeof productDiscoveries.$inferInsert;
export type Problem = typeof problems.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
