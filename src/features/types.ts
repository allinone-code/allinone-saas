/**
 * T8.3 — Paylaşılan görünüm tipleri.
 * Önceki sürümde tüm UI state'i `any[]` idi; alan adı yanlış yazıldığında
 * derleyici uyarmıyor, ekranda sessizce `undefined` görünüyordu.
 */

export type Role = "ADMIN" | "MANAGER" | "STORE_USER";

export interface SessionUserView {
  id: number;
  name: string;
  email: string;
  role: Role;
  storeCode: string;
  avatar?: string | null;
}

export interface StoreView {
  id: number;
  storeCode: string;
  storeName: string;
  marketplace: string;
  status: string;
  accountHealthScore: number;
}

export interface OrderView {
  id: number;
  buyerStore: string;
  orderDate: string;
  imageUrl?: string | null;
  fulfillmentType: string;
  productTitle: string;
  asin: string;
  msku: string;
  supplierName: string;
  supplierCode?: string | null;
  supplierUrl: string;
  amazonUrl: string;
  orderNumber: string;
  driveLink?: string | null;
  packCount: number;
  quantity: number;
  unitCost: string;
  sellingPrice: string;
  totalCost: string;
  orderEmail: string;
  cargoStatus: string;
  shippedToAmazon: number;
  p1CancelQty: number;
  p2MissingQty: number;
  p3DefectiveQty: number;
  p4ExpiredQty: number;
  problemAction?: string | null;
  problemResult?: string | null;
  refundAmount: string;
  creditCard?: string | null;
  isFragile: string;
  isMultiPack: string;
  isBundle: string;
  countPerBundle?: number | null;
  condition: string;
  brandName: string;
  description1?: string | null;
  description2?: string | null;
  auditNote?: string | null;
  periodCode?: string | null;
  correctedCost: string;
  pshBatchNo?: string | null;
  pshStatus: string;
  inventoryLabStatus: string;
}

export interface BatchView {
  id: number;
  batchNumber: string;
  storeCode: string;
  title: string;
  status: string;
  notes?: string | null;
  inventoryLabSynced: boolean;
}

export interface ProductMasterView {
  id: number;
  productCode: string;
  title: string;
  brand: string;
  asin: string;
  upc: string;
  researcherName: string;
  dataFreshnessStatus: string;
  dataQualityStatus: string;
  landedCost: string;
  sellingPrice: string;
  roiPercent: string;
  actualRoiPercent?: string | null;
  opportunityScore: number;
  decisionAction: string;
  confidenceScore: number;
}

export interface ResearcherView {
  id: number;
  code: string;
  name: string;
  specialtyDomain: string;
  discoveryVolume: number;
  approvalRate: string;
  averageRoi: string;
  averageNetProfit: string;
  problemRate: string;
  researcherScore: number;
  activeListingsCount: number;
  avatar?: string | null;
}

export interface BriefingItemView {
  text: string;
  metric: string;
  severity: "INFO" | "WARN" | "CRITICAL";
}

export interface HealthBreakdownView {
  axis: string;
  weight: number;
  score: number;
  detail: string;
}

export interface MorningBriefingView {
  businessHealthScore: number;
  healthGrade: string;
  healthBreakdown: HealthBreakdownView[];
  whatChanged: BriefingItemView[];
  whatMatters: BriefingItemView[];
  whatShouldIDo: BriefingItemView[];
  sampleSize: number;
  generatedAt: string;
}

export type TabId =
  | "BRIEFING_DECISION"
  | "RESEARCHERS"
  | "XLS_MASTER"
  | "PSH_BATCHES"
  | "WAREHOUSE"
  | "INVENTORY_LAB"
  | "PROBLEMS"
  | "ADMIN";

export interface OrderKpis {
  totalOrders: number;
  totalUnits: number;
  totalSpend: string;
  totalShipped: number;
  totalRevenueEst: string;
  grossNetEst: string;
  avgRoi: string;
  fulfillmentRate: number;
  problemCount: number;
  totalRefunds: string;
}

/** Bir siparişin P1–P4 / iptal / refund açısından problemli olup olmadığı — tek doğruluk kaynağı */
export function isProblemOrder(o: OrderView): boolean {
  return (
    o.cargoStatus === "İPTAL" ||
    Number(o.p1CancelQty) > 0 ||
    Number(o.p2MissingQty) > 0 ||
    Number(o.p3DefectiveQty) > 0 ||
    Number(o.p4ExpiredQty) > 0 ||
    Number(o.refundAmount) > 0
  );
}
