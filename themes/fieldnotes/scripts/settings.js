'use strict';
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const {merge, settings, safeUrl, cssVariables, voyageClasses, emphasis} = require('../lib/settings.cjs');
// Hexo merges arrays by appending. Navigation and module ordering instead need
// replacement semantics, including [] to deliberately remove all entries.
hexo.extend.filter.register('before_generate', function() {
  const read = file => fs.existsSync(file) ? yaml.load(fs.readFileSync(file, 'utf8')) || {} : {};
  const base = read(path.join(hexo.theme_dir, '_config.yml'));
  const override = read(path.join(hexo.base_dir, '_config.fieldnotes.yml'));
  const site = read(hexo.config_path || path.join(hexo.base_dir, '_config.yml'));
  hexo.theme.config = merge(merge(base, override), site.theme_config);
}, 1);
hexo.extend.helper.register('fn_settings', function() { return settings(this.theme); });
hexo.extend.helper.register('fn_theme_css', function() { return cssVariables(this.theme); });
hexo.extend.helper.register('fn_emphasis', value => emphasis(value));
hexo.extend.helper.register('fn_voyage_classes', function() {
  const frontPage = this.is_home() && (!this.page.current || this.page.current === 1);
  return voyageClasses(settings(this.theme).article.style, {post: this.is_post(), frontPage});
});
hexo.extend.helper.register('fn_url', function(value) {
  const url = safeUrl(value);
  return /^(?:https?:|mailto:|tel:|#)/i.test(url) ? url : this.url_for(url);
});
hexo.extend.helper.register('fn_locker_enabled', function(mode) {
  const config = settings(this.theme);
  return config.locker.enabled && (mode !== 'about' || config.locker.on_about);
});
hexo.extend.helper.register('fn_nav_active', function(url) {
  const current = '/' + String(this.page.path || '').replace(/index\.html$/, '');
  if (url === '/') return this.is_home();
  if (url === '/archives/') return this.is_archive() || this.is_post() || this.is_category() || this.is_tag();
  return !/^(?:https?:|mailto:|tel:|#)/i.test(url) && (current === url || current.startsWith(url.endsWith('/') ? url : url + '/'));
});
