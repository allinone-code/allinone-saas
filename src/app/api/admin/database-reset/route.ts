import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  orders,
  pshBatches,
  auditLogs,
  productMasters,
  researchSessions,
  users,
  stores,
} from "@/db/schema";
import { requireRole, isDenied } from "@/lib/guards";
import { eq, ne } from "drizzle-orm";
import { ALL_38_XLS_ORDERS, INITIAL_STORES, INITIAL_BATCHES } from "@/lib/mockData";

export async function POST(req: Request) {
  // T0.2: Bu yıkıcı araç üretim ortamında tamamen devre dışıdır.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  try {
    // Anonim geçiş kapatıldı (F-02): oturum yoksa 401, ADMIN değilse 403
    const gate = await requireRole("ADMIN");
    if (isDenied(gate)) return gate.response;
    const currentUser = gate.user;

    const { actionType, confirmationCode } = await req.json();

    if (confirmationCode !== "RESET-CERBERUS") {
      return NextResponse.json(
        { error: "Güvenlik kodu hatalı. Lütfen 'RESET-CERBERUS' onay kodunu girin." },
        { status: 400 }
      );
    }

    if (actionType === "CLEAN_ORDERS_ONLY") {
      // 1. Sadece Siparişleri ve PSH Partilerini Temizle (Kullanıcılar & Mağazalar Kalır)
      await db.delete(orders);
      await db.delete(pshBatches);

      await db.insert(auditLogs).values({
        actorName: currentUser.name,
        storeCode: "ALL",
        actionType: "DATABASE_CLEAN_ORDERS",
        targetEntity: "orders & psh_batches",
        beforeState: "DOLU_VERITABANI",
        afterState: "TEMIZ_SIPARIS_HAVUZU",
        details: "Tüm siparişler ve PSH partileri temizlendi. Kullanıcılar ve 26 mağaza tanımı korundu.",
      });

      return NextResponse.json({
        success: true,
        message: "Siparişler ve PSH partileri tertemiz silindi. Kullanıcı hesapları ve mağazalarınız korundu. Artık kendi gerçek Excel/Drive verilerinizi yükleyebilirsiniz.",
      });
    }

    if (actionType === "RESTORE_REAL_XLS") {
      // 2. The Vitamin Shoppe 38 Gerçek Siparişini Geri Yükle
      await db.delete(orders);
      await db.insert(orders).values(ALL_38_XLS_ORDERS as any);

      // PSH Batch'lerini de kontrol et
      await db.delete(pshBatches);
      await db.insert(pshBatches).values(
        INITIAL_BATCHES.map((b) => ({
          batchNumber: b.batchNumber,
          storeCode: b.storeCode,
          title: b.title,
          status: b.status,
          totalItemsCount: b.totalItemsCount,
          totalUnitsCount: b.totalUnitsCount,
          receivedUnitsCount: b.receivedUnitsCount,
          missingUnitsCount: b.missingUnitsCount,
          defectiveUnitsCount: b.defectiveUnitsCount,
          inventoryLabSynced: b.inventoryLabSynced,
          notes: b.notes,
        }))
      );

      await db.insert(auditLogs).values({
        actorName: currentUser.name,
        storeCode: "ALL",
        actionType: "DATABASE_RESTORE_XLS",
        targetEntity: `38 Gerçek Sipariş`,
        beforeState: "MEVCUT_DURUM",
        afterState: "40_KOLON_ORJINAL",
        details: "The Vitamin Shoppe 38 gerçek siparişi ve PSH sevkiyat partileri veritabanına yeniden yüklendi.",
      });

      return NextResponse.json({
        success: true,
        message: "40-Kolonluk Google Drive XLS tablosundaki 38 gerçek sipariş ve PSH partileri başarıyla geri yüklendi.",
      });
    }

    if (actionType === "NUKE_ALL_KEEP_ADMIN") {
      // 3. Admin Hariç Tüm Tabloları Temizle
      await db.delete(orders);
      await db.delete(pshBatches);
      await db.delete(productMasters);
      await db.delete(researchSessions);
      await db.delete(auditLogs);

      // Admin dışındaki kullanıcıları temizle
      await db.delete(users).where(ne(users.role, "ADMIN"));

      await db.insert(auditLogs).values({
        actorName: currentUser.name,
        storeCode: "ALL",
        actionType: "DATABASE_FACTORY_RESET",
        targetEntity: "Tüm Tablolar",
        beforeState: "DOLU",
        afterState: "SIFIRLANDI",
        details: "Fabrika ayarlarına dönüldü. Yalnızca Sistem Yöneticisi hesabı ve mağaza tanımları korundu.",
      });

      return NextResponse.json({
        success: true,
        message: "Veritabanı fabrika ayarlarına sıfırlandı. Sadece Sistem Yöneticisi (Admin) hesabı bırakıldı.",
      });
    }

    return NextResponse.json({ error: "Geçersiz işlem tipi" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/admin/database-reset error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
