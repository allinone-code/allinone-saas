import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseBody, pshCompareSchema, storeCreateSchema, xraySchema } from "./validation";

const schema = z.object({ name: z.string() });

function request(body: BodyInit | null, contentType = "application/json") {
  return new Request("https://example.test/api", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
}

describe("parseBody", () => {
  it("geçerli JSON'u doğrular", async () => {
    const result = await parseBody(request(JSON.stringify({ name: "Cerberus" })), schema);
    expect("data" in result && result.data.name).toBe("Cerberus");
  });

  it("JSON content type zorunludur", async () => {
    const result = await parseBody(request('{"name":"x"}', "text/plain"), schema);
    expect("response" in result && result.response.status).toBe(415);
  });

  it("Content-Length olmasa da gerçek akış boyutunu sınırlar", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"name":"'));
        controller.enqueue(new TextEncoder().encode("x".repeat(100)));
        controller.enqueue(new TextEncoder().encode('"}'));
        controller.close();
      },
    });
    const req = new Request("https://example.test/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      // Node's Request requires duplex for a streaming request body.
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const result = await parseBody(req, schema, 32);
    expect("response" in result && result.response.status).toBe(413);
  });

  it("bozuk JSON için 400 döner", async () => {
    const result = await parseBody(request("{"), schema);
    expect("response" in result && result.response.status).toBe(400);
  });
});

describe("storeCreateSchema", () => {
  const base = { storeCode: "ANK", storeName: "Ankara Store" };

  it("kart bilinmiyorsa boş bırakılmasına izin verir", () => {
    expect(storeCreateSchema.parse({ ...base, defaultCard: "" }).defaultCard).toBe("");
  });

  it("kart alanında yalnız dört hane kabul eder", () => {
    expect(storeCreateSchema.safeParse({ ...base, defaultCard: "1234" }).success).toBe(true);
    expect(storeCreateSchema.safeParse({ ...base, defaultCard: "1753xxxx" }).success).toBe(false);
  });

  it("mağaza e-postasının biçimini doğrular", () => {
    expect(storeCreateSchema.safeParse({ ...base, defaultEmail: "not-an-email" }).success).toBe(false);
  });
});

describe("xraySchema", () => {
  it("boş satır listesini reddeder", () => {
    expect(xraySchema.safeParse({ rows: [] }).success).toBe(false);
  });

  it("20.000'den fazla satırı reddeder", () => {
    expect(xraySchema.safeParse({ rows: Array.from({ length: 20_001 }, () => ({})) }).success).toBe(false);
  });

  it("satırları ve eşiği kabul eder; eşik 1..500 dışında reddedilir", () => {
    expect(xraySchema.safeParse({ rows: [{ a: 1 }], priceDeviationPct: 25 }).success).toBe(true);
    expect(xraySchema.safeParse({ rows: [{ a: 1 }], priceDeviationPct: 0 }).success).toBe(false);
    expect(xraySchema.safeParse({ rows: [{ a: 1 }], priceDeviationPct: 501 }).success).toBe(false);
  });
});

describe("pshCompareSchema", () => {
  const row = [{ a: 1 }];
  it("boş alım veya boş PSH satır listesini ayrı ayrı reddeder", () => {
    expect(pshCompareSchema.safeParse({ purchaseRows: [], pshRows: row }).success).toBe(false);
    expect(pshCompareSchema.safeParse({ purchaseRows: row, pshRows: [] }).success).toBe(false);
    expect(pshCompareSchema.safeParse({ purchaseRows: row, pshRows: row }).success).toBe(true);
  });

  it("fiyat eşiği metinden sayıya çevrilir, 1..500 dışı reddedilir", () => {
    const ok = pshCompareSchema.safeParse({ purchaseRows: row, pshRows: row, priceTolerancePct: "10" });
    expect(ok.success && ok.data.priceTolerancePct).toBe(10);
    expect(pshCompareSchema.safeParse({ purchaseRows: row, pshRows: row, priceTolerancePct: 0 }).success).toBe(false);
    expect(pshCompareSchema.safeParse({ purchaseRows: row, pshRows: row, priceTolerancePct: 501 }).success).toBe(false);
  });

  it("bekleme penceresi 0..90 tam sayı; verilmezse undefined", () => {
    expect(pshCompareSchema.safeParse({ purchaseRows: row, pshRows: row, pendingWindowDays: 91 }).success).toBe(false);
    expect(pshCompareSchema.safeParse({ purchaseRows: row, pshRows: row, pendingWindowDays: -1 }).success).toBe(false);
    const d = pshCompareSchema.safeParse({ purchaseRows: row, pshRows: row });
    expect(d.success && d.data.pendingWindowDays).toBeUndefined();
  });
});
