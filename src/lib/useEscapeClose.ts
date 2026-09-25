"use client";

import { useEffect } from "react";

/**
 * Açık modal/çekmecelerde ESC ile kapatma (WCAG 2.1.1).
 * `active` kapalıyken dinleyici takılmaz.
 */
export function useEscapeClose(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onClose]);
}
