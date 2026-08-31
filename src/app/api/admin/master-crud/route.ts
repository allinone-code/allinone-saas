import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  orders,
  users,
  stores,
  pshBatches,
  productMasters,
} from "@/db/schema";
import { requireRole, isDenied } from "@/lib/guards";
import { parseBody, masterCrudDeleteSchema } from "@/lib/validation";
import { handleRouteError } from "@/lib/apiResponse";
import { eq } from "drizzle-orm";

export async function DELETE(req: Request) {
  try {
    // Oturum yoksa 401, rol uymazsa 403 — anonim geçiş kapatıldı (F-02)
    const gate = await requireRole("ADMIN", "MANAGER");
    if (isDenied(gate)) return gate.response;

    // Zod doğrulama (T3.1): tablo beyaz listesi şemada; auditLogs burada da engellenir
    const parsed = await parseBody(req, masterCrudDeleteSchema);
    if ("response" in parsed) return parsed.response;
    const { tableName, id, storeCodeFilter } = parsed.data;

    if (storeCodeFilter && tableName === "orders") {
      await db.delete(orders).where(eq(orders.buyerStore, storeCodeFilter));
      return NextResponse.json({
        message: `${storeCodeFilter} mağazasına ait tüm siparişler silindi.`,
      });
    }

    if (!id) {
      return NextResponse.json({ error: "Kayıt ID'si zorunludur." }, { status: 400 });
    }

    const numId = Number(id);

    if (tableName === "orders") {
      await db.delete(orders).where(eq(orders.id, numId));
    } else if (tableName === "users") {
      await db.delete(users).where(eq(users.id, numId));
    } else if (tableName === "stores") {
      await db.delete(stores).where(eq(stores.id, numId));
    } else if (tableName === "pshBatches") {
      await db.delete(pshBatches).where(eq(pshBatches.id, numId));
    } else if (tableName === "productMasters") {
      await db.delete(productMasters).where(eq(productMasters.id, numId));
    } else if (tableName === "auditLogs") {
      // F-09: Denetim izi değiştirilemez — silme API üzerinden asla yapılamaz
      return NextResponse.json(
        { error: "Denetim izi (audit log) kayıtları güvenlik gerekçesiyle silinemez." },
        { status: 403 }
      );
    } else {
      return NextResponse.json({ error: "Desteklenmeyen tablo." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Kayıt (${tableName} #${id}) başarıyla silindi.`,
    });
  } catch (error: unknown) {
    return handleRouteError("DELETE /api/admin/master-crud", error);
  }
}
