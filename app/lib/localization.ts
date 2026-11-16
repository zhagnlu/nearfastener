import { resolvePageRequest, renderFragments, interactionMessages, messageKeys } from '../../scripts/localization.mjs';
import { routes } from './content';
import header from '../../content/header.html?raw';
import footer from '../../content/footer.html?raw';
import behavior from '../../public/site.js?raw';
const dictionaries = import.meta.glob('../../content/locales/*.json', { import: 'default', eager: true }) as Record<string, Record<string, string>>;
export const dictionaryFor = (language: string) => dictionaries[`../../content/locales/${language}.json`];
export function localizedPage(pathname: string, search = '') {
  const request = resolvePageRequest(pathname, search, routes);
  if (!request) return null;
  return { ...request, dictionary: dictionaryFor(request.language) };
}
export function pageMarkup(body: string, path: string, language: string, dictionary: Record<string, string>) {
  return renderFragments(header, body, footer, path, language, dictionary, routes) + interactionMessages(dictionary, messageKeys(behavior));
}
