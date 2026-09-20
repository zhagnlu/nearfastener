import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage } from "../lib/content";

type PageProps = { params: Promise<{ slug?: string[] }> };
const pathFor = (slug?: string[]) => slug?.length ? "/" + slug.join("/") : "/";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const page = getPage(pathFor((await params).slug));
  return { title: page?.title ?? "Page Not Found | Near Fastener", description: page?.description };
}

export default async function Page({ params }: PageProps) {
  const path = pathFor((await params).slug);
  const page = getPage(path);
  if (!page) notFound();
  return <div className="site-fragment" data-page-path={path} dangerouslySetInnerHTML={{ __html: page.html }} />;
}
