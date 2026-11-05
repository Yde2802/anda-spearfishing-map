'use strict';
const $=id=>document.getElementById(id),LS={get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}},set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pad=n=>String(n).padStart(2,'0'),hm=d=>pad(d.getHours())+':'+pad(d.getMinutes());
const fmtD=m=>m<1000?Math.round(m)+' m':(m/1000).toFixed(m<10000?2:1)+' km';
const R2D=180/Math.PI,D2R=Math.PI/180;
function bearing(a,b){const y=Math.sin((b[1]-a[1])*D2R)*Math.cos(b[0]*D2R),x=Math.cos(a[0]*D2R)*Math.sin(b[0]*D2R)-Math.sin(a[0]*D2R)*Math.cos(b[0]*D2R)*Math.cos((b[1]-a[1])*D2R);return (Math.atan2(y,x)*R2D+360)%360}
const card=b=>['N','NE','E','SE','S','SW','W','NW'][Math.round(b/45)%8];
const hav=(a,b)=>{const p=(b[0]-a[0])*D2R,l=(b[1]-a[1])*D2R,h=Math.sin(p/2)**2+Math.cos(a[0]*D2R)*Math.cos(b[0]*D2R)*Math.sin(l/2)**2;return 12742000*Math.asin(Math.sqrt(h))};
let previewH=0;const tNow=()=>new Date(Date.now()+previewH*3600e3);
// ---------- sheet / tabs ----------
const sheet=$('sheet'),shead=$('shead');L.DomEvent.disableClickPropagation(sheet);L.DomEvent.disableScrollPropagation(sheet);
const snapH=()=>{const v=innerHeight;return{min:84,'':v*.45,big:v*.88}};
function setSnap(c){sheet.style.height='';sheet.className=c;setTimeout(()=>map.invalidateSize(),300)}
let dg=null;
shead.addEventListener('touchstart',e=>{const t=e.touches[0];dg={y:t.clientY,h:sheet.getBoundingClientRect().height,moved:false,hist:[[t.clientY,e.timeStamp]]}},{passive:true});
shead.addEventListener('touchmove',e=>{if(!dg)return;const t=e.touches[0],dy=dg.y-t.clientY;if(!dg.moved&&Math.abs(dy)<6)return;dg.moved=true;e.preventDefault();sheet.classList.add('drag');
 const H=snapH();sheet.style.height=Math.max(H.min,Math.min(H.big,dg.h+dy))+'px';dg.hist.push([t.clientY,e.timeStamp]);if(dg.hist.length>5)dg.hist.shift()},{passive:false});
shead.addEventListener('touchend',e=>{if(!dg)return;const d=dg;dg=null;sheet.classList.remove('drag');if(!d.moved)return;e.preventDefault();
 const h=sheet.getBoundingClientRect().height,H=snapH(),a=d.hist[0],b=d.hist[d.hist.length-1],v=(a[0]-b[0])/Math.max(1,b[1]-a[1]);// px/ms, + = up
 const order=['min','','big'];let c;if(Math.abs(v)>.5){const cur=order.reduce((p,k)=>Math.abs(H[k]-h)<Math.abs(H[p]-h)?k:p,'min');let i=order.indexOf(cur);if(v>0&&H[cur]<=h)i++;if(v<0&&H[cur]>=h)i--;c=order[Math.max(0,Math.min(2,i))]}
 else c=order.reduce((p,k)=>Math.abs(H[k]-h)<Math.abs(H[p]-h)?k:p,'min');setSnap(c)},{passive:false});
