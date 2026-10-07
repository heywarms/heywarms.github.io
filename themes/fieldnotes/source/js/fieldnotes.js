(() => {
  'use strict';
  const root = document.documentElement;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const themeButton = $('[data-toggle-theme]');
  const themeMedia = matchMedia('(prefers-color-scheme: dark)');
  let savedTheme;
  try { savedTheme = localStorage.getItem('fieldnotes-theme'); } catch (_) {}
  function applyTheme(theme) {
    root.dataset.theme = theme;
    themeButton.setAttribute('aria-label', theme === 'dark' ? '切换浅色模式' : '切换深色模式');
    $('meta[name="theme-color"]').content = theme === 'dark' ? '#171b19' : '#f7f6f2';
  }
  if (themeButton) {
    themeButton.hidden = false;
    applyTheme(root.dataset.theme || (themeMedia.matches ? 'dark' : 'light'));
    themeButton.addEventListener('click', () => {
      savedTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(savedTheme);
      try { localStorage.setItem('fieldnotes-theme', savedTheme); } catch (_) {}
    });
    themeMedia.addEventListener('change', event => { if (!savedTheme) applyTheme(event.matches ? 'dark' : 'light'); });
  }

  const menuButton = $('[data-toggle-menu]');
  const nav = $('#primary-nav');
  function closeMenu() {
    nav.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', '展开导航');
  }
  if (menuButton) {
    menuButton.hidden = false;
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') !== 'true';
      nav.classList.toggle('is-open', open);
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.setAttribute('aria-label', open ? '收起导航' : '展开导航');
    });
    document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
    nav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') { closeMenu(); menuButton.focus(); }
    });
    matchMedia('(max-width: 620px)').addEventListener('change', closeMenu);
  }

  let toastTimer;
  function notify(message) {
    const toast = $('.toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  }
  async function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const field = document.createElement('textarea');
    field.value = text;
    field.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
    document.body.appendChild(field);
    const focused = document.activeElement;
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    if (focused) focused.focus();
    if (!copied) throw new Error('Copy unavailable');
  }
  $$('[data-copy-link]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', async () => {
      try { await copy(location.href); notify('文章链接已复制'); }
      catch (_) { notify('复制失败，可以复制浏览器中的地址'); }
    });
  });
  $$('.prose figure.highlight').forEach(figure => {
    const content = figure.querySelector('.code');
    if (!content) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-code';
    button.textContent = '复制';
    button.setAttribute('aria-label', '复制代码');
    button.addEventListener('click', async () => {
      try { await copy(content.innerText.replace(/\n$/, '')); notify('代码已复制'); }
      catch (_) { notify('复制失败，请选择代码后复制'); }
    });
    figure.appendChild(button);
  });
  $$('.prose table').filter(table => !table.closest('.highlight')).forEach(table => {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-scroll';
    wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', '表格，可左右滚动');
    table.replaceWith(wrapper);
    wrapper.appendChild(table);
  });

  $$('dialog').forEach(dialog => {
    dialog.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); dialog.close(); }
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
  });
  const search = $('.search-dialog');
  const input = $('#search-input');
  const status = $('.search-status');
  const results = $('.search-results');
  let searchIndex;
  let pendingIndex;
  async function loadSearch() {
    if (searchIndex) return searchIndex;
    if (pendingIndex) return pendingIndex;
    pendingIndex = fetch(document.body.dataset.searchUrl)
      .then(response => { if (!response.ok) throw new Error('Search unavailable'); return response.json(); })
      .then(data => {
        if (!Array.isArray(data)) throw new Error('Invalid search data');
        searchIndex = data;
        return data;
      }).catch(error => { pendingIndex = undefined; throw error; });
    return pendingIndex;
  }
  async function renderSearch() {
    status.textContent = '正在翻找文章…';
    try {
      const index = await loadSearch();
      const query = input.value.trim().toLocaleLowerCase();
      const terms = query.split(/\s+/).filter(Boolean);
      const matches = query ? index.filter(post => {
        const haystack = [post.title, (post.categories || []).join(' '), post.content].join(' ').toLocaleLowerCase();
        return terms.every(term => haystack.includes(term));
      }).sort((a, b) => Number(b.title.toLocaleLowerCase().includes(query)) - Number(a.title.toLocaleLowerCase().includes(query))) : index;
      results.replaceChildren();
      status.textContent = query ? (matches.length ? '找到 ' + matches.length + ' 篇文章' + (matches.length > 30 ? '，先展示前 30 篇' : '') : '暂时没有找到，换个关键词试试。') : '最近的几篇记录';
      matches.slice(0, query ? 30 : 6).forEach(post => {
        const link = document.createElement('a');
        const url = new URL(post.url, location.origin);
        if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
        link.href = url.href;
        link.className = 'search-result';
        const title = document.createElement('h3');
        title.textContent = post.title;
        const description = document.createElement('p');
        description.textContent = post.excerpt;
        const meta = document.createElement('span');
        meta.textContent = [post.date, (post.categories || []).join(' / ')].filter(Boolean).join(' · ');
        link.append(title, description, meta);
        results.appendChild(link);
      });
    } catch (_) {
      results.replaceChildren();
      status.textContent = '暂时无法加载搜索，请通过下方入口浏览全部文章。';
    }
  }
  if (search && typeof search.showModal === 'function') {
    $$('[data-open-search]').forEach(button => {
      button.hidden = false;
      button.addEventListener('click', () => { closeMenu(); search.showModal(); input.focus(); renderSearch(); });
    });
    document.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !$('.image-dialog').open) {
        event.preventDefault();
        if (!search.open) search.showModal();
        input.focus();
        renderSearch();
      }
    });
    let debounce;
    input.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(renderSearch, 120); });
  }

  const viewer = $('.image-dialog');
  function viewImage(image, trigger) {
    if (!viewer || typeof viewer.showModal !== 'function') return;
    viewer.querySelector('img').src = image.currentSrc || image.src;
    viewer.querySelector('img').alt = image.alt || '文章图片';
    viewer.querySelector('p').textContent = image.alt || '';
    viewer.showModal();
    viewer.addEventListener('close', () => { if (trigger) trigger.focus({preventScroll: true}); }, {once: true});
  }
  $$('.prose img').filter(image => !image.closest('a')).forEach(image => {
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', '放大图片' + (image.alt ? '：' + image.alt : ''));
    image.addEventListener('click', () => viewImage(image, image));
    image.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); viewImage(image, image); }
    });
  });
  $$('[data-photo-view]').forEach(button => button.addEventListener('click', () => viewImage(button.querySelector('img'), button)));

  const article = $('#article-content');
  const progress = $('.reading-progress span');
  if (article && progress) {
    let queued = false;
    function updateProgress() {
      const rect = article.getBoundingClientRect();
      const total = Math.max(1, article.offsetHeight - window.innerHeight * .6);
      const value = Math.max(0, Math.min(1, (window.innerHeight * .2 - rect.top) / total));
      progress.style.transform = 'scaleX(' + value + ')';
      queued = false;
    }
    function queueProgress() { if (!queued) { queued = true; requestAnimationFrame(updateProgress); } }
    window.addEventListener('scroll', queueProgress, {passive: true});
    window.addEventListener('resize', queueProgress, {passive: true});
    if ('ResizeObserver' in window) new ResizeObserver(queueProgress).observe(article);
    queueProgress();
    const tocLinks = $$('.toc-link');
    const headings = [...article.querySelectorAll('h1[id],h2[id],h3[id]')];
    if ('IntersectionObserver' in window && tocLinks.length) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          tocLinks.forEach(link => {
            let target;
            try { target = decodeURIComponent(link.hash.slice(1)); } catch (_) { target = link.hash.slice(1); }
            const active = target === entry.target.id;
            link.classList.toggle('is-active', active);
            if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
          });
        });
      }, {rootMargin: '-8% 0px -70% 0px'});
      headings.forEach(heading => observer.observe(heading));
    }
    if (!headings.length && $('.post-toc')) $('.post-toc').hidden = true;
  }
})();
