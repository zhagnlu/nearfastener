import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import catalog from "../../content/catalog.json";
import site from "../../content/site.json";
import { pageSeo, safeJson } from "../../scripts/seo.mjs";
import { getPage, routes } from "../lib/content";

import { localizedPage, pageMarkup } from "../lib/localization";
type PageProps = { params: Promise<{ slug?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
async function requestFor(props: PageProps) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await props.searchParams)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  return localizedPage(pathFor((await props.params).slug), query.toString());
}
const pathFor = (slug?: string[]) => slug?.length ? "/" + slug.join("/") : "/";

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const request = await requestFor(props);
  const page = request && getPage(request.path);
  if (!page || !request) return { title: "Page Not Found | Near Fastener", robots: { index: false, follow: false } };
  const seo = pageSeo(request.path, page, catalog, site, routes, request.language, request.dictionary);
  return { title: seo.title, description: seo.description, ...(seo.canonical ? { alternates: { canonical: seo.canonical, languages: Object.fromEntries(seo.alternates.map((item: {language: string; url: string}) => [item.language, item.url])) } } : {}), openGraph: { title: seo.title, description: seo.description, type: "website", ...(seo.canonical ? { url: seo.canonical } : {}), ...(seo.image ? { images: [seo.image] } : {}) }, twitter: { card: "summary_large_image", title: seo.title, description: seo.description, ...(seo.image ? { images: [seo.image] } : {}) } };
}

export default async function Page(props: PageProps) {
  const request = await requestFor(props);
  if (!request) notFound();
  const pathname = pathFor((await props.params).slug);
  if (request.redirect && request.canonical.replace(/\/$/, "") !== pathname.replace(/\/$/, "")) permanentRedirect(request.redirect);
  const {path, language, dictionary} = request;
  const page = getPage(path);
  if (!page) notFound();
  const seo = pageSeo(path, page, catalog, site, routes, language, dictionary);
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(seo.structuredData) }} /><div className="site-fragment" data-page-path={path} dangerouslySetInnerHTML={{ __html: pageMarkup(page.html, path, language, dictionary) }} /></>;
}
