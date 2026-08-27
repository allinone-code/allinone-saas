import { cookies } from "next/headers";

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "STORE_USER";
  storeCode: string; // 'ALL' or specific like 'HRN'
  avatar?: string | null;
}

export const DEFAULT_SYSTEM_USERS = [
  {
    name: "Ahmet Erdem (Sistem Yöneticisi)",
    email: "ahmet@cerberus-commerce.io",
    passwordHash: "admin2026",
    role: "ADMIN" as const,
    storeCode: "ALL",
    avatar: "AE",
  },
  {
    name: "Harun (HRN Store Yöneticisi)",
    email: "harun@cerberus-commerce.io",
    passwordHash: "store2026",
    role: "STORE_USER" as const,
    storeCode: "HRN",
    avatar: "HRN",
  },
  {
    name: "Selin Yılmaz (SEL Store Yöneticisi)",
    email: "selin@cerberus-commerce.io",
    passwordHash: "store2026",
    role: "STORE_USER" as const,
    storeCode: "SEL",
    avatar: "SY",
  },
  {
    name: "Can Demir (MK Store Yöneticisi)",
    email: "can@cerberus-commerce.io",
    passwordHash: "store2026",
    role: "STORE_USER" as const,
    storeCode: "MK",
    avatar: "CD",
  },
  {
    name: "Mert Yılmaz",
    email: "mert@cerberus.io",
    passwordHash: "cerberus2026",
    role: "ADMIN" as const,
    storeCode: "ALL",
    avatar: "MY",
  },
];

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("cerberus_session")?.value;

  if (!sessionCookie) {
    return null;
  }

  try {
    const decoded = Buffer.from(sessionCookie, "base64").toString("utf-8");
    return JSON.parse(decoded) as SessionUser;
  } catch {
    return null;
  }
}
