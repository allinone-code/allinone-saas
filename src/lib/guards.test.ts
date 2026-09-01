import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/session";

// next/headers'ı mock'la: getCurrentUser çerez deposunu buradan okuyor
vi.mock("next/headers", () => {
  let cookieValue: string | null = null;
  return {
    __setCookie: (v: string | null) => {
      cookieValue = v;
    },
    cookies: async () => ({
      get: (name: string) =>
        cookieValue && name === "cerberus_session" ? { value: cookieValue } : undefined,
    }),
  };
});

import * as headersMock from "next/headers";
import { requireUser, requireRole, resolveStoreScope, canAccessStore } from "@/lib/guards";
import { createSessionToken } from "@/lib/session";

const storeUser: SessionUser = {
  id: 3,
  name: "Harun",
  email: "harun@cerberus-commerce.io",
  role: "STORE_USER",
  storeCode: "HRN",
  avatar: "HR",
};
const adminUser: SessionUser = { ...storeUser, id: 1, role: "ADMIN", storeCode: "ALL", name: "Ahmet" };

describe("Yetki guard'ları (F-02/F-05/F-11)", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET =
      "guard-test-secret-must-be-at-least-32-chars!!";
    (headersMock as any).__setCookie(null);
  });

  it("çerez yoksa requireUser 401 döner", async () => {
    const gate = await requireUser();
    expect("response" in gate && gate.response.status).toBe(401);
  });

  it("geçerli oturumla requireUser kullanıcıyı döner", async () => {
    const token = await createSessionToken(storeUser);
    (headersMock as any).__setCookie(token);
    const gate = await requireUser();
    expect("user" in gate && gate.user.email).toBe(storeUser.email);
  });

  it("STORE_USER, ADMIN uçlarında 403 alır (requireRole)", async () => {
    const token = await createSessionToken(storeUser);
    (headersMock as any).__setCookie(token);
    const gate = await requireRole("ADMIN");
    expect("response" in gate && gate.response.status).toBe(403);
  });

  it("ADMIN, ADMIN uçlarından geçer", async () => {
    const token = await createSessionToken(adminUser);
    (headersMock as any).__setCookie(token);
    const gate = await requireRole("ADMIN");
    expect("user" in gate && gate.user.role).toBe("ADMIN");
  });

  it("mağaza kapsamı: STORE_USER istediği storeCode'u GÖNDERSE BİLE kilitlenir", () => {
    expect(resolveStoreScope(storeUser, "SEL")).toBe("HRN");
    expect(resolveStoreScope(storeUser, "ALL")).toBe("HRN");
    expect(resolveStoreScope(adminUser, "SEL")).toBe("SEL");
  });

  it("canAccessStore: STORE_USER yabancı mağazayı göremez, ADMIN hepsini görür", () => {
    expect(canAccessStore(storeUser, "HRN")).toBe(true);
    expect(canAccessStore(storeUser, "MK")).toBe(false);
    expect(canAccessStore(adminUser, "MK")).toBe(true);
  });
});
