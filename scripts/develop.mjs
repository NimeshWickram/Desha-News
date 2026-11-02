import {spawn} from 'node:child_process';
import {watch,existsSync} from 'node:fs';
const children=new Set();const expectedExit=new Set();let apiChildren=[];
const launch=args=>{const child=spawn(process.execPath,args,{stdio:'inherit',windowsHide:true});children.add(child);child.on('exit',code=>{children.delete(child);if(expectedExit.delete(child)||stopping)return;if(code){console.error('Development process exited:',code);stop(code)}});return child};
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill();process.exitCode=code}
launch(['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3100']);
function startApis(){apiChildren=[3000,3001].map(port=>launch(['scripts/preview.mjs','--dev','--port',String(port)]))}
startApis();
let timer,restarting=false,queued=false;
async function restartApis(){if(stopping)return;if(restarting){queued=true;return}restarting=true;try{await Promise.all(apiChildren.map(child=>new Promise(resolve=>{if(child.exitCode!==null||child.signalCode!==null){resolve();return}expectedExit.add(child);child.once('exit',resolve);child.kill()})));if(!stopping){console.log('Reloading API servers after server/config changes.');startApis()}}finally{restarting=false;if(queued){queued=false;restartApis()}}}
for(const path of ['worker','scripts/preview.mjs','scripts/runtime-env.mjs','.env.local','.secrets'])if(existsSync(path))watch(path,{persistent:false},()=>{clearTimeout(timer);timer=setTimeout(restartApis,250)});
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
