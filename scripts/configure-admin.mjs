import {runtimeEnv} from './runtime-env.mjs';
import {firebaseAccessToken} from '../worker/services.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
const env=runtimeEnv();
try{
 const token=await firebaseAccessToken(env,'https://www.googleapis.com/auth/cloud-platform');
 const r=await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts:lookup`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({email:env.ADMIN_EMAILS.split(',').map(v=>v.trim())}),signal:AbortSignal.timeout(15000)});
 const data=await r.json();if(!r.ok)throw new Error(`Firebase account lookup failed (${data.error?.status||r.status}: ${data.error?.message||'No details'}). Enable Firebase Authentication and create your editorial account.`);
 const users=(data.users||[]).filter(u=>!u.disabled&&env.ADMIN_EMAILS.split(',').map(v=>v.trim().toLowerCase()).includes(u.email.toLowerCase()));
 if(!users.length)throw new Error('No matching editorial account exists in Firebase Authentication yet.');
 let text=readFileSync('.env.local','utf8');text=text.replace(/^FIREBASE_ADMIN_UIDS=.*\r?\n?/m,'');text+=`\nFIREBASE_ADMIN_UIDS=${users.map(u=>u.localId).join(',')}\n`;writeFileSync('.env.local',text);
 console.log(`Configured ${users.length} existing Firebase editorial account(s). No passwords changed.`);
}catch(e){console.error(e.message);process.exitCode=1}
