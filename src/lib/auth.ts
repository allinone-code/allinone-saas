import { cookies } from "next/headers";

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "STORE_USER";
  storeCode: string; // 'ALL' or specific like 'HRN'
  avatar?: string | null;
}

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