shead.addEventListener('touchcancel',()=>{if(dg){dg=null;sheet.classList.remove('drag');setSnap(sheet.className)}});
$('grab').onclick=()=>setSnap(sheet.className=='min'?'':sheet.className==''?'big':'min');
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{if(b.classList.contains('act')&&sheet.className!='min'){setSnap('min');return}document.querySelectorAll('#tabs button,.pane').forEach(x=>x.classList.remove('act'));b.classList.add('act');$('p-'+b.dataset.t).classList.add('act');if(sheet.className=='min')setSnap('');(TABS[b.dataset.t]||(()=>{}))()});
const TABS={};const toast=(t,ms=2500,fn)=>{const e=$('toast');e.textContent=t;e.style.display='block';e.onclick=fn||null;clearTimeout(e._t);if(ms)e._t=setTimeout(()=>e.style.display='none',ms)};
// ---------- map ----------
const T=new Set(TK);
const map=L.map('map',{zoomControl:false,preferCanvas:true,minZoom:6,maxZoom:18,maxBounds:[[3,113],[23,130]],attributionControl:true});
const ESRI=(z,x,y)=>`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
// Tiles: always request the real zoom from Esri (SW: network-first, runtime cache, falls back to downloaded/bundled/cached).
// If a tile fails (offline + not cached), draw the best cached parent, scaled, with no smoothing seams.
const Sat=L.GridLayer.extend({createTile(c,done){const cv=document.createElement('canvas');cv.width=cv.height=256;const g=cv.getContext('2d');
 const tryZ=dz=>{const z=c.z-dz;if(dz>7||z<6){done(null,cv);return}const x=c.x>>dz,y=c.y>>dz,i=new Image();i.crossOrigin='anonymous';
  i.onload=()=>{const s=256/2**dz,ox=(c.x-(x<<dz))*s,oy=(c.y-(y<<dz))*s;g.imageSmoothingEnabled=dz<3;g.drawImage(i,ox,oy,s,s,-.5,-.5,257,257);done(null,cv)};
  i.onerror=()=>tryZ(dz+1);i.src=ESRI(z,x,y)};
 tryZ(c.z>18?c.z-18:0);return cv}});
new Sat({maxNativeZoom:18,keepBuffer:3,updateWhenIdle:false,attribution:'Imagery © Esri, Maxar, Earthstar Geographics · MPAs: Philippine MPA Database · Depth: SRTM15+'}).addTo(map);
const G={mpa:L.layerGroup().addTo(map),est:L.layerGroup().addTo(map),nat:L.layerGroup().addTo(map),spots:L.layerGroup().addTo(map),depth:L.layerGroup().addTo(map),dlab:L.layerGroup().addTo(map),log:L.layerGroup().addTo(map),track:L.layerGroup().addTo(map),zones:L.layerGroup().addTo(map),meas:L.layerGroup().addTo(map)};
const info=h=>L.popup({maxWidth:290}).setLatLng(map.getCenter()).setContent(h).openOn(map);
// zones used for proximity: {name, poly:[[lat,lon]..]} or {name,c:[lat,lon],r}; kind 'mpa'|'buf'
const ZONES=[];
D.mpas.forEach(m=>{if(m.id==1292||m.id==871)return;m.ll.forEach(p=>{const ll=p.map(q=>[q[1],q[0]]);ZONES.push({name:m.name,poly:ll,kind:'mpa'});
 L.polygon(ll,{color:'#fff',weight:2,fillColor:'#e3342f',fillOpacity:.35}).bindTooltip(m.name,{permanent:true,direction:'center',className:'lbl'}).bindPopup(`<b>${m.name}</b><br>${m.muni}${m.brgy?', '+m.brgy:''} · ${m.ha} ha · est. ${m.year}<br>Published boundary. No take inside (RA 10654 Sec 101).<br><span class="note">mpadatabase.netlify.app/datalist/${m.id}</span>`).addTo(G.mpa)})});
const can=EST.can,buf=EST.buf;ZONES.push({name:'Caniogan MPA (ESTIMATED)',poly:can,kind:'mpa'},{name:'Caniogan safety buffer',poly:buf,kind:'buf'});
const cInfo=`<b>Caniogan MPA: ESTIMATED boundary</b><br>9.8 ha, 2001. Database has only a point (16.3017, 120.019). The box (350 × 280 m) is a guess along the outer reef edge south of the Tondol spit. Outer dashed line = ~100 m safety buffer. Stay outside it.`;
L.polygon(buf,{color:'#ffb347',weight:1.5,dashArray:'4 6',fill:false,opacity:.8}).bindPopup(cInfo).addTo(G.est);
L.polygon(can,{color:'#ff8c00',weight:3,dashArray:'8 6',fillColor:'#ff8c00',fillOpacity:.25}).bindTooltip('Caniogan MPA<br>ESTIMATED',{permanent:true,direction:'bottom',offset:[0,30],className:'lbl est'}).bindPopup(cInfo).addTo(G.est);
const vic=D.mpas.find(m=>m.id==1027);ZONES.push({name:'Victory MPA (ESTIMATED)',c:[vic.lat,vic.lon],r:124,kind:'mpa'});
L.circle([vic.lat,vic.lon],{radius:124,color:'#ff8c00',dashArray:'8 6',weight:2,fillOpacity:.2}).bindTooltip('Victory MPA, ESTIMATED',{permanent:true,direction:'right',className:'lbl est'}).bindPopup('<b>Victory MPA, Bolinao: ESTIMATED</b><br>4.8 ha circle around the database point. A guess only.').addTo(G.est);
const ANDA_IDS=new Set(D.mpas.map(m=>m.id));
const pinI=(c)=>L.divIcon({className:'',html:`<div style="width:14px;height:14px;border-radius:50%;background:${c};border:2px solid #fff;box-shadow:0 0 4px #000"></div>`,iconSize:[14,14]});
L.marker([16.305371,120.013252],{icon:pinI('#d946ef')}).bindTooltip('HIPSA II',{permanent:true,direction:'left',className:'lbl'}).addTo(G.spots);
// national MPAs (lazy)
let NAT=null;
fetch('nat/mpas.json').then(r=>r.json()).then(a=>{NAT=a;const ren=L.canvas({padding:.3});
 a.forEach(([id,n,prov,muni,typ,ha,yr,nip,g])=>{if(ANDA_IDS.has(id)||id==990)return;
  const head=`<b>${esc(n)}</b><br>${esc(muni)}, ${esc(prov)} · ${typ||'MPA'} · ${ha||'?'} ha · est. ${yr||'?'}${nip?'<br><b>NIPAS protected area</b>: zoned; strict-protection zones are no-take. Check the PAMB zoning before fishing.':''}<br><span class="note">mpadatabase.netlify.app/datalist/${id}</span>`;
  if(Array.isArray(g[0])){g.forEach(ll=>{ZONES.push({name:n,poly:ll,kind:'mpa',nat:1});L.polygon(ll,{renderer:ren,color:'#fff',weight:1.5,fillColor:'#e3342f',fillOpacity:.3}).bindPopup(head+'<br>Published boundary. No take inside (RA 10654 Sec 101).').addTo(G.nat)})}
  else if(g[2]>0){ZONES.push({name:n+' (ESTIMATED)',c:[g[0],g[1]],r:g[2],kind:'mpa',nat:1});ZONES.push({name:n+' safety buffer',c:[g[0],g[1]],r:g[2]+100,kind:'buf',nat:1});
   L.circle([g[0],g[1]],{renderer:ren,radius:g[2],color:'#ff8c00',dashArray:'6 5',weight:2,fillOpacity:.18}).bindPopup(head+`<br><b>ESTIMATED</b>: no published boundary. Drawn as a ${g[2]} m radius circle (= ${ha} ha) around the database point, plus a 100 m buffer. The real shape is unknown.`).addTo(G.nat);
   L.circle([g[0],g[1]],{renderer:ren,radius:g[2]+100,color:'#ffb347',dashArray:'3 6',weight:1,fill:false,interactive:false}).addTo(G.nat)}
  else L.circleMarker([g[0],g[1]],{renderer:ren,radius:6,color:'#fff',weight:1,fillColor:'#a855f7',fillOpacity:.9}).bindPopup(head+'<br>Point only, area too large or unknown to estimate a boundary. Ask locally.').addTo(G.nat)});
 checkSpots();buildSpots()}).catch(e=>console.warn('mpas',e));
// ---------- geometry ----------
function inPoly(la,lo,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const[yi,xi]=p[i],[yj,xj]=p[j];if((yi>la)!=(yj>la)&&lo<(xj-xi)*(la-yi)/(yj-yi)+xi)c=!c}return c}
function nearestOnPoly(pt,p){const k=Math.cos(pt[0]*D2R)*111320,m=111320;let best=1e12,bp=null;
 for(let i=0,j=p.length-1;i<p.length;j=i++){const ax=(p[j][1]-pt[1])*k,ay=(p[j][0]-pt[0])*m,bx=(p[i][1]-pt[1])*k,by=(p[i][0]-pt[0])*m,dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy;let t=L2?-(ax*dx+ay*dy)/L2:0;t=Math.max(0,Math.min(1,t));const x=ax+t*dx,y=ay+t*dy,d=x*x+y*y;if(d<best){best=d;bp=[pt[0]+y/m,pt[1]+x/k]}}return[Math.sqrt(best),bp]}
function zoneStatus(pt,maxKm=30){let inside=[],inBuf=[],near=null;
 for(const z of ZONES){const c=z.c||z.poly[0];if(Math.abs(c[0]-pt[0])>maxKm/111||Math.abs(c[1]-pt[1])>maxKm/106)continue;
  let d,bp;if(z.c){const dc=hav(pt,z.c);d=Math.abs(dc-z.r);const b=bearing(z.c,pt)*D2R,dl=z.r/111320;bp=[z.c[0]+dl*Math.cos(b),z.c[1]+dl*Math.sin(b)/Math.cos(z.c[0]*D2R)];if(dc<z.r)(z.kind=='buf'?inBuf:inside).push(z.name)}
  else{[d,bp]=nearestOnPoly(pt,z.poly);if(inPoly(pt[0],pt[1],z.poly))(z.kind=='buf'?inBuf:inside).push(z.name)}
  if(z.kind=='mpa'&&(!near||d<near.d))near={d,bp,name:z.name}}
 return{inside,inBuf,near}}
// ---------- contours with depth labels ----------
let CF=null,CN=null;const ren2=L.canvas({padding:.2});
Promise.all([fetch('nat/cont_fine.json').then(r=>r.json()),fetch('nat/cont_nat.json').then(r=>r.json())]).then(([f,n])=>{CF=[];Object.values(f).forEach(a=>a.forEach(l=>CF.push(l)));CN=n;[CF,CN].forEach(A=>A.forEach(l=>{let a=90,b=-90,c=180,d=-180;l[1].forEach(p=>{a=Math.min(a,p[0]);b=Math.max(b,p[0]);c=Math.min(c,p[1]);d=Math.max(d,p[1])});l.bb=L.latLngBounds([a,c],[b,d])}));drawDepth()}).catch(e=>console.warn('cont',e));
const DCOL={3:'#a5f3fc',5:'#67e8f9',10:'#7dd3fc',20:'#38bdf8',30:'#0ea5e9',50:'#0284c7',100:'#1e40af',200:'#1e1b4b'};
function drawDepth(){G.depth.clearLayers();G.dlab.clearLayers();if(!CF||!map.hasLayer(G.depth))return;const b=map.getBounds().pad(.1),z=map.getZoom();
 const src=CF.filter(l=>l.bb.intersects(b));const useN=z<11||!src.length;const lines=(useN?CN.filter(l=>l.bb.intersects(b)&&(z>=9||l[0]>=50)):src);
 const th=tideHere(map.getCenter());let nl=0;
 lines.forEach(l=>{L.polyline(l[1],{renderer:ren2,color:DCOL[l[0]]||'#fff',weight:l[0]>=20?1.6:1.2,opacity:.9,dashArray:l[0]<10?'4 4':null,interactive:false}).addTo(G.depth);
  if(z>=(useN?9:13)&&nl<70){const p=l[1][Math.floor(l[1].length/2)];if(b.contains(p)){nl++;const now=th?(l[0]+th.h).toFixed(1):null;
   L.marker(p,{interactive:false,icon:L.divIcon({className:'dl',html:`<span>${l[0]} m${now?` · now ${now}`:''}</span>`,iconSize:null})}).addTo(G.dlab)}}})}
map.on('moveend',()=>drawDepth());
// ---------- depth grid ----------
let GRID=null,PRE=[];fetch('nat/grids.json').then(r=>r.json()).then(g=>{GRID=g;buildSpots()});fetch('nat/presets.json').then(r=>r.json()).then(p=>{PRE=p;renderAreas()});
function depthAt(lat,lon){if(!GRID)return null;for(const k in GRID){const[la0,lo0,dla,dlo,nla,nlo,v]=GRID[k];const i=Math.round((lat-la0)/dla),j=Math.round((lon-lo0)/dlo);if(i>=0&&j>=0&&i<nla&&j<nlo){const z=v[i*nlo+j];if(z==9999)return null;return{z,reg:k}}}return null}
// ---------- tides ----------
const EP=Date.UTC(2000,0,1,12);let HARM=null;fetch('nat/harm.json').then(r=>r.json()).then(h=>{HARM=h;TABS.tide();drawDepth()});
function fu(n,th){const N=(125.04-0.052954*th/24)*D2R,c=Math.cos(N),s=Math.sin(N),fM=1-.037*c,uM=-2.1*s,K1=[1.006+.115*c,-8.9*s],O1=[1.009+.187*c,10.8*s];
 const d={M2:[fM,uM],N2:[fM,uM],'2N2':[fM,uM],MU2:[fM,uM],NU2:[fM,uM],L2:[fM,uM],K1,J1:[1.013+.168*c,-12.9*s],O1,Q1:O1,'2Q1':O1,OO1:[1+.64*c,-36.7*s],K2:[1.024+.286*c,-17.7*s],M4:[fM*fM,2*uM],MN4:[fM*fM,2*uM],MS4:[fM,uM],M6:[fM**3,3*uM],MK3:[fM*K1[0],uM+K1[1]],Mf:[1.043+.414*c,-23.7*s],Mm:[1-.13*c,0]};return d[n]||[1,0]}
function harmH(st,date){const th=(date-EP)/3600e3;let h=0;for(const k in HARM.freq){const[f,u]=fu(k,th),ph=(HARM.freq[k]*th+u)*D2R,[a,b]=st.c[k];h+=f*(a*Math.cos(ph)+b*Math.sin(ph))}return h}
const BOL=D.tides.map(t=>({t:new Date(t.iso+':00+08:00').getTime(),h:t.h})),BOLOFF=BOL.reduce((s,x)=>s+x.h,0)/BOL.length;
function bolH(date){const t=+date;for(let i=0;i<BOL.length-1;i++){const a=BOL[i],b=BOL[i+1];if(t>=a.t&&t<=b.t){const f=(t-a.t)/(b.t-a.t);return a.h+(b.h-a.h)*(1-Math.cos(Math.PI*f))/2-BOLOFF}}return null}
function station(ll){if(!HARM)return null;let best=null;HARM.st.forEach(s=>{const d=hav([ll.lat,ll.lng],[s.lat,s.lon]);if(!best||d<best.d)best={s,d}});return best}
function tideAt(ll,date){ll=L.latLng(ll);if(hav([ll.lat,ll.lng],[16.3,120.0])<40000){const h=bolH(date);if(h!=null)return{h,src:'Bolinao (tide-forecast.com, cosine-interpolated, MSL offset approx.)'}}
 const b=station(ll);if(!b)return null;return{h:harmH(b.s,date),src:`${b.s.n} harmonic prediction (${Math.round(b.d/1000)} km away)`}}
const tideHere=ll=>tideAt(ll,tNow());
function extremes(ll,from,hrs){const out=[];let p2=tideAt(ll,new Date(from-6*60e3)),p1=tideAt(ll,from);if(!p1)return out;for(let m=6;m<=hrs*60;m+=6){const t=new Date(+from+m*60e3),c=tideAt(ll,t);if(!c)break;if((p1.h>p2.h&&p1.h>=c.h)||(p1.h<p2.h&&p1.h<=c.h))out.push({t:new Date(+t-6*60e3),h:p1.h,k:p1.h>p2.h?'H':'L'});p2=p1;p1=c}return out}
// sun & moon
function sun(date,lat=16.31,lon=120.02){const d0=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));const n=Math.round((d0-Date.UTC(2000,0,1,12))/864e5);
 const J=n-lon/360,M=(357.5291+.98560028*J)%360,C=1.9148*Math.sin(M*D2R)+.02*Math.sin(2*M*D2R)+.0003*Math.sin(3*M*D2R),lam=(M+C+180+102.9372)%360,Jt=2451545+J+.0053*Math.sin(M*D2R)-.0069*Math.sin(2*lam*D2R);
 const dec=Math.asin(Math.sin(lam*D2R)*Math.sin(23.44*D2R)),w=Math.acos((Math.sin(-.833*D2R)-Math.sin(lat*D2R)*Math.sin(dec))/(Math.cos(lat*D2R)*Math.cos(dec)))*R2D;
 const toD=j=>new Date((j-2440587.5)*864e5);return{rise:toD(Jt-w/360),set:toD(Jt+w/360)}}
function moon(date){const p=((date-Date.UTC(2000,0,6,18,14))/864e5/29.530588853)%1,f=(1-Math.cos(2*Math.PI*p))/2;const nm=['New moon','Waxing crescent','First quarter','Waxing gibbous','Full moon','Waning gibbous','Last quarter','Waning crescent'][Math.round(p*8)%8];return{p,f,nm,spring:Math.min(p,Math.abs(p-.5),1-p)<.1}}
function goodAt(ll,t){const s=sun(t),day=t>new Date(+s.rise+30*60e3)&&t<new Date(+s.set-60*60e3);if(!day)return false;const ex=extremes(ll,new Date(+t-2*3600e3),4);return ex.some(e=>Math.abs(e.t-t)<90*60e3)}
let tideDay=0;
TABS.tide=()=>{const ll=me?L.latLng(me):map.getCenter();const base=new Date();base.setHours(0,0,0,0);
 $('days').innerHTML=Array.from({length:14},(_,i)=>{const d=new Date(+base+i*864e5);return`<button class="btn${i==tideDay?' p':''}" data-d="${i}">${d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric'})}</button>`}).join('');
 $('days').querySelectorAll('button').forEach(b=>b.onclick=()=>{tideDay=+b.dataset.d;TABS.tide()});
 const d0=new Date(+base+tideDay*864e5),pts=[];for(let m=0;m<=1440;m+=10){const r=tideAt(ll,new Date(+d0+m*60e3));if(r)pts.push([m,r.h,r.src])}
 const svg=$('tc');if(!pts.length){svg.innerHTML='<text x="10" y="70" fill="#8aa0b2">No tide data here</text>';return}
 const mn=Math.min(...pts.map(p=>p[1]),-.6),mx=Math.max(...pts.map(p=>p[1]),.6),X=m=>20+m/1440*330,Y=h=>120-(h-mn)/(mx-mn)*100;
 let g='';for(let m=0;m<=1440;m+=30){const t=new Date(+d0+m*60e3);if(goodAt(ll,t))g+=`<rect x="${X(m)}" y="15" width="${330/48}" height="105" fill="#16a34a44"/>`}
 const s=sun(d0);[s.rise,s.set].forEach(t=>{const m=(t-d0)/60e3;g+=`<line x1="${X(m)}" x2="${X(m)}" y1="15" y2="120" stroke="#facc15" stroke-dasharray="2 3"/>`});
 for(let h=0;h<=24;h+=6)g+=`<text x="${X(h*60)-6}" y="135" fill="#8aa0b2" font-size="9">${pad(h)}</text>`;
 g+=`<line x1="20" x2="350" y1="${Y(0)}" y2="${Y(0)}" stroke="#4b6072" stroke-dasharray="3 3"/><text x="0" y="${Y(0)+3}" fill="#8aa0b2" font-size="8">MSL</text>`;
 g+=`<polyline fill="none" stroke="#38bdf8" stroke-width="2" points="${pts.map(p=>X(p[0])+','+Y(p[1])).join(' ')}"/>`;
 const nowM=(tNow()-d0)/60e3;if(nowM>=0&&nowM<=1440){const r=tideAt(ll,tNow());g+=`<line x1="${X(nowM)}" x2="${X(nowM)}" y1="15" y2="120" stroke="#f87171" stroke-width="2"/>`;if(r)g+=`<circle cx="${X(nowM)}" cy="${Y(r.h)}" r="4" fill="#f87171"/>`}
 svg.innerHTML=g;const ex=extremes(ll,d0,24);
 const nr=tideAt(ll,tNow()),good=goodAt(ll,tNow());$('tnow').innerHTML=nr?`${previewH?'At '+hm(tNow())+' (preview)':'Now'}: ${nr.h>=0?'+':''}${nr.h.toFixed(2)} m vs MSL · ${good?'<span style="color:#4ade80">GOOD window</span>':'not ideal'}`:'';
 const mo=moon(d0);$('tsun').textContent=`Sunrise ${hm(s.rise)} · Sunset ${hm(s.set)} · ${mo.nm} (${Math.round(mo.f*100)}% lit)${mo.spring?' · spring tides (bigger range, stronger current)':''}`;
 $('tlist').innerHTML=ex.map(e=>`${e.k=='H'?'High':'Low'} ${hm(e.t)} ${e.h>=0?'+':''}${e.h.toFixed(2)} m`).join(' · ')+`<br>Source: ${pts[0][2]}`};
