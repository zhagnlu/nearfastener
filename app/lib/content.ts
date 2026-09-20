import catalog from "../../content/routes.json";

export type PageInfo = { title: string; description: string; file: string };
export const routes = catalog as Record<string, PageInfo>;
const fragments = import.meta.glob("../../content/pages/**/*.html", {
  query: "?raw", import: "default", eager: true,
}) as Record<string, string>;

export function getPage(path: string) {
  const info = routes[path];
  return info ? { ...info, html: fragments[`../../content/pages/${info.file}`] } : undefined;
}
