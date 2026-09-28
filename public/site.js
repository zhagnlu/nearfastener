// Shared, dependency-free behavior for the app and the standalone HTML export.
function initNearFastener() {
  const t = (text) => window.NearFastenerI18n?.t(text) ?? text;
  const header = document.querySelector('header');
  const main = document.querySelector('main');
  const toggle = header?.querySelector('[aria-label="Toggle menu"]');
  const desktopNav = header?.querySelector('nav');
  const route = document.querySelector('[data-page-path]')?.getAttribute('data-page-path') || location.pathname;

  const setCurrentNav = (nav) => {
    nav?.querySelectorAll('a').forEach((link) => {
      const target = link.dataset.route || new URL(link.href, location.href).pathname;
      const selected = route === target || route.startsWith(target + '/') || (target === '/products' && route.startsWith('/product/'));
      if (selected) {
        link.setAttribute('aria-current', 'page');
        link.classList.add('is-current');
      }
    });
  };
  setCurrentNav(desktopNav);

  if (header && toggle && desktopNav) {
    const mobileNav = desktopNav.cloneNode(true);
    mobileNav.id = 'mobile-navigation';
    mobileNav.className = 'mobile-navigation';
    mobileNav.setAttribute('aria-label', 'Mobile navigation');
    mobileNav.hidden = true;
    const quote = header.querySelector('a[href$="/rfq"], a[data-route="/rfq"]')?.cloneNode(true);
    if (quote) { quote.className = 'mobile-quote'; mobileNav.append(quote); }
    header.append(mobileNav);
    toggle.setAttribute('aria-controls', mobileNav.id);
    toggle.setAttribute('aria-expanded', 'false');
    const close = () => {
      mobileNav.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Toggle menu');
    };
    toggle.addEventListener('click', () => {
      const open = mobileNav.hidden;
      mobileNav.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Toggle menu');
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !mobileNav.hidden) { close(); toggle.focus(); }
    });
    document.addEventListener('click', (event) => {
      if (!mobileNav.hidden && !header.contains(event.target)) close();
    });
    mobileNav.addEventListener('click', (event) => { if (event.target.closest('a')) close(); });
    window.matchMedia('(min-width: 1280px)').addEventListener('change', (event) => { if (event.matches) close(); });
    const onScroll = () => header.classList.toggle('header-scrolled', window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Content remains fully visible if JavaScript is disabled or motion is reduced.
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('reveal-pending');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' });
    main?.querySelectorAll('[data-reveal]').forEach((element) => {
      if (element.getBoundingClientRect().top > window.innerHeight) {
        element.classList.add('reveal-pending');
        observer.observe(element);
      }
    });
  }

  document.querySelectorAll('[data-preview-form]').forEach((form) => {
    const feedback = form.querySelector('.form-feedback');
    const fileInput = form.querySelector('input[type="file"]');
    const dropzone = fileInput?.parentElement;
    let drawing = null;
    const showFeedback = (message, error = false) => {
      feedback.hidden = false;
      feedback.classList.toggle('form-error', error);
      feedback.replaceChildren(document.createTextNode(message));
    };
    const checkFile = (file) => {
      if (!file) { drawing = null; return; }
      const extension = file.name.split('.').pop()?.toLowerCase();
      const allowed = ['pdf', 'dwg', 'dxf', 'xls', 'xlsx', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
      if (!allowed.includes(extension)) {
        drawing = null;
        fileInput.value = '';
        fileInput.dataset.validationMessage = 'Choose a PDF, CAD, Office document, or JPG/PNG image.';
        fileInput.setCustomValidity(t(fileInput.dataset.validationMessage));
        showFeedback('Please choose a PDF, CAD, Office document, or JPG/PNG image.', true);
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        drawing = null;
        fileInput.value = '';
        fileInput.dataset.validationMessage = 'The file must be no larger than 20 MB.';
        fileInput.setCustomValidity(t(fileInput.dataset.validationMessage));
        showFeedback('The selected file exceeds the 20 MB limit.', true);
        return;
      }
      fileInput.dataset.validationMessage = '';
      fileInput.setCustomValidity('');
      drawing = file;
      const caption = dropzone.querySelector('p');
      if (caption) caption.dataset.noTranslate = '';
      if (caption) caption.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
      feedback.hidden = true;
    };
    if (fileInput && dropzone) {
      fileInput.accept = '.pdf,.dwg,.dxf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png';
      fileInput.addEventListener('change', () => checkFile(fileInput.files?.[0]));
      for (const eventName of ['dragenter', 'dragover']) {
        dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.add('is-dragging'); });
      }
      for (const eventName of ['dragleave', 'drop']) {
        dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.remove('is-dragging'); });
      }
      dropzone.addEventListener('drop', (event) => checkFile(event.dataTransfer?.files?.[0]));
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const entries = [...new FormData(form).entries()].filter(([, value]) => typeof value === 'string' && value.trim());
      const body = entries.map(([key, value]) => `${t(form.elements.namedItem(key)?.labels?.[0]?.textContent || key.replaceAll('_', ' '))}: ${value}`).join('\n\n');
      const text = `NEAR FASTENER — ${t(form.dataset.previewForm === 'rfq' ? 'Request a Quote' : 'Contact Us')}\n\n${body}${drawing ? `\n\n${t('Selected drawing')}: ${drawing.name}` : ''}\n\n${t('This request has not been sent. A selected drawing is not included in this text file.')}\n`;
      showFeedback('Your request is ready to download. No message or file has been sent.');
      const download = document.createElement('button');
      download.type = 'button';
      download.className = 'download-request';
      download.textContent = 'Download request';
      download.addEventListener('click', () => {
        const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = form.dataset.previewForm === 'rfq' ? 'near-fastener-rfq.txt' : 'near-fastener-message.txt';
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
      feedback.append(document.createElement('br'), download);
      feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });
  window.NearFastenerI18n?.init();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNearFastener, { once: true });
else initNearFastener();