$('slider').oninput=e=>{previewH=+e.target.value;$('slv').textContent=previewH?'+'+previewH+' h → '+tNow().toLocaleString('en-GB',{weekday:'short',hour:'2-digit',minute:'2-digit'}):'now';drawDepth();if($('p-tide').classList.contains('act'))TABS.tide()};
// tap popup
let mode=null;
map.on('click',e=>{const ll=e.latlng;if(mode=='measure')return measureClick(ll);if(mode=='log'){mode=null;$('addTap').classList.remove('on');return openForm([ll.lat,ll.lng])}
 const d=depthAt(ll.lat,ll.lng),st=zoneStatus([ll.lat,ll.lng]);let h=`<b>${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}</b><br>`;
 if(st.inside.length)h+=`<b style="color:#f87171">Inside ${esc(st.inside.join(', '))}: NO TAKE</b><br>`;else if(st.inBuf.length)h+=`<b style="color:#fb923c">In safety buffer</b><br>`;else if(st.near)h+=`Nearest protected boundary: ${fmtD(st.near.d)} ${card(bearing([ll.lat,ll.lng],st.near.bp))}<br>`;
 if(d&&d.z<0){const c=-d.z,tn=tideAt(ll,tNow()),ex=extremes(ll,tNow(),26),lo=ex.find(x=>x.k=='L'),hi=ex.find(x=>x.k=='H');
  h+=`Charted depth ≈ <b>${c} m</b> (SRTM15+, ~MSL, 450 m cells, coarse near shore)`;if(tn)h+=`<br>${previewH?'At '+hm(tNow()):'Now'}: <b>${(c+tn.h).toFixed(1)} m</b>`+(lo?`<br>Next low ${hm(lo.t)}: ${(c+lo.h).toFixed(1)} m`:'')+(hi?`<br>Next high ${hm(hi.t)}: ${(c+hi.h).toFixed(1)} m`:'')+`<br><span class="note">Tide: ${tn.src}</span>`}
 else if(d)h+='Land/intertidal in depth grid (coarse).';else h+='<span class="note">No detailed depth grid here (only preset regions).</span>';
 L.popup({maxWidth:290}).setLatLng(ll).setContent(h).openOn(map)});
