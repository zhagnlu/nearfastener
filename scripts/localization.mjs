import { parseFragment, serialize } from 'parse5';
import en from '../content/locales/en.json' with { type: 'json' };
import zh from '../content/locales/zh-CN.json' with { type: 'json' };
import es from '../content/locales/es.json' with { type: 'json' };
import fr from '../content/locales/fr.json' with { type: 'json' };
import de from '../content/locales/de.json' with { type: 'json' };
import pt from '../content/locales/pt.json' with { type: 'json' };
import ru from '../content/locales/ru.json' with { type: 'json' };
import ar from '../content/locales/ar.json' with { type: 'json' };
import ja from '../content/locales/ja.json' with { type: 'json' };

export const languages = ['en', 'zh-CN', 'es', 'fr', 'de', 'pt', 'ru', 'ar', 'ja'];
export const languageNames = { en: 'English', 'zh-CN': '简体中文', es: 'Español', fr: 'Français', de: 'Deutsch', pt: 'Português', ru: 'Русский', ar: 'العربية', ja: '日本語' };
const dictionaries = { en, 'zh-CN': zh, es, fr, de, pt, ru, ar, ja };
export const translator = (language = 'en') => (text) => dictionaries[language]?.[text] ?? text;
export function localizedPath(path, language = 'en') {
  if (!languages.includes(language)) throw new Error(`Unsupported language: ${language}`);
  return `${language === 'en' ? '' : `/${language}`}${path === '/' ? '/' : `${path.replace(/\/$/, '')}/`}`;
}
export function resolveLocalizedPath(path) {
  const parts = path.split('/').filter(Boolean);
  const language = parts[0] !== 'en' && languages.includes(parts[0]) ? parts.shift() : 'en';
  return { language, path: parts.length ? '/' + parts.join('/') : '/' };
}
export function languageNavigation(path, language = 'en') {
  const t = translator(language);
  return `<nav class="language-links" aria-label="${t('Language')}" data-no-translate>${languages.map(code => `<a href="${localizedPath(path, code)}" data-language-code="${code}" lang="${code}" hreflang="${code}"${code === language ? ' aria-current="true"' : ''}>${languageNames[code]}</a>`).join('')}</nav>`;
}

// Parse text and attributes as HTML so entities, URLs, form values and scripts remain intact.
export function localizeHtml(html, language = 'en', transform) {
  const fragment = parseFragment(html);
  const t = translator(language);
  function visit(node, ignored = false) {
    const attrs = node.attrs ?? [];
    const skip = ignored || ['script', 'style', 'textarea'].includes(node.tagName) || attrs.some(attr => attr.name === 'data-no-translate');
    if (node.nodeName === '#text' && !skip) {
      const text = node.value.trim();
      if (text) node.value = node.value.replace(text, () => t(text));
    }
    if (!skip) for (const attr of attrs) if (['alt', 'title', 'placeholder', 'aria-label'].includes(attr.name)) attr.value = t(attr.value);
    if (node.tagName) transform?.(node);
    for (const child of node.childNodes ?? []) visit(child, skip);
  }
  visit(fragment);
  return serialize(fragment);
}
