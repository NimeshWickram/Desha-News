// Server-only integrations. No credentials are included in the generated assets.
const encoder = new TextEncoder();
const serviceTokens = new Map();
const serviceError = (message, status = 503) => Object.assign(new Error(message), { status });
const base64url = value => btoa(typeof value === 'string' ? value : String.fromCharCode(...value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
export function firestoreReady(env) { return !!(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY); }
export async function firebaseAccessToken(env, scope='https://www.googleapis.com/auth/datastore') {
 if (!firestoreReady(env)) throw serviceError('Firebase setup is incomplete. Add the server service-account credentials.');
 const cacheKey = `${scope}:${env.FIREBASE_PROJECT_ID}:${env.FIREBASE_CLIENT_EMAIL}:${env.FIREBASE_PRIVATE_KEY}`;
 const cached = serviceTokens.get(cacheKey);
 if (cached && cached.expires > Date.now() + 60000) return cached.token;
 const now = Math.floor(Date.now() / 1000);
 const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
 const payload = base64url(JSON.stringify({ iss: env.FIREBASE_CLIENT_EMAIL, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
 const pem = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/-----[^-]+-----|[\s"']/g, '');
 const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
 const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(`${header}.${payload}`)));
 const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${payload}.${base64url(signature)}` }), signal: AbortSignal.timeout(15000) });
 const data = await response.json();
 if (!response.ok || !data.access_token) throw serviceError('Firebase server authentication failed. Check the service account.');
 serviceTokens.set(cacheKey, { token: data.access_token, expires: Date.now() + Number(data.expires_in) * 1000 });
 return data.access_token;
}
export function firestoreStore(env) {
 const root = `projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents`;
 async function call(path, options = {}, missing = false) {
  const token = await firebaseAccessToken(env);
  const r = await fetch(`https://firestore.googleapis.com/v1/${root}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (missing && r.status === 404) return null;
  const result = await r.json();
  if (!r.ok) {
   if ([409, 412].includes(r.status) || ['ALREADY_EXISTS', 'FAILED_PRECONDITION', 'ABORTED'].includes(result.error?.status)) throw serviceError('Another editor saved first or this URL is already used. Refresh before saving.', 409);
   throw serviceError('Firestore is unavailable. Check that the database exists and the service account has access.');
  }
  return result;
 }
 const get = path => call(`/${path}`, {}, true);
 const fields = data => ({ data: { stringValue: JSON.stringify(data) } });
 const unpack = doc => JSON.parse(doc.fields.data.stringValue);
 return {
  async posts() {
   const rows = []; let pageToken = '';
   do { const page = await call(`/posts?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`); rows.push(...(page.documents || []).map(unpack)); pageToken = page.nextPageToken || ''; } while (pageToken);
   return rows;
  },
  async settings() { const doc = await get('settings/site'); return doc ? unpack(doc) : {}; },
  async saveSettings(data) { await call('/settings/site', { method: 'PATCH', body: JSON.stringify({ fields: fields(data) }) }); },
  async savePost(post, old, authorId) {
   const existing = await get(`posts/${post.id}`);
   if (existing ? unpack(existing).version !== (old?.version || 0) : (old?.version || 0) > 0) throw serviceError('This story changed in another session. Refresh before saving.', 409);
   const slug = await get(`slugs/${post.slug}`);
   if (slug && slug.fields.postId.stringValue !== post.id) throw serviceError('Another story already uses this URL.', 409);
   const writes = [
    { update: { name: `${root}/posts/${post.id}`, fields: { ...fields(post), authorId: { stringValue: authorId } } }, currentDocument: existing ? { updateTime: existing.updateTime } : { exists: false } },
    { update: { name: `${root}/slugs/${post.slug}`, fields: { postId: { stringValue: post.id } } }, currentDocument: slug ? { updateTime: slug.updateTime } : { exists: false } }
   ];
   if (old && old.slug !== post.slug) {
    const previous = await get(`slugs/${old.slug}`);
    if (previous?.fields.postId.stringValue === post.id) writes.push({ delete: `${root}/slugs/${old.slug}`, currentDocument: { updateTime: previous.updateTime } });
   }
   await call(':commit', { method: 'POST', body: JSON.stringify({ writes }) });
  }
 };
}
export function cloudinaryReady(env) { return !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET); }
export function cloudinaryImage(url, env) {
 try { const u = new URL(url); return u.protocol === 'https:' && u.hostname === 'res.cloudinary.com' && !u.username && !u.password && u.pathname.startsWith(`/${env.CLOUDINARY_CLOUD_NAME}/image/upload/`); } catch { return false; }
}
export async function cloudinaryUpload(env, bytes, type, name) {
 if (!cloudinaryReady(env)) throw serviceError('Cloudinary is not configured. Add the server credentials.');
 const timestamp = String(Math.floor(Date.now() / 1000));
 const publicId = `desha-news/${crypto.randomUUID()}`;
 const signed = `public_id=${publicId}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
 const signature = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', encoder.encode(signed))), b => b.toString(16).padStart(2, '0')).join('');
 const form = new FormData(); form.set('file', new Blob([bytes], { type }), name); form.set('timestamp', timestamp); form.set('public_id', publicId); form.set('api_key', env.CLOUDINARY_API_KEY); form.set('signature', signature);
 const r = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/image/upload`, { method: 'POST', body: form, signal: AbortSignal.timeout(60000) });
 const data = await r.json();
 if (!r.ok || !cloudinaryImage(data.secure_url, env)) throw serviceError('Cloudinary upload failed. Check the API credentials and upload limits.');
 return { url: data.secure_url, name, size: data.bytes, publicId: data.public_id };
}
export async function cloudinaryList(env) {
 if (!cloudinaryReady(env)) throw serviceError('Cloudinary is not configured. Add the server credentials.');
 const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/resources/image/upload?prefix=desha-news%2F&max_results=100`;
 const r = await fetch(url, { headers: { Authorization: `Basic ${btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`)}` }, signal: AbortSignal.timeout(15000) });
 const data = await r.json();
 if (!r.ok) throw serviceError('Cloudinary media library could not be loaded.');
 return { items: (data.resources || []).map(v => ({ url: v.secure_url, name: v.display_name || v.public_id.split('/').pop(), size: v.bytes })), truncated: !!data.next_cursor };
}
const allowedEmail = (email, env) => (env.ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
export async function editorIdentity(request, env) {
 if (env.AUTH_PROVIDER === 'firebase') {
  const token = (request.headers.get('Cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith('desha_session='))?.slice(14);
  if (!token || !env.FIREBASE_WEB_API_KEY) return { id: null, email: '', isAdmin: false };
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }), signal: AbortSignal.timeout(10000) });
  if (!r.ok) return { id: null, email: '', isAdmin: false };
  const user = (await r.json()).users?.[0];
  const pinned=(env.FIREBASE_ADMIN_UIDS||'').split(',').map(v=>v.trim()).filter(Boolean);
  return { id: user?.localId || null, email: user?.email || '', isAdmin: !!user && !user.disabled && allowedEmail(user.email || '', env) && (user.emailVerified===true || pinned.includes(user.localId)) };
 }
 const id = request.headers.get('oai-authenticated-user-id'); const email = request.headers.get('oai-authenticated-user-email') || '';
 return { id, email, isAdmin: !!id && allowedEmail(email, env) };
}
export async function firebaseLogin(request, env) {
 if (env.AUTH_PROVIDER !== 'firebase' || !env.FIREBASE_WEB_API_KEY || !env.ADMIN_EMAILS) throw serviceError('Firebase editorial login is not configured.');
 const raw = await request.text(); if (raw.length > 5000) throw serviceError('Request too large.', 413);
 const { email, password } = JSON.parse(raw);
 if (typeof email !== 'string' || typeof password !== 'string' || !allowedEmail(email, env)) throw serviceError('Sign-in failed. Check your editorial account.', 401);
 const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }), signal: AbortSignal.timeout(15000) });
 const data = await r.json();
 if (!r.ok || !data.idToken) throw serviceError(r.status === 429 ? 'Too many attempts. Please try again later.' : 'Sign-in failed. Check your account and enable Email/Password in Firebase.', r.status === 429 ? 429 : 401);
 const check=await editorIdentity(new Request(request.url,{headers:{Cookie:`desha_session=${data.idToken}`}}),env);
 if(!check.isAdmin)throw serviceError('Verify your email address, or configure your Firebase user UID in the server allowlist.',403);
 return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store', 'Set-Cookie': `desha_session=${data.idToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3500${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}` } });
}
