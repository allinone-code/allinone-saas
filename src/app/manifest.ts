import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CERBERUS Commerce OS",
    short_name: "CERBERUS",
    description:
      "Karar merkezli ticaret işletim sistemi: ürün zekâsı, sipariş operasyonu ve kârlılık.",
    start_url: "/",
    display: "standalone",
    background_color: "#070A12",
    theme_color: "#070A12",
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
