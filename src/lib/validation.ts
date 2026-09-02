import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_JSON_BODY_BYTES } from "@/lib/apiResponse";

/**
 * Merkezi gövde doğrulama (T3.1/T3.4).
 * - İstek boyutu content-length üzerinden ön kontrol edilir (413)
 * - JSON parse hatası -> 400, zod ihlali -> 422 (alan bazlı ilk 5 sorun)
 */
export async function parseBody<S extends z.ZodType>(
  req: Request,
  schema: S,
  maxBytes: number = MAX_JSON_BODY_BYTES
): Promise<{ data: z.output<S> } | { response: NextResponse }> {
  const contentLength = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    const limitMb = Math.round(maxBytes / (1024 * 1024));
    const response = NextResponse.json(
      { error: `İstek gövdesi çok büyük (üst sınır ${limitMb} MB).` },
      { status: 413 }
    );
    return { response };
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      response: NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 5).map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    return {
      response: NextResponse.json(
        { error: "Girdi doğrulaması başarısız.", details: issues },
        { status: 422 }
      ),
    };
  }
  return { data: parsed.data };
}

/* ---------------------------------- Şemalar ---------------------------------- */

const shortText = (max: number) => z.string().trim().max(max);
const money = z.coerce.number().min(0).max(10_000_000);
const countInt = z.coerce.number().int().min(0).max(100_000);
const moneyStr = money.transform((n) => n.toFixed(2));
const yesNo = z.enum(["YES", "NO"]).default("NO");
const emailStr = z.string().trim().toLowerCase().email().max(254);

export const loginSchema = z.object({
  email: emailStr,
  password: z.string().min(1).max(128),
});

export const orderCreateSchema = z.object({
  buyerStore: shortText(32).optional(),
  orderDate: shortText(16).optional(),
  imageUrl: shortText(1000).optional(),
  fulfillmentType: z.enum(["FBA", "FBM" ]).default("FBA"),
  productTitle: shortText(500).min(1, "Ürün adı zorunludur"),
  asin: shortText(20).min(1, "ASIN zorunludur"),
  msku: shortText(64).optional(),
  supplierName: shortText(200).optional(),
  supplierCode: shortText(32).optional(),
  supplierUrl: shortText(1000).optional(),
  amazonUrl: shortText(1000).optional(),
  orderNumber: shortText(64).min(1, "Sipariş No zorunludur"),
  driveLink: shortText(1000).optional(),
  packCount: countInt.optional(),
  quantity: countInt.optional(),
  unitCost: money.optional(),
  sellingPrice: money.optional(),
  totalCost: money.optional(),
  orderEmail: shortText(254).optional(),
  cargoStatus: shortText(60).optional(),
  shippedToAmazon: countInt.optional(),
  p1CancelQty: countInt.optional(),
  p2MissingQty: countInt.optional(),
  p3DefectiveQty: countInt.optional(),
  p4ExpiredQty: countInt.optional(),
  problemAction: shortText(1000).optional(),
  problemResult: shortText(1000).optional(),
  refundAmount: money.optional(),
  creditCard: shortText(8).optional(),
  isFragile: yesNo.optional(),
  isMultiPack: yesNo.optional(),
  isBundle: yesNo.optional(),
  condition: shortText(40).optional(),
  brandName: shortText(120).optional(),
  description1: shortText(2000).optional(),
  description2: shortText(2000).optional(),
  auditNote: shortText(2000).optional(),
  periodCode: shortText(16).optional(),
  correctedCost: money.optional(),
  pshBatchNo: shortText(64).nullable().optional(),
  pshStatus: shortText(40).optional(),
  inventoryLabStatus: shortText(40).optional(),
  actorName: shortText(120).optional(), // geriye dönük uyumluluk; sunucu oturum adını kullanır
});

export const orderUpdateSchema = z
  .object({
    cargoStatus: shortText(60).optional(),
    shippedToAmazon: countInt.optional(),
    p1CancelQty: countInt.optional(),
    p2MissingQty: countInt.optional(),
    p3DefectiveQty: countInt.optional(),
    p4ExpiredQty: countInt.optional(),
    problemAction: shortText(1000).optional(),
    problemResult: shortText(1000).optional(),
    refundAmount: moneyStr.optional(),
    pshBatchNo: shortText(64).nullable().optional(),
    pshStatus: shortText(40).optional(),
    inventoryLabStatus: shortText(40).optional(),
    description1: shortText(2000).optional(),
    description2: shortText(2000).optional(),
    auditNote: shortText(2000).optional(),
    driveLink: shortText(1000).optional(),
    sellingPrice: moneyStr.optional(),
    unitCost: moneyStr.optional(),
    quantity: countInt.optional(),
    totalCost: moneyStr.optional(),
    correctedCost: moneyStr.optional(),
  })
  .strict();

