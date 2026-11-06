'use strict';

const {buildTopics, readingPath, explicitUpdated, topicWorlds} = require('../lib/content.cjs');

hexo.extend.helper.register('fn_topics', function() {
  return buildTopics(this.site.posts, this.theme.topics);
});
hexo.extend.helper.register('fn_topic_worlds', topics => topicWorlds(topics));
hexo.extend.helper.register('fn_reading_path', function(post) {
  return readingPath(post, buildTopics(this.site.posts, this.theme.topics));
});
hexo.extend.helper.register('fn_updated', function(post) {
  return explicitUpdated(post, (this.theme.article || {}).updated_dates);
});
hexo.extend.generator.register('fieldnotes-collections', function(locals) {
  const config = hexo.theme.config;
  const routeKey = path => String(path).replace(/index\.html$/, '').replace(/\/$/, '');
  const occupied = new Set(locals.pages.toArray().map(page => routeKey(page.path)));
  const pages = [];
  function add(path, layout, data) {
    if (!occupied.has(routeKey(path))) pages.push({path, layout, data});
  }
  const topics = buildTopics(locals.posts, config.topics);
  add('topics/index.html', 'topics', {title: '专题书架', fieldnotes_topics: true, description: '沿着一条阅读路线，把零散的发现连成自己的知识。'});
  topics.forEach(topic => add(topic.path + 'index.html', 'topic', {title: topic.title, description: topic.description, fieldnotes_topics: true, fieldnotes_topic: topic.slug}));
  add('projects/index.html', 'projects', {title: '我的作品', fieldnotes_projects: true, description: '从自己的问题出发，把想法做成用得上的工具。'});
  return pages;
});
