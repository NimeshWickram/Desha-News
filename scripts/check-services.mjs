import {runtimeEnv} from './runtime-env.mjs';
import {firestoreStore,cloudinaryList,firebaseAccessToken} from '../worker/services.mjs';
const env=runtimeEnv();
let failed=false;
for(const [name,check] of [['Firestore',()=>firestoreStore(env).posts()],['Cloudinary',()=>cloudinaryList(env)]]){
 try{const data=await check();console.log(`${name}: connected (${Array.isArray(data)?data.length:data.items.length} records)`)}catch(e){failed=true;console.error(`${name}: ${e.message}`)}
}
if(failed)process.exitCode=1;
if(process.argv.includes('--diagnose')){
 try{const token=await firebaseAccessToken(env);const r=await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/posts?pageSize=1`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});const data=await r.json();console.log(JSON.stringify({service:'Firestore',status:r.status,error:data.error?.status,message:data.error?.message}));}catch(e){console.error('Firestore diagnostic failed:',e.message)}
}
