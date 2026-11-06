'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {defaults, merge, settings, cssVariables, safeUrl, voyageClasses, emphasis} = require('../lib/settings.cjs');

test('partial overrides retain defaults; false and empty arrays remain intentional', () => {
  const config = settings({home: {order: [], topics: {enabled: false}}, navigation: [], locker: {enabled: false}, features: {search: false}});
  assert.deepEqual(config.home.order, []);
  assert.deepEqual(config.navigation, []);
  assert.equal(config.features.search, false);
  assert.equal(config.features.code_copy, true);
  assert.equal(config.locker.enabled, false);
  assert.equal(config.locker.on_about, true);
  assert.equal(defaults.locker.enabled, true);
});

test('module order ignores duplicates, unsupported names and disabled modules', () => {
  assert.deepEqual(settings({home: {order: ['about','hero','about','../../post','topics'], hero: {enabled: false}}}).home.order, ['about','topics']);
});

test('replacing array overrides permits removal and reorder without Hexo append semantics', () => {
  const original = {navigation: [{title:'首页'}], home:{order:['hero','about']}, features:{search:true,code_copy:true}};
  const config = merge(original, {navigation: [], home:{order:['about']}, features:{search:false}});
  assert.deepEqual(config.navigation, []);
  assert.deepEqual(config.home.order, ['about']);
  assert.deepEqual(config.features, {search:false,code_copy:true});
  assert.equal(original.navigation.length, 1);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.hasOwn(merge({}, JSON.parse('{"__proto__":{"polluted":true}}')), '__proto__'), false);
});

test('invalid CSS, URLs and numeric options cannot escape their configuration context', () => {
  const malformed = {appearance: {accent: '</style><script>alert(1)</script>',content_width:99999,mode:'other'}, home:{featured:{limit:-3}}, navigation:[{title:'unsafe',url:'javascript:alert(1)'},{title:'safe',url:'/archives/'}]};
  const config = settings(malformed);
  assert.equal(config.appearance.accent, '#3158df');
  assert.equal(config.appearance.content_width, 1600);
  assert.equal(config.home.featured.limit, 1);
  assert.equal(config.navigation.length, 1);
  assert.doesNotMatch(cssVariables(malformed), /<|>/);
  assert.equal(safeUrl('data:text/html,hi'), '#');
  assert.equal(safeUrl('https://example.com/'), 'https://example.com/');
  assert.equal(settings({appearance:null,home:false,locker:{enabled:'false'}}).locker.enabled, true);
});

test('voyage spreads the sky to every inner page but leaves the front page alone', () => {
  const style = settings({article: {style: 'voyage'}}).article.style;
  assert.deepEqual(voyageClasses(style, {post: true}), ['voyage-space', 'voyage-reader']);
  assert.deepEqual(voyageClasses(style), ['voyage-space']);
  assert.deepEqual(voyageClasses(style, {frontPage: true}), []);
  assert.deepEqual(voyageClasses(settings({article: {style: 'starship'}}).article.style, {post: true}), []);
  assert.deepEqual(voyageClasses(settings().article.style), []);
});

test('about hero keeps media safe, bounds the video shift and escapes the headline', () => {
  const hero = settings({about: {hero: {enabled: true, video: 'javascript:alert(1)', poster: '/videos/about.jpg', shift: 99, heading: '  AI, in *plain* words.  ', button_text: ''}}}).about.hero;
  assert.equal(hero.video, '');
  assert.equal(hero.poster, '/videos/about.jpg');
  assert.equal(hero.shift, 40);
  assert.equal(hero.button_text, '了解更多');
  assert.equal(emphasis(hero.heading), 'AI, in <em>plain</em> words.');
  assert.equal(emphasis('<b>*x*</b>'), '&lt;b&gt;<em>x</em>&lt;/b&gt;');
  assert.equal(settings().about.hero.enabled, false);
});

test('list backdrop needs media, keeps it safe and bounds the hue shift', () => {
  assert.equal(settings({list_backdrop: {enabled: true}}).list_backdrop.enabled, false);
  const backdrop = settings({list_backdrop: {enabled: true, video: 'https://example.com/a.mp4', poster: 'javascript:x', hue: 400}}).list_backdrop;
  assert.equal(backdrop.enabled, true);
  assert.equal(backdrop.poster, '');
  assert.equal(backdrop.hue, 180);
});
