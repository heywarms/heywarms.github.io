'use strict';

const stylus = require('stylus');
const postcss = require('postcss');
const tailwindcss = require('tailwindcss');
const autoprefixer = require('autoprefixer');
const fs = require('fs');
const path = require('path');

function getProperty(obj, name) {
  name = name.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '');

  const split = name.split('.');
  let key = split.shift();

  if (!Object.prototype.hasOwnProperty.call(obj, key)) return '';

  let result = obj[key];
  const len = split.length;

  if (!len) {
    if (result === 0) return result;
    return result || '';
  }
  if (typeof result !== 'object') return '';

  for (let i = 0; i < len; i++) {
    key = split[i];
    if (!Object.prototype.hasOwnProperty.call(result, key)) return '';

    result = result[split[i]];
    if (typeof result !== 'object') return result;
  }

  return result;
}

function applyPlugins(stylusConfig, plugins) {
  plugins.forEach(plugin => {
    const factoryFn = require(plugin.trim());
    stylusConfig.use(factoryFn());
  });
}

function processWithPostCSS(css, callback) {
  postcss([tailwindcss, autoprefixer])
    .process(css, { from: undefined }) // `from: undefined` 防止文件路径警告
    .then(result => {
      callback(null, result.css);
    })
    .catch(err => {
      callback(err);
    });
}

function stylusFn(data, options, callback) {
  const config = this.config.stylus || {};
  const self = this;
  const plugins = ['nib'].concat(config.plugins || []);

  function defineConfig(style) {
    style.define('hexo-config', data => {
      return getProperty(self.theme.config, data.val);
    });
  }

  const stylusConfig = stylus(data.text);

  applyPlugins(stylusConfig, plugins);

  // 先应用 Stylus 插件，然后使用 PostCSS 处理（应用 Tailwind CSS）
  stylusConfig
    .use(defineConfig)
    .use(style => this.execFilterSync('stylus:renderer', style, { context: this }))
    .set('filename', data.path)
    .set('sourcemap', config.sourcemaps)
    .set('compress', config.compress)
    .set('include css', true)
    .render((err, css) => {
      if (err) {
        return callback(err);
      }

      // 使用 Tailwind CSS 和 autoprefixer 处理 CSS
      processWithPostCSS(css, (err, finalCss) => {
        if (err) {
          return callback(err);
        }

        callback(null, finalCss);
      });
    });
}

stylusFn.disableNunjucks = true;

module.exports = stylusFn;
