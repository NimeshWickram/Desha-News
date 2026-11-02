// Local-only preview adapter. This file is never included in the deployed Worker.
import {createServer,request as httpRequest} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {runtimeEnv} from './runtime-env.mjs';
import {createApi} from '../worker/api.mjs';
const port=Number(process.argv[process.argv.indexOf('--port')+1])||3000;
const configured=process.argv.includes('--demo')?{}:runtimeEnv();
const localStorageEnabled=process.argv.includes('--demo')||configured.CONTENT_PROVIDER!=='firebase';
const state=resolve(process.env.DESHA_PREVIEW_STATE||'.sites-runtime/preview');if(localStorageEnabled){mkdirSync(state,{recursive:true});mkdirSync(join(state,'media'),{recursive:true})}
const db=localStorageEnabled?new DatabaseSync(join(state,'content.sqlite')):null;
if(db){db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
db.exec('CREATE TABLE IF NOT EXISTS __preview_migrations (name TEXT PRIMARY KEY, hash TEXT NOT NULL)');
for(const name of readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort()){const sql=readFileSync(join('drizzle',name),'utf8');const hash=createHash('sha256').update(sql).digest('hex');const old=db.prepare('SELECT hash FROM __preview_migrations WHERE name=?').get(name);if(old){if(old.hash!==hash)throw new Error('An applied migration was edited: '+name);continue;}db.exec('BEGIN');try{db.exec(sql);db.prepare('INSERT INTO __preview_migrations VALUES (?,?)').run(name,hash);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}}}
const DB={
 prepare(sql){
  const statement=db.prepare(sql);let params=[];
  return {
   bind(...p){params=p;return this},
   async all(){return {results:statement.all(...params)}},
   async first(){return statement.get(...params)||null},
   async run(){const result=statement.run(...params);return {meta:{changes:Number(result.changes)}}}
  };
 }
};
const BUCKET={async put(key,bytes,options){const name=key.split('/').pop();writeFileSync(join(state,'media',name),bytes);writeFileSync(join(state,'media',name+'.json'),JSON.stringify({...options,uploaded:new Date().toISOString()}))},async get(key){const name=key.split('/').pop();const filename=join(state,'media',name);if(!existsSync(filename))return null;const meta=JSON.parse(readFileSync(filename+'.json','utf8'));return {body:readFileSync(filename),httpMetadata:meta.httpMetadata}},async list(){const objects=readdirSync(join(state,'media')).filter(n=>n.endsWith('.json')).map(n=>{const meta=JSON.parse(readFileSync(join(state,'media',n),'utf8'));const name=n.slice(0,-5);return {key:`media/${name}`,size:statSync(join(state,'media',name)).size,...meta}});return {objects,truncated:false}}};
const dev=process.argv.includes('--dev');
let worker;
if(dev){const data=JSON.parse(readFileSync('.sites-runtime/seed.json','utf8'));const api=createApi(data.seedPosts,data.defaultSettings);worker={fetch:api}}
else{const source=readFileSync('dist/server/index.js','utf8');worker=(await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default;}
const env={DB,BUCKET,ADMIN_EMAILS:'editor@desha.local',PREVIEW_MODE:'local',...configured};
if(process.argv.includes('--demo')){env.CONTENT_PROVIDER='demo';env.MEDIA_PROVIDER='local';env.AUTH_PROVIDER='sites'}
else if(env.AUTH_PROVIDER==='firebase'){env.PREVIEW_MODE='';}
const server=createServer(async(req,res)=>{
 try{
  if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(req.headers.host)){res.writeHead(403);res.end('Local preview only');return;}
  const url=new URL(req.url,`http://${req.headers.host}`);
  if(dev&&!url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/media/')&&!url.pathname.startsWith('/__preview/')){
   const upstream=httpRequest({hostname:'127.0.0.1',port:3100,path:req.url,method:req.method,headers:{...req.headers,host:'localhost:3100'}},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res)});
   upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503,{'Content-Type':'text/plain'});res.end('Development server is starting. Refresh in a moment.');});req.pipe(upstream);return;
  }
  if(url.pathname==='/__preview/signin'||url.pathname==='/__preview/signout'){
   if(env.AUTH_PROVIDER==='firebase'){res.writeHead(404);res.end('Development sign-in is disabled for Firebase mode.');return;}
   if(req.headers['sec-fetch-site']==='cross-site'){res.writeHead(403);res.end('Same-origin sign in required');return;}
   const signIn=url.pathname.endsWith('/signin');const target=url.searchParams.get('return_to');const safe=target?.startsWith('/')&&!target.startsWith('//')&&!target.includes('\\')?target:'/admin/';res.writeHead(303,{'Location':safe,'Cache-Control':'no-store','Set-Cookie':`desha_preview=${signIn?'local-editor':''}; Path=/; HttpOnly; SameSite=Lax${signIn?'':'; Max-Age=0'}`});res.end();return;
  }
  const headers=new Headers();for(const [name,value]of Object.entries(req.headers)){if(name.startsWith('oai-authenticated-user-')||name==='host'||value===undefined)continue;headers.set(name,Array.isArray(value)?value.join(','):value)}
  if(env.AUTH_PROVIDER!=='firebase'&&(req.headers.cookie||'').split(';').some(c=>c.trim()==='desha_preview=local-editor')){headers.set('oai-authenticated-user-id','local-editor');headers.set('oai-authenticated-user-email','editor@desha.local')}
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>9*1024*1024){res.writeHead(413);res.end('Too large');return;}chunks.push(chunk)}
  const request=new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){console.error(error.message);res.writeHead(500,{'Content-Type':'text/plain'});res.end('Local preview error')}
});
if(dev)server.on('upgrade',(req,socket,head)=>{
 if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(req.headers.host)){socket.destroy();return}
 const upstream=httpRequest({hostname:'127.0.0.1',port:3100,path:req.url,headers:{...req.headers,host:'localhost:3100'}});
 upstream.on('upgrade',(response,target,targetHead)=>{socket.write(`HTTP/1.1 ${response.statusCode} Switching Protocols\r\n${Object.entries(response.headers).map(([k,v])=>`${k}: ${v}`).join('\r\n')}\r\n\r\n`);if(targetHead.length)socket.write(targetHead);if(head.length)target.write(head);socket.pipe(target);target.pipe(socket);target.on('error',()=>socket.destroy());socket.on('error',()=>target.destroy())});upstream.on('error',()=>socket.destroy());upstream.end();
});
server.listen(port,'127.0.0.1',()=>console.log(`Desha News preview: http://127.0.0.1:${port}\nEditorial workspace: http://127.0.0.1:${port}/admin/\nDatabase: ${env.CONTENT_PROVIDER==='firebase'?'Firebase Firestore':'local demo'}\nImages: ${env.MEDIA_PROVIDER==='cloudinary'?'Cloudinary':'local demo'}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{db?.close();process.exit(0)}));
