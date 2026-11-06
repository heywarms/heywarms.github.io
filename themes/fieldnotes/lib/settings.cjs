'use strict';

// Only presentation settings live here; article files are never changed.
// Cinema modules make up the dark homepage and share one stylesheet: the stage
// plus either full-screen "floors" (episode…dispatch) or glass "deck" cards (routes…connect).
const deckModules = ['routes', 'glossary', 'videos', 'updates', 'connect'];
const planetTypes = ['ocean', 'gas', 'desert', 'ice', 'lava'];
const cinemaModules = ['stage', 'episode', 'notes', 'profile', 'dispatch', ...deckModules];
const modules = ['hero', 'interlude', 'topics', 'featured', 'projects', 'journal', 'about', ...cinemaModules];
const defaults = {
  brand_avatar: '',
  cinema: {accent: '#C6FF3D', sphere_a: '#6EE7FF', sphere_b: '#A78BFA', fonts: 'https://fonts.googleapis.com/css2?family=Anton&family=Condiment&display=swap'},
  archive: {categories: [], text: '早期档案：之前写的技术笔记', name: '早期档案', description: '之前写的技术笔记，继续保留、可以搜到。', planet: 'ice'},
  social: {github: '', bilibili: '', xiaohongshu: '', douyin: '', wechat: '', rss: '', email: ''},
  navigation: [
    {title: '首页', url: '/'}, {title: '专题', url: '/topics/'},
    {title: '文章', url: '/archives/'}, {title: '作品', url: '/projects/'},
    {title: '生活', url: '/life/'}, {title: '关于', url: '/about/'}
  ],
  appearance: {mode: 'system', toggle: true, accent: '#3158df', accent_dark: '#9aaeff', background: '#f7f6f2', background_dark: '#171b19', content_width: 1200, font: 'sans'},
  hero: {primary_text: '读点什么', primary_url: '/topics/', secondary_text: '认识一下', secondary_url: '/about/'},
  locker: {enabled: true, on_about: true, caption: 'THE CURIOSITY CABINET', number: 'NO. 001', note: '把想法、日常和一点点自己，好好收在这里。', poster: '/images/locker-preview.png', poster_alt: '立体个人储物柜', landscape: '/images/fieldnotes-landscape.svg', body_color: '#e8e3d3', articles_color: '#294ddb', life_color: '#ecd581', about_color: '#d9835c'},
  home: {
    order: ['hero', 'interlude', 'topics', 'featured', 'projects', 'journal', 'about'],
    hero: {enabled: true},
    interlude: {enabled: true, items: ['写代码', '记灵感', '去生活'], note: 'Good things take curiosity.'},
    topics: {enabled: true, eyebrow: 'THE NOTEBOOK SHELF', title: '挑一格，慢慢探索', link_text: '专题书架'},
    featured: {enabled: true, eyebrow: 'SELECTED NOTES', title: '值得慢慢读的几篇', link_text: '全部文章', limit: 3},
    projects: {enabled: true, eyebrow: 'ON MY WORKBENCH', title: '不只记录，也动手创造', link_text: '我的作品'},
    journal: {enabled: true, eyebrow: 'THE JOURNAL', title: '最近，写了这些', limit: 5, show_life: true},
    about: {enabled: true, eyebrow: 'ALWAYS EXPLORING', title: '一个持续更新中的人。', description: '在这里，想法可以不完整，热爱可以很具体。', link_text: '更多关于我'},
    stage: {enabled: true, visual: 'sphere', eyebrow: 'Plain-words AI · Videos & Notes', heading: ['Hello!', "I'm Mihotel"], signature: 'Mihotel', tagline: '', note: '', primary_text: '看最新一期', primary_url: '#videos', secondary_text: '读笔记', secondary_url: '/archives/', chips: [], video: '', video_webm: '', poster: '', mobile_video: '', mobile_video_webm: '', mobile_poster: ''},
    episode: {enabled: true, heading: ['Latest', 'Episode'], signature: 'new!', intro: '', intro_zh: '', label: '', post: '', cover_title: '', video_title: '', meta: '', duration: '', video_url: '', watch_text: '看视频', read_text: '读笔记', video: '', video_webm: '', poster: '', cards: []},
    notes: {enabled: true, heading: ['Notes'], signature: 'plain words', link_text: 'All notes', limit: 4, exclude_categories: [], archive_text: '早期档案：之前写的技术笔记', upcoming: []},
    profile: {enabled: true, eyebrow: 'About · 关于我', heading: ['The guy in', 'the blue hoodie'], signature: "that's me", description: '', note: '', facts: [], stickers: [], link_text: '更多关于我', link_url: '/about/', video: '', video_webm: '', poster: ''},
    dispatch: {enabled: true, eyebrow: 'Weekly dispatch', title: '', description: '', form_action: '', email_field: 'email', placeholder: '输入邮箱', button_label: '订阅', video: '', video_webm: '', poster: '', video_caption: '', wordmark: '', signature: 'see you next week!'},
    routes: {enabled: true, eyebrow: 'Start here', title: '从这里开始', description: '', link_text: '', link_url: '', items: []},
    glossary: {enabled: true, eyebrow: 'Plain words', title: '听到这些词，别慌', description: '', link_text: '', link_url: '', items: []},
    videos: {enabled: true, eyebrow: 'Video × Notes', title: '每期视频，都有一份能回看的笔记', description: '', link_text: '', link_url: '', post: '', label: '', cover_title: '', video_title: '', meta: '', duration: '', video_url: '', watch_text: '在 B站观看', poster: '', extras: [], more: []},
    updates: {enabled: true, eyebrow: 'Latest', title: '最近更新', link_text: '全部文章', limit: 5, upcoming: []},
    connect: {enabled: true, eyebrow: 'About', title: '', description: '', note: '', link_text: '更多关于我', link_url: '/about/', show_project: true, video: '', video_webm: '', poster: '', subscribe_eyebrow: 'Weekly dispatch', subscribe_title: '', subscribe_description: '', form_action: '', email_field: 'email', placeholder: '输入邮箱', button_label: '订阅'}
  },
  features: {search: true, code_copy: true, image_zoom: true},
  // Article lists open on a slow looping video; hue shifts its colours toward the site palette.
  list_backdrop: {enabled: false, video: '', poster: '', hue: 0},
  // The topics page opens on a planet horizon, one world per topic, that swaps on click.
  topic_hero: {enabled: false},
  article: {style: 'paper', toc: true, mobile_toc: true, progress: true, reading_time: true, info: true, share: true, tags: true, series: true},
  about: {title: '关于我', eyebrow: 'A PERSON, NOT JUST A PROFILE', status: '保持好奇，持续更新', show_projects: true,
    // A full-screen video opening with liquid-glass controls; replaces the cabinet when enabled.
    hero: {enabled: false, heading: '', subtitle: '', video: '', poster: '', shift: 17, button_text: '了解更多', cta_text: '', cta_url: ''}},
  footer: {enabled: true, title: '保持热爱。', description: '下次见面，带着新的发现。', motto: 'A small place, a curious mind.', start_year: '', show_credit: true, links: []}
};
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function merge(base, override) {
  const result = {...base};
  if (!object(override)) return result;
  for (const [key, value] of Object.entries(override)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) continue;
    result[key] = object(value) && object(base[key]) ? merge(base[key], value) : value;
  }
  return result;
}
function normalize(base, value) {
  if (Array.isArray(base)) return Array.isArray(value) ? value : base.slice();
  if (object(base)) return Object.fromEntries(Object.entries(merge(base, value)).map(([key, item]) => [key, key in base ? normalize(base[key], item) : item]));
  return typeof value === typeof base ? value : base;
}
function safeUrl(value, fallback = '#') {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u0020\u007f\\]/.test(value.trim())) return fallback;
  const url = value.trim();
  return /^(?:https?:\/\/|mailto:|tel:)/i.test(url) || (!/^[a-z][a-z\d+.-]*:/i.test(url) && !url.startsWith('//')) ? url : fallback;
}
function settings(config = {}) {
  const value = normalize(defaults, config);
  const bounded = (n, fallback, min, max) => Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
  const color = (n, fallback) => typeof n === 'string' && /^#[\da-f]{6}$/i.test(n) ? n : fallback;
  for (const key of ['accent', 'accent_dark', 'background', 'background_dark']) value.appearance[key] = color(value.appearance[key], defaults.appearance[key]);
  for (const key of ['body_color', 'articles_color', 'life_color', 'about_color']) value.locker[key] = color(value.locker[key], defaults.locker[key]);
  value.appearance.mode = ['system', 'light', 'dark'].includes(value.appearance.mode) ? value.appearance.mode : 'system';
  value.appearance.font = value.appearance.font === 'serif' ? 'serif' : 'sans';
  // voyage: articles are read aboard a starship, over a quiet starfield.
  value.article.style = value.article.style === 'voyage' ? 'voyage' : 'paper';
  value.appearance.content_width = bounded(value.appearance.content_width, 1200, 960, 1600);
  value.home.featured.limit = bounded(value.home.featured.limit, 3, 1, 9);
  value.home.journal.limit = bounded(value.home.journal.limit, 5, 1, 20);
  value.home.order = [...new Set(value.home.order)].filter(key => modules.includes(key) && value.home[key].enabled);
  value.navigation = value.navigation.filter(item => object(item) && typeof item.title === 'string' && item.title.trim() && safeUrl(item.url, '')).map(item => ({...item, url: safeUrl(item.url), new_tab: item.new_tab === true}));
  value.footer.links = value.footer.links.filter(item => object(item) && typeof item.title === 'string' && safeUrl(item.url, '')).map(item => ({...item, url: safeUrl(item.url)}));
  cinema(value, color, bounded);
  aboutHero(value.about.hero, bounded);
  const backdrop = value.list_backdrop;
  for (const key of ['video', 'poster']) backdrop[key] = typeof backdrop[key] === 'string' && backdrop[key].trim() ? safeUrl(backdrop[key].trim(), '') : '';
  backdrop.hue = bounded(backdrop.hue, 0, -180, 180);
  backdrop.enabled = backdrop.enabled && Boolean(backdrop.video || backdrop.poster);
  return value;
}
// Hero text renders as plain text and its media and link stay site-relative or http(s).
function aboutHero(hero, bounded) {
  const text = n => typeof n === 'string' ? n.trim() : '';
  for (const key of ['heading', 'subtitle', 'button_text', 'cta_text']) hero[key] = text(hero[key]);
  for (const key of ['video', 'poster', 'cta_url']) hero[key] = text(hero[key]) ? safeUrl(text(hero[key]), '') : '';
  hero.shift = bounded(hero.shift, 17, 0, 40);
  hero.button_text = hero.button_text || '了解更多';
}
// Escapes text and turns *word* into an italic accent, for serif display headlines.
function emphasis(value) {
  const escaped = String(value || '').replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[ch]);
  return escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