// ---------- GPS & nav ----------
let me=null,dot,acc,heading=null,lastWarn='';
function startGPS(){if(!navigator.geolocation){$('gps').textContent='No GPS';return}$('gps').textContent='GPS…';
 navigator.geolocation.watchPosition(p=>{const{latitude:la,longitude:lo,accuracy:a}=p.coords;me=[la,lo];
  if(!dot){acc=L.circle(me,{radius:a,color:'#3b82f6',weight:1,fillOpacity:.12,interactive:false}).addTo(map);dot=L.marker(me,{interactive:false,icon:L.divIcon({className:'',html:'<div id="medot"></div>',iconSize:[22,22]})}).addTo(map);map.setView(me,16)}
  acc.setLatLng(me).setRadius(a);dot.setLatLng(me);$('gps').textContent='📍 ±'+Math.round(a)+' m';trackPoint(me,a);updateNav();if(!window._s1){window._s1=1;summary()}},
 e=>{$('gps').textContent=e.code==1?'GPS denied':'GPS unavailable'},{enableHighAccuracy:true,maximumAge:3000,timeout:20000})}
function updateNav(){if(!me)return;const st=zoneStatus(me);const bn=$('banner');let w='';
 if(st.inside.length){w='mpa';bn.className='';bn.textContent='⛔ INSIDE '+st.inside[0]+' — NO TAKE. Leave the area.';bn.style.display='block'}
 else if(st.inBuf.length){w='buf';bn.className='buf';bn.textContent='⚠️ In safety buffer of a protected area. Move away.';bn.style.display='block'}else bn.style.display='none';
 if(w&&w!=lastWarn&&navigator.vibrate)navigator.vibrate(w=='mpa'?[400,150,400,150,400]:[300,150,300]);lastWarn=w;
 if(st.near){const b=bearing(me,st.near.bp);$('nd').textContent=fmtD(st.near.d)+' '+card(b);$('nn').textContent='to '+st.near.name+' (bearing '+Math.round(b)+'°)';$('dist').textContent=st.inside.length?'⛔ IN MPA':'⛔ MPA '+fmtD(st.near.d)+' '+card(b);$('dist').classList.toggle('warn',!!st.inside.length||st.near.d<300);
  $('arrow').style.transform=`rotate(${b-(heading||0)}deg)`}else{$('nd').textContent='> 30 km';$('nn').textContent='No mapped protected area within 30 km.'}}
