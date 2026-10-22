import { describe, it, expect } from "vitest";
import {
  buildPrepShipLoadDataRows,
  PREPSHIP_LOADDATA_COLUMNS,
  splitPrepShipExportable,
  type PrepShipExportOrder,
} from "./prepshipExport";

describe("buildPrepShipLoadDataRows", () => {
  it("başlık satırı gerçek PrepShip LoadData şablonuyla birebir aynı", () => {
    expect(PREPSHIP_LOADDATA_COLUMNS.join(",")).toBe(
      "TrackingNumber,OrderNumber,OrderNumberSold,PalletId,ShipmentDate,ExpirationDate,ASIN,MSKU,UPC,FNSKU,SerialNo,ProductTitle,ManufactureOrSupplier,ProductGroup,NumberOfUnits,Condition,Cost,SalePrice,Fragile,MultiPack,Bundle,CountPerBundle,Action,Notes"
    );
    const [header] = buildPrepShipLoadDataRows([]);
    expect(header).toEqual([...PREPSHIP_LOADDATA_COLUMNS]);
  });

  it("sipariş satırını doğru kolonlara eşler (Action=fulfillmentType, ManufactureOrSupplier=supplierCode)", () => {
    const rows = buildPrepShipLoadDataRows([
      {
        orderNumber: "WO310759607",
        orderDate: new Date("2026-02-11T00:00:00Z"),
        asin: "B0DGQX1FS7",
        msku: "HRN-B0DGQX1FS7",
        productTitle: "Test Ürün",
        supplierCode: "A198",
        quantity: 4,
        condition: "New",
        unitCost: "29.99",
        sellingPrice: "65",
        isFragile: "NO",
        isMultiPack: "NO",
        isBundle: "NO",
        countPerBundle: null,
        fulfillmentType: "FBA",
        description1: null,
      },
    ]);
    expect(rows).toHaveLength(2);
    const [, row] = rows;
    expect(row[1]).toBe("WO310759607"); // OrderNumber
    expect(row[4]).toBe("2026-02-11"); // ShipmentDate
    expect(row[6]).toBe("B0DGQX1FS7"); // ASIN
    expect(row[7]).toBe("HRN-B0DGQX1FS7"); // MSKU
    expect(row[12]).toBe("A198"); // ManufactureOrSupplier
    expect(row[14]).toBe(4); // NumberOfUnits
    expect(row[22]).toBe("FBA"); // Action
  });

  it("bundle/fragile/multipack alanlarını YES/NO olarak büyük harfe çevirir", () => {
    const rows = buildPrepShipLoadDataRows([
      {
        orderNumber: "WO1",
        orderDate: "2026-09-18",
        asin: "B0TEST",
        msku: "HRN-B0TEST",
        productTitle: "Bundle Ürün",
        supplierCode: "A198",
        quantity: 2,
        condition: "New",
        unitCost: "10",
        sellingPrice: "20",
        isFragile: "yes",
        isMultiPack: "no",
        isBundle: "yes",
        countPerBundle: 2,
        fulfillmentType: "FBM",
        description1: "Not",
      },
    ]);
    const [, row] = rows;
    expect(row[18]).toBe("YES"); // Fragile
    expect(row[19]).toBe("NO"); // MultiPack
    expect(row[20]).toBe("YES"); // Bundle
    expect(row[21]).toBe(2); // CountPerBundle
  });
});

describe("İPTAL kuralı (denetim R2)", () => {
  const order = (over: Partial<PrepShipExportOrder>): PrepShipExportOrder => ({
    orderNumber: "WO1",
    orderDate: "2026-09-18",
    asin: "B0TEST",
    msku: "HRN-B0TEST",
    productTitle: "Ürün",
    supplierCode: "A198",
    quantity: 4,
    condition: "New",
    unitCost: "46.3599999",
    sellingPrice: "80",
    isFragile: "NO",
    isMultiPack: "NO",
    isBundle: "NO",
    countPerBundle: null,
    fulfillmentType: "FBA",
    description1: null,
    ...over,
  });

  it("İPTAL satır dosyaya girmez ve dışlananlarda raporlanır", () => {
    const orders = [order({ cargoStatus: "İPTAL" }), order({ orderNumber: "WO2", cargoStatus: "Tam Geldi" })];
    const { included, excluded } = splitPrepShipExportable(orders);
    expect(included.map((o) => o.orderNumber)).toEqual(["WO2"]);
    expect(excluded).toEqual([{ orderNumber: "WO1", asin: "B0TEST", reason: "CANCELLED" }]);
    expect(buildPrepShipLoadDataRows(orders)).toHaveLength(2); // başlık + 1 satır
  });

  it("kısmi iptalde NumberOfUnits iptal adedi kadar düşer", () => {
    const [, row] = buildPrepShipLoadDataRows([order({ p1CancelQty: 1 })]);
    expect(row[14]).toBe(3);
  });

  it("tamamı P1 ile iptal edilmiş satır (durum iptal değil) NO_UNITS_LEFT olarak dışlanır", () => {
    const { excluded } = splitPrepShipExportable([order({ p1CancelQty: 4 })]);
    expect(excluded[0].reason).toBe("NO_UNITS_LEFT");
  });

  it("Cost ve SalePrice 2 basamağa yuvarlanır (R5)", () => {
    const [, row] = buildPrepShipLoadDataRows([order({})]);
    expect(row[16]).toBe(46.36);
    expect(row[17]).toBe(80);
  });

  it("cargoStatus verilmeyen eski çağrılar bozulmaz", () => {
    expect(splitPrepShipExportable([order({})]).included).toHaveLength(1);
  });
});


describe("sayı olmayan maliyet", () => {
  it("NaN hücre üretmez, değeri olduğu gibi geçirir", () => {
    const rows = buildPrepShipLoadDataRows([
      { orderNumber: "O1", orderDate: null, asin: "B0", msku: "M", productTitle: "t", supplierCode: null, quantity: 1,
        condition: null, unitCost: "N/A", sellingPrice: 12.345, isFragile: null, isMultiPack: null, isBundle: null,
        countPerBundle: null, fulfillmentType: null, description1: null },
    ]);
    expect(rows[1][16]).toBe("N/A");
    expect(rows[1][17]).toBe(12.35);
  });
});
