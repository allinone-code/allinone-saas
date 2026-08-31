import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import type { SessionUser } from "@/lib/session";

export type { SessionUser } from "@/lib/session";
export { SESSION_COOKIE };

export interface DefaultSystemUser {
  name: string;
  email: string;
  role: SessionUser["role"];
  storeCode: string;
  avatar: string;
}

/**
 * Varsayılan sistem kullanıcıları — PAROLA İÇERMEZ.
 * İlk parolalar seed sırasında SEED_ADMIN_PASSWORD / SEED_STORE_PASSWORD
 * ortam değişkenlerinden alınır ve bcrypt ile hash'lenerek saklanır.
 * (Eski `passwordHash: "admin2026"` alanı güvenlik audit'i F-03/F-04 kapsamında kaldırıldı.)
 */
export const DEFAULT_SYSTEM_USERS: DefaultSystemUser[] = [
  {
    name: "Ahmet Erdem (Sistem Yöneticisi)",
    email: "ahmet@cerberus-commerce.io",
    role: "ADMIN",
    storeCode: "ALL",
    avatar: "AE",
  },
  {
    name: "Harun (HRN Store Yöneticisi)",
    email: "harun@cerberus-commerce.io",
    role: "STORE_USER",
    storeCode: "HRN",
    avatar: "HRN",
  },
  {
    name: "Selin Yılmaz (SEL Store Yöneticisi)",
    email: "selin@cerberus-commerce.io",
    role: "STORE_USER",
    storeCode: "SEL",
    avatar: "SY",
  },
  {
    name: "Can Demir (MK Store Yöneticisi)",
    email: "can@cerberus-commerce.io",
    role: "STORE_USER",
    storeCode: "MK",
    avatar: "CD",
  },
  {
    name: "Mert Yılmaz",
    email: "mert@cerberus.io",
    role: "ADMIN",
    storeCode: "ALL",
    avatar: "MY",
  },
];

/**
 * İlk kurulum (bootstrap) parolası.
 * - ÜRETİM: env yoksa null döner → ilgili hesap seed EDİLMEZ (bilinen parolalı hesap açılmaz).
 * - GELİŞTİRME: yalnızca lokalde geçerli dev fallback parolaları döner.
 */
export function getBootstrapPassword(role: SessionUser["role"]): string | null {
  const isAdminSide = role === "ADMIN" || role === "MANAGER";
  const fromEnv = isAdminSide
    ? process.env.SEED_ADMIN_PASSWORD
    : process.env.SEED_STORE_PASSWORD;

  if (fromEnv && fromEnv.length >= 12) return fromEnv;

  if (process.env.NODE_ENV !== "production") {
    return isAdminSide ? "dev-admin-changeMe!!" : "dev-store-changeMe!!";
  }
  return null;
}

/**
 * İmzalı + süreli oturum çerezini doğrular.
 * Geçersiz/kurcalanmış/süresi dolmuş çerezlerde null döner.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