$('me').onclick=()=>{if(!me)startGPS();else map.setView(me,Math.max(map.getZoom(),16))};
$('hd').onclick=async()=>{try{if(typeof DeviceOrientationEvent!='undefined'&&DeviceOrientationEvent.requestPermission){const r=await DeviceOrientationEvent.requestPermission();if(r!='granted'){toast('Compass permission denied');return}}
 const h=e=>{heading=e.webkitCompassHeading!=null?e.webkitCompassHeading:(e.absolute&&e.alpha!=null?360-e.alpha:null);if(heading!=null){$('hdn').textContent='Compass on: heading '+Math.round(heading)+'°. Arrow turns with the phone.';const m=document.getElementById('medot');if(m)m.style.setProperty('--h',heading+'deg');updateNav()}};
 window.addEventListener('deviceorientationabsolute',h);window.addEventListener('deviceorientation',h);$('hd').classList.add('on');toast('Compass on')}catch(e){toast('No compass on this device')}};
// ---------- measure ----------
let mpts=[];function measureClick(ll){mpts.push(ll);L.circleMarker(ll,{radius:5,color:'#fff',fillColor:'#facc15',fillOpacity:1}).addTo(G.meas);
 if(mpts.length==2){const d=hav([mpts[0].lat,mpts[0].lng],[ll.lat,ll.lng]),b=bearing([mpts[0].lat,mpts[0].lng],[ll.lat,ll.lng]);L.polyline(mpts,{color:'#facc15',weight:3,dashArray:'6 4'}).bindTooltip(fmtD(d)+' · '+Math.round(b)+'° '+card(b),{permanent:true,className:'lbl'}).addTo(G.meas);mpts=[]}}
$('ms').onclick=()=>{if(mode=='measure'){mode=null;$('ms').classList.remove('on');G.meas.clearLayers();mpts=[]}else{mode='measure';$('ms').classList.add('on');toast('Tap two points. Tap 📏 again to clear.')}};
// ---------- track ----------
let rec=false,trk=LS.get('anda_track',[]);const trkLine=L.polyline(trk.map(p=>[p[0],p[1]]),{color:'#f472b6',weight:3}).addTo(G.track);
function trackPoint(p,a){if(!rec||a>40)return;const l=trk[trk.length-1];if(l&&hav(l,p)<4)return;trk.push([+p[0].toFixed(6),+p[1].toFixed(6),Date.now()]);trkLine.addLatLng(p);if(trk.length%5==0)LS.set('anda_track',trk);
 let d=0;for(let i=1;i<trk.length;i++)d+=hav(trk[i-1],trk[i]);$('tkI').textContent=`Track: ${trk.length} pts, ${fmtD(d)}`}
$('tk').onclick=()=>{rec=!rec;$('tk').classList.toggle('on',rec);if(rec&&!me)startGPS();LS.set('anda_track',trk);toast(rec?'Recording swim track (keep app open)':'Track paused')};
$('tkC').onclick=()=>{if(confirm('Clear swim track?')){trk=[];LS.set('anda_track',trk);trkLine.setLatLngs([]);$('tkI').textContent=''}};
// ---------- log ----------
let LOG=LS.get('anda_log',[]),pend=null;
$('fS').innerHTML='<option value="">(no catch / spot only)</option>'+FISH.filter(f=>f.f!='no').map(f=>`<option>${esc(f.n)}</option>`).join('');
function openForm(ll){pend=ll;$('form').style.display='block';$('fC').textContent=ll[0].toFixed(5)+', '+ll[1].toFixed(5);$('fN').value='';$('fT').value='';$('fS').value='';document.querySelector('[data-t=log]').click()}
$('addMe').onclick=()=>{if(!me){startGPS();toast('Waiting for GPS…');return}openForm(me)};
$('addTap').onclick=()=>{mode='log';$('addTap').classList.add('on');setSnap('min');toast('Tap the map where the spot is')};
$('fX').onclick=()=>{$('form').style.display='none';pend=null};
$('fOk').onclick=()=>{if(!pend)return;LOG.push({n:$('fN').value||'Spot',s:$('fS').value,t:$('fT').value,ll:pend,ts:Date.now()});LS.set('anda_log',LOG);$('form').style.display='none';pend=null;renderLog()};
function renderLog(){G.log.clearLayers();$('logL').innerHTML=LOG.length?LOG.map((e,i)=>`<div class="row" style="justify-content:space-between;border-bottom:1px solid #22384a;padding:4px 0"><span>${e.s?'🐟':'📍'} <b>${esc(e.n)}</b> ${e.s?esc(e.s):''}<br><span class="note">${new Date(e.ts).toLocaleString('en-GB')} · ${esc(e.t)}</span></span><span><button class="btn" data-g="${i}">Go</button> <button class="btn r" data-x="${i}">✕</button></span></div>`).join(''):'Nothing saved yet.';
 LOG.forEach(e=>L.marker(e.ll,{icon:pinI(e.s?'#f59e0b':'#06b6d4')}).bindPopup(`<b>${esc(e.n)}</b><br>${esc(e.s||'')}<br>${esc(e.t)}<br>${new Date(e.ts).toLocaleString('en-GB')}`).addTo(G.log));
 $('logL').querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{map.setView(LOG[b.dataset.g].ll,17);setSnap('')});
 $('logL').querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>{if(confirm('Delete?')){LOG.splice(+b.dataset.x,1);LS.set('anda_log',LOG);renderLog()}})}
renderLog();
async function share(name,type,text){const f=new File([text],name,{type});try{if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:name});return}}catch(e){if(e.name=='AbortError')return}
 const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=name;document.body.appendChild(a);a.click();a.remove()}
