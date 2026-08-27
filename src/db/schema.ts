import { boolean, integer, numeric, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const productStatus = pgEnum("product_status", [
  "discovered", "screening", "analyzing", "review", "approved", "purchasing", "received", "listing", "active", "paused", "discontinued", "rejected",
]);
export const discoveryMethod = pgEnum("discovery_method", ["manual", "extension", "import"]);
export const userRole = pgEnum("user_role", ["admin", "manager", "researcher", "analyst"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 180 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("researcher"),
  initials: varchar("initials", { length: 4 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  domain: varchar("domain", { length: 180 }).notNull(),
  score: integer("score").notNull().default(70),
  reliability: integer("reliability").notNull().default(80),
  activeProducts: integer("active_products").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 240 }).notNull(),
  brand: varchar("brand", { length: 120 }).notNull(),
  category: varchar("category", { length: 120 }).notNull(),
  identifier: varchar("identifier", { length: 80 }),
  imageUrl: text("image_url"),
  status: productStatus("status").notNull().default("discovered"),
  targetPrice: numeric("target_price", { precision: 12, scale: 2 }).notNull(),
  estimatedProfit: numeric("estimated_profit", { precision: 12, scale: 2 }).notNull(),
  roi: numeric("roi", { precision: 8, scale: 2 }).notNull(),
  opportunityScore: integer("opportunity_score").notNull().default(50),
  riskLevel: varchar("risk_level", { length: 20 }).notNull().default("low"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const discoveries = pgTable("product_discoveries", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  researcherId: integer("researcher_id").notNull().references(() => users.id),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  sourceUrl: text("source_url").notNull(),
  sourceDomain: varchar("source_domain", { length: 180 }).notNull(),
  sourcePrice: numeric("source_price", { precision: 12, scale: 2 }).notNull(),
  shipping: numeric("shipping", { precision: 12, scale: 2 }).notNull().default("0"),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  notes: text("notes"),
  method: discoveryMethod("method").notNull().default("manual"),
  duplicateScore: integer("duplicate_score").notNull().default(0),
  flagged: boolean("flagged").notNull().default(false),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("discovery_product_source_idx").on(table.productId, table.sourceUrl)]);

export const activity = pgTable("activity", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 80 }).notNull(),
  detail: text("detail").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Product = typeof products.$inferSelect;
export type Discovery = typeof discoveries.$inferSelect;
