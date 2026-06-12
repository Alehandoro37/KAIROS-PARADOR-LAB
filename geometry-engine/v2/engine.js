/* KAIROS PARADOR — GEOMETRY ENGINE v2
   Fuente geométrica única: ../../data/lot.json
   Diseño conceptual: bandas, retiros y contenedores ISO validados dentro del polígono. */

const els = {
  canvas: document.getElementById('lotCanvas'),
  metrics: document.getElementById('metrics'),
  exportBtn: document.getElementById('exportBtn'),
  versionSelect: document.getElementById('versionSelect')
};
const controls = ['offEast','offWest','parkBand','walkBand','boxType','boxCount','boxGap','boxStart'];
let lot, local, ctx, scale, ox, oy;

const M_PER_DEG_LAT = 111320;
const iso = {20:{l:6.06,w:2.44},40:{l:12.19,w:2.44}};

function val(id){ const e=document.getElementById(id); return e.tagName==='SELECT'?Number(e.value):Number(e.value); }
function out(id,v){ const e=document.getElementById(id+'Out'); if(e) e.textContent = typeof v==='number' ? v.toFixed(id==='boxCount'?0:1)+' m' : v; }
function dist(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
function area(poly){ let s=0; for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length]; s+=a.x*b.y-b.x*a.y;} return Math.abs(s/2); }
function pointInPoly(p, poly){ let inside=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const a=poly[i],b=poly[j]; if(((a.y>p.y)!==(b.y>p.y)) && (p.x < (b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)) inside=!inside; } return inside; }
function lonLatToLocal(p, ref){ const mLon=M_PER_DEG_LAT*Math.cos(ref.lat*Math.PI/180); return {id:p.id, lon:p.lon, lat:p.lat, x:(p.lon-ref.lon)*mLon, y:(p.lat-ref.lat)*M_PER_DEG_LAT}; }
function localToLonLat(p, ref){ const mLon=M_PER_DEG_LAT*Math.cos(ref.lat*Math.PI/180); return {lon:ref.lon+p.x/mLon, lat:ref.lat+p.y/M_PER_DEG_LAT}; }

function stFrame(poly){
  const A=poly[0], B=poly[1]; const L=dist(A,B); const ux=(B.x-A.x)/L, uy=(B.y-A.y)/L;
  const nx=-uy, ny=ux; return {A,L,ux,uy,nx,ny};
}
function stToXY(f,s,t){ return {x:f.A.x+f.ux*s+f.nx*t, y:f.A.y+f.uy*s+f.ny*t}; }
function rect(f,s,t,l,w){ const a=s-l/2,b=s+l/2,c=t-w/2,d=t+w/2; return [stToXY(f,a,c),stToXY(f,b,c),stToXY(f,b,d),stToXY(f,a,d)]; }

function fit(){ const dpr=window.devicePixelRatio||1; const r=els.canvas.getBoundingClientRect(); els.canvas.width=r.width*dpr; els.canvas.height=r.height*dpr; ctx=els.canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); }
function project(p){ return {x:ox+p.x*scale, y:oy-p.y*scale}; }
function pathPoly(poly){ ctx.beginPath(); poly.forEach((p,i)=>{const q=project(p); i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);}); ctx.closePath(); }
function fillStroke(poly, fill, stroke){ pathPoly(poly); ctx.fillStyle=fill; ctx.fill(); ctx.strokeStyle=stroke; ctx.lineWidth=2; ctx.stroke(); }
function line(a,b,color,w=1){ const p=project(a),q=project(b); ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle=color;ctx.lineWidth=w;ctx.stroke(); }
function label(txt,p,color='#eaf8ff'){ const q=project(p); ctx.fillStyle=color; ctx.font='12px ui-monospace,monospace'; ctx.fillText(txt,q.x+6,q.y-6); }

