import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

/**
 * Yazı tipleri artık `next/font/google` ile derleme anında indirilmiyor.
 * Google Fonts'a çıkış, ağı kısıtlı ortamlarda (CI, sandbox, kurumsal proxy)
 * derlemeyi uyarıya düşürüp fontları sessizce fallback'e çeviriyordu.
 * Tipografi yığını globals.css içindeki tokenlarda tanımlıdır.
 */

export const metadata: Metadata = {
  title: "CERBERUS | Karar Merkezli Ticaret İşletim Sistemi",
  description:
    "Çoklu mağaza ürün tedarik zekâsı, landed-cost kârlılık analizi, karar motoru ve pazaryeri operasyonları için kurumsal platform.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" className="dark">
      <body className="bg-surface-base text-ink font-sans antialiased selection:bg-brand/30">
        {children}
      </body>
    </html>
  );
}
