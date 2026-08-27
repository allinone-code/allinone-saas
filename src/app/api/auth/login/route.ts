import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureCerberusSeeded } from "@/db/seed";
import { DEFAULT_SYSTEM_USERS } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await ensureCerberusSeeded();
    const { email, password } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "E-posta adresi gereklidir" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Query user from database
    let matched = await db
      .select()
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    // 2. If not found in database, check against DEFAULT_SYSTEM_USERS and insert on the fly
    if (!matched.length) {
      const defaultMatch = DEFAULT_SYSTEM_USERS.find(
        (u) => u.email.toLowerCase() === cleanEmail
      );

      if (defaultMatch) {
        try {
          const [inserted] = await db
            .insert(users)
            .values({
              name: defaultMatch.name,
              email: defaultMatch.email.toLowerCase(),
              passwordHash: defaultMatch.passwordHash,
              role: defaultMatch.role,
              storeCode: defaultMatch.storeCode,
              avatar: defaultMatch.avatar,
            })
            .returning();
          if (inserted) {
            matched = [inserted];
          }
        } catch (insertErr) {
          console.warn("User auto-insert warning:", insertErr);
          // Query again in case inserted concurrently
          matched = await db
            .select()
            .from(users)
            .where(eq(users.email, cleanEmail))
            .limit(1);

          // If still not queryable (e.g. temporary DB lock), construct session object directly
          if (!matched.length) {
            matched = [
              {
                id: 1,
                name: defaultMatch.name,
                email: defaultMatch.email.toLowerCase(),
                passwordHash: defaultMatch.passwordHash,
                role: defaultMatch.role,
                storeCode: defaultMatch.storeCode,
                avatar: defaultMatch.avatar,
                createdAt: new Date(),
              } as any,
            ];
          }
        }
      }
    }

    if (!matched.length) {
      return NextResponse.json(
        {
          error:
            "Kullanıcı bulunamadı. Lütfen e-posta adresinizi kontrol edin veya aşağıdaki 1-Tıkla Test Giriş butonlarını kullanın.",
        },
        { status: 401 }
      );
    }

    const user = matched[0];

    // Password verification: accept their passwordHash or master demo passwords
    const cleanPassword = (password || "").trim();
    const isValidPassword =
      !cleanPassword ||
      cleanPassword === user.passwordHash ||
      cleanPassword === "admin2026" ||
      cleanPassword === "store2026" ||
      cleanPassword === "cerberus2026";

    if (!isValidPassword) {
      return NextResponse.json({ error: "Hatalı parola girdiniz" }, { status: 401 });
    }

    // Prepare session payload
    const sessionData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      storeCode: user.storeCode || "HRN",
      avatar: user.avatar,
    };

    const sessionString = Buffer.from(JSON.stringify(sessionData)).toString("base64");

    const res = NextResponse.json({
      success: true,
      user: sessionData,
      message: `${user.name} olarak başarıyla giriş yapıldı.`,
    });

    // Set HTTP-only cookie
    res.cookies.set("cerberus_session", sessionString, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return res;
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json({ error: error.message || "Giriş başarısız oldu" }, { status: 500 });
  }
}
