import {createApi} from './api.mjs';
import {seoResponse} from './seo.mjs';
// The build supplies immutable Next.js assets and sample content in this module.
const api=createApi(SEED_POSTS,DEFAULT_SETTINGS);
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/media/'))return api(request,env);
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  if(['/robots.txt','/sitemap.xml','/ads.txt'].includes(url.pathname))return seoResponse(request,env,api,null);
  let path=url.pathname;let asset=ASSETS[path]||ASSETS[path.endsWith('/')?`${path}index.html`:`${path}/index.html`];
  if(!asset){asset=ASSETS['/404.html'];if(!asset)return new Response('Not found',{status:404});}
  const found=!!(ASSETS[path]||ASSETS[path.endsWith('/')?`${path}index.html`:`${path}/index.html`]);
  const bytes=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));
  if(found&&asset.type.startsWith('text/html'))return seoResponse(request,env,api,new TextDecoder().decode(bytes));
  return new Response(request.method==='HEAD'?null:bytes,{status:found?200:404,headers:{'Content-Type':asset.type,'Cache-Control':path.startsWith('/_next/static/')?'public,max-age=31536000,immutable':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
 }
};
