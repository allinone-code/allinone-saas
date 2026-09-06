export interface ImportRowProblem { row: number; field: string; message: string }
export const CARGO_STATUSES = ["Yolda", "Tam Geldi", "İPTAL", "Kayıp Depoya gelmiş"] as const;
export const FULFILLMENT_TYPES = ["FBA", "FBM"] as const;
export const PSH_STATUSES = ["BEKLIYOR", "BATCH_OLUSTURULDU", "DEPO_SAYILDI", "AMAZONA_SEVK"] as const;
export const INVENTORY_LAB_STATUSES = ["GIRILMEDI", "GIRILDI", "AKTIF_SATISTA"] as const;
export function normalizeMoney(raw: unknown): number | null {
  if (raw == null) return null; if (typeof raw === "number") return Number.isFinite(raw)&&raw>=0?raw:null;
  let s=String(raw).trim().replace(/[$€£₺\u00a0\s]/g,""); if(!s)return null;
  const c=s.includes(","), d=s.includes(".");
  if(c&&d) s=s.lastIndexOf(",")>s.lastIndexOf(".")?s.replace(/\./g,"").replace(",","."):s.replace(/,/g,"");
  else if(c)s=s.replace(",",".");
  const n=Number(s); return Number.isFinite(n)&&n>=0?n:null;
}
export function normalizeCount(raw: unknown): number | null {
  if(raw==null||String(raw).trim()==="")return null; const n=Number(String(raw).trim().replace(/[^\d.-]/g,""));
  return Number.isFinite(n)&&n>=0?Math.trunc(n):null;
}
const enumCheck=(v:unknown,a:readonly string[],label:string,row:number):ImportRowProblem|null=>v==null||String(v).trim()===""?null:a.includes(String(v).trim())?null:{row,field:label,message:`Geçersiz değer "${v}". İzin verilenler: ${a.join(", ")}.`};
export function validateImportRow(r:Record<string,any>,i:number):ImportRowProblem[]{const row=i+1,p:ImportRowProblem[]=[]; const order=String(r.orderNumber??"").trim(); if(!order)p.push({row,field:"Sipariş No (Orderno)",message:"Sipariş numarası boş."}); if(!String(r.asin??"").trim())p.push({row,field:"ASIN",message:"ASIN boş."}); const q=normalizeCount(r.quantity)??1; if(r.quantity!=null&&String(r.quantity).trim()!==""&&(normalizeCount(r.quantity)===null||q<1))p.push({row,field:"Ürün adedi",message:"Adet pozitif bir tam sayı olmalı."}); const shipped=normalizeCount(r.shippedToAmazon)??0; if(shipped>q)p.push({row,field:"Amazona gönderilen adet",message:`Sevk edilen adet (${shipped}) sipariş adedinden (${q}) fazla olamaz.`}); const fire=["p1CancelQty","p2MissingQty","p3DefectiveQty","p4ExpiredQty"].reduce((n,k)=>n+(normalizeCount(r[k])??0),0); if(fire>q)p.push({row,field:"P1–P4 fire adetleri",message:`Fire toplamı (${fire}) sipariş adedini (${q}) aşıyor.`}); [[r.cargoStatus,CARGO_STATUSES,"Kargo durumu"],[r.fulfillmentType,FULFILLMENT_TYPES,"FBM/FBA"],[r.pshStatus,PSH_STATUSES,"PSH durumu"],[r.inventoryLabStatus,INVENTORY_LAB_STATUSES,"Inventory Lab durumu"]].forEach(([v,a,l])=>{const x=enumCheck(v,a as readonly string[],l as string,row);if(x)p.push(x)}); for(const [k,l] of [["unitCost","Birim maliyet"],["sellingPrice","Satış fiyatı"],["totalCost","Toplam maliyet"],["correctedCost","Düzeltilmiş maliyet"],["refundAmount","Refund miktarı"]])if(r[k]!=null&&String(r[k]).trim()!==""&&normalizeMoney(r[k])===null)p.push({row,field:l,message:`"${r[k]}" sayıya çevrilemedi.`}); return p}
export function detectDuplicatePairs(rows:Record<string,any>[],resolve:(r:Record<string,any>)=>string):ImportRowProblem[]{const seen=new Set<string>(),p:ImportRowProblem[]=[];rows.forEach((r,i)=>{const k=`${resolve(r)}|${String(r.orderNumber??"").trim()}`;if(seen.has(k))p.push({row:i+1,field:"Sipariş No (Orderno)",message:`"${r.orderNumber??""}" bu mağazada birden çok satırda geçiyor.`});else seen.add(k)});return p}
export function pgErrorCode(error:unknown):string|null{if(!error||typeof error!=="object")return null;const e=error as any;return e?.cause?.code??e?.code??null}
