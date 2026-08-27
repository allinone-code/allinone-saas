import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  orders,
  users,
  stores,
  pshBatches,
  productMasters,
  auditLogs,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function DELETE(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (currentUser && currentUser.role !== "ADMIN" && currentUser.role !== "MANAGER") {
      return NextResponse.json(
        { error: "Bu işlemi yapmak için yönetici yetkisi gerekir." },
        { status: 403 }
      );
    }

    const { tableName, id, storeCodeFilter } = await req.json();

    if (storeCodeFilter && tableName === "orders") {
      await db.delete(orders).where(eq(orders.buyerStore, storeCodeFilter));
      return NextResponse.json({
        message: `${storeCodeFilter} mağazasına ait tüm siparişler silindi.`,
      });
    }

    if (!id || !tableName) {
      return NextResponse.json({ error: "Tablo adı ve ID zorunludur." }, { status: 400 });
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
      await db.delete(auditLogs).where(eq(auditLogs.id, numId));
    } else {
      return NextResponse.json({ error: "Desteklenmeyen tablo." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Kayıt (${tableName} #${id}) başarıyla silindi.`,
    });
  } catch (error: any) {
    console.error("DELETE /api/admin/master-crud error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
