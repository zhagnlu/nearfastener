function contactEmailDraft(values, t = (text) => text) {
  const subject = String(values.subject || 'Near Fastener enquiry').slice(0, 300);
  const name = String(values.name || '').slice(0, 300);
  const email = String(values.email || '').slice(0, 300);
  const message = String(values.message || '').slice(0, 5000);
  const body = `${t('Name')}: ${name}\n${t('Email')}: ${email}\n\n${message}`;
  return `mailto:info@nearfastener.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

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

  const articleFilters = document.querySelector('[data-resource-filters]');
  if (articleFilters) {
    const buttons = [...articleFilters.querySelectorAll('[data-resource-filter]')];
    const articles = document.querySelectorAll('[data-resource-card]');
    const selectTopic = (topic) => {
      if (!buttons.some((button) => button.dataset.resourceFilter === topic)) topic = 'all';
      buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.resourceFilter === topic)));
      articles.forEach((article) => { article.hidden = topic !== 'all' && article.dataset.topic !== topic; });
    };
    selectTopic(new URLSearchParams(location.search).get('topic') || 'all');
    buttons.forEach((button) => button.addEventListener('click', () => selectTopic(button.dataset.resourceFilter)));
    articleFilters.hidden = false;
  }

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
    if (form.dataset.previewForm === 'rfq') {
      const params = new URLSearchParams(location.search);
      const product = [...form.querySelectorAll('[data-rfq-product-id]')].find((item) => item.dataset.rfqProductId === params.get('product_id'));
      if (product) {
        form.querySelector('[data-rfq-context]').hidden = false;
        product.hidden = false;
        const productField = form.elements.namedItem('product');
        let automaticTitle = product.dataset.productTitle;
        productField.value = automaticTitle;
        document.addEventListener('nearfastener:language', () => {
          if (productField.value === automaticTitle) {
            automaticTitle = t(product.dataset.productTitle);
            productField.value = automaticTitle;
          }
        });
        form.elements.namedItem('standard').value = product.dataset.productStandard;
        for (const name of ['diameter', 'length', 'thread_pitch', 'material', 'property_class', 'surface_treatment', 'quantity']) {
          const value = params.get(name);
          if (value && value.length <= 160) {
            form.elements.namedItem(name).value = name === 'length' && params.get('length_unit') === 'mm' && /^\d+(?:\.\d+)?$/.test(value) ? `${value} mm` : value;
          }
        }
      }
    }
    const feedback = form.querySelector('.form-feedback');
    const fileInput = form.querySelector('input[type="file"]');
    const dropzone = fileInput?.parentElement;
    let drawing = null;
    const showFeedback = (message, error = false) => {
      feedback.hidden = false;
      feedback.classList.toggle('form-error', error);
      feedback.replaceChildren(document.createTextNode(t(message)));
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
    let submissionId = null;
    let submitting = false;
    let submitted = false;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      if (form.hasAttribute('data-rfq-submit')) {
        if (submitting || submitted) return;
        const button = form.querySelector('button[type="submit"]');
        if (location.protocol === 'file:') { showFeedback('Online submission is unavailable here. Please email info@nearfastener.com with your requirements and drawing.', true); return; }
        submissionId ??= crypto.randomUUID();
        const data = new FormData(form);
        data.set('submission_id', submissionId);
        data.set('language', document.documentElement.lang || 'en');
        const productId = new URLSearchParams(location.search).get('product_id');
        if (productId) data.set('product_id', productId);
        if (drawing) data.set('drawing', drawing, drawing.name);
        submitting = true;
        button.disabled = true;
        showFeedback('Submitting your request...');
        try {
          const response = await fetch('/api/rfq', { method: 'POST', body: data, signal: AbortSignal.timeout(45000) });
          const result = await response.json();
          if (!response.ok) {
            const messages = {
              not_configured: 'Online submission is not enabled yet. Please email info@nearfastener.com with your requirements and drawing.',
              too_large: 'The selected file exceeds the 20 MB limit.',
              invalid_file: 'Please choose a PDF, CAD, Office document, or JPG/PNG image.',
              invalid: 'Please check the required fields and email address.',
            };
            showFeedback(messages[result.error] || 'Submission failed. Please try again or email info@nearfastener.com.', true);
          } else if (result.id && ['notified', 'queued'].includes(result.status)) {
            submitted = true;
            showFeedback(result.status === 'notified' ? 'Your request has been saved and the email notification has been sent.' : 'Your request has been saved. The email notification is pending and will be retried.');
            const reference = document.createElement('p');
            reference.textContent = `${t('Request reference')}: ${result.id}`;
            reference.dataset.noTranslate = '';
            feedback.append(reference);
          } else { showFeedback('Submission failed. Please try again or email info@nearfastener.com.', true); }
        } catch { showFeedback('Unable to confirm submission. Please retry with this form or email info@nearfastener.com.', true); }
        finally { submitting = false; button.disabled = submitted; }
        feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      if (form.dataset.previewForm === 'contact') {
        const data = new FormData(form);
        const draft = document.createElement('a');
        draft.href = contactEmailDraft(Object.fromEntries(data), t);
        draft.textContent = t('Open Email Draft');
        draft.className = 'download-request';
        showFeedback('Your email draft is ready. Send it from your email app.');
        feedback.append(document.createElement('br'), draft);
        draft.click();
        return;
      }
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
  const requestLanguages = document.querySelectorAll('[data-request-language]');
  document.addEventListener('nearfastener:language', (event) => {
    requestLanguages.forEach((input) => { input.value = event.detail.language; });
  });
  window.NearFastenerI18n?.init();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNearFastener, { once: true });
else initNearFastener();
