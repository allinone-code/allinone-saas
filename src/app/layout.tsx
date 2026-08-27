import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cerberus — Commerce Intelligence",
  description: "Product Intelligence & Commerce Operations Platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="tr"><body>{children}</body></html>;
}
