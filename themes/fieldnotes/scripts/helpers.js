'use strict';

const { stripHTML, unescapeHTML } = require('hexo-util');

function postsFrom(collection) {
  const items = collection && typeof collection.toArray === 'function' ? collection.toArray() : [];
  return items.filter(post => post.published !== false && !String(post.source || '').startsWith('_drafts/'));
}

function plain(content) {
  return unescapeHTML(stripHTML(String(content || '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')))
    .replace(/\s+/g, ' ').trim();
}

hexo.extend.helper.register('fn_posts', function(collection) {
  return postsFrom(collection || this.site.posts).sort((a, b) => Number(b.date) - Number(a.date));
});
hexo.extend.helper.register('fn_excerpt', function(post, length = 92) {
  const text = plain(post.description || post.excerpt || post.content || '');
  return text.length > length ? text.slice(0, length).trim() + '…' : text;
});
hexo.extend.helper.register('fn_minutes', function(post) {
  const text = plain(post.content);
  const chinese = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const words = text.replace(/[\u3400-\u9fff]/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(chinese / 400 + words / 220));
});
hexo.extend.helper.register('fn_featured', function() {
  const all = postsFrom(this.site.posts);
  const picked = (this.theme.featured || []).map(item => {
    const post = all.find(post => post.title === item.title || post.source === item.source);
    return post ? { post, ...item } : null;
  }).filter(Boolean);
  if (picked.length) return picked.slice(0, 3);
  return all.sort((a, b) => Number(b.date) - Number(a.date)).slice(0, 3)
    .map((post, i) => ({ post, label: 'FIELD NOTES', artwork: ['containers', 'database', 'intelligence'][i] }));
});
hexo.extend.helper.register('fn_categories', function(post) {
  return post.categories && typeof post.categories.toArray === 'function' ? post.categories.toArray() : [];
});
hexo.extend.helper.register('fn_is_life', function(post) {
  const names = (this.theme.life && this.theme.life.categories) || [];
  const categories = post.categories && typeof post.categories.toArray === 'function' ? post.categories.toArray() : [];
  return categories.some(category => names.includes(category.name));
});
hexo.extend.helper.register('fn_icon', function(name, className = '') {
  const paths = {
    arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    northeast: '<path d="M6 18 18 6M6 6h12v12"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
    moon: '<path d="M20.5 14a8.7 8.7 0 0 1-10.5-10.5A9 9 0 1 0 20.5 14Z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
    github: '<path d="M9 19c-4 1-4-2-5-2m10 4v-3.9a3.4 3.4 0 0 0-1-2.6c3.3-.4 6.8-1.6 6.8-7.4A5.8 5.8 0 0 0 18.2 3 5.4 5.4 0 0 0 18 0s-1.3-.4-4.3 1.6a15 15 0 0 0-7.8 0C2.9-.4 1.6 0 1.6 0a5.4 5.4 0 0 0-.2 3A5.8 5.8 0 0 0 0 7.1c0 5.8 3.5 7 6.8 7.4a3.4 3.4 0 0 0-1 2.6V21" transform="translate(2 1) scale(.95)"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/>',
    spark: '<path d="M12 1v22M1 12h22M4.2 4.2l15.6 15.6M4.2 19.8 19.8 4.2"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    back: '<path d="M19 12H5m7-7-7 7 7 7"/>'
  };
  return '<svg class="icon ' + String(className).replace(/[^a-zA-Z0-9 _-]/g, '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.arrow) + '</svg>';
});

hexo.extend.generator.register('fieldnotes-search', function(locals) {
  const urlFor = hexo.extend.helper.get('url_for').bind(hexo);
  return {
    path: 'fieldnotes/search.json',
    data: JSON.stringify(postsFrom(locals.posts).sort((a, b) => Number(b.date) - Number(a.date)).map(post => ({
      title: post.title || '未命名文章',
      url: urlFor(post.path),
      excerpt: plain(post.excerpt || post.content).slice(0, 140),
      content: plain(post.content),
      categories: post.categories.toArray().map(category => category.name),
      date: post.date.format('YYYY-MM-DD')
    })))
  };
});

hexo.extend.generator.register('fieldnotes-life', function(locals) {
  if (locals.pages.toArray().some(page => /^(?:life\/?|life\/index\.html)$/.test(page.path))) return [];
  return { path: 'life/index.html', layout: 'life', data: { title: '生活切片', fieldnotes_life: true } };
});
