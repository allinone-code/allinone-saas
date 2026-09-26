"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bookmark,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  RefreshCw,
} from "lucide-react";

interface CaptureTokenState {
  hasToken: boolean;
  token: string | null;
  bookmarklet: string | null;
  message?: string;
  revoked?: boolean;
}

/**
 * Bookmarklet kurulum bölümü.
 *
 * Neden bu yol birincil: VitaminShoppe ve benzeri perakende siteleri
 * sunucudan gelen isteği engelliyor (DataDome — TLS parmak izi + JavaScript
 * istiyor). Bookmarklet ise KULLANICININ KENDİ tarayıcısından, oturumu
 * açıkken çalışır. Site gerçek bir tarayıcı isteği gördüğü için engellemez;
 * proxy, ABD sunucusu veya Docker gerekmez.
 */
export function BookmarkletSetup({ defaultStore }: { defaultStore: string }) {
  const [state, setState] = useState<CaptureTokenState | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (method: "GET" | "POST") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/crawler/capture-token", { method });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Token alınamadı");
      setState(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load("GET");
  }, [load]);

  return (
    <div className="rounded-2xl border border-positive/25 bg-positive/5 p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-positive/30 bg-positive/15 text-positive">
          <Bookmark className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-ink">Tarayıcıdan Yakala (önerilen)</h3>
          <p className="mt-1 text-xs font-mono-tech leading-relaxed text-ink-muted">
            Bu siteler sunucudan gelen isteği engelliyor. Bu yöntem bot korumasıyla hiç
            savaşmaz: <span className="font-bold text-ink">sizin tarayıcınızdan</span>, oturumunuz
            açıkken, tek tıkla veri alır. Sunucu, proxy veya Docker gerektirmez.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      {!state && !error && (
        <div className="mt-4 flex items-center gap-2 text-xs font-mono-tech text-ink-faint">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Token hazırlanıyor…
        </div>
      )}

      {state && !state.token && (
        <div className="mt-4 rounded-xl border border-line bg-surface-1 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-positive">
            <CheckCircle2 className="h-4 w-4" />
            <span>Bookmarklet kurulmuş</span>
          </div>
          <p className="mt-2 text-xs font-mono-tech text-ink-muted">
            {state.message ?? "Token aktif. Metni kaybettiyseniz yenileyebilirsiniz."}
          </p>
          <button
            onClick={() => void load("POST")}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-bold text-ink-muted hover:text-ink disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
            Token yenile
          </button>
        </div>
      )}

      {state?.token && state.bookmarklet && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-line bg-surface-1 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-ink">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[10px] text-white">
                1
              </span>
              Bağlantıyı sürükleyip tarayıcı çubuğuna bırakın
            </div>
            <p className="mt-1.5 pl-7 text-[11px] font-mono-tech text-ink-faint">
              Aşağıdaki butonu tutup{" "}
              <span className="text-ink">tarayıcılar çubuğuna</span> sürükleyin. Adres
              çubuğuna <span className="text-ink">yapıştırmayın</span> — birçok tarayıcı
              <code>javascript:</code> yapıştırmayı engeller.
            </p>
            {/* `javascript:` href sürükle-bırak ile çalışır; tıklayınca değil.
                Bu yüzden tıklama engellenir. */}
            <a
              href={state.bookmarklet}
              onClick={(e) => e.preventDefault()}
              draggable
              className="mt-3 ml-7 inline-flex cursor-grab items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-xs font-bold text-white active:cursor-grabbing"
            >
              <Bookmark className="h-3.5 w-3.5" /> Cerberus · Ürünü Yakala
            </a>
          </div>

          <div className="rounded-xl border border-line bg-surface-1 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-ink">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[10px] text-white">
                2
              </span>
              Ürün sayfasındayken çubuktaki ikona tıklayın
            </div>
            <p className="mt-1.5 pl-7 text-[11px] font-mono-tech text-ink-faint">
              Ürünü açın (kategori listesi değil), sonra çubuktaki{" "}
              <span className="text-ink">Cerberus · Ürünü Yakala</span> ikonuna tıklayın.
              Sağ üstte kaç ürünün kaydedildiğini ve fiyat düştüyse bildirimini görürsünüz.
            </p>
          </div>

          <div className="rounded-xl border border-line bg-surface-1 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-ink">
              <KeyRound className="h-3.5 w-3.5" />
              Token
            </div>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-3 px-2.5 py-1.5 text-[10px] font-mono-tech text-ink-muted">
                {state.token}
              </code>
              <button
                onClick={() => {
                  void navigator.clipboard
                    .writeText(state.token ?? "")
                    .then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    })
                    .catch(() => setError("Kopyalanamadı — metni elle seçebilirsiniz."));
                }}
                className="shrink-0 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-ink-muted hover:text-ink"
                title="Kopyala"
                aria-label="Token'ı kopyala"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-positive" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <p className="mt-2 text-[10px] font-mono-tech text-ink-faint">
              Mağaza: <span className="text-ink-muted">{defaultStore}</span> · Token yalnız ürün
              eklemeye yarar; okuma veya silme yetkisi vermez. Şifreli saklanır, bu metin
              tekrar gösterilemez.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
