import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, orders, auditLogs } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { requireRole, isDenied } from "@/lib/guards";
import { handleRouteError } from "@/lib/apiResponse";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword } from "@/lib/passwords";
import { log } from "@/lib/logger";
import crypto from "crypto";

/**
 * T7.3 — Veri Sahibi Talebi (DSR) teknik karşılığı (KVKK m.11).
 * Akış dokümanı: docs/compliance/dsr-akisi.md
 *
 * GET  ?email=... → ilgili kişinin tutulan tüm verilerinin JSON dışa aktarımı (ADMIN)
 * POST { email, confirm: "ANONYMIZE" } → geri döndürülemez anonimleştirme (ADMIN)
 */

export async function GET(req: Request) {
  try {
    const gate = await requireRole("ADMIN");
    if (isDenied(gate)) return gate.response;
    const currentUser = gate.user;

    const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "email parametresi zorunludur" }, { status: 400 });
    }

    const [userRows, orderRows, auditRows] = await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          storeCode: users.storeCode,
          createdAt: users.createdAt,
          // NOT: password_hash asla dışa aktarılmaz
        })
        .from(users)
        .where(eq(users.email, email)),
      db
        .select()
        .from(orders)
        .where(eq(orders.orderEmail, email)),
      db
        .select()
        .from(auditLogs)
        .where(or(eq(auditLogs.actorName, email), eq(auditLogs.targetEntity, email), eq(auditLogs.details, email))),
    ]);

    log.info("admin/dsr", "DSR dışa aktarımı", { actor: currentUser.email, toId: userRows[0]?.id ?? null });

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      subject: email,
      data: {
        userAccount: userRows,
        ordersWithThisContactEmail: orderRows,
        auditLogMentions: auditRows.length, // içerik değil sayı; tam içerikler ayrı talepte
      },
      retention: "docs/compliance/veri-envanteri.md içindeki saklama sürelerine tabidir.",
    });
  } catch (error: unknown) {
    return handleRouteError("GET /api/admin/dsr", error);
  }
}

export async function POST(req: Request) {
  try {
    const gate = await requireRole("ADMIN");
    if (isDenied(gate)) return gate.response;
    const currentUser = gate.user;

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    if (!email || body.confirm !== "ANONYMIZE") {
      return NextResponse.json(
        { error: "Geri alınamaz işlem: { email, confirm: 'ANONYMIZE' } gönderin." },
        { status: 400 }
      );
    }

    const matched = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!matched.length) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }
    const target = matched[0];

    if (target.role === "ADMIN") {
      return NextResponse.json(
        { error: "ADMIN hesabı anonimleştirilemez (kritik işlem)." },
        { status: 403 }
      );
    }

    // Geri döndürülemez anonimleştirme: kimliği tanımlayan her alan silinir
    await db
      .update(users)
      .set({
        name: `Anonim Kullanıcı #${target.id}`,
        email: `deleted+${target.id}@redacted.local`,
        avatar: null,
        passwordHash: await hashPassword(crypto.randomBytes(32).toString("hex")),
      })
      .where(eq(users.id, target.id));

    // Sipariş iletişim alanındaki PII'yi de maskeli forma çek
    await db
      .update(orders)
      .set({ orderEmail: `deleted+${target.id}@redacted.local` })
      .where(eq(orders.orderEmail, email));

    await writeAuditLog({
      actorName: currentUser.name,
      storeCode: target.storeCode,
      actionType: "DSR_ANONYMIZE",
      targetEntity: `user_id:${target.id}`, // PII taşımayan referans — kasıtlı
      beforeState: "KAYITLI_KISI",
      afterState: "ANONIM",
      details: "KVKK m.11 silme/anonimleştirme talebi uygulandı.",
    });

    log.warn("admin/dsr", "Kullanıcı anonimleştirildi", { actor: currentUser.email, userId: target.id });

    return NextResponse.json({
      success: true,
      message: `Kullanıcı #${target.id} anonimleştirildi. Bu işlem geri alınamaz.`,
    });
  } catch (error: unknown) {
    return handleRouteError("POST /api/admin/dsr", error);
  }
}
