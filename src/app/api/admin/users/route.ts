import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, auditLogs } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ensureCerberusSeeded } from "@/db/seed";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    await ensureCerberusSeeded();
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    // Sanitize password_hash before returning
    const safeUsers = allUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      storeCode: u.storeCode,
      avatar: u.avatar,
      createdAt: u.createdAt,
    }));
    return NextResponse.json({ users: safeUsers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (currentUser && currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Yetkisiz işlem. Yalnızca Admin kullanıcı ekleyebilir." }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, role = "STORE_USER", storeCode = "HRN", password = "store2026" } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "İsim ve e-posta zorunludur" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check duplicate email
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: "Bu e-posta adresiyle kayıtlı kullanıcı zaten var." }, { status: 400 });
    }

    const avatar = name
      .split(" ")
      .map((w: string) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    const [created] = await db
      .insert(users)
      .values({
        name: name.trim(),
        email: cleanEmail,
        passwordHash: password,
        role: role as any,
        storeCode: role === "ADMIN" ? "ALL" : storeCode,
        avatar,
      })
      .returning();

    await db.insert(auditLogs).values({
      actorName: currentUser?.name || "Admin",
      storeCode: storeCode || "ALL",
      actionType: "USER_CREATED",
      targetEntity: `${created.name} (${cleanEmail})`,
      beforeState: "YOK",
      afterState: role,
      details: `Yeni kullanıcı oluşturuldu. Yetki: ${role}, Atanan Mağaza: ${created.storeCode}`,
    });

    return NextResponse.json({
      message: `${created.name} başarıyla eklendi.`,
      user: {
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role,
        storeCode: created.storeCode,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (currentUser && currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Yetkisiz işlem. Yalnızca Admin kullanıcı düzenleyebilir." }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, role, storeCode, password } = body;

    if (!id) {
      return NextResponse.json({ error: "Kullanıcı ID zorunludur" }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.id, Number(id)))
      .limit(1);

    if (!existing.length) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    const current = existing[0];
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) {
      updateData.role = role;
      if (role === "ADMIN") updateData.storeCode = "ALL";
    }
    if (storeCode !== undefined && role !== "ADMIN") {
      updateData.storeCode = storeCode;
    }
    if (password) updateData.passwordHash = password;

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, Number(id)))
      .returning();

    await db.insert(auditLogs).values({
      actorName: currentUser?.name || "Admin",
      storeCode: updated.storeCode || "ALL",
      actionType: "USER_UPDATED",
      targetEntity: `${updated.name} (${updated.email})`,
      beforeState: `${current.role} - ${current.storeCode}`,
      afterState: `${updated.role} - ${updated.storeCode}`,
      details: `Kullanıcı yetki ve mağaza ataması güncellendi.`,
    });

    return NextResponse.json({
      message: "Kullanıcı güncellendi",
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        storeCode: updated.storeCode,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