$('exG').onclick=()=>share('spearfishing-log.gpx','application/gpx+xml',`<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Spearfishing map PH" xmlns="http://www.topografix.com/GPX/1/1">\n`+LOG.map(e=>`<wpt lat="${e.ll[0]}" lon="${e.ll[1]}"><time>${new Date(e.ts).toISOString()}</time><name>${esc(e.n)}</name><desc>${esc((e.s?e.s+'. ':'')+e.t)}</desc></wpt>`).join('\n')+(trk.length?`\n<trk><name>Swim track</name><trkseg>${trk.map(p=>`<trkpt lat="${p[0]}" lon="${p[1]}"><time>${new Date(p[2]).toISOString()}</time></trkpt>`).join('')}</trkseg></trk>`:'')+'\n</gpx>');
$('exJ').onclick=()=>share('spearfishing-log.json','application/json',JSON.stringify({log:LOG,track:trk},null,1));
// ---------- dive timer ----------
let dv={st:'idle',t0:0,last:0,hist:[]},dI=null;
const ms2=s=>Math.floor(s/60)+':'+pad(Math.floor(s%60));
function dTick(){const s=(Date.now()-dv.t0)/1000;$('dT').textContent=ms2(s);if(dv.st=='surf'){const need=Math.max(2*dv.last,60);const left=need-s;$('dInfo').innerHTML=left>0?`Rest at least <b>${ms2(left)}</b> more (2× last dive ${ms2(dv.last)}).`:'<b style="color:#4ade80">OK to dive again</b> — buddy watching?';if(left<=0&&!dv.buzz){dv.buzz=1;navigator.vibrate&&navigator.vibrate([200,100,200])}}
 else if(dv.st=='dive'){$('dInfo').textContent=s>90?'Long dive, come up calmly.':''}}
$('dGo').onclick=()=>{dv.st='dive';dv.t0=Date.now();dv.buzz=0;$('dS').textContent='DIVING';$('dS').style.color='#38bdf8';clearInterval(dI);dI=setInterval(dTick,250)};
$('dSurf').onclick=()=>{if(dv.st=='dive'){dv.last=(Date.now()-dv.t0)/1000;dv.hist.unshift(dv.last);$('dHist').textContent='Dives: '+dv.hist.slice(0,10).map(ms2).join(', ')}dv.st='surf';dv.t0=Date.now();dv.buzz=0;$('dS').textContent='SURFACE';$('dS').style.color='#4ade80';clearInterval(dI);dI=setInterval(dTick,250)};
$('dRst').onclick=()=>{clearInterval(dI);dv={st:'idle',t0:0,last:0,hist:[]};$('dT').textContent='0:00';$('dS').textContent='Ready';$('dInfo').textContent='';$('dHist').textContent=''};
// ---------- fish ----------
$('fishL').innerHTML=FISH.map(f=>`<div class="card"><img loading="lazy" src="fish/${f.k}.jpg" alt=""><div><b>${esc(f.n)}</b> <span class="tag ${f.f}">${f.f=='ok'?'OK to take':f.f=='warn'?'CAUTION':'DO NOT TAKE'}</span><br><i class="note">${esc(f.s)}</i><div>${esc(f.note)}</div>${f.warn?`<div style="color:#fbbf24">⚠ ${esc(f.warn)}</div>`:''}<div class="note" style="font-size:10.5px">Photo: ${esc(f.by)}, ${esc(f.lic)} · <a href="${f.src}" style="color:#7dd3fc">source</a></div></div></div>`).join('');
// ---------- spots ----------
let SPOTS=[];fetch('nat/spots.json').then(r=>r.json()).then(s=>{SPOTS=s.map(x=>({n:x[0],ll:[x[1],x[2]],area:x[3],src:x[4],kind:'web'}));
 SPOTS.unshift({n:'Tondol White Beach, west end',ll:[16.3138,120.0153],area:'Anda, Pangasinan',src:'',kind:'own',why:'Sandy shore entry. Swim NW, away from the estimated Caniogan box (~1.3 km SSE). Magsaysay MPA ~2 km E. Shallow seagrass first.'});checkSpots()});
function checkSpots(){if(!SPOTS.length)return;G.spots.eachLayer(l=>{if(l._spot)G.spots.removeLayer(l)});
 SPOTS.forEach(s=>{const st=zoneStatus(s.ll,5);s.bad=st.inside.length||st.inBuf.length?(st.inside[0]||st.inBuf[0]):null;s.near=st.near;
  const m=L.marker(s.ll,{icon:pinI(s.bad?'#9ca3af':'#22c55e')}).bindPopup(`<b>${esc(s.n)}</b><br>${esc(s.area)}<br>${s.why?esc(s.why)+'<br>':''}${s.bad?`<b style="color:#f87171">Inside/near ${esc(s.bad)} — not legal to fish here.</b><br>`:''}${s.near?`Nearest protected boundary: ${fmtD(s.near.d)}<br>`:''}${s.src?`<span class="note">Source: <a href="${s.src}" style="color:#7dd3fc">${s.src.replace('https://','')}</a> (approximate area point, not an exact entry)</span>`:'<span class="note">Our own suggestion from satellite + MPA data.</span>'}<br><span class="note">Always check local ordinances (LGU) first.</span>`);m._spot=1;m.addTo(G.spots)});buildSpots()}
// auto-suggested zones from depth grid
let AUTO=[];
function buildZones(){if(!GRID||!NAT)return;AUTO=[];G.zones.clearLayers();for(const k in GRID){const[la0,lo0,dla,dlo,nla,nlo,v]=GRID[k];const Z=(i,j)=>(i<0||j<0||i>=nla||j>=nlo)?9999:v[i*nlo+j];const c=[];
 for(let i=1;i<nla-1;i++)for(let j=1;j<nlo-1;j++){const z=Z(i,j);if(z==9999||z>-3||z<-15)continue;let land=null,deep=0;
  for(let di=-2;di<=2;di++)for(let dj=-2;dj<=2;dj++){const q=Z(i+di,j+dj);if(q==9999)continue;if(q>=0&&(!land||Math.abs(di)+Math.abs(dj)<Math.abs(land[0])+Math.abs(land[1])))land=[di,dj];if(q<=z-12)deep++}
  if(!land||!deep)continue;const ll=[la0+i*dla,lo0+j*dlo];const st=zoneStatus(ll,5);if(st.inside.length||st.inBuf.length||(st.near&&st.near.d<300))continue;
  const sh=Math.hypot(land[0]*dla*111,land[1]*dlo*107);c.push({ll,z:-z,deep,sh,land:Math.atan2(land[1],land[0])*R2D,reg:k,score:deep*2+(sh<.6?4:sh<1?2:0)})}
 c.sort((a,b)=>b.score-a.score);const pick=[];for(const x of c){if(pick.length>=8)break;if(pick.every(p=>hav(p.ll,x.ll)>1200))pick.push(x)}AUTO.push(...pick)}
 AUTO.forEach(a=>{a.n=`Suggested zone (ESTIMATED), ~${a.z} m`;a.why=`Depth ≈ ${a.z} m in a 450 m cell with a drop-off (${a.deep} deeper cells nearby) and land ~${a.sh.toFixed(1)} km away. Not checked on the ground; no beach access data; coarse depth.`;
  L.circle(a.ll,{radius:220,color:'#a3e635',weight:1.5,dashArray:'4 4',fillOpacity:.08}).bindPopup(`<b>${a.n}</b><br>${a.why}<br>Outside all mapped MPAs + 300 m.`).addTo(G.zones)})}
