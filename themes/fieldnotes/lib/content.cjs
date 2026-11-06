'use strict';

const frontMatter = require('hexo-front-matter');

const list = value => Array.isArray(value) ? value : value && typeof value.toArray === 'function' ? value.toArray() : [];
const key = post => String(post.source || post.path || '').replace(/\\/g, '/');

function publishedPosts(collection) {
  return list(collection).filter(post => post.published !== false && key(post) && !key(post).startsWith('_drafts/'));
}

// The order is editorial: named sources first, then new category matches.
// A moved/missing file is skipped; it never becomes a broken reading step.
function buildTopics(collection, definitions) {
  const posts = publishedPosts(collection);
  const slugs = new Set();
  return list(definitions).flatMap(definition => {
    if (!definition || typeof definition.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(definition.slug) || slugs.has(definition.slug)) return [];
    slugs.add(definition.slug);
    const sources = list(definition.sources);
    const categories = list(definition.categories);
    const ordered = sources.map(source => posts.find(post => key(post) === source)).filter(Boolean);
    const extra = posts.filter(post => list(post.categories).some(category => categories.includes(category.name)))
      .sort((a, b) => (Number(a.date) || 0) - (Number(b.date) || 0) || key(a).localeCompare(key(b)));
    const seen = new Set();
    const selected = [...ordered, ...extra].filter(post => {
      if (seen.has(key(post))) return false;
      seen.add(key(post));
      return true;
    });
    return selected.length ? [{...definition, path: 'topics/' + definition.slug + '/', posts: selected}] : [];
  });
}

function readingPath(post, topics) {
  for (const topic of topics) {
    const index = topic.posts.findIndex(item => key(item) === key(post));
    if (index >= 0) return {topic, index, previous: topic.posts[index - 1], next: topic.posts[index + 1]};
  }
  return null;
}

function explicitUpdated(post, overrides = {}) {
  let value = overrides && typeof overrides === 'object' ? overrides[key(post)] : undefined;
  if (value === undefined) {
    try { value = frontMatter.parse(post.raw || '').updated; } catch (_) { return null; }
  }
  if (!(value instanceof Date) && typeof value !== 'string') return null;
  // Hexo's post.updated may just be the checkout/CI file mtime. Only use an
  // authored date, either already in Front Matter or in theme configuration.
  const updated = new Date(value);
  const published = Number(post.date);
  return Number.isFinite(+updated) && (!Number.isFinite(published) || +updated > published) ? updated : null;
}

// Each topic is a world on the topics page: its own planet type if set, otherwise one that
// suits its artwork, otherwise the next type nobody has taken yet.
const WORLDS = ['ocean', 'gas', 'desert', 'ice', 'lava'];
const ARTWORK_WORLDS = {intelligence: 'ocean', database: 'gas', containers: 'desert'};
function topicWorlds(topics) {
  const taken = new Set();
  const picks = topics.map(topic => {
    const own = WORLDS.includes(topic.planet) ? topic.planet : ARTWORK_WORLDS[topic.artwork];
    const pick = own && !taken.has(own) ? own : null;
    if (pick) taken.add(pick);
    return pick;
  });
  return picks.map(pick => {
    if (pick) return pick;
    const free = WORLDS.find(type => !taken.has(type)) || WORLDS[taken.size % WORLDS.length];
    taken.add(free);
    return free;
  });
}
module.exports = {publishedPosts, buildTopics, readingPath, explicitUpdated, topicWorlds};
