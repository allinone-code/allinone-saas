import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import type { SessionUser } from "@/lib/session";

export type GuardResult = { user: SessionUser } | { response: NextResponse };

export function isDenied(result: GuardResult): result is { response: NextResponse } {
  return "response" in result;
}

/**
 * Geçerli (imzalı, süresi dolmamış) oturum zorunluluğu.
 * Kullanıcı yoksa 401 döner — asla "boş geç" yapmaz.
 */
export async function requireUser(): Promise<GuardResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      response: NextResponse.json(
        { error: "Bu işlem için geçerli bir oturum gereklidir." },
        { status: 401 }
      ),
    };
  }
  return { user };
}

/** Rol zorunluluğu: önce oturum, sonra rol kontrolü. */
export async function requireRole(...roles: Array<SessionUser["role"]>): Promise<GuardResult> {
  const gate = await requireUser();
  if (isDenied(gate)) return gate;

  if (!roles.includes(gate.user.role)) {
    return {
      response: NextResponse.json(
        { error: "Bu işlem için yetkiniz bulunmuyor." },
        { status: 403 }
      ),
    };
  }
  return gate;
}

/**
 * Mağaza kapsam hesabı: STORE_USER her zaman kendi mağazasına kilitlenir;
 * istemciden gelen storeCode'a güvenilmez.
 */
export function resolveStoreScope(user: SessionUser, requestedStore?: string | null): string {
  if (user.role === "STORE_USER" && user.storeCode !== "ALL") {
    return user.storeCode;
  }
  return requestedStore || "ALL";
}

/** Kullanıcının belirli bir mağazanın kaydına erişim hakkı var mı? */
export function canAccessStore(user: SessionUser, storeCode: string): boolean {
  if (user.storeCode === "ALL") return true;
  if (user.role === "ADMIN" || user.role === "MANAGER") return true;
  return user.storeCode === storeCode;
}
