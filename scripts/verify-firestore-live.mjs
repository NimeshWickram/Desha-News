import assert from 'node:assert/strict';
import {runtimeEnv} from './runtime-env.mjs';
import {firestoreStore,firebaseAccessToken} from '../worker/services.mjs';
const env=runtimeEnv();const store=firestoreStore(env);const id=`qa-${crypto.randomUUID()}`;
const tr={title:'Integration check — unpublished',excerpt:'Temporary draft used to verify database persistence.',body:['This temporary draft is removed by the test.'],alt:'Test'};
const post={id,slug:id,category:'දේශීය',si:tr,en:tr,image:'/images/ella.webp',read:1,status:'draft',featured:false,editorPick:false,breaking:false,sample:true,author:'Integration check',publishedAt:'',updatedAt:new Date().toISOString(),version:1};
try{
 await store.savePost(post,undefined,'integration-check');assert((await store.posts()).some(p=>p.id===id&&p.status==='draft'));
 await store.savePost({...post,version:2},post,'integration-check');
 await assert.rejects(()=>store.savePost({...post,version:3},post,'integration-check'),e=>e.status===409);
 console.log('PASS: live Firestore draft creation, persistence, update and stale-write protection.');
}finally{
 const root=`projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;const token=await firebaseAccessToken(env);const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};const writes=[];
 for(const path of [`posts/${id}`,`slugs/${id}`]){const r=await fetch(`https://firestore.googleapis.com/v1/${root}/${path}`,{headers});if(r.status===404)continue;if(!r.ok)throw new Error('Unable to inspect temporary test data for cleanup.');const doc=await r.json();writes.push({delete:doc.name,currentDocument:{updateTime:doc.updateTime}})}
 if(writes.length){const r=await fetch(`https://firestore.googleapis.com/v1/${root}:commit`,{method:'POST',headers,body:JSON.stringify({writes})});if(!r.ok)throw new Error('Temporary test draft cleanup failed.');}
 console.log('Temporary draft and slug removed. No test story was published.');
}
