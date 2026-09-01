import { describe, expect, it } from "vitest";
import { XLS_40_COLUMNS, buildOrdersCsv, computeOrderKpis, csvCell, filterOrders } from "./ordersCsv";
import type { OrderView } from "../types";

function makeOrder(patch: Partial<OrderView> = {}): OrderView {
  return {
    id: 1,
    buyerStore: "HRN",
    orderDate: "2026-01-15",
    imageUrl: null,
    fulfillmentType: "FBA",
    productTitle: "MegaFood Vitamin D3",
    asin: "B00TESTASIN",
    msku: "MEG-101",
    supplierName: "THE VITAMIN SHOPPE",
    supplierCode: "A198",
    supplierUrl: "https://vitaminshoppe.com/p/1",
    amazonUrl: "https://amazon.com/dp/B00TESTASIN",
    orderNumber: "WO110074776",
    driveLink: null,
    packCount: 1,
    quantity: 10,
    unitCost: "12.00",
    sellingPrice: "29.99",
    totalCost: "120.00",
    orderEmail: "ops@example.com",
    cargoStatus: "Tam Geldi",
    shippedToAmazon: 10,
    p1CancelQty: 0,
    p2MissingQty: 0,
    p3DefectiveQty: 0,
    p4ExpiredQty: 0,
    problemAction: null,
    problemResult: null,
    refundAmount: "0.00",
    creditCard: "1753",
    isFragile: "NO",
    isMultiPack: "NO",
    isBundle: "NO",
    countPerBundle: null,
    condition: "New",
    brandName: "MegaFood",
    description1: null,
    description2: null,
    auditNote: null,
    periodCode: "O26",
    correctedCost: "120.00",
    pshBatchNo: "PSH-2026-01",
    pshStatus: "BEKLIYOR",
    inventoryLabStatus: "GIRILDI",
    ...patch,
  };
}

describe("csvCell", () => {
  it("virgül ve tırnak içeren değerleri kolon kaydırmadan kaçırır", () => {
    expect(csvCell('Acme, Inc "Big"')).toBe('"Acme, Inc ""Big"""');
  });

  it("satır sonu içeren metni tek hücrede tutar", () => {
    expect(csvCell("satır1\nsatır2")).toBe('"satır1\nsatır2"');
  });

  it("CSV injection'ı engeller (= + - @ ile başlayan değerler)", () => {
    expect(csvCell("=SUM(A1:A9)")).toBe(`"'=SUM(A1:A9)"`);
    expect(csvCell("+1234")).toBe(`"'+1234"`);
    expect(csvCell("@cmd")).toBe(`"'@cmd"`);
  });

  it("null/undefined için boş hücre üretir", () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });
});

describe("buildOrdersCsv", () => {
  it("kilitli 40 kolon şemasını korur", () => {
    expect(XLS_40_COLUMNS).toHaveLength(40);
    const csv = buildOrdersCsv([makeOrder()]);
    const headerCells = csv.split("\r\n")[0].split(",");
    expect(headerCells).toHaveLength(40);
  });

  it("her satırda 40 alan üretir", () => {
    const csv = buildOrdersCsv([makeOrder(), makeOrder({ id: 2 })]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1].split('","')).toHaveLength(40);
  });

  it("tedarikçi adındaki virgül satırı bozmaz", () => {
    const csv = buildOrdersCsv([makeOrder({ supplierName: "Acme, Inc" })]);
    expect(csv.split("\r\n")[1].split('","')).toHaveLength(40);
  });
});

describe("computeOrderKpis", () => {
  it("temel toplamları doğru hesaplar", () => {
    const kpis = computeOrderKpis([makeOrder(), makeOrder({ id: 2, quantity: 5, totalCost: "60.00" })]);
    expect(kpis.totalOrders).toBe(2);
    expect(kpis.totalUnits).toBe(15);
    expect(kpis.totalSpend).toBe("180.00");
  });

  it("veri yokken uydurma ROI göstermez", () => {
    const kpis = computeOrderKpis([]);
    expect(kpis.avgRoi).toBe("—");
    expect(kpis.fulfillmentRate).toBe(0);
  });

  it("problemli siparişleri sayar", () => {
    const kpis = computeOrderKpis([
      makeOrder(),
      makeOrder({ id: 2, cargoStatus: "İPTAL" }),
      makeOrder({ id: 3, p2MissingQty: 3 }),
      makeOrder({ id: 4, refundAmount: "15.00" }),
    ]);
    expect(kpis.problemCount).toBe(3);
  });
});

describe("filterOrders", () => {
  const data = [
    makeOrder({ id: 1, orderNumber: "WO111", cargoStatus: "Yolda", pshBatchNo: "B1" }),
    makeOrder({ id: 2, orderNumber: "WO222", cargoStatus: "İPTAL", pshBatchNo: "B2" }),
  ];

  it("kargo durumuna göre süzer", () => {
    expect(filterOrders(data, { search: "", cargo: "İPTAL", batch: "ALL" })).toHaveLength(1);
  });

  it("batch numarasına göre süzer", () => {
    expect(filterOrders(data, { search: "", cargo: "ALL", batch: "B1" })[0].id).toBe(1);
  });

  it("order no ile büyük/küçük harf duyarsız arar", () => {
    expect(filterOrders(data, { search: "wo222", cargo: "ALL", batch: "ALL" })[0].id).toBe(2);
  });

  it("filtre yokken tüm kayıtları döner", () => {
    expect(filterOrders(data, { search: "  ", cargo: "ALL", batch: "ALL" })).toHaveLength(2);
  });
});