function wxFor(ll){const all=LS.get('wx',{});let best=null;for(const k in all){const w=all[k];const d=hav(ll,w.ll);if(d<60000&&(!best||d<best.d))best={...w,d}}return best}
function wxNow(w){if(!w)return null;const t=tNow(),i=w.h.time.findIndex(x=>new Date(x+':00+08:00')>t)-1;if(i<0)return null;return{ws:w.h.wind_speed_10m[i],wd:w.h.wind_direction_10m[i],g:w.h.wind_gusts_10m?w.h.wind_gusts_10m[i]:null,wh:w.m?w.m.wave_height[i]:null,sw:w.m?w.m.swell_wave_height[i]:null}}
function buildSpots(){if(!SPOTS.length||!GRID||!NAT)return;if(!AUTO.length)buildZones();const from=me||[map.getCenter().lat,map.getCenter().lng];
 const all=[...SPOTS.filter(s=>!s.bad),...AUTO].map(s=>{const t=goodAt(L.latLng(s.ll),tNow()),w=wxNow(wxFor(s.ll));let sc=(t?3:0);let wtxt='no forecast cached';
  if(w){sc+=w.ws<15?2:w.ws<25?0:-3;if(w.wh!=null)sc+=w.wh<.5?2:w.wh<1?0:-3;if(s.land!=null){const on=Math.abs(((w.wd-(s.land+180))+540)%360-180)<60;if(on)sc-=1}wtxt=`wind ${Math.round(w.ws)} km/h ${card(w.wd)}${w.wh!=null?', waves '+w.wh.toFixed(1)+' m':''}`}
  const d=hav(from,s.ll);sc-=Math.log10(Math.max(d,1000)/1000)*2;return{s,sc,d,t,wtxt}}).sort((a,b)=>b.sc-a.sc).slice(0,12);
 $('best').innerHTML=all.map(x=>`<div class="row" style="justify-content:space-between;flex-wrap:nowrap;border-bottom:1px solid #22384a;padding:5px 0"><span style="flex:1"><b>${esc(x.s.n)}</b> <span class="note">${esc(x.s.area||x.s.reg||'')}</span><br><span class="note">${fmtD(x.d)} away · tide ${x.t?'<span style="color:#4ade80">good</span>':'not ideal'} · ${x.wtxt}</span></span><button class="btn" data-ll="${x.s.ll}">Show</button></div>`).join('');
 $('best').querySelectorAll('[data-ll]').forEach(b=>b.onclick=()=>{map.setView(b.dataset.ll.split(',').map(Number),15);setSnap('')})}
TABS.spots=()=>buildSpots();
// ---------- areas (offline download) ----------
const lon2x=(lo,z)=>Math.floor((lo+180)/360*2**z),lat2y=(la,z)=>Math.floor((1-Math.log(Math.tan(la*D2R)+1/Math.cos(la*D2R))/Math.PI)/2*2**z);
function tileList(b,zmax){const o=[];for(let z=10;z<=zmax;z++){const x0=lon2x(b[1],z),x1=lon2x(b[3],z),y0=lat2y(b[2],z),y1=lat2y(b[0],z);for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)o.push([z,x,y])}return o}
const zmaxFor=b=>tileList(b,17).length<4000?17:16,mb=n=>(n*16/1024).toFixed(0);
let DL=LS.get('areas',{}),busy=false;
function renderAreas(){$('preL').innerHTML=PRE.map(([k,n,a,b,c,d])=>{const bb=[a,b,c,d],z=zmaxFor(bb),n2=tileList(bb,z).length;return`<div class="row" style="justify-content:space-between;border-bottom:1px solid #22384a;padding:5px 0"><span><b>${esc(n)}</b><br><span class="note">z10–${z} · ${n2} tiles · ~${mb(n2)} MB${k=='anda'?' · core already bundled':''}${DL[k]?' · <span style="color:#4ade80">downloaded</span>':''}</span></span><span><button class="btn" data-v="${k}">View</button> ${DL[k]?`<button class="btn r" data-del="${k}">Delete</button>`:`<button class="btn p" data-dl="${k}">Download</button>`}</span></div>`}).join('');
 const cust=Object.entries(DL).filter(([k])=>k.startsWith('c'));$('custL').innerHTML=cust.map(([k,v])=>`<div class="row" style="justify-content:space-between"><span>${esc(v.name)} · ${v.n} tiles</span><span><button class="btn" data-v="${k}">View</button> <button class="btn r" data-del="${k}">Delete</button></span></div>`).join('')||'<span class="note">None.</span>';
 document.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{const p=PRE.find(x=>x[0]==b.dataset.v),bb=p?p.slice(2):DL[b.dataset.v].b;map.fitBounds([[bb[0],bb[1]],[bb[2],bb[3]]]);setSnap('')});
 document.querySelectorAll('[data-dl]').forEach(b=>b.onclick=()=>{const p=PRE.find(x=>x[0]==b.dataset.dl);download(p[0],p[1],p.slice(2))});
 document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>delArea(b.dataset.del))}
async function download(key,name,b){if(busy)return toast('A download is already running');const z=zmaxFor(b),L1=tileList(b,z);if(L1.length*16/1024>150&&!confirm(`About ${mb(L1.length)} MB. That is large. Continue?`))return;
 busy=true;const cache=await caches.open('tiles-dl');let done=0,fail=0;$('dlP').style.display='block';
 const q=L1.slice();async function w(){while(q.length){const[zz,x,y]=q.shift(),u=ESRI(zz,x,y);try{if(!(await cache.match(u))){const r=await fetch(u,{mode:'cors'});if(r.ok)await cache.put(u,r);else fail++}}catch(e){fail++}done++;if(done%10==0||done==L1.length)$('dlP').textContent=`Downloading ${name}: ${done}/${L1.length} (${Math.round(done/L1.length*100)}%)${fail?' · '+fail+' failed':''}`}}
 await Promise.all([w(),w(),w(),w()]);
 await fetchWx(key,[(b[0]+b[2])/2,(b[1]+b[3])/2]);
 DL[key]={name,b,n:L1.length,ts:Date.now()};LS.set('areas',DL);busy=false;$('dlP').textContent=`${name}: done (${L1.length-fail} tiles${fail?', '+fail+' failed — retry later':''}). Forecast cached.`;renderAreas()}
async function delArea(k){if(!confirm('Delete offline tiles for '+DL[k].name+'?'))return;const cache=await caches.open('tiles-dl');const keepOther=new Set();
 Object.entries(DL).forEach(([kk,v])=>{if(kk!=k)tileList(v.b,zmaxFor(v.b)).forEach(t=>keepOther.add(ESRI(...t)))});
 for(const t of tileList(DL[k].b,zmaxFor(DL[k].b))){const u=ESRI(...t);if(!keepOther.has(u))await cache.delete(u)}delete DL[k];LS.set('areas',DL);renderAreas();toast('Deleted')}
