import type { SessionUser } from "@/lib/session";

/**
 * Varsayılan sistem kullanıcıları — PAROLA İÇERMEZ.
 *
 * Bu modül bilinçli olarak veritabanına dokunmaz; Neon SQL üretici gibi
 * DB bağlantısı olmadan çalışan araçlar tarafından da import edilir.
 * İlk parolalar seed sırasında SEED_ADMIN_PASSWORD / SEED_STORE_PASSWORD
 * ortam değişkenlerinden alınır ve bcrypt ile hash'lenerek saklanır.
 */
export interface DefaultSystemUser {
  name: string;
  email: string;
  role: SessionUser["role"];
  storeCode: string;
  avatar: string;
}

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
