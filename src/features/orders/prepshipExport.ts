import { isCancelledStatus } from "@/domain/sat26Hygiene";

/**
 * PrepShip "LoadData" toplu yükleme şablonu — GERÇEK ŞABLON.
 *
 * Denetim raporu §14: kullanıcının paylaştığı gerçek PrepShip şablonundan
 * (`15_Subat_Vs.xlsx`, sayfa "LoadData") alındı. Bu, kullanıcının bugün
 * PrepShip'e ELLE tek tek girdiği batch açma adımının yerini alır —
 * CERBERUS'taki bir PSH batch'i doğrudan bu 24 kolonlu dosyaya döker,
 * kullanıcı yalnızca PrepShip'e yükler.
 *
 * Kolon ↔ CERBERUS eşlemesi (PrepShip'in "Instructions" sayfasından ve
 * gerçek örnek satırlardan doğrulandı):
 * - Action ↔ orders.fulfillmentType (PrepShip'in "Lookup" sayfasındaki
 *   Actions listesi FBA/FBM/RETURN/REMOVAL_ORDER dahil DROPSHIP/DELIVERR/
 *   WFS/FORWARDING/STORAGE'ı da içeriyor — CERBERUS şu an yalnızca
 *   kullanıcının teyit ettiği 4 değeri destekliyor, bkz. §14 açık bulgu).
 * - ManufactureOrSupplier ↔ orders.supplierCode (örnekte "A198" vb.)
 * - Fragile/MultiPack/Bundle zaten "YES"/"NO" metniyle tutuluyor — birebir.
 * - NumberOfUnits ↔ orders.quantity (PrepShip: "sellable" adet, bundle/
 *   multipack içindeki tekil parça sayısı değil — CERBERUS'ta zaten böyle).
 * - PalletId, TrackingNumber, OrderNumberSold, SerialNo, FNSKU, UPC,
 *   ProductGroup CERBERUS'ta karşılığı olmayan alanlar — boş bırakılır,
 *   depo bu dosyayı PrepShip'e yükledikten sonra kendi tarafında doldurur.
 */
export const PREPSHIP_LOADDATA_COLUMNS = [
  "TrackingNumber",
  "OrderNumber",
  "OrderNumberSold",
  "PalletId",
  "ShipmentDate",
  "ExpirationDate",
  "ASIN",
  "MSKU",
  "UPC",
  "FNSKU",
  "SerialNo",
  "ProductTitle",
  "ManufactureOrSupplier",
  "ProductGroup",
  "NumberOfUnits",
  "Condition",
  "Cost",
  "SalePrice",
  "Fragile",
  "MultiPack",
  "Bundle",
  "CountPerBundle",
  "Action",
  "Notes",
] as const;

export interface PrepShipExportOrder {
  orderNumber: string;
  orderDate: Date | string | null;
  asin: string;
  msku: string;
  productTitle: string;
  supplierCode: string | null;
  quantity: number | string | null;
  condition: string | null;
  unitCost: number | string | null;
  sellingPrice: number | string | null;
  isFragile: string | null;
  isMultiPack: string | null;
  isBundle: string | null;
  countPerBundle: number | string | null;
  fulfillmentType: string | null;
  description1: string | null;
  /** İptal kuralı için (R2). Verilmezse satır iptal edilmemiş sayılır. */
  cargoStatus?: string | null;
  p1CancelQty?: number | string | null;
}

export interface ExcludedPrepShipOrder {
  orderNumber: string;
  asin: string;
  reason: "CANCELLED" | "NO_UNITS_LEFT";
}

/** Denetim bulgusu R2: İPTAL satırlar PrepShip'e gitmemeli. Kısmi iptalde adet düşülür. */
export function splitPrepShipExportable<T extends PrepShipExportOrder>(
  batchOrders: T[]
): { included: (T & { exportUnits: number })[]; excluded: ExcludedPrepShipOrder[] } {
  const included: (T & { exportUnits: number })[] = [];
  const excluded: ExcludedPrepShipOrder[] = [];
  for (const o of batchOrders) {
    if (isCancelledStatus(o.cargoStatus)) {
      excluded.push({ orderNumber: o.orderNumber, asin: o.asin, reason: "CANCELLED" });
      continue;
    }
    const units = (Number(o.quantity) || 1) - (Number(o.p1CancelQty) || 0);
    if (units <= 0) {
      excluded.push({ orderNumber: o.orderNumber, asin: o.asin, reason: "NO_UNITS_LEFT" });
      continue;
    }
    included.push({ ...o, exportUnits: units });
  }
  return { included, excluded };
}

const round2 = (v: number | string | null): number | string =>
  v === null || v === "" ? "" : Math.round((Number(v) + Number.EPSILON) * 100) / 100;

function toDateOnly(value: Date | string | null): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : "";
  return d.toISOString().split("T")[0];
}

/** PrepShip'e yüklenecek satır dizisi — .xlsx üretimi için XLSX.utils.aoa_to_sheet'e verilir. */
export function buildPrepShipLoadDataRows(allOrders: PrepShipExportOrder[]): (string | number)[][] {
  const header = [...PREPSHIP_LOADDATA_COLUMNS];
  const { included } = splitPrepShipExportable(allOrders);
  const rows = included.map((o) => [
    "", // TrackingNumber — henüz kargo bilgisi yok, depo dolduracak
    o.orderNumber,
    "", // OrderNumberSold — yalnızca satılan ürünler için
    "", // PalletId — CERBERUS'ta izlenmiyor, depo dolduracak
    toDateOnly(o.orderDate),
    "", // ExpirationDate
    o.asin,
    o.msku,
    "", // UPC
    "", // FNSKU
    "", // SerialNo
    o.productTitle,
    o.supplierCode || "",
    "", // ProductGroup
    o.exportUnits,
    o.condition || "New",
    round2(o.unitCost ?? null),
    round2(o.sellingPrice ?? null),
    (o.isFragile || "NO").toUpperCase(),
    (o.isMultiPack || "NO").toUpperCase(),
    (o.isBundle || "NO").toUpperCase(),
    o.countPerBundle ?? "",
    o.fulfillmentType || "FBA",
    o.description1 || "",
  ]);
  return [header, ...rows];
}
