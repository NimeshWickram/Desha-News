import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
export function runtimeEnv() {
 if(existsSync('.env.local'))process.loadEnvFile('.env.local');
 const env={...process.env};
 const path=resolve(env.FIREBASE_SERVICE_ACCOUNT_PATH||'.secrets/firebase-service-account.json');
 if(existsSync(path)){
  const account=JSON.parse(readFileSync(path,'utf8'));
  if(account.project_id!==env.FIREBASE_PROJECT_ID)throw new Error('Service-account project does not match FIREBASE_PROJECT_ID.');
  env.FIREBASE_CLIENT_EMAIL=account.client_email;env.FIREBASE_PRIVATE_KEY=account.private_key;
 }
 return env;
}
