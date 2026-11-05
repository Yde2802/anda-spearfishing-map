'use strict';
const SB_URL='https://nqflpwpnhqtlajcqrfky.supabase.co';
const SB_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xZmxwd3BuaHF0bGFqY3FyZmt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4NjAyOTIsImV4cCI6MjEwOTQzNjI5Mn0.b-Z012mL7aux4o0sjuiHuwHBAVk0qRI3subxBlqq31s';
const REDIR='https://yde2802.github.io/anda-spearfishing-map/app/';
let sb=null,sbUser=null,syncing=false;
function sbReady(){return typeof supabase!=='undefined'&&supabase.createClient}
function initSB(){if(!sbReady())return null;if(sb)return sb;sb=supabase.createClient(SB_URL,SB_ANON,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 sb.auth.onAuthStateChange((ev,sess)=>{sbUser=sess&&sess.user||null;updateAuthUI();if(sbUser&&(ev==='SIGNED_IN'||ev==='INITIAL_SESSION'||ev==='TOKEN_REFRESHED'))pullMerge().catch(()=>{})});
 sb.auth.getSession().then(({data})=>{sbUser=data.session&&data.session.user||null;updateAuthUI();if(sbUser)pullMerge().catch(()=>{})});return sb}
function updateAuthUI(){const el=document.getElementById('authBox');if(!el)return;
 if(sbUser){el.innerHTML=`<div class="note">Signed in as <b>${esc(sbUser.email||sbUser.id)}</b></div><button class="btn" id="authOut">Sign out</button><button class="btn" id="authSync">Sync now</button><div class="note" id="authMsg"></div>`;
  document.getElementById('authOut').onclick=async()=>{await sb.auth.signOut();sbUser=null;updateAuthUI();toast('Signed out')};
  document.getElementById('authSync').onclick=()=>pullMerge(true)}
 else{el.innerHTML=`<div class="note">Optional account — app works fully offline without signing in. Magic link email (free Supabase).</div><input id="authEmail" type="email" placeholder="you@email.com" autocomplete="email"><button class="btn p" id="authIn" style="margin-top:6px">Email me a sign-in link</button><div class="note" id="authMsg"></div>`;
  document.getElementById('authIn').onclick=sendMagic}}
async function sendMagic(){const email=document.getElementById('authEmail').value.trim();const msg=document.getElementById('authMsg');
 if(!email||!email.includes('@')){msg.textContent='Enter a valid email.';return}msg.textContent='Sending…';
 const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:REDIR}});
 msg.textContent=error?('Error: '+error.message):'Check your email for the magic link. Open it on this phone.';}
function newer(a,b){return new Date(a||0)>=new Date(b||0)}
async function pullMerge(force){if(!sbUser||syncing)return;syncing=true;const msg=document.getElementById('authMsg');if(msg)msg.textContent='Syncing…';
 try{await pushLocal();
  // favourites
  const {data:rf}=await sb.from('favourites').select('*').eq('user_id',sbUser.id);
  const locF=LS.get(FAV_KEY,[]);const byKey={};locF.forEach(r=>byKey[r.id]=r);
  (rf||[]).forEach(r=>{const loc=byKey[r.id];const remote={id:r.id,type:r.type,key:r.key,name:r.name,ll:r.lat!=null?[r.lat,r.lon]:null,updated_at:r.updated_at,deleted_at:r.deleted_at,meta:r.meta};
   if(!loc||newer(remote.updated_at,loc.updated_at))byKey[r.id]=remote});
  LS.set(FAV_KEY,Object.values(byKey));
  // pins
  const {data:rp}=await sb.from('pins').select('*').eq('user_id',sbUser.id);
  const locP=LS.get(PIN_KEY,[]);const byP={};locP.forEach(r=>byP[r.id]=r);
  (rp||[]).forEach(r=>{const loc=byP[r.id];const remote={id:r.id,name:r.name,note:r.note,when:r.when_txt,ll:[r.lat,r.lon],type:'pin',updated_at:r.updated_at,deleted_at:r.deleted_at};
   if(!loc||newer(remote.updated_at,loc.updated_at))byP[r.id]=remote});
  LS.set(PIN_KEY,Object.values(byP));
  // settings
  const {data:rs}=await sb.from('settings').select('*').eq('user_id',sbUser.id).maybeSingle();
  if(rs&&rs.payload){const loc=getSettings();const locAt=LS.get('ph_settings_at',null);if(!locAt||newer(rs.updated_at,locAt)){setSettings(Object.assign(defaultSettings(),rs.payload));LS.set('ph_settings_at',rs.updated_at)}}
  if(typeof renderFavs==='function')renderFavs();if(typeof drawPins==='function')drawPins();if(typeof loadOptsUI==='function')loadOptsUI();if(typeof checkSpots==='function')checkSpots();
  if(msg)msg.textContent='Synced '+new Date().toLocaleTimeString('en-GB');if(force)toast('Synced')}
 catch(e){if(msg)msg.textContent='Sync failed: '+(e.message||e);console.warn('sync',e)}
 finally{syncing=false}}
async function pushLocal(){if(!sbUser)return;
 const favs=LS.get(FAV_KEY,[]);
 if(favs.length){const rows=favs.map(f=>({id:f.id,user_id:sbUser.id,type:f.type||'spot',key:f.key||f.id,name:f.name||null,lat:f.ll?f.ll[0]:null,lon:f.ll?f.ll[1]:null,meta:{},updated_at:f.updated_at||nowIso(),deleted_at:f.deleted_at||null}));
  const {error}=await sb.from('favourites').upsert(rows,{onConflict:'id'});if(error)throw error}
 const pins=LS.get(PIN_KEY,[]);
 if(pins.length){const rows=pins.map(p=>({id:p.id,user_id:sbUser.id,name:p.name||'Pin',note:p.note||null,when_txt:p.when||null,lat:p.ll[0],lon:p.ll[1],updated_at:p.updated_at||nowIso(),deleted_at:p.deleted_at||null}));
  const {error}=await sb.from('pins').upsert(rows,{onConflict:'id'});if(error)throw error}
 const S=getSettings();const {error}=await sb.from('settings').upsert({user_id:sbUser.id,payload:S,updated_at:nowIso(),deleted_at:null},{onConflict:'user_id'});if(error)throw error;
 LS.set('ph_settings_at',nowIso())}
// Hook local writes when signed in
const _upsert=typeof upsertRec==='function'?upsertRec:null;
window.afterLocalWrite=()=>{if(sbUser)pushLocal().catch(e=>console.warn('push',e))};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&sbUser)pullMerge().catch(()=>{})});
addEventListener('online',()=>{if(sbUser)pullMerge().catch(()=>{})});
