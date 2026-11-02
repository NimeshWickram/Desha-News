import assert from 'node:assert/strict';
import {firestoreStore,editorIdentity,firebaseLogin,cloudinaryUpload} from '../worker/services.mjs';
import {seoResponse} from '../worker/seo.mjs';
const original=globalThis.fetch;
try{
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const pem=Buffer.from(await crypto.subtle.exportKey('pkcs8',keys.privateKey)).toString('base64');
 const env={FIREBASE_PROJECT_ID:'test',FIREBASE_CLIENT_EMAIL:'test@example.com',FIREBASE_PRIVATE_KEY:`-----BEGIN PRIVATE KEY-----\n${pem}\n-----END PRIVATE KEY-----`,AUTH_PROVIDER:'firebase',FIREBASE_WEB_API_KEY:'test',ADMIN_EMAILS:'editor@example.com',FIREBASE_ADMIN_UIDS:'editor-uid',CLOUDINARY_CLOUD_NAME:'test-cloud',CLOUDINARY_API_KEY:'key',CLOUDINARY_API_SECRET:'test-secret'};
 let commits=[],postDoc=null,slugDoc=null,user={localId:'editor-uid',email:'editor@example.com',emailVerified:false};
 globalThis.fetch=async(url,options={})=>{
  const u=String(url);
  if(u.includes('oauth2.googleapis.com'))return Response.json({access_token:'mock',expires_in:3600});
  if(u.includes('accounts:lookup'))return Response.json({users:[user]});
  if(u.includes('accounts:signInWithPassword'))return Response.json({idToken:'mock-id-token'});
  if(u.endsWith(':commit')){commits.push(JSON.parse(options.body));return Response.json({writeResults:[]})}
  if(u.includes('/posts/'))return postDoc?Response.json(postDoc):Response.json({}, {status:404});
  if(u.includes('/slugs/'))return slugDoc?Response.json(slugDoc):Response.json({}, {status:404});
  if(u.includes('api.cloudinary.com')){const form=options.body;assert.match(form.get('signature'),/^[a-f0-9]{40}$/);assert(!form.has('api_secret'));return Response.json({secure_url:'https://res.cloudinary.com/test-cloud/image/upload/v1/test.webp',bytes:10})}
  throw new Error('Unexpected request: '+u);
 };
 const store=firestoreStore(env);const post={id:'p1',slug:'a-story',version:1};await store.savePost(post,undefined,'editor-uid');
 assert.equal(commits[0].writes.length,2);assert.deepEqual(commits[0].writes[0].currentDocument,{exists:false});assert.deepEqual(commits[0].writes[1].currentDocument,{exists:false});
 postDoc={fields:{data:{stringValue:JSON.stringify(post)}},updateTime:'2026-10-29T00:00:00Z'};slugDoc={fields:{postId:{stringValue:'p1'}},updateTime:'2026-10-29T00:00:00Z'};
 await store.savePost({...post,version:2},post,'editor-uid');assert.equal(commits[1].writes[0].currentDocument.updateTime,postDoc.updateTime);
 await assert.rejects(()=>store.savePost({...post,version:3},{...post,version:0},'editor-uid'),e=>e.status===409);
 slugDoc={fields:{postId:{stringValue:'other'}},updateTime:'2026-10-29T00:00:00Z'};await assert.rejects(()=>store.savePost({...post,version:2},post,'editor-uid'),e=>e.status===409);
 const req=new Request('https://news.example/api/session',{headers:{Cookie:'desha_session=mock'}});assert.equal((await editorIdentity(req,env)).isAdmin,true);
 user={...user,localId:'different-uid'};assert.equal((await editorIdentity(req,env)).isAdmin,false);user={...user,email:'other@example.com',emailVerified:true};assert.equal((await editorIdentity(req,env)).isAdmin,false);
 user={localId:'editor-uid',email:'editor@example.com',emailVerified:false};const login=await firebaseLogin(new Request('https://news.example/api/auth/login',{method:'POST',body:JSON.stringify({email:user.email,password:'test-only'})}),env);assert.match(login.headers.get('Set-Cookie'),/HttpOnly; SameSite=Strict/);assert.match(login.headers.get('Set-Cookie'),/Secure/);
 const media=await cloudinaryUpload(env,new Uint8Array([1,2]),'image/webp','test.webp');assert.match(media.url,/^https:/);
 const published={...post,status:'published',sample:false,si:{title:'සිංහල',excerpt:'විස්තර'},en:{title:'English story',excerpt:'A useful story'},image:'/images/ella.webp',publishedAt:'2026-10-28T00:00:00Z',updatedAt:'2026-10-29T00:00:00Z',author:'Editor'};
 const api=async()=>Response.json({posts:[published,{...published,slug:'sample',sample:true}]});const prod={SITE_URL:'https://news.example',PUBLIC_SITE:'true'};
 const sitemap=await (await seoResponse(new Request('https://news.example/sitemap.xml'),prod,api,null)).text();assert(sitemap.includes('a-story&amp;lang=en'));assert(!sitemap.includes('slug=sample'));
 const article=await seoResponse(new Request('https://news.example/article/?slug=a-story&lang=en'),prod,api,'<html><head><title>Old</title></head><body></body></html>');assert.equal(article.status,200);const html=await article.text();assert(html.includes('English story | Desha News'));assert(html.includes('NewsArticle'));assert.equal(article.headers.get('X-Robots-Tag'),'index,follow');
 const missing=await seoResponse(new Request('https://news.example/article/?slug=missing'),prod,api,'<html><head></head></html>');assert.equal(missing.status,404);
 const robots=await (await seoResponse(new Request('https://news.example/robots.txt'),{},api,null)).text();assert(robots.includes('Disallow: /'));
 console.log('PASS: Firestore atomic version/slug guards, Firebase identity checks, secure cookies, signed Cloudinary upload, sitemap/metadata/noindex. External services mocked.');
}finally{globalThis.fetch=original}
