import type { Metadata } from "next";
import { notFound } from "next/navigation";
import catalog from "../../content/catalog.json";
import site from "../../content/site.json";
import { pageSeo, safeJson } from "../../scripts/seo.mjs";
import { getPage, routes } from "../lib/content";

type PageProps = { params: Promise<{ slug?: string[] }> };
const pathFor = (slug?: string[]) => slug?.length ? "/" + slug.join("/") : "/";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const page = getPage(pathFor((await params).slug));
  if (!page) return { title: "Page Not Found | Near Fastener", robots: { index: false, follow: false } };
  const seo = pageSeo(pathFor((await params).slug), page, catalog, site, routes);
  return { title: seo.title, description: seo.description, ...(seo.canonical ? { alternates: { canonical: seo.canonical } } : {}), openGraph: { title: seo.title, description: seo.description, type: "website", ...(seo.canonical ? { url: seo.canonical } : {}), ...(seo.image ? { images: [seo.image] } : {}) }, twitter: { card: "summary_large_image", title: seo.title, description: seo.description, ...(seo.image ? { images: [seo.image] } : {}) } };
}

export default async function Page({ params }: PageProps) {
  const path = pathFor((await params).slug);
  const page = getPage(path);
  if (!page) notFound();
  const seo = pageSeo(path, page, catalog, site, routes);
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(seo.structuredData) }} /><div className="site-fragment" data-page-path={path} dangerouslySetInnerHTML={{ __html: page.html }} /></>;
}
