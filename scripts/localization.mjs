export const languages = ['en', 'zh-CN', 'es', 'fr', 'de', 'pt', 'ru', 'ar', 'ja'];
export const languageNames = ['English', '简体中文', 'Español', 'Français', 'Deutsch', 'Português', 'Русский', 'العربية', '日本語'];
export const escapeHtml = (s) => String(s).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export const decodeHtml = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, e) => e.startsWith('#x') ? String.fromCodePoint(parseInt(e.slice(2), 16)) : e.startsWith('#') ? String.fromCodePoint(Number(e.slice(1))) : ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'}[e.toLowerCase()]));
export function splitLocalePath(pathname) {
  const clean = pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '') || '/';
  const parts = clean.split('/');
  const language = languages.find(code => code.toLowerCase() === parts[1]?.toLowerCase());
  return { language, path: language ? '/' + parts.slice(2).join('/') : clean };
}
export function localizedPath(path, language) {
  const [, pathname, suffix] = path.match(/^([^?#]*)(.*)$/);
  const bare = splitLocalePath(pathname).path;
  return `/${language.toLowerCase()}${bare === '/' ? '/' : bare + '/'}${suffix}`;
}
export function resolvePageRequest(pathname, search, routes) {
  const { language, path } = splitLocalePath(pathname);
  if (!routes[path]) return null;
  const params = new URLSearchParams(search);
  const legacy = languages.find(code => code.toLowerCase() === params.get('lang')?.toLowerCase());
  const code = language || legacy || 'en';
  const canonical = localizedPath(path, code);
  const hadLang = params.has('lang');
  params.delete('lang');
  const query = hadLang ? params.toString() : String(search || '').replace(/^\?/, '');
  return { language: code, path, canonical, redirect: pathname !== canonical || hadLang ? canonical + (query ? '?' + query : '') : null };
}
export const translate = (text, dictionary) => dictionary[text] || text;
// Translate text tokens and user-facing attributes at render/build time. Never rewrite markup as translated text.
export function localizeHtml(html, language, dictionary, routes) {
  const text = (value) => {
    const decoded = decodeHtml(value);
    const key = decoded.trim();
    return key && dictionary[key] ? escapeHtml(decoded.replace(key, () => dictionary[key])) : value;
  };
  let ignored = 0;
  return html.split(/(<[^>]+>)/g).map(token => {
    if (!token.startsWith('<')) return ignored ? token : text(token);
    if (/^<\/(script|style|textarea)\b/i.test(token)) ignored--;
    else if (/^<(script|style|textarea)\b/i.test(token)) ignored++;
    if (ignored) return token;
    return token.replace(/\b(placeholder|aria-label|alt|title|data-product-title)="([^"]*)"/g, (_, attr, value) => `${attr}="${text(value)}"`)
      .replace(/\b(href|action)="(\/[^"?#]*)([^"]*)"/g, (match, attr, path, suffix) => routes[path] ? `data-route="${path}" ${attr}="${localizedPath(path, language)}${suffix}"` : match);
  }).join('');
}
export function languageMenu(path, language, dictionary) {
  return `<div class="language-switcher"><details class="language-menu"><summary>${languageNames[languages.indexOf(language)]}</summary><nav aria-label="${escapeHtml(translate('Language', dictionary))}">${languages.map((code, index) => `<a data-language="${code}" lang="${code}" hreflang="${code}" href="${localizedPath(path, code)}"${code === language ? ' aria-current="page"' : ''}>${languageNames[index]}</a>`).join('')}</nav></details></div>`;
}
export function renderFragments(header, body, footer, path, language, dictionary, routes) {
  const markup = localizeHtml(header + body + footer, language, dictionary, routes);
  // Place the ordinary link menu before the existing mobile toggle.
  return markup.replace(/<button\b/, languageMenu(path, language, dictionary) + '<button');
}
export function interactionMessages(dictionary, keys) {
  return `<div hidden id="site-messages">${keys.map(key => `<span data-source="${escapeHtml(key)}">${escapeHtml(translate(key, dictionary))}</span>`).join('')}</div>`;
}
export function messageKeys(behavior) {
  return [...new Set(['Toggle menu', 'Close menu', 'Request a Quote', 'Contact Us', ...[...behavior.matchAll(/\bt\('([^']+)'\)|showFeedback\('([^']+)'\)|validationMessage = '([^']+)'/g)].map(match => match[1] || match[2] || match[3])])];
}