// Cinema strings render as plain text; links and media must stay site-relative or http(s).
function cinema(value, color, bounded) {
  const text = n => typeof n === 'string' ? n.trim() : '';
  const link = n => text(n) ? safeUrl(text(n), '') : '';
  const https = n => /^https:\/\//i.test(text(n)) ? link(n) : '';
  const lines = list => list.map(text).filter(Boolean).slice(0, 4);
  const entries = (list, keys) => list.filter(object).map(item => Object.fromEntries(keys.map(key => [key, key === 'url' ? link(item[key]) : text(item[key])])));
  const {stage, episode, notes, profile, dispatch, routes, glossary, videos, updates, connect} = value.home;
  value.brand_avatar = link(value.brand_avatar);
  value.archive.categories = value.archive.categories.map(text).filter(Boolean);
  if (!notes.exclude_categories.length) notes.exclude_categories = value.archive.categories;
  routes.items = routes.items.filter(object).map((item, index) => ({
    step: text(item.step), title: text(item.title), description: text(item.description), tag: text(item.tag),
    topic: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text(item.topic)) ? text(item.topic) : '', region: text(item.region),
    planet: planetTypes.includes(item.planet) ? item.planet : planetTypes[index % 3],
    planned: Array.isArray(item.planned) ? item.planned.map(text).filter(Boolean).slice(0, 8) : []
  })).filter(item => item.title).slice(0, 3);
  glossary.items = entries(glossary.items, ['term', 'en', 'definition', 'url']).filter(item => item.term && item.definition).slice(0, 8);
  videos.extras = entries(videos.extras, ['title', 'note', 'url', 'icon']).filter(item => item.title).slice(0, 4)
    .map(item => ({...item, icon: ['note', 'image', 'copy', 'link', 'next'].includes(item.icon) ? item.icon : 'link'}));
  videos.more = entries(videos.more, ['label', 'title', 'url']).filter(item => item.title).slice(0, 3);
  for (const section of [routes, glossary, videos]) section.link_url = link(section.link_url);
  videos.video_url = link(videos.video_url);
  videos.poster = link(videos.poster);
  updates.limit = bounded(updates.limit, 5, 1, 12);
  updates.upcoming = entries(updates.upcoming, ['title', 'label']).filter(item => item.title).slice(0, 3);
  connect.link_url = link(connect.link_url);
  for (const key of ['video', 'video_webm', 'poster']) connect[key] = link(connect[key]);
  connect.form_action = https(connect.form_action);
  connect.email_field = /^[A-Za-z_][\w.-]{0,40}$/.test(connect.email_field) ? connect.email_field : 'email';
  for (const key of ['accent', 'sphere_a', 'sphere_b']) value.cinema[key] = color(value.cinema[key], defaults.cinema[key]);
  value.cinema.fonts = https(value.cinema.fonts);
  stage.visual = ['video', 'planets'].includes(stage.visual) ? stage.visual : 'sphere';
  value.archive.planet = planetTypes.includes(value.archive.planet) ? value.archive.planet : 'ice';
  stage.chips = stage.chips.map(text).filter(Boolean).slice(0, 5);
  value.social = Object.fromEntries(Object.entries(value.social).map(([key, url]) => {
    const raw = text(url);
    return [key, key === 'email' && /^[^\s@<>"]+@[^\s@<>"]+$/.test(raw) ? 'mailto:' + raw : link(raw)];
  }));
  for (const section of [stage, episode, profile, dispatch]) {
    for (const key of ['video', 'video_webm', 'poster', 'mobile_video', 'mobile_video_webm', 'mobile_poster']) if (key in section) section[key] = link(section[key]);
  }
  for (const section of [stage, episode, notes, profile]) section.heading = lines(section.heading);
  stage.primary_url = link(stage.primary_url);
  stage.secondary_url = link(stage.secondary_url);
  episode.video_url = link(episode.video_url);
  episode.cards = entries(episode.cards, ['label', 'title', 'url']).filter(item => item.title).slice(0, 3);
  notes.limit = bounded(notes.limit, 4, 1, 12);
  notes.exclude_categories = notes.exclude_categories.map(text).filter(Boolean);
  notes.upcoming = entries(notes.upcoming, ['title', 'label']).filter(item => item.title).slice(0, 4);
  profile.link_url = link(profile.link_url);
  profile.facts = entries(profile.facts, ['label', 'value']).filter(item => item.label && item.value);
  profile.stickers = profile.stickers.map(text).filter(Boolean).slice(0, 4);
  dispatch.form_action = https(dispatch.form_action);
  dispatch.email_field = /^[A-Za-z_][\w.-]{0,40}$/.test(dispatch.email_field) ? dispatch.email_field : 'email';
}
// voyage: every inner page shares one deep-space sky (voyage-space); posts also read on the
// glass console (voyage-reader). The front page keeps its own design, cinema or paper.
function voyageClasses(style, {post = false, frontPage = false} = {}) {
  if (style !== 'voyage' || frontPage) return [];
  return post ? ['voyage-space', 'voyage-reader'] : ['voyage-space'];
}
function cssVariables(config) {
  const {appearance: a, cinema: c} = settings(config);
  return `:root{--blue:${a.accent};--paper:${a.background};--content-width:${a.content_width}px;--body-font:var(${a.font === 'serif' ? '--serif' : '--font'});--cinema-accent:${c.accent};--sphere-a:${c.sphere_a};--sphere-b:${c.sphere_b}}[data-theme="dark"]{--blue:${a.accent_dark};--paper:${a.background_dark}}`;
}
module.exports = {defaults, modules, cinemaModules, deckModules, planetTypes, merge, settings, safeUrl, cssVariables, voyageClasses, emphasis};
