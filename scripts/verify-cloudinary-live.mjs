import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runtimeEnv} from './runtime-env.mjs';
import {cloudinaryUpload} from '../worker/services.mjs';
const env=runtimeEnv();let asset;
try{
 asset=await cloudinaryUpload(env,readFileSync('public/images/desha-logo.jpeg'),'image/jpeg','desha-logo-upload-check.jpeg');
 assert.match(asset.publicId,/^desha-news\/[0-9a-f-]{36}$/);
 const r=await fetch(asset.url,{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);assert.match(r.headers.get('Content-Type'),/^image\//);assert((await r.arrayBuffer()).byteLength>0);
 console.log('PASS: signed Cloudinary upload and delivery of the supplied Desha News logo.');
}finally{
 if(asset?.publicId&&/^desha-news\/[0-9a-f-]{36}$/.test(asset.publicId)){
  const timestamp=String(Math.floor(Date.now()/1000));const input=`public_id=${asset.publicId}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
  const signature=Buffer.from(await crypto.subtle.digest('SHA-1',new TextEncoder().encode(input))).toString('hex');
  const body=new URLSearchParams({public_id:asset.publicId,timestamp,api_key:env.CLOUDINARY_API_KEY,signature});
  const r=await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`,{method:'POST',body,signal:AbortSignal.timeout(15000)});const data=await r.json();
  assert(r.ok&&data.result==='ok','Temporary upload cleanup failed.');console.log('Only the temporary test upload was removed.');
 }
}
