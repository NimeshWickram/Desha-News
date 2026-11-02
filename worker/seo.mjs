const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const infoPages=['/','/about/','/contact/','/privacy/','/terms/','/editorial-policy/'];
export function publicOrigin(env){try{const u=new URL(env.SITE_URL);return u.protocol==='https:'&&!u.username&&!u.password?u.origin:null}catch{return null}}
export async function seoResponse(request,env,api,html){
 const url=new URL(request.url);const origin=publicOrigin(env);const indexable=env.PUBLIC_SITE==='true'&&!!origin;
 const lang=url.searchParams.get('lang')==='en'?'en':'si';
 const textResponse=(text,type='text/plain; charset=utf-8',status=200)=>new Response(request.method==='HEAD'?null:text,{status,headers:{'Content-Type':type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
 if(url.pathname==='/robots.txt')return textResponse(indexable?`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n');
 if(url.pathname==='/ads.txt'){const id=env.ADSENSE_PUBLISHER_ID||'';return /^pub-\d{16}$/.test(id)?textResponse(`google.com, ${id}, DIRECT, f08c47fec0942fa0\n`):textResponse('No advertising sellers configured.\n','text/plain; charset=utf-8',404)}
 const article=url.pathname==='/article/'||url.pathname==='/article'||url.pathname.startsWith('/news/');
 if(!html&&url.pathname!=='/sitemap.xml')return null;
 let posts=[];
 if(article||url.pathname==='/sitemap.xml'){
  const response=await api(new Request(`${url.origin}/api/public`),env);
  if(!response.ok)return textResponse('Content temporarily unavailable. Please try again later.','text/plain; charset=utf-8',503);
  posts=(await response.json()).posts;
 }
 if(url.pathname==='/sitemap.xml'){
  const urls=indexable?infoPages.flatMap(path=>['si','en'].map(l=>({loc:`${origin}${path}?lang=${l}`}))).concat(posts.filter(p=>!p.sample).flatMap(p=>['si','en'].filter(l=>p[l]?.title).map(l=>({loc:`${origin}/article/?slug=${encodeURIComponent(p.slug)}&lang=${l}`,updated:p.updatedAt})))):[];
  return textResponse(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(v=>`<url><loc>${escapeHtml(v.loc)}</loc>${v.updated?`<lastmod>${escapeHtml(v.updated)}</lastmod>`:''}</url>`).join('')}</urlset>`,'application/xml; charset=utf-8');
 }
 const pageTitles={'/':{si:'දේශ News | ඔබේ හඬ. ඔබේ පුවත්.',en:'Desha News | Your voice. Your news.'},'/about/':{si:'අප ගැන | Desha News',en:'About | Desha News'},'/contact/':{si:'සම්බන්ධ වන්න | Desha News',en:'Contact | Desha News'},'/privacy/':{si:'පෞද්ගලිකත්ව ප්‍රතිපත්තිය | Desha News',en:'Privacy policy | Desha News'},'/terms/':{si:'භාවිත කොන්දේසි | Desha News',en:'Terms of use | Desha News'},'/editorial-policy/':{si:'කර්තෘ ප්‍රතිපත්තිය | Desha News',en:'Editorial policy | Desha News'}};
 let title=pageTitles[url.pathname]?.[lang],description=lang==='en'?'News, stories and perspectives from Sri Lanka and the world.':'ශ්‍රී ලංකාවෙන් සහ ලෝකයෙන් පුවත්, කතාබහ සහ නව අදහස්.',canonical=`${origin||url.origin}${url.pathname}?lang=${lang}`,schema='',image='',allow=indexable&&infoPages.includes(url.pathname)&&!url.searchParams.has('search')&&!url.searchParams.has('category');let status=200;let alternates=infoPages.includes(url.pathname)?['si','en'].map(l=>({lang:l,url:`${origin||url.origin}${url.pathname}?lang=${l}`})):[];
 if(article){
  const slug=url.searchParams.get('slug')||url.pathname.split('/').filter(Boolean)[1];const post=posts.find(p=>p.slug===slug);
  if(!post||!post[lang]?.title){status=404;allow=false;title='Story not found | Desha News';description='This story is not published in this language.';}
  else{const tr=post[lang];title=`${tr.title} | Desha News`;description=tr.excerpt;image=new URL(post.image,origin||url.origin).href;canonical=`${origin||url.origin}/article/?slug=${encodeURIComponent(post.slug)}&lang=${lang}`;allow=indexable&&!post.sample;
   alternates=['si','en'].filter(l=>post[l]?.title).map(l=>({lang:l,url:`${origin||url.origin}/article/?slug=${encodeURIComponent(post.slug)}&lang=${l}`}));
   schema=`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'NewsArticle',headline:tr.title,description:tr.excerpt,image:[image],datePublished:post.publishedAt,dateModified:post.updatedAt,inLanguage:lang,author:{'@type':'Person',name:post.author},publisher:{'@type':'Organization',name:'Desha News'},mainEntityOfPage:canonical}).replace(/</g,'\\u003c')}</script>`;
  }
 }
 html=html.replace(/<meta name="robots"[^>]*>/g,'').replace(/<link rel="canonical"[^>]*>/g,'');
 if(title)html=html.replace(/<title>.*?<\/title>/s,`<title>${escapeHtml(title)}</title>`);
 if(description)html=html.replace(/<meta name="description"[^>]*>/g,'');
 const extras=`<meta name="robots" content="${allow?'index,follow':'noindex,nofollow'}"/><link rel="canonical" href="${escapeHtml(canonical)}"/>${title?`<meta property="og:title" content="${escapeHtml(title)}"/>`:''}${description?`<meta name="description" content="${escapeHtml(description)}"/><meta property="og:description" content="${escapeHtml(description)}"/>`:''}<meta property="og:url" content="${escapeHtml(canonical)}"/>${image?`<meta property="og:image" content="${escapeHtml(image)}"/>`:''}${schema}`;
 html=html.replace('</head>',`${extras}${alternates.map(v=>`<link rel="alternate" hreflang="${v.lang}" href="${escapeHtml(v.url)}"/>`).join('')}</head>`);
 return new Response(request.method==='HEAD'?null:html,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Robots-Tag':allow?'index,follow':'noindex,nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
}
