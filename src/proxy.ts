import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // /api uçları burada bilinçli olarak erken-dönüyor: Next.js 16 proxy'si gövde
  // döndüremediği için 401/403 kararını her route'un kendisi verir
  // (requireUser / requireRole — bkz. src/lib/guards.ts).
  const isPublicPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".");

  if (isPublicPath) {
    if (session && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // İmza/süre doğrulaması: yoksa veya kurcalanmışsa login'e yönlendir.
  if (!session) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    if (token) {
      // Geçersiz (ör. eski base64 veya sahte imzalı) çerezi temizle
      res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
    }
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
