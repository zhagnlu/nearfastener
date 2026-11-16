import type { Metadata } from "next";
import { splitLocalePath } from "../scripts/localization.mjs";
import { dictionaryFor } from "./lib/localization";
import SiteEnhancements from "./SiteEnhancements";

export const metadata: Metadata = {
  title: "Custom Fasteners & OEM Bulk Supply | Near Fastener",
  description: "From custom screws and bolts to SEMS assemblies, we support OEM production and factory purchasing based on your drawings and requirements.",
  icons: {
    icon: { url: "/assets/brand/nearfastener_flag_transparent.png", type: "image/png" },
    shortcut: "/assets/brand/nearfastener_flag_transparent.png",
  },
};

export default async function RootLayout({
  children, params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ slug?: string[] }>;
}>) {
  const language = splitLocalePath("/" + ((await params).slug || []).join("/")).language || "en";
  return (
    <html lang={language} dir={language === "ar" ? "rtl" : "ltr"}>
      <head>
        <link rel="stylesheet" href="/site.css" />
        <link rel="stylesheet" href="/replica.css" />
      </head>
      <body>
        <a className="skip-link" href="#main-content">{dictionaryFor(language)["Skip to content"] || "Skip to content"}</a>
        <div className="site-shell">
          {children}
        </div>
        <SiteEnhancements />
      </body>
    </html>
  );
}
