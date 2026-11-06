'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {buildTopics, readingPath, explicitUpdated} = require('../lib/content.cjs');
const post = (source, extra = {}) => ({source, path: source.replace('_posts/', '').replace('.md', '/'), title: source, date: new Date('2026-03-01'), categories: [{name:'docker'}], ...extra});
const query = items => ({toArray: () => items});

test('generated collections preserve user-authored pages at the same routes', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const script = path.resolve(__dirname, '../scripts/collections.js');
  let generate;
  const hexo = {theme:{config:{topics:[{slug:'docker', categories:['docker']}]}}, extend:{helper:{register() {}}, generator:{register(name, callback) {generate = callback;}}}};
  vm.runInNewContext(fs.readFileSync(script, 'utf8'), {hexo, require:require('node:module').createRequire(script)}, {filename:script});
  const result = generate({posts:query([post('_posts/a.md')]), pages:query([{path:'topics/index.html'}, {path:'projects/index.html'}])});
  assert.deepEqual(Array.from(result, page => page.path), ['topics/docker/index.html']);
});

test('editorial order is stable, category additions append, duplicate matches collapse', () => {
  const a = post('_posts/a.md');
  const b = post('_posts/b.md', {date: new Date('2025-01-01')});
  const c = post('_posts/c.md', {date: new Date('2024-01-01'), categories: query([{name:'docker'}])});
  const defs = [{slug:'docker', sources:[a.source, b.source, a.source], categories:['docker']}];
  const result = buildTopics(query([c, b, a]), defs);
  assert.deepEqual(result[0].posts.map(p => p.source), [a.source, b.source, c.source]);
  assert.equal(result[0].path, 'topics/docker/');
  assert.deepEqual(defs[0].sources, [a.source, b.source, a.source]);
});

test('drafts, unpublished and missing sources cannot leak into reading routes', () => {
  const entries = [post('_posts/a.md'), post('_drafts/private.md'), post('_posts/hidden.md', {published:false})];
  const result = buildTopics(entries, [{slug:'docker', sources:['_drafts/private.md', '_posts/missing.md', '_posts/hidden.md'], categories:['docker']}]);
  assert.deepEqual(result[0].posts.map(p => p.source), ['_posts/a.md']);
});

test('empty topics, duplicate slugs and path traversal do not create routes', () => {
  const result = buildTopics([post('_posts/a.md')], [
    {slug:'empty', categories:['other']}, {slug:'../../outside', categories:['docker']}, {categories:['docker']},
    {slug:'docker', categories:['docker']}, {slug:'docker', categories:['docker']}
  ]);
  assert.deepEqual(result.map(topic => topic.slug), ['docker']);
  assert.deepEqual(buildTopics([], null), []);
});

test('first, middle, last and ungrouped articles have correct continuation targets', () => {
  const posts = ['a', 'b', 'c'].map(name => post('_posts/' + name + '.md'));
  const topics = buildTopics(posts, [{slug:'docker', sources:posts.map(p => p.source)}]);
  assert.equal(readingPath(posts[0], topics).previous, undefined);
  assert.equal(readingPath(posts[0], topics).next, posts[1]);
  assert.equal(readingPath(posts[1], topics).previous, posts[0]);
  assert.equal(readingPath(posts[1], topics).next, posts[2]);
  assert.equal(readingPath(posts[2], topics).next, undefined);
  assert.equal(readingPath(post('_posts/other.md'), topics), null);
});

test('CI/file timestamps never masquerade as editorial update dates', () => {
  const entry = post('_posts/a.md', {updated:new Date('2026-10-15'), raw:'---\ntitle: a\n---\nBody'});
  assert.equal(explicitUpdated(entry), null);
  assert.equal(explicitUpdated(entry, null), null);
  const authored = explicitUpdated({...entry, raw:'---\nupdated: 2026-04-02\n---\nBody'});
  assert.deepEqual([authored.getFullYear(), authored.getMonth(), authored.getDate()], [2026, 3, 2]);
  assert.equal(explicitUpdated(entry, {[entry.source]:'2026-05-03'}).toISOString(), '2026-05-03T00:00:00.000Z');
  assert.equal(explicitUpdated(entry, {[entry.source]:'invalid'}), null);
  assert.equal(explicitUpdated(entry, {[entry.source]:'2025-01-01'}), null);
  assert.equal(explicitUpdated(entry, {[entry.source]:null}), null);
});

test('each topic gets its own world: its choice, then its artwork, then a free type', () => {
  const {topicWorlds} = require('../lib/content.cjs');
  assert.deepEqual(topicWorlds([{artwork: 'containers'}, {artwork: 'database'}, {artwork: 'intelligence'}]), ['desert', 'gas', 'ocean']);
  assert.deepEqual(topicWorlds([{planet: 'ice', artwork: 'containers'}, {artwork: 'containers'}, {planet: 'nope'}]), ['ice', 'desert', 'ocean']);
  assert.deepEqual(topicWorlds([{planet: 'gas'}, {planet: 'gas'}]), ['gas', 'ocean']);
});