let rect=null,drawing=false,p0=null;
$('drawR').onclick=()=>{drawing=true;setSnap('min');toast('Drag on the map to draw a rectangle',4000);map.dragging.disable()};
map.on('mousedown',e=>{if(!drawing)return;p0=e.latlng;rect&&map.removeLayer(rect);rect=L.rectangle([p0,p0],{color:'#facc15'}).addTo(map)});
map.on('mousemove',e=>{if(drawing&&p0)rect.setBounds([p0,e.latlng])});
map.on('mouseup',e=>{if(!drawing||!p0)return;drawing=false;map.dragging.enable();const bb=rect.getBounds(),b=[bb.getSouth(),bb.getWest(),bb.getNorth(),bb.getEast()];p0=null;const z=zmaxFor(b),n=tileList(b,z).length;
 setSnap('');document.querySelector('[data-t=areas]').click();$('custQ').innerHTML=`Selected area: ${n} tiles (z10–${z}), ~${mb(n)} MB${n*16/1024>150?' <b style="color:#fbbf24">large!</b>':''} <button class="btn p" id="custGo">Download</button>`;
 $('custGo').onclick=()=>{map.removeLayer(rect);download('c'+Date.now(),'Custom '+b.map(x=>x.toFixed(2)).join(','),b)}});
async function fetchWx(key,ll){try{const q=`latitude=${ll[0].toFixed(3)}&longitude=${ll[1].toFixed(3)}&timezone=Asia%2FManila&forecast_days=7`;
 const [h,m]=await Promise.all([fetch('https://api.open-meteo.com/v1/forecast?'+q+'&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation').then(r=>r.json()),fetch('https://marine-api.open-meteo.com/v1/marine?'+q+'&hourly=wave_height,swell_wave_height,swell_wave_direction,swell_wave_period').then(r=>r.json()).catch(()=>null)]);
 const all=LS.get('wx',{});all[key]={ll,ts:Date.now(),h:h.hourly,m:m&&m.hourly};LS.set('wx',all);renderWx();return true}catch(e){return false}}
function renderWx(){const ll=me||[map.getCenter().lat,map.getCenter().lng],w=wxFor(ll);if(!w){$('wx').innerHTML='No forecast cached near here. Tap “Refresh forecast” with signal.';return}
 const rows=[];for(let i=0;i<w.h.time.length;i+=3){const t=new Date(w.h.time[i]+':00+08:00');if(t<Date.now()-3*3600e3||rows.length>=24)continue;rows.push(`<tr><td>${t.toLocaleDateString('en-GB',{weekday:'short'})} ${hm(t)}</td><td>${Math.round(w.h.wind_speed_10m[i])}/${Math.round(w.h.wind_gusts_10m[i])} ${card(w.h.wind_direction_10m[i])}</td><td>${w.m?w.m.wave_height[i]?.toFixed(1)+' / '+(w.m.swell_wave_height[i]?.toFixed(1)):'–'}</td></tr>`)}
 $('wx').innerHTML=`<div class="note">Open-Meteo forecast fetched ${new Date(w.ts).toLocaleString('en-GB')} (${Math.round(w.d/1000)} km from here). Older than a day = treat as stale.</div><table><tr><th>Time</th><th>Wind/gust km/h</th><th>Waves/swell m</th></tr>${rows.join('')}</table>`}
$('wxR').onclick=async()=>{const c=me||[map.getCenter().lat,map.getCenter().lng];toast('Fetching forecast…');toast(await fetchWx('p'+c.map(x=>x.toFixed(1)).join('_'),c)?'Forecast saved for offline':'No signal: could not fetch',3000)};
TABS.areas=()=>{renderAreas()};TABS.nav=()=>{renderWx()};
// ---------- info ----------
$('nt').innerHTML=E.notake.map(s=>`<li>${s}</li>`).join('');$('ca').innerHTML=E.caution.map(s=>`<li>${s}</li>`).join('');
$('mpaT').innerHTML='<tr><th>Anda area</th><th>ha</th><th>Boundary</th></tr>'+D.mpas.filter(m=>m.id!=1292).map(m=>`<tr><td>${m.name}</td><td>${m.ha}</td><td>${m.ll.length?'published':(m.id==990||m.id==1027?'<b>estimated</b>':'point only')}</td></tr>`).join('');
// layers toggle
const LAY=[['MPAs (Anda)','mpa'],['Estimated (Anda)','est'],['MPAs (national)','nat'],['Spots','spots'],['Suggested zones','zones'],['Depth lines','depth'],['My log','log'],['Swim track','track']];
$('lay').onclick=()=>{const h='<b>Layers</b><br>'+LAY.map(([n,k])=>`<label style="display:block;padding:4px 0"><input type="checkbox" style="width:auto" data-k="${k}" ${map.hasLayer(G[k])?'checked':''}> ${n}</label>`).join('');const p=L.popup().setLatLng(map.getCenter()).setContent(h).openOn(map);
 p.getElement().querySelectorAll('input').forEach(i=>i.onchange=()=>{const g=G[i.dataset.k];i.checked?g.addTo(map):map.removeLayer(g);if(i.dataset.k=='depth'){i.checked?(G.dlab.addTo(map),drawDepth()):map.removeLayer(G.dlab)}})};
$('zT').onclick=()=>{map.fitBounds([[16.296,120.008],[16.318,120.035]]);setSnap('')};$('zA').onclick=()=>{map.fitBounds([[16.255,119.94],[16.40,120.07]]);setSnap('')};$('zP').onclick=()=>{map.fitBounds([[4.5,116.5],[21,127]]);setSnap('')};
map.on('zoomend',()=>document.body.classList.toggle('lowz',map.getZoom()<12));map.fitBounds([[16.296,120.008],[16.318,120.035]]);
setInterval(()=>{if(!previewH&&$('p-tide').classList.contains('act'))TABS.tide();if(me)updateNav()},60000);
// ---------- service worker + update toast ----------
if('serviceWorker' in navigator){let had=!!navigator.serviceWorker.controller;navigator.serviceWorker.register('sw.js').then(r=>{$('off').textContent='Offline copy: saving…';
 navigator.serviceWorker.ready.then(()=>$('off').textContent='Offline copy ready.');
 r.addEventListener('updatefound',()=>{const n=r.installing;n&&n.addEventListener('statechange',()=>{if(n.state=='installed'&&navigator.serviceWorker.controller)toast('Update available — tap to reload',0,()=>{n.postMessage('skip')})})});setInterval(()=>r.update(),3600e3)}).catch(()=>{});
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(had)location.reload();had=true})}
function summary(){const ll=me?L.latLng(me):map.getCenter(),tn=tideAt(ll,new Date());let lo=null;if(tn){const ex=extremes(ll,new Date(),26);lo=ex.find(x=>x.k=='L')}
 if(tn)$('ttop').textContent='🌊 '+(tn.h>=0?'+':'')+tn.h.toFixed(1)+' m'+(lo?' · low '+hm(lo.t):'');
 let mp='MPA –';if(me){const st=zoneStatus(me);mp=st.inside.length?'INSIDE MPA':st.near?'MPA '+fmtD(st.near.d)+' '+card(bearing(me,st.near.bp)):'No MPA within 30 km'}else mp='Tap ◎ for GPS';
 $('sum').textContent=mp+(tn?' · tide '+(tn.h>=0?'+':'')+tn.h.toFixed(2)+' m (MSL)':'')+(lo?' · next low '+hm(lo.t)+' ('+(lo.h>=0?'+':'')+lo.h.toFixed(2)+')':'')}
setInterval(summary,60000);setTimeout(summary,1500);
window.__ok=true;
