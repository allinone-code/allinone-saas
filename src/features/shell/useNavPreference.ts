"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "cerberus:navCollapsed";

/**
 * Sol menünün daraltılmış tercihi.
 *
 * Neden `useSyncExternalStore`?
 * `useState(() => localStorage.getItem(...))` ile okumak sunucuda `false`,
 * istemcide `true` üretip **hidrasyon uyumsuzluğuna** yol açardı. Bu hook
 * sunucu anlık görüntüsünü (`getServerSnapshot`) ayrıca verdiği için ilk
 * render iki tarafta da aynı olur, tercih hidrasyondan sonra uygulanır.
 */
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("cerberus:nav-pref", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("cerberus:nav-pref", callback);
  };
}

function getSnapshot(): boolean {
  return window.localStorage.getItem(KEY) === "1";
}

function getServerSnapshot(): boolean {
  return false;
}

export function useNavPreference(): [boolean, () => void] {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next = window.localStorage.getItem(KEY) === "1" ? "0" : "1";
    window.localStorage.setItem(KEY, next);
    window.dispatchEvent(new Event("cerberus:nav-pref"));
  }, []);

  return [collapsed, toggle];
}
