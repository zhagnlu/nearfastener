// Local dictionaries only: script loading also works when opening the static export via file://.
(() => {
  const base = new URL('locales/', document.currentScript.src);
  const languages = [['en', 'English'], ['zh-CN', '简体中文'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['pt', 'Português'], ['ru', 'Русский'], ['ar', 'العربية'], ['ja', '日本語']];
  const supported = new Set(languages.map(([code]) => code));
  const packs = new Map([['en', {}]]);
  const loading = new Map();
  const invariantText = new Set();
  const originals = new WeakMap();
  let active = 'en';
  let serial = 0;
  let observer;
  let selector;
  let status;
  const ignored = 'script, style, noscript, textarea, [data-no-translate], [contenteditable="true"]';
  const t = (source) => {
    const dictionary = packs.get(active);
    return dictionary && Object.hasOwn(dictionary, source) ? dictionary[source] : source;
  };
  const load = (code) => {
    if (packs.has(code)) return Promise.resolve();
    if (loading.has(code)) return loading.get(code);
    const pending = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL(`${code}.js`, base).href;
      script.onload = () => { script.remove(); if (packs.has(code)) resolve(); else reject(new Error('Invalid language file')); };
      script.onerror = () => { script.remove(); reject(new Error('Language file unavailable')); };
      document.head.append(script);
    }).catch((error) => { loading.delete(code); throw error; });
    loading.set(code, pending);
    return pending;
  };
  function valueFor(node, key, current) {
    let record = originals.get(node);
    if (!record) { record = {}; originals.set(node, record); }
    // Remember English, but accept new source content inserted by navigation or form interactions.
    if (!record[key] || record[key].output !== current) record[key] = { source: current, output: current };
    const source = record[key].source;
    const trimmed = source.trim();
    const output = trimmed ? source.replace(trimmed, () => t(trimmed)) : source;
    record[key].output = output;
    return output;
  }
  function translateTree(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      if (!root.parentElement?.closest(ignored)) {
        root.nodeValue = valueFor(root, 'text', root.nodeValue);
        const source = originals.get(root)?.text.source.trim();
        if (source && root.parentElement?.childElementCount === 0) root.parentElement.toggleAttribute('data-i18n-ltr', invariantText.has(source));
      }
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE || root.closest(ignored)) return;
    for (const attr of ['placeholder', 'aria-label', 'alt', 'title']) {
      if (root.hasAttribute(attr)) root.setAttribute(attr, valueFor(root, attr, root.getAttribute(attr)));
    }
    if (root.matches('meta[name="description"]')) root.content = valueFor(root, 'content', root.content);
    if (root.matches('input[data-validation-message]')) root.setCustomValidity(t(root.dataset.validationMessage));
    for (const child of root.childNodes) translateTree(child);
  }
  function updateLinks() {
    document.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute('href');
      if (href.startsWith('#') || link.hasAttribute('download')) return;
      const url = new URL(href, location.href);
      if (url.protocol !== location.protocol || url.host !== location.host || !['http:', 'https:', 'file:'].includes(url.protocol)) return;
      if (/\.(?:pdf|jpg|png|zip|xlsx?|docx?)$/i.test(url.pathname)) return;
      if (active === 'en') url.searchParams.delete('lang'); else url.searchParams.set('lang', active);
      // Absolute file URLs are only produced at runtime, leaving the export relocatable.
      if (link.href !== url.href) link.href = url.href;
    });
  }
  function observe() {
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'alt', 'title', 'content', 'data-validation-message'] });
  }
  function render() {
    observer.disconnect();
    translateTree(document.documentElement);
    selector.setAttribute('aria-label', t('Language'));
    document.documentElement.lang = active;
    document.documentElement.dir = active === 'ar' ? 'rtl' : 'ltr';
    updateLinks();
    observe();
  }
  async function change(code, persist = true) {
    if (!supported.has(code)) return;
    const request = ++serial;
    selector.setAttribute('aria-busy', 'true');
    status.textContent = t('Loading language…');
    try {
      await load(code);
      if (request !== serial) return;
      active = code;
      selector.value = code;
      render();
      if (persist) {
        try { localStorage.setItem('nearfastener-language', code); } catch { /* Storage can be disabled. */ }
        try {
          const url = new URL(location.href);
          if (code === 'en') url.searchParams.delete('lang'); else url.searchParams.set('lang', code);
          history.replaceState(null, '', url);
        } catch { /* Some browsers disallow file:// history changes. */ }
      }
      status.textContent = '';
      document.dispatchEvent(new CustomEvent('nearfastener:language', { detail: { language: code } }));
    } catch {
      if (request !== serial) return;
      selector.value = active;
      status.textContent = t('Language could not be loaded. Please try again.');
    } finally {
      if (request === serial) selector.removeAttribute('aria-busy');
    }
  }
  function init() {
    if (selector) return;
    const headerRow = document.querySelector('header > div > div');
    if (!headerRow) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'language-switcher';
    wrapper.innerHTML = '<svg class="language-icon" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"></circle><ellipse cx="12" cy="12" rx="4" ry="9"></ellipse><path d="M3 12h18"></path></svg><select aria-label="Language" id="site-language" data-no-translate></select><span class="language-status" role="status" aria-live="polite" data-no-translate></span>';
    selector = wrapper.querySelector('select');
    // Native names remain readable regardless of the currently selected language.
    for (const [code, name] of languages) selector.add(new Option(name, code));
    status = wrapper.querySelector('[role="status"]');
    const menu = headerRow.querySelector('button');
    headerRow.insertBefore(wrapper, menu);
    selector.addEventListener('change', () => change(selector.value));
    observer = new MutationObserver((records) => {
      observer.disconnect();
      for (const record of records) {
        if (record.type === 'childList') record.addedNodes.forEach(translateTree);
        else translateTree(record.target);
      }
      updateLinks();
      observe();
    });
    observe();
    let saved;
    try { saved = localStorage.getItem('nearfastener-language'); } catch { /* Use English if storage is unavailable. */ }
    const requested = new URL(location.href).searchParams.get('lang');
    change(supported.has(requested) ? requested : supported.has(saved) ? saved : 'en', false);
    window.addEventListener('popstate', () => {
      const code = new URL(location.href).searchParams.get('lang') || 'en';
      change(supported.has(code) ? code : 'en', false);
    });
  }
  window.NearFastenerI18n = { init, t, change, register: (code, dictionary, invariants = []) => {
    if (supported.has(code)) { packs.set(code, dictionary); invariants.forEach(value => invariantText.add(value)); }
  } };
})();
