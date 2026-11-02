import {firestoreReady,firestoreStore,cloudinaryReady,cloudinaryImage,cloudinaryUpload,cloudinaryList,editorIdentity,firebaseLogin} from './services.mjs';
// Production identity headers are supplied by Sites dispatch. The local-only
// preview harness strips incoming identity headers before adding its test user.
export function createApi(seedPosts, defaultSettings) {
 const categories=new Set(['දේශීය','විදේශීය','ව්‍යාපාර','ක්‍රීඩා','තාක්ෂණය','ජීවන රටා']);
 const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
 const clean=(v,max=500)=>typeof v==='string'?v.trim().slice(0,max):'';
 async function allPosts(env){let rows;if(env.CONTENT_PROVIDER==='firebase')rows=await firestoreStore(env).posts();else{const {results}=await env.DB.prepare('SELECT data,version FROM posts').all();rows=results.map(row=>({...JSON.parse(row.data),version:row.version}))}const map=new Map((env.CONTENT_PROVIDER==='firebase'?[]:seedPosts).map(p=>[p.id,p]));for(const row of rows)map.set(row.id,row);return [...map.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))}
 async function settings(env){if(env.CONTENT_PROVIDER==='firebase')return {...defaultSettings,...await firestoreStore(env).settings()};const row=await env.DB.prepare('SELECT data FROM settings WHERE id = ?').bind('site').first();return {...defaultSettings,...(row?JSON.parse(row.data):{})}}
 function validate(input,old,env){
  if(!input||typeof input!=='object')fail('Invalid article.');
  const post={id:old?.id||crypto.randomUUID(),slug:clean(input.slug,120),category:clean(input.category,40),image:clean(input.image,1000),read:Math.max(1,Math.min(60,Number(input.read)||3)),status:input.status,featured:!!input.featured,editorPick:!!input.editorPick,breaking:!!input.breaking,sample:!!input.sample,author:clean(input.author,100)||'Desha News',publishedAt:old?.publishedAt||'',updatedAt:new Date().toISOString(),version:(old?.version||0)+1};
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug))fail('Use a URL slug with lowercase letters, numbers and hyphens.');
  if(!categories.has(post.category))fail('Choose a valid category.');
  if(!['published','draft','trash'].includes(post.status))fail('Invalid status.');
  if((post.image||post.status==='published')&&!/^\/images\/[a-zA-Z0-9._-]+$/.test(post.image)&&!(env.CONTENT_PROVIDER!=='firebase'&&/^\/media\/[a-zA-Z0-9._-]+$/.test(post.image))&&!cloudinaryImage(post.image,env))fail('Choose an uploaded image or a library image before publishing.');
  for(const lang of ['si','en']){const value=input[lang]||{};post[lang]={title:clean(value.title,220),excerpt:clean(value.excerpt,800),alt:clean(value.alt,300),body:Array.isArray(value.body)?value.body.slice(0,150).map(p=>clean(p,12000)).filter(Boolean):[]};}
  if(!post.si.title&&!post.en.title)fail('Add a title in at least one language.');
  if(post.status==='published')for(const lang of ['si','en']){const tr=post[lang];if(tr.title&&(!tr.excerpt||!tr.body.length||!tr.alt))fail(`Complete the ${lang==='si'?'Sinhala':'English'} excerpt, article and image description before publishing.`)}
  if(post.status==='published'&&!post.publishedAt)post.publishedAt=post.updatedAt;
  return post;
 }
 return async function api(request,env){
  const url=new URL(request.url);const path=url.pathname.replace(/\/$/,'');
  try{
   if(path==='/api/session'){const user=await editorIdentity(request,env);return json({signedIn:!!user.id,isAdmin:user.isAdmin,email:user.isAdmin?user.email:'',configured:!!env.ADMIN_EMAILS,local:env.PREVIEW_MODE==='local',authProvider:env.AUTH_PROVIDER||'sites',storage:env.CONTENT_PROVIDER==='firebase'?'firebase':'demo',firebaseReady:firestoreReady(env),cloudinaryReady:cloudinaryReady(env)})}
   if(path==='/api/auth/login'||path==='/api/auth/logout'){
    if(request.method!=='POST'||request.headers.get('Origin')!==url.origin||request.headers.get('X-Desha-Request')!=='1')fail('Request origin could not be verified.',403);
    if(path.endsWith('/login'))return await firebaseLogin(request,env);
    return Response.json({success:true},{headers:{'Cache-Control':'no-store','Set-Cookie':`desha_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${url.protocol==='https:'?'; Secure':''}`}});
   }
   if(path.startsWith('/media/')){if(env.MEDIA_PROVIDER==='cloudinary'||!env.BUCKET||!/^\/media\/[a-f0-9-]+\.(jpg|png|webp)$/.test(path))return new Response('Not found',{status:404});const object=await env.BUCKET.get(path.slice(1));if(!object)return new Response('Not found',{status:404});return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}})}
   if(env.CONTENT_PROVIDER!=='firebase'&&!env.DB)fail('The content database is not configured.',503);
   if(path==='/api/public'&&request.method==='GET')return json({posts:(await allPosts(env)).filter(p=>p.status==='published'),settings:await settings(env)});
   if(!path.startsWith('/api/admin/'))return json({error:'Not found'},404);
   const user=await editorIdentity(request,env);if(!user.id)fail('Sign in to continue.',401);if(!user.isAdmin)fail('This account does not have editorial access.',403);
   if(!['GET','HEAD'].includes(request.method)){
    if(request.headers.get('Origin')!==url.origin||request.headers.get('X-Desha-Request')!=='1')fail('Request origin could not be verified.',403);
    if(path!=='/api/admin/media'&&!request.headers.get('Content-Type')?.includes('application/json'))fail('Expected a JSON request.',415);
    if(Number(request.headers.get('Content-Length')||0)>9*1024*1024)fail('Request is too large.',413);
   }
   if(path==='/api/admin/posts'&&request.method==='GET')return json({posts:await allPosts(env),settings:await settings(env)});
   if(path==='/api/admin/posts'&&request.method==='POST'){
    const raw=await request.text();if(raw.length>300000)fail('Article is too long.',413);const input=JSON.parse(raw);const posts=await allPosts(env);const old=input.id?posts.find(p=>p.id===input.id):undefined;
    if(input.id&&!old)fail('Article no longer exists. Refresh and try again.',404);
    if(old&&Number(input.version)!==old.version)fail('This article changed in another session. Refresh before saving.',409);
    const post=validate(input,old,env);if(posts.some(p=>p.slug===post.slug&&p.id!==post.id))fail('Another story already uses this URL slug.',409);
    if(env.CONTENT_PROVIDER==='firebase'){await firestoreStore(env).savePost(post,old,user.id);return json({post})}
    const values=[post.slug,JSON.stringify(post),post.status,post.version,post.updatedAt,user.id,post.id];
    let result;
    if(old&&old.version>0)result=await env.DB.prepare('UPDATE posts SET slug=?,data=?,status=?,version=?,updated_at=?,author_id=? WHERE id=? AND version=?').bind(...values,old.version).run();
    else result=await env.DB.prepare('INSERT INTO posts (slug,data,status,version,updated_at,author_id,id) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(...values).run();
    if(!result.meta.changes)fail('Another editor saved first. Refresh before saving.',409);
    return json({post});
   }
   if(path==='/api/admin/settings'&&request.method==='PUT'){
    const input=await request.json();const value={facebookUrl:clean(input.facebookUrl,500),taglineSi:clean(input.taglineSi,100),taglineEn:clean(input.taglineEn,100),contactEmail:clean(input.contactEmail,200)};
    if(value.contactEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.contactEmail))fail('Enter a valid contact email.');
    if(value.facebookUrl){let u;try{u=new URL(value.facebookUrl)}catch{fail('Enter a valid Facebook URL.')};if(u.protocol!=='https:'||!['facebook.com','www.facebook.com','m.facebook.com','fb.com','www.fb.com'].includes(u.hostname)||u.username||u.password)fail('Use an https://facebook.com page URL.');}
    if(!value.taglineSi||!value.taglineEn)fail('Add the tagline in both languages.');
    if(env.CONTENT_PROVIDER==='firebase')await firestoreStore(env).saveSettings(value);else await env.DB.prepare('INSERT INTO settings(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind('site',JSON.stringify(value)).run();return json({settings:value});
   }
   if(path==='/api/admin/media'&&request.method==='GET'){if(env.MEDIA_PROVIDER==='cloudinary')return json(await cloudinaryList(env));const list=await env.BUCKET.list({prefix:'media/',limit:100,include:['customMetadata','httpMetadata']});return json({items:list.objects.map(o=>({url:`/${o.key}`,name:o.customMetadata?.name||o.key,size:o.size})),truncated:list.truncated})}
   if(path==='/api/admin/media'&&request.method==='POST'){
    const bytes=new Uint8Array(await request.arrayBuffer());if(!bytes.length||bytes.length>8*1024*1024)fail('Choose an image up to 8 MB.',413);
    const type=request.headers.get('Content-Type');let ext='';
    if(type==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)ext='jpg';
    if(type==='image/png'&&bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10')ext='png';
    if(type==='image/webp'&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')ext='webp';
    if(!ext)fail('Only valid JPG, PNG and WebP images are accepted.');const key=`media/${crypto.randomUUID()}.${ext}`;const name=clean(decodeURIComponent(request.headers.get('X-File-Name')||'Image'),200);
    if(env.MEDIA_PROVIDER==='cloudinary')return json(await cloudinaryUpload(env,bytes,type,name),201);
    await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:type},customMetadata:{name}});return json({url:`/${key}`,name,size:bytes.length},201);
   }
   return json({error:'Method or endpoint not found'},404);
  }catch(error){if(error.status)return json({error:error.message},error.status);if(error instanceof SyntaxError)return json({error:'Invalid JSON request.'},400);console.error('Content operation failed',error.message);return json({error:'The operation could not be completed. Please try again.'},500)}
 }
}
