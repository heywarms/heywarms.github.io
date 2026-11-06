'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {settings, cssVariables, modules} = require('../lib/settings.cjs');
const {selectNotes, findPost, noteCategory, resolveRoutes, archiveGroups, planetRegions} = require('../lib/cinema.cjs');
const post = (source, date, categories = []) => ({source, title: source.replace('_posts/', '').replace('.md', ''), date: new Date(date), categories: {toArray: () => categories.map(name => ({name}))}});
const query = items => ({toArray: () => items});

test('cinema modules join the allowed module list and can lead the homepage', () => {
  const config = settings({home: {order: ['stage', 'episode', 'stage', 'notes', 'unknown'], episode: {enabled: false}}});
  assert.deepEqual(config.home.order, ['stage', 'notes']);
  assert.ok(['stage', 'episode', 'notes', 'profile', 'dispatch'].every(key => modules.includes(key)));
  assert.deepEqual(settings({}).home.order, ['hero', 'interlude', 'topics', 'featured', 'projects', 'journal', 'about']);
});

test('stage visual defaults to the sphere and keeps at most five chips', () => {
  assert.equal(settings({}).home.stage.visual, 'sphere');
  assert.equal(settings({home: {stage: {visual: 'video'}}}).home.stage.visual, 'video');
  assert.equal(settings({home: {stage: {visual: '<script>'}}}).home.stage.visual, 'sphere');
  assert.deepEqual(settings({home: {stage: {chips: ['a', '', 'b', 'c', 'd', 'e', 'f']}}}).home.stage.chips, ['a', 'b', 'c', 'd', 'e']);
  const css = cssVariables({cinema: {sphere_a: '#112233', sphere_b: 'url(x)'}});
  assert.match(css, /--sphere-a:#112233/);
  assert.match(css, /--sphere-b:#A78BFA/);
});

test('cinema links, media and colours cannot escape their context', () => {
  const config = settings({
    brand_avatar: 'javascript:alert(1)',
    cinema: {accent: 'red;}</style>', fonts: 'http://insecure.example/fonts.css'},
    social: {bilibili: 'https://space.bilibili.com/1', douyin: 'data:text/html,x', email: 'me@example.com'},
    home: {
      stage: {video: '/videos/a.mp4', poster: 'javascript:x', heading: ['Hello', '', 3, 'World'], primary_url: 'vbscript:x'},
      episode: {cards: [{title: 'Next', url: 'javascript:x'}, {label: 'no title'}, 'text']},
      notes: {limit: 99, exclude_categories: ['docker', '', null], upcoming: [{title: ''}, {title: 'Soon', label: 'Planned'}]},
      profile: {facts: [{label: 'Building', value: 'Hexo Pro'}, {label: 'Empty'}], stickers: ['a', 'b', 'c', 'd', 'e']},
      dispatch: {form_action: 'http://example.com/subscribe', email_field: 'e"mail'}
    }
  });
  assert.equal(config.brand_avatar, '');
  assert.equal(config.cinema.accent, '#C6FF3D');
  assert.equal(config.cinema.fonts, '');
  assert.equal(config.social.bilibili, 'https://space.bilibili.com/1');
  assert.equal(config.social.douyin, '');
  assert.equal(config.social.email, 'mailto:me@example.com');
  assert.equal(config.home.stage.video, '/videos/a.mp4');
  assert.equal(config.home.stage.poster, '');
  assert.equal(config.home.stage.primary_url, '');
  assert.deepEqual(config.home.stage.heading, ['Hello', 'World']);
  assert.deepEqual(config.home.episode.cards, [{label: '', title: 'Next', url: ''}]);
  assert.equal(config.home.notes.limit, 12);
  assert.deepEqual(config.home.notes.exclude_categories, ['docker']);
  assert.deepEqual(config.home.notes.upcoming, [{title: 'Soon', label: 'Planned'}]);
  assert.deepEqual(config.home.profile.facts, [{label: 'Building', value: 'Hexo Pro'}]);
  assert.equal(config.home.profile.stickers.length, 4);
  assert.equal(config.home.dispatch.form_action, '');
  assert.equal(config.home.dispatch.email_field, 'email');
  assert.doesNotMatch(cssVariables({cinema: {accent: '</style>'}}), /<|>/);
  assert.match(cssVariables({cinema: {accent: '#123456'}}), /--cinema-accent:#123456/);
});

test('homepage notes skip archived categories but still count them', () => {
  const posts = query([
    post('_posts/old.md', '2026-03-15', ['docker']),
    post('_posts/llm.md', '2026-03-15', ['前端开发', '大模型']),
    post('_posts/new.md', '2026-10-17', ['自媒体']),
    {...post('_drafts/draft.md', '2026-10-18'), published: false}
  ]);
  const picked = selectNotes(posts, {exclude_categories: ['docker'], limit: 4});
  assert.deepEqual(picked.posts.map(item => item.source), ['_posts/new.md', '_posts/llm.md']);
  assert.equal(picked.archived, 1);
  assert.equal(selectNotes(posts, {exclude_categories: [], limit: 1}).posts.length, 1);
  assert.equal(noteCategory(picked.posts[1]), '大模型');
  assert.equal(noteCategory(post('_posts/x.md', '2026-01-01', ['docker']), ['docker']), '');
});

test('episode posts resolve by source path or exact title, never drafts', () => {
  const posts = query([post('_posts/what-is-llm.md', '2026-03-15'), {...post('_drafts/secret.md', '2026-03-15'), published: false}]);
  assert.equal(findPost(posts, '_posts/what-is-llm.md').source, '_posts/what-is-llm.md');
  assert.equal(findPost(posts, 'what-is-llm').source, '_posts/what-is-llm.md');
  assert.equal(findPost(posts, '_drafts/secret.md'), null);
  assert.equal(findPost(posts, ''), null);
});

test('glass-card settings keep only well-formed entries and a valid planet type', () => {
  const config = settings({
    archive: {categories: ['docker', ''], planet: 'moon'},
    home: {
      stage: {visual: 'planets'},
      routes: {items: [{title: 'A', topic: 'ai', planet: 'gas', planned: ['x', '', 'y']}, {title: 'B', topic: '../etc'}, {step: 'no title'}, {title: 'C'}, {title: 'D'}]},
      glossary: {items: [{term: '大模型', definition: '会接着往下写的程序'}, {term: 'empty'}]},
      videos: {extras: [{title: 'Next', icon: 'rocket', url: 'javascript:x'}], more: [{label: 'only label'}]},
      connect: {form_action: 'http://example.com', video: '/videos/about.mp4'}
    }
  });
  assert.equal(config.home.stage.visual, 'planets');
  assert.deepEqual(config.archive.categories, ['docker']);
  assert.equal(config.archive.planet, 'ice');
  assert.deepEqual(config.home.notes.exclude_categories, ['docker']);
  assert.equal(config.home.routes.items.length, 3);
  assert.deepEqual(config.home.routes.items[0].planned, ['x', 'y']);
  assert.equal(config.home.routes.items[0].planet, 'gas');
  assert.equal(config.home.routes.items[1].topic, '');
  assert.equal(config.home.routes.items[1].planet, 'gas');
  assert.equal(config.home.glossary.items.length, 1);
  assert.deepEqual(config.home.videos.extras, [{title: 'Next', note: '', url: '', icon: 'link'}]);
  assert.deepEqual(config.home.videos.more, []);
  assert.equal(config.home.connect.form_action, '');
  assert.equal(config.home.connect.video, '/videos/about.mp4');
});

test('article style is paper unless voyage is chosen', () => {
  assert.equal(settings({}).article.style, 'paper');
  assert.equal(settings({article: {style: 'voyage'}}).article.style, 'voyage');
  assert.equal(settings({article: {style: 'space"><script>'}}).article.style, 'paper');
});

test('routes resolve topics, and planets add an archive world only when archived posts exist', () => {
  const posts = query([
    post('_posts/llm.md', '2026-03-15', ['大模型']),
    post('_posts/d1.md', '2026-03-01', ['docker']),
    post('_posts/d2.md', '2026-03-02', ['docker']),
    post('_posts/sql.md', '2026-03-03', ['MySql'])
  ]);
  const routes = resolveRoutes(posts, [{slug: 'ai', title: 'AI', categories: ['大模型']}], [
    {title: '认识它', topic: 'ai', region: '认识 AI', planet: 'ocean', planned: ['下一篇']},
    {title: '用起来', topic: '', region: '', planet: 'gas', planned: ['a', 'b']}
  ]);
  assert.equal(routes[0].first.source, '_posts/llm.md');
  assert.equal(routes[1].first, null);
  const groups = archiveGroups(posts, ['docker', 'MySql', 'markdown']);
  assert.deepEqual(groups, [{name: 'docker', count: 2}, {name: 'MySql', count: 1}]);
  const planets = planetRegions(routes, groups, {name: '早期档案', planet: 'ice'});
  assert.deepEqual(planets.map(p => [p.name, p.planet, p.count]), [['认识 AI', 'ocean', '1/2'], ['用起来', 'gas', '0/2'], ['早期档案', 'ice', '3 篇']]);
  assert.equal(planets[0].summary, '1 篇已发布 · 1 篇规划中');
  assert.equal(planets[1].summary, '2 篇规划中');
  assert.equal(planetRegions(routes, [], {}).length, 2);
});
