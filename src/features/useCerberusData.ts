"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BatchView,
  MorningBriefingView,
  OrderView,
  ProductMasterView,
  ProductView,
  ProductSummaryView,
  ResearcherView,
  SessionUserView,
  StoreView,
} from "./types";

interface CerberusData {
  currentUser: SessionUserView | null;
  checkingAuth: boolean;
  orders: OrderView[];
  stores: StoreView[];
  batches: BatchView[];
  productMasters: ProductMasterView[];
  /** Aşama 2 — ürün merkezli katalog ve portföy özeti */
  products: ProductView[];
  productSummary: ProductSummaryView | null;
  researchers: ResearcherView[];
  briefing: MorningBriefingView | null;
  loading: boolean;
  dataError: string | null;
  selectedStore: string;
  setSelectedStore: (code: string) => void;
  refresh: () => Promise<void>;
  applyOrderPatch: (id: number, patch: Partial<OrderView>) => void;
  applyMasterPatch: (id: number, patch: Partial<ProductMasterView>) => void;
  prependOrder: (order: OrderView) => void;
  logout: () => Promise<void>;
}

/**
 * T8.3 — Tüm sunucu-durumu (server state) tek yerde toplanır.
 *
 * Önceki sürümde bu mantık 1.640 satırlık `page.tsx` içinde dağılmıştı ve
 * `useEffect` içinde doğrudan `setState` çağrıldığı için React derleyicisi
 * "cascading render" hatası veriyordu (F-19/F-21). Burada tüm yükleme tek
 * bir async akışta, iptal edilebilir (`aborted` bayrağı) biçimde yapılır.
 */
export function useCerberusData(): CerberusData {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<SessionUserView | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [stores, setStores] = useState<StoreView[]>([]);
  const [batches, setBatches] = useState<BatchView[]>([]);
  const [productMasters, setProductMasters] = useState<ProductMasterView[]>([]);
  const [products, setProducts] = useState<ProductView[]>([]);
  const [productSummary, setProductSummary] = useState<ProductSummaryView | null>(null);
  const [researchers, setResearchers] = useState<ResearcherView[]>([]);
  const [briefing, setBriefing] = useState<MorningBriefingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<string>("ALL");

  // 1) Oturum doğrulama — sahte/mock kullanıcıya düşmek yok (F-15)
  useEffect(() => {
    let aborted = false;

    async function verify() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (aborted) return;

        if (!res.ok) {
          router.push("/login");
          return;
        }

        const data = await res.json();
        if (aborted) return;

        if (!data.authenticated || !data.user) {
          router.push("/login");
          return;
        }

        setCurrentUser(data.user as SessionUserView);
        // Mağaza kullanıcısı kendi mağazasına kilitlenir; kapsam sunucuda da zorlanır
        if (data.user.role === "STORE_USER" && data.user.storeCode !== "ALL") {
          setSelectedStore(data.user.storeCode);
        }
      } catch {
        if (!aborted) setDataError("Oturum doğrulanamadı. Bağlantınızı kontrol edin.");
      } finally {
        if (!aborted) setCheckingAuth(false);
      }
    }

    verify();
    return () => {
      aborted = true;
    };
  }, [router]);

  // 2) Veri yükleme — oturum doğrulandıktan sonra
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const [ordersRes, intelRes, productsRes] = await Promise.all([
          fetch(`/api/orders?storeCode=${encodeURIComponent(selectedStore)}`, {
            cache: "no-store",
            signal,
          }),
          fetch(`/api/intelligence?storeCode=${encodeURIComponent(selectedStore)}`, {
            cache: "no-store",
            signal,
          }),
          fetch(`/api/products?storeCode=${encodeURIComponent(selectedStore)}`, {
            cache: "no-store",
            signal,
          }),
        ]);

        if (ordersRes.status === 401 || intelRes.status === 401 || productsRes.status === 401) {
          router.push("/login");
          return;
        }

        if (!ordersRes.ok || !intelRes.ok || !productsRes.ok) {
          setDataError(
            "Veriler sunucudan alınamadı. Ekranda eksik veri gösterilmiyor — lütfen sayfayı yenileyin."
          );
          return;
        }

        const ordersJson = await ordersRes.json();
        const intelJson = await intelRes.json();
        const productsJson = await productsRes.json();

        setDataError(null);
        setOrders(ordersJson.orders ?? []);
        setStores(ordersJson.stores ?? []);
        setBatches(ordersJson.batches ?? []);
        setProductMasters(intelJson.productMasters ?? []);
        setProducts(productsJson.products ?? []);
        setProductSummary(productsJson.summary ?? null);
        setResearchers(intelJson.researchers ?? []);
        setBriefing(intelJson.morningBriefing ?? null);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        // Mock veriye sessizce düşmek yok (F-15): yönetici demo veriyi gerçek sanmamalı
        setDataError("Veriler yüklenemedi. Bağlantınızı kontrol edip sayfayı yenileyin.");
      } finally {
        setLoading(false);
      }
    },
    [selectedStore, router]
  );

  useEffect(() => {
    if (checkingAuth || !currentUser) return;
    const controller = new AbortController();

    // Yükleme bayrağı effect gövdesinde senkron set edilmez (cascading render);
    // async akışın içinde ayarlanır.
    async function run() {
      setLoading(true);
      await load(controller.signal);
    }

    void run();
    return () => controller.abort();
  }, [checkingAuth, currentUser, load]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await load();
  }, [load]);

  const applyOrderPatch = useCallback((id: number, patch: Partial<OrderView>) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }, []);

  const applyMasterPatch = useCallback((id: number, patch: Partial<ProductMasterView>) => {
    setProductMasters((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const prependOrder = useCallback((order: OrderView) => {
    setOrders((prev) => [order, ...prev]);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }, [router]);

  return {
    currentUser,
    checkingAuth,
    orders,
    stores,
    batches,
    productMasters,
    products,
    productSummary,
    researchers,
    briefing,
    loading,
    dataError,
    selectedStore,
    setSelectedStore,
    refresh,
    applyOrderPatch,
    applyMasterPatch,
    prependOrder,
    logout,
  };
}
