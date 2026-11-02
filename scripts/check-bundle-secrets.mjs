import {runtimeEnv} from './runtime-env.mjs';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
const env=runtimeEnv();const forbidden=[env.CLOUDINARY_API_SECRET,env.FIREBASE_PRIVATE_KEY?.split('\n')[1]].filter(Boolean);let count=0;
function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())walk(path);else{const data=readFileSync(path,'utf8');if(forbidden.some(secret=>data.includes(secret)))throw new Error('Server secret found in generated output.');count++}}}
walk('out');walk('dist');console.log(`PASS: ${count} generated files checked; no server secrets found.`);
