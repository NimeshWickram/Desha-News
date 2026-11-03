import {readFileSync,writeFileSync,readdirSync,mkdirSync,cpSync,existsSync} from 'node:fs';
import {resolve,join,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.cwd();
const {articles}=await import(pathToFileURL(resolve('src/lib/articles.ts')).href);
const {englishArticles}=await import(pathToFileURL(resolve('src/lib/english-articles.ts')).href);
const seedPosts=articles.map((a,i)=>({id:a.slug,slug:a.slug,category:a.category,si:{title:a.title,excerpt:a.excerpt,body:a.body,alt:a.alt},en:englishArticles[i],image:`/images/${a.image}.webp`,read:a.read,status:'published',featured:i===0,editorPick:i===7,breaking:i<3,sample:true,author:'Desha News',publishedAt:'2026-10-12T10:00:00.000Z',updatedAt:`2026-10-12T${String(10-Math.floor(i/4)).padStart(2,'0')}:${String(59-i).padStart(2,'0')}:00.000Z`,version:0}));
const settings={facebookUrl:'',contactEmail:'',taglineSi:'ඔබේ හඬ. ඔබේ පුවත්.',taglineEn:'Your voice. Your news.'};
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.jpeg':'image/jpeg','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'};
const assets={};function walk(dir,base=''){for(const item of readdirSync(dir,{withFileTypes:true})){const rel=`${base}/${item.name}`,path=join(dir,item.name);if(item.isDirectory())walk(path,rel);else if(!rel.endsWith('.map')&&!rel.endsWith('.jpg'))assets[rel]={type:types[extname(path)]||'application/octet-stream',data:readFileSync(path).toString('base64')};}}
if (!existsSync('out')) {
  console.log('Static export directory "out" not found; skipping worker bundling.');
  process.exit(0);
}
walk(resolve('out'));
const services=readFileSync('worker/services.mjs','utf8')+'\n'+readFileSync('worker/seo.mjs','utf8');const api=readFileSync('worker/api.mjs','utf8').replace(/^import .*from '\.\/services.mjs';\r?\n/m,'');const entry=readFileSync('worker/index.mjs','utf8').replace(/^import .*;\r?\n/gm,'');
mkdirSync('dist/server',{recursive:true});mkdirSync('dist/.openai',{recursive:true});
writeFileSync('dist/server/index.js',`const ASSETS=${JSON.stringify(assets)};\nconst SEED_POSTS=${JSON.stringify(seedPosts)};\nconst DEFAULT_SETTINGS=${JSON.stringify(settings)};\n${services}\n${api}\n${entry}`);
cpSync('.openai/hosting.json','dist/.openai/hosting.json');
mkdirSync('.sites-runtime',{recursive:true});writeFileSync('.sites-runtime/seed.json',JSON.stringify({seedPosts,defaultSettings:settings}));
console.log(`Packaged ${Object.keys(assets).length} Next.js assets with the Firebase / Cloudinary content API.`);
