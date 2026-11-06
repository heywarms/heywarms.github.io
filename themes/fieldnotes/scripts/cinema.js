'use strict';

const {settings, safeUrl, cinemaModules} = require('../lib/settings.cjs');
const {selectNotes, findPost, noteCategory, resolveRoutes, archiveGroups, planetRegions} = require('../lib/cinema.cjs');

function homeOrder(context) {
  const first = context.is_home() && (!context.page.current || context.page.current === 1);
  return first ? settings(context.theme).home.order : [];
}

// Cinema assets load only on the first homepage page that uses those modules.
hexo.extend.helper.register('fn_cinema_home', function() {
  return homeOrder(this).some(key => cinemaModules.includes(key));
});
hexo.extend.helper.register('fn_stage_home', function() {
  return homeOrder(this)[0] === 'stage';
});
hexo.extend.helper.register('fn_media', function(value) {
  const url = typeof value === 'string' && value.trim() ? safeUrl(value.trim(), '') : '';
  if (!url) return '';
  return /^(?:https?:|mailto:|tel:|#)/i.test(url) ? url : this.url_for(url);
});
hexo.extend.helper.register('fn_external', function(url) {
  return /^https?:\/\//i.test(String(url || ''));
});
hexo.extend.helper.register('fn_notes', function(section) {
  return selectNotes(this.site.posts, section);
});
hexo.extend.helper.register('fn_find_post', function(reference) {
  return findPost(this.site.posts, reference);
});
hexo.extend.helper.register('fn_note_category', function(post, excluded) {
  return noteCategory(post, excluded);
});
hexo.extend.helper.register('fn_routes', function() {
  return resolveRoutes(this.site.posts, this.theme.topics, settings(this.theme).home.routes.items);
});
hexo.extend.helper.register('fn_planets', function() {
  const config = settings(this.theme);
  const routes = resolveRoutes(this.site.posts, this.theme.topics, config.home.routes.items);
  return planetRegions(routes, archiveGroups(this.site.posts, config.archive.categories), config.archive);
});
hexo.extend.helper.register('fn_archive_count', function() {
  return archiveGroups(this.site.posts, settings(this.theme).archive.categories).reduce((sum, group) => sum + group.count, 0);
});