const xlsRowSchema = z.record(z.string(), z.unknown()); // satır alanları route içinde normalize edilir

export const importXlsSchema = z.object({
  rows: z.array(xlsRowSchema).min(1, "Satır gerekli").max(5000, "Tek seferde en fazla 5.000 satır"),
  defaultStore: shortText(32).optional(),
});

export const driveUrlSchema = z.object({
  driveUrl: z.string().trim().min(10).max(500),
  defaultStore: shortText(32).optional(),
});

export const batchCreateSchema = z.object({
  batchNumber: shortText(64).min(1, "Batch no zorunludur"),
  storeCode: shortText(32).optional(),
  title: shortText(200).min(1, "Başlık zorunludur"),
  orderIds: z.array(z.coerce.number().int().positive()).max(5000).default([]),
  notes: shortText(2000).optional(),
});

export const userCreateSchema = z.object({
  name: shortText(100).min(2, "İsim zorunludur"),
  email: emailStr,
  role: z.enum(["ADMIN", "MANAGER", "STORE_USER"]).default("STORE_USER"),
  storeCode: shortText(32).optional(),
  password: z.string().min(12, "Parola en az 12 karakter olmalıdır").max(128),
});

export const userUpdateSchema = z.object({
  id: z.coerce.number().int().positive(),
  name: shortText(100).optional(),
  role: z.enum(["ADMIN", "MANAGER", "STORE_USER"]).optional(),
  storeCode: shortText(32).optional(),
  password: z.string().min(12, "Parola en az 12 karakter olmalıdır").max(128).optional(),
});

export const storeCreateSchema = z.object({
  storeCode: shortText(32).min(1, "Mağaza kodu zorunludur"),
  storeName: shortText(200).min(1, "Mağaza adı zorunludur"),
  marketplace: shortText(32).optional(),
  buyerName: shortText(100).optional(),
  currency: z.string().trim().length(3).optional(),
  defaultCard: shortText(8).optional(),
  defaultEmail: shortText(254).optional(),
  notes: shortText(2000).optional(),
});

export const storeUpdateSchema = z.object({
  id: z.coerce.number().int().positive(),
  storeName: shortText(200).optional(),
  buyerName: shortText(100).optional(),
  status: z.enum(["ACTIVE", "PASSIVE"]).optional(),
  defaultCard: shortText(8).optional(),
  defaultEmail: shortText(254).optional(),
  notes: shortText(2000).optional(),
});

export const intelligenceCreateSchema = z.object({
  sourceUrl: z.union([z.literal(""), z.string().trim().url().max(1000)]).optional(),
  title: shortText(500).min(1, "Ürün başlığı zorunludur"),
  brand: shortText(120).optional(),
  category: shortText(120).optional(),
  upc: shortText(32).optional(),
  // Aşama 3: sahte ASIN üretmek katalogu çöple doldurur. Keşif kimliği zorunlu.
  asin: shortText(20).min(1, "ASIN zorunludur"),
  sourcePrice: money,
  sellingPrice: money,
  prepCost: money.optional(),
  researcherName: shortText(120).optional(),
  researcherCode: shortText(32).optional(),
  supplierName: shortText(200).optional(),
  notes: shortText(2000).optional(),
});

export const intelligencePatchSchema = z
  .object({
    decisionAction: z
      .enum(["BUY", "TEST", "WAIT", "REJECT", "REPRICE", "REORDER", "PAUSE", "LIQUIDATE"])
      .optional(),
    lifecycleStage: shortText(40).optional(),
    policyStatus: shortText(60).optional(),
    dataQualityStatus: shortText(40).optional(),
    sellingPrice: money.optional(),
    actorName: shortText(120).optional(),
  })
  .strict();

export const masterCrudDeleteSchema = z.object({
  tableName: z.enum(["orders", "users", "stores", "pshBatches", "productMasters"]),
  id: z.coerce.number().int().positive().optional(),
  storeCodeFilter: shortText(32).optional(),
});

export const dbResetSchema = z.object({
  actionType: z.enum(["CLEAN_ORDERS_ONLY", "RESTORE_REAL_XLS", "NUKE_ALL_KEEP_ADMIN"]),
  confirmationCode: z.literal("RESET-CERBERUS"),
});
