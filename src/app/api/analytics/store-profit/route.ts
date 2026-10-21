import { NextResponse } from "next/server";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { storeFinancials, stores } from "@/db/schema";
import { requireUser, requireRole, isDenied, resolveStoreScope, canAccessStore } from "@/lib/guards";
import { parseBody, storeFinancialEntriesSchema } from "@/lib/validation";
import { handleRouteError } from "@/lib/apiResponse";
import {
  computeMonthlyProfit,
  monthRange,
  FINANCE_SOURCES,
  type FinanceEntry,
} from "@/domain/storeProfit";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * GET /api/analytics/store-profit?storeCode=HRN|ALL&from=YYYY-MM&to=YYYY-MM
 *
 * Aylık karlılık tablosu. STORE_USER yalnız kendi mağazasını görür.
 * `missingSources`: veri girilmemiş kaynaklar — ekran "bu kâr eksik veriyle
 * hesaplandı" uyarısı gösterebilsin diye döner.
 */
export async function GET(req: Request) {
  try {
    const gate = await requireUser();
    if (isDenied(gate)) return gate.response;

    const sp = new URL(req.url).searchParams;
    const storeCode = resolveStoreScope(gate.user, sp.get("storeCode") || "ALL");
    const from = sp.get("from");
    const to = sp.get("to");
    if ((from && !MONTH.test(from)) || (to && !MONTH.test(to))) {
      return NextResponse.json({ error: "from/to YYYY-AA biçiminde olmalı." }, { status: 400 });
    }

    const conditions = [];
    if (storeCode !== "ALL") conditions.push(eq(storeFinancials.storeCode, storeCode));
    if (from) conditions.push(gte(storeFinancials.month, from));
    if (to) conditions.push(lte(storeFinancials.month, to));

    const base = db.select().from(storeFinancials);
    const rows = await (conditions.length ? base.where(and(...conditions)) : base);

    const entries: FinanceEntry[] = rows.map((r) => ({
      month: r.month,
      source: r.source as FinanceEntry["source"],
      category: r.category as FinanceEntry["category"],
      amount: Number(r.amount),
    }));

    const months = monthRange(entries);
    const profit = computeMonthlyProfit(entries, months);
    const present = new Set(entries.map((e) => e.source));

    const totals = profit.reduce(
      (t, m) => ({
        revenue: t.revenue + (m.revenue ?? 0),
        netProfit: t.netProfit + (m.netProfit ?? 0),
      }),
      { revenue: 0, netProfit: 0 }
    );

    return NextResponse.json({
      storeCode,
      months: profit,
      totals: {
        revenue: Math.round(totals.revenue * 100) / 100,
        netProfit: Math.round(totals.netProfit * 100) / 100,
        marginPct: totals.revenue > 0 ? Math.round((totals.netProfit / totals.revenue) * 10000) / 100 : null,
      },
      missingSources: FINANCE_SOURCES.filter((s) => !present.has(s)),
    });
  } catch (error: unknown) {
    return handleRouteError("GET /api/analytics/store-profit", error);
  }
}

/**
 * POST /api/analytics/store-profit — aylık finans kalemlerini yükler (ADMIN/MANAGER).
 * Aynı (mağaza, ay, kaynak, sınıf, kalem) tekrar gelirse üzerine yazılır.
 */
export async function POST(req: Request) {
  try {
    const gate = await requireRole("ADMIN", "MANAGER");
    if (isDenied(gate)) return gate.response;

    const parsed = await parseBody(req, storeFinancialEntriesSchema);
    if ("response" in parsed) return parsed.response;
    const { storeCode, entries } = parsed.data;

    if (!canAccessStore(gate.user, storeCode)) {
      return NextResponse.json({ error: "Bu mağaza kapsamınızda değil." }, { status: 403 });
    }
    const [store] = await db.select().from(stores).where(eq(stores.storeCode, storeCode)).limit(1);
    if (!store) return NextResponse.json({ error: `Mağaza bulunamadı: ${storeCode}` }, { status: 404 });

    await db
      .insert(storeFinancials)
      .values(
        entries.map((e) => ({
          storeCode,
          month: e.month,
          source: e.source,
          category: e.category,
          label: e.label,
          amount: e.amount.toFixed(2),
          note: e.note ?? null,
          createdBy: gate.user.name,
        }))
      )
      .onConflictDoUpdate({
        target: [
          storeFinancials.storeCode,
          storeFinancials.month,
          storeFinancials.source,
          storeFinancials.category,
          storeFinancials.label,
        ],
        set: { amount: sql`excluded.amount`, note: sql`excluded.note`, updatedAt: sql`now()` },
      });

    return NextResponse.json({ saved: entries.length });
  } catch (error: unknown) {
    return handleRouteError("POST /api/analytics/store-profit", error);
  }
}