function params(){ return Object.fromEntries(controls.map(id=>[id,val(id)])); }
function draw(){
  fit(); const p=params();
  controls.forEach(id=>{ if(id!=='boxType') out(id,p[id]); }); out('boxCount', String(p.boxCount));
  ctx.clearRect(0,0,els.canvas.width,els.canvas.height);
  const xs=local.map(p=>p.x), ys=local.map(p=>p.y); const pad=45; const W=els.canvas.clientWidth,H=els.canvas.clientHeight;
  scale=Math.min((W-2*pad)/(Math.max(...xs)-Math.min(...xs)),(H-2*pad)/(Math.max(...ys)-Math.min(...ys)));
  ox=pad-Math.min(...xs)*scale; oy=H-pad+Math.min(...ys)*scale;
  ctx.fillStyle='#061526'; ctx.fillRect(0,0,W,H);
  fillStroke(local,'rgba(143,229,255,.10)','#8fe5ff');
  local.forEach(v=>label(v.id,v,'#ffd36b'));
  const f=stFrame(local);
  line(stToXY(f,0,0),stToXY(f,f.L,0),'rgba(255,255,255,.65)',2);
  label('K0+000 / PUNTA',stToXY(f,0,0),'#ffd36b'); label('K0+'+Math.round(f.L),stToXY(f,f.L,0),'#ffd36b');

  const offE=p.offEast, park=p.parkBand, walk=p.walkBand;
  const zoneL=f.L;
  fillStroke(rect(f,zoneL/2,offE+park/2,zoneL,park),'rgba(180,190,255,.16)','#c7ceff');
  fillStroke(rect(f,zoneL/2,offE+park+walk/2,zoneL,walk),'rgba(255,255,255,.10)','#ffffff');
  label('PARQUEO',stToXY(f,8,offE+park/2)); label('ANDÉN',stToXY(f,8,offE+park+walk/2));

  const box=iso[p.boxType]; let valid=0, rejected=0; const boxes=[];
  for(let i=0;i<p.boxCount;i++){
    const s=p.boxStart+i*(box.l+p.boxGap); const t=offE+park+walk+box.w/2+0.8;
    const r=rect(f,s,t,box.l,box.w); const ok=r.every(c=>pointInPoly(c,local));
    fillStroke(r, ok?'rgba(255,179,107,.30)':'rgba(255,90,90,.25)', ok?'#ffb36b':'#ff7777');
    label((ok?'FOOD ':'OUT ')+(i+1), stToXY(f,s,t));
    ok?valid++:rejected++; boxes.push({index:i+1,valid:ok,corners:r.map(c=>localToLonLat(c,lot.reference_point))});
  }
  const metrics = {area_m2:area(local), edge_AB_m:dist(local[0],local[1]), edge_BC_m:dist(local[1],local[2]), edge_CD_m:dist(local[2],local[3]), edge_DA_m:dist(local[3],local[0]), valid_modules:valid, rejected_modules:rejected};
  els.metrics.innerHTML='<h4>Métricas</h4>'+Object.entries(metrics).map(([k,v])=>`<div>${k}: <b>${Number(v).toFixed(2)}</b></div>`).join('');
  window.currentLayout={project:'KAIROS PARADOR — LINEAR STATION', generated_at:new Date().toISOString(), params:p, metrics, modules:boxes};
}
async function loadVersions(){ try{ const r=await fetch('../../data/layouts/manifest.json'); const m=await r.json(); (m.layouts||[]).forEach(x=>{const o=document.createElement('option'); o.value=x.file; o.textContent=x.label; els.versionSelect.appendChild(o);}); }catch(e){} }
async function loadLayout(file){ if(!file) return; const r=await fetch('../../data/layouts/'+file); const l=await r.json(); Object.entries(l.params||{}).forEach(([k,v])=>{const e=document.getElementById(k); if(e) e.value=v;}); draw(); }
function exportJson(){ const blob=new Blob([JSON.stringify(window.currentLayout,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='layout-export.json'; a.click(); URL.revokeObjectURL(a.href); }
async function init(){ const r=await fetch('../../data/lot.json'); lot=await r.json(); local=lot.polygon.map(p=>lonLatToLocal(p,lot.reference_point)); controls.forEach(id=>document.getElementById(id).addEventListener('input',draw)); els.versionSelect.addEventListener('change',e=>loadLayout(e.target.value)); els.exportBtn.addEventListener('click',exportJson); await loadVersions(); draw(); }
window.addEventListener('resize',draw); init().catch(e=>{els.metrics.innerHTML='<h4>Error</h4>No se pudo cargar lot.json. Usa GitHub Pages o servidor local.'; console.error(e);});
