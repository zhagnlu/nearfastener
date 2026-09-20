import type { Metadata } from "next";
import header from "../content/header.html?raw";
import footer from "../content/footer.html?raw";
import SiteEnhancements from "./SiteEnhancements";

export const metadata: Metadata = {
  title: "High Strength Fastener Manufacturer in China | Near Fastener",
  description: "Bolts, nuts, studs and custom fasteners. GB / DIN / ISO / ASTM / EN standards. Near Fastener.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
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
