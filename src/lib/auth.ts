import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  createAuthVersion,
  isSessionRole,
  verifySessionToken,
} from "@/lib/session";
import type { SessionUser } from "@/lib/session";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export type { SessionUser } from "@/lib/session";
export { SESSION_COOKIE };
// DB'ye dokunmayan sistem kullanıcısı sabitleri ayrı modüldedir; mevcut
// import'lar kırılmasın diye buradan yeniden export edilir.
export { DEFAULT_SYSTEM_USERS, getBootstrapPassword } from "@/lib/systemUsers";
export type { DefaultSystemUser } from "@/lib/systemUsers";

/**
 * İmzalı + süreli oturum çerezini doğrular, ardından hesabın güncel durumunu
 * veritabanından okur. Böylece kullanıcı silme, rol/mağaza değişikliği ve parola
 * sıfırlama mevcut JWT süresi dolmadan da yürürlüğe girer.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token);
  if (!claims) return null;

  const [liveUser] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      storeCode: users.storeCode,
      avatar: users.avatar,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, claims.id))
    .limit(1);

  if (!liveUser || !isSessionRole(liveUser.role)) return null;
  if ((await createAuthVersion(liveUser.passwordHash)) !== claims.authVersion) return null;

  return {
    id: liveUser.id,
    name: liveUser.name,
    email: liveUser.email,
    role: liveUser.role,
    storeCode: liveUser.storeCode,
    avatar: liveUser.avatar,
  };
}
