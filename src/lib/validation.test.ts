import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  firstPasswordSchema,
  parseBody,
  passwordChangeSchema,
  storeCreateSchema,
} from "./validation";

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

describe("passwordChangeSchema", () => {
  it("mevcut + en az 12 karakterlik farklı yeni parola kabul eder", () => {
    const r = passwordChangeSchema.safeParse({
      currentPassword: "eski-parola-1234",
      newPassword: "yepyeni-parola-5678",
    });
    expect(r.success).toBe(true);
  });

  it("12 karakterden kısa yeni parolayı reddeder", () => {
    const r = passwordChangeSchema.safeParse({
      currentPassword: "eski-parola-1234",
      newPassword: "kisa",
    });
    expect(r.success).toBe(false);
  });

  it("mevcut parolayla aynı yeni parolayı reddeder", () => {
    const r = passwordChangeSchema.safeParse({
      currentPassword: "ayni-parola-1234",
      newPassword: "ayni-parola-1234",
    });
    expect(r.success).toBe(false);
  });
});

describe("firstPasswordSchema", () => {
  it("e-postayı normalize eder ve geçerli rotasyonu kabul eder", () => {
    const r = firstPasswordSchema.safeParse({
      email: "  ADMIN@Cerberus.io ",
      currentPassword: "kurulum-parolasi",
      newPassword: "kalici-parola-1234",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("admin@cerberus.io");
  });

  it("kurulum parolasıyla aynı yeni parolayı reddeder", () => {
    const r = firstPasswordSchema.safeParse({
      email: "a@b.co",
      currentPassword: "ayni-kaliyor-12",
      newPassword: "ayni-kaliyor-12",
    });
    expect(r.success).toBe(false);
  });
});
