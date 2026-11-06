'use strict';

const {publishedPosts, buildTopics} = require('./content.cjs');

const list = value => Array.isArray(value) ? value : value && typeof value.toArray === 'function' ? value.toArray() : [];
const key = post => String(post.source || post.path || '').replace(/\\/g, '/');
const newest = (a, b) => (Number(b.date) || 0) - (Number(a.date) || 0);

// Posts in an archived category leave the homepage list but are still counted,
// so the "early archive" row can say how much older writing exists.
function selectNotes(collection, {exclude_categories: excluded = [], limit = 4} = {}) {
  const posts = publishedPosts(collection).sort(newest);
  const archived = post => list(post.categories).some(category => excluded.includes(category.name));
  const current = posts.filter(post => !archived(post));
  return {posts: current.slice(0, limit), archived: posts.length - current.length};
}

// A reference is either a source path such as _posts/name.md or an exact title.
function findPost(collection, reference) {
  const ref = typeof reference === 'string' ? reference.trim() : '';
  if (!ref) return null;
  return publishedPosts(collection).find(post => key(post) === ref || post.title === ref) || null;
}

// The most specific category is the last one Hexo stores for a post.
function noteCategory(post, excluded = []) {
  const names = list(post.categories).map(category => category.name).filter(name => !excluded.includes(name));
  return names.length ? names[names.length - 1] : '';
}

// A route links to an existing topic when it has one; otherwise it is only planned.
function resolveRoutes(collection, topicDefinitions, items) {
  const topics = buildTopics(collection, topicDefinitions);
  return list(items).map(item => {
    const topic = item.topic ? topics.find(entry => entry.slug === item.topic) || null : null;
    const posts = topic ? topic.posts : [];
    return {...item, topic, posts, first: posts[0] || null};
  });
}

// Archived posts grouped by the first archive category they belong to, in config order.
function archiveGroups(collection, categories) {
  const counts = new Map();
  for (const post of publishedPosts(collection)) {
    const names = list(post.categories).map(category => category.name);
    const hit = categories.find(name => names.includes(name));
    if (hit) counts.set(hit, (counts.get(hit) || 0) + 1);
  }
  return categories.filter(name => counts.has(name)).map(name => ({name, count: counts.get(name)}));
}

// Each knowledge base becomes a planet in the hero: routes first, then the archive.
function planetRegions(routes, groups, archive = {}) {
  const regions = routes.slice(0, 3).map(route => {
    const live = route.posts.length;
    const total = live + route.planned.length;
    const parts = [live && live + ' 篇已发布', route.planned.length && route.planned.length + ' 篇规划中'].filter(Boolean);
    return {kind: 'route', planet: route.planet, name: route.region || route.title, code: route.step, title: route.title, description: route.description, first: route.first, count: live + '/' + Math.max(total, live), summary: parts.join(' · ') || '规划中'};
  });
  const archived = groups.reduce((sum, group) => sum + group.count, 0);
  if (archived) {
    const name = archive.name || '早期档案';
    regions.push({kind: 'archive', planet: archive.planet || 'ice', name, code: name, title: name, description: archive.description || '', groups, count: archived + ' 篇', summary: archived + ' 篇 · 已归档'});
  }
  return regions;
}

module.exports = {selectNotes, findPost, noteCategory, resolveRoutes, archiveGroups, planetRegions};
