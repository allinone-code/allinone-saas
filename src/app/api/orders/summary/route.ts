import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireUser, isDenied, resolveStoreScope } from "@/lib/guards";
import { handleRouteError } from "@/lib/apiResponse";
import { and, count, eq, sql } from "drizzle-orm";

/**
 * T3.2 — Yalnızca KPI/özet döner; satır yoktur.
 * Dashboard özet kartları ve gelecekteki pencere araçları bunu çağırır.
 */
export async function GET(req: Request) {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;
    const currentUser = gate.user;

    const { searchParams } = new URL(req.url);
    const effectiveStore = resolveStoreScope(currentUser, searchParams.get("storeCode") || "ALL");

    const conditions = [];
    if (effectiveStore !== "ALL") {
      conditions.push(eq(orders.buyerStore, effectiveStore));
    }

    const base = db
      .select({
        totalOrdersCount: count(),
        totalUnits: sql<string>`coalesce(sum(${orders.quantity}), 0)`,
        totalSpend: sql<string>`coalesce(sum(${orders.totalCost}), 0)`,
        totalShippedToAmazon: sql<string>`coalesce(sum(${orders.shippedToAmazon}), 0)`,
        totalRefunds: sql<string>`coalesce(sum(${orders.refundAmount}), 0)`,
      })
      .from(orders);

    const [row] = await (conditions.length > 0 ? base.where(and(...conditions)) : base);

    return NextResponse.json({
      storeScope: effectiveStore,
      kpis: {
        totalOrdersCount: Number(row?.totalOrdersCount || 0),
        totalUnits: Number(row?.totalUnits || 0),
        totalSpend: Number(row?.totalSpend || 0).toFixed(2),
        totalShippedToAmazon: Number(row?.totalShippedToAmazon || 0),
        totalRefunds: Number(row?.totalRefunds || 0).toFixed(2),
      },
    });
  } catch (error: unknown) {
    return handleRouteError("GET /api/orders/summary", error);
  }
}
