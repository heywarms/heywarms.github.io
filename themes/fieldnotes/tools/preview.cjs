#!/usr/bin/env node
'use strict';

// Preview against real content in an isolated Hexo instance. It never runs
// admin/deployment plugins or writes the project's cache or article files.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const Hexo = require('hexo');
const yaml = require('js-yaml');
const serveStatic = require('serve-static');

async function main() {
  const project = path.resolve(__dirname, '../../..');
  const args = process.argv.slice(2);
  const port = Number(args[args.indexOf('--port') + 1]) || 8796;
  const buildOnly = args.includes('--build-only');
  const rootFlag = args.indexOf('--root');
  const root = rootFlag >= 0 ? args[rootFlag + 1] : '/';
  if (!/^\/(?:[^?#]*\/)?$/.test(root)) throw new Error('--root must start and end with /');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hexo-fieldnotes-'));
  const config = yaml.load(fs.readFileSync(path.join(project, '_config.yml'), 'utf8'));
  const preview = {};
  for (const key of ['title','subtitle','description','author','language','timezone','permalink','pretty_urls','date_format','time_format','pagination_dir','per_page','index_generator','archive_generator','category_generator','tag_generator','highlight','prismjs','marked','external_link','post_asset_folder','future']) {
    if (config[key] !== undefined) preview[key] = config[key];
  }
  Object.assign(preview, {
    theme: 'fieldnotes', url: 'http://127.0.0.1:' + port + root,
    root, source_dir: 'source', public_dir: 'public',
    render_drafts: false
  });
  fs.writeFileSync(path.join(temp, '_config.yml'), yaml.dump(preview));
  const packages = ['hexo-generator-index','hexo-generator-archive','hexo-generator-category','hexo-generator-tag','hexo-renderer-ejs','hexo-renderer-marked'];
  fs.writeFileSync(path.join(temp, 'package.json'), JSON.stringify({name:'fieldnotes-preview',private:true,hexo:{version:'7.3.0'},dependencies:Object.fromEntries(packages.map(name=>[name,'*']))}));
  fs.mkdirSync(path.join(temp, 'themes'));
  fs.symlinkSync(path.join(project, 'source'), path.join(temp, 'source'));
  fs.symlinkSync(path.join(project, 'themes/fieldnotes'), path.join(temp, 'themes/fieldnotes'));
  fs.symlinkSync(path.join(project, 'node_modules'), path.join(temp, 'node_modules'));
  const hexo = new Hexo(temp, {});
  await hexo.init();
  await hexo.call('generate', {bail: true});
  await hexo.exit();
  console.log(JSON.stringify({public: path.join(temp,'public'), root, theme:'fieldnotes'}));
  if (buildOnly) return;
  const content = serveStatic(path.join(temp,'public'), {extensions:['html']});
  const assets = serveStatic(path.join(project,'themes/fieldnotes/source'));
  const server = http.createServer((req,res) => {
    if (!req.url.startsWith(root)) { res.writeHead(404); res.end('Not found'); return; }
    req.url = '/' + req.url.slice(root.length);
    assets(req,res,()=>content(req,res,()=>{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('页面还没有写到这里。');}));
  });
  server.listen(port,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:'+port+root));
  const stop = () => server.close(()=>process.exit(0));
  process.once('SIGINT',stop);
  process.once('SIGTERM',stop);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
