import type { Metadata } from "next";
import header from "../content/header.html?raw";
import footer from "../content/footer.html?raw";
import SiteEnhancements from "./SiteEnhancements";

export const metadata: Metadata = {
  title: "Custom Fasteners & OEM Bulk Supply | Near Fastener",
  description: "From custom screws and bolts to SEMS assemblies, we support OEM production and factory purchasing based on your drawings and requirements.",
  icons: {
    icon: { url: "/assets/brand/nearfastener_flag_transparent.png", type: "image/png" },
    shortcut: "/assets/brand/nearfastener_flag_transparent.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/site.css" />
        <link rel="stylesheet" href="/replica.css" />
      </head>
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <div className="site-shell">
          <div className="site-fragment" dangerouslySetInnerHTML={{ __html: header }} />
          {children}
          <div className="site-fragment" dangerouslySetInnerHTML={{ __html: footer }} />
        </div>
        <SiteEnhancements />
      </body>
    </html>
  );
}
