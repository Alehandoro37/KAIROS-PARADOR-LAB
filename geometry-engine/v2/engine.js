/* KAIROS PARADOR — Geometry Engine v2 / Setback Layer V1 */
(() => {
  const LOT_URL = '../../data/lot.json';
  const MANIFEST_URL = '../../data/layouts/manifest.json';
  const canvas = document.getElementById('lotCanvas');
  const ctx = canvas.getContext('2d');
  const metricsEl = document.getElementById('metrics');
  const versionSelect = document.getElementById('versionSelect');
  const exportBtn = document.getElementById('exportBtn');

  const ids = [
    'roadAxisOffsetM','roadSetbackM','railAxisOffsetM','railSetbackM','oldRoadAxisOffsetM','waterBufferM',
    'parkBand','walkBand','boxType','boxCount','boxGap','boxStart'
  ];

  const ISO = { 20: { l: 6.06, w: 2.44 }, 40: { l: 12.19, w: 2.44 } };
  let lot, local, basis, scale = 1, pad = 48, lastExport = null;

  function $(id){ return document.getElementById(id); }
  function val(id){ const el=$(id); return el ? Number(el.value) : 0; }
  function setVal(id,v){ const el=$(id); if(el) el.value = v; }
  function out(id,v){ const el=$(id+'Out'); if(el) el.textContent = id.includes('Count') ? String(v) : `${Number(v).toFixed(id.includes('boxStart') ? 0 : 1)} m`; }
  function sub(a,b){ return {x:a.x-b.x,y:a.y-b.y}; }
  function add(a,b){ return {x:a.x+b.x,y:a.y+b.y}; }
  function mul(a,k){ return {x:a.x*k,y:a.y*k}; }
  function dot(a,b){ return a.x*b.x+a.y*b.y; }
  function len(a){ return Math.hypot(a.x,a.y); }
  function norm(a){ const l=len(a)||1; return {x:a.x/l,y:a.y/l}; }

  function projectLL(points){
    const lat0 = points.reduce((s,p)=>s+p.lat,0)/points.length;
    const lon0 = points.reduce((s,p)=>s+p.lon,0)/points.length;
    const mLat = 111320, mLon = 111320*Math.cos(lat0*Math.PI/180);
    return points.map(p=>({ id:p.id, lon:p.lon, lat:p.lat, x:(p.lon-lon0)*mLon, y:(p.lat-lat0)*mLat }));
  }
  function area(poly){ let a=0; for(let i=0;i<poly.length;i++){ const p=poly[i], q=poly[(i+1)%poly.length]; a += p.x*q.y-q.x*p.y; } return Math.abs(a/2); }
  function pointInPoly(pt, poly){
    let inside=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i], b=poly[j];
      const hit = ((a.y>pt.y)!=(b.y>pt.y)) && (pt.x < (b.x-a.x)*(pt.y-a.y)/(b.y-a.y+1e-9)+a.x);
      if(hit) inside=!inside;
    }
    return inside;
  }
  function toST(p){ const v=sub(p,basis.A); return {s:dot(v,basis.u), t:dot(v,basis.n)}; }
  function fromST(s,t){ return add(basis.A, add(mul(basis.u,s), mul(basis.n,t))); }
  function isRestrictedST(st,c){
    const road = c.roadSetbackM>0 && c.roadAxisOffsetM>0 && st.t <= Math.max(0,c.roadSetbackM-c.roadAxisOffsetM);
    const rail = c.railSetbackM>0 && c.railAxisOffsetM>0 && st.t <= Math.max(0,c.railSetbackM-c.railAxisOffsetM);
    const water = c.waterBufferM>0 && st.t >= basis.maxT-c.waterBufferM;
    return { blocked: road || rail || water, reason: water ? 'pisa buffer hídrico preliminar' : (road||rail ? 'pisa retiro vial/férreo preliminar' : '') };
  }
  function params(){
    return {
      parkBand: val('parkBand'), walkBand: val('walkBand'), boxType: val('boxType'), boxCount: val('boxCount'), boxGap: val('boxGap'), boxStart: val('boxStart')
    };
  }
  function constraints(){
    return {
      roadAxisOffsetM: val('roadAxisOffsetM'), roadSetbackM: val('roadSetbackM'),
      railAxisOffsetM: val('railAxisOffsetM'), railSetbackM: val('railSetbackM'),
      oldRoadAxisOffsetM: val('oldRoadAxisOffsetM'), waterBufferM: val('waterBufferM'),
      status: 'PRELIMINAR — pendiente topografía',
      model: 'ejes paralelos al lindero oriental A→B; valores editables, no topografía ni norma'
    };
  }
  function computeModules(p,c){
    const type = ISO[p.boxType] || ISO[20];
    const valid=[], rejected=[];
    for(let i=0;i<p.boxCount;i++){
      const s0 = p.boxStart + i*(type.l+p.boxGap);
      const t0 = Math.max(c.roadSetbackM-c.roadAxisOffsetM, c.railSetbackM-c.railAxisOffsetM, 0) + p.parkBand + p.walkBand + type.w/2;
      const cornersST = [
        {s:s0, t:t0-type.w/2}, {s:s0+type.l, t:t0-type.w/2},
        {s:s0+type.l, t:t0+type.w/2}, {s:s0, t:t0+type.w/2}
      ];
      const corners = cornersST.map(q=>fromST(q.s,q.t));
      let reason='';
      if(!corners.every(pt=>pointInPoly(pt, local))) reason='fuera del polígono';
      const restrictedCorner = cornersST.find(st=>isRestrictedST(st,c).blocked);
      if(!reason && restrictedCorner) reason=isRestrictedST(restrictedCorner,c).reason;
      const mod = { id:`M${i+1}`, type:`${p.boxType}'`, s:s0, t:t0, cornersST, corners };
      (reason ? rejected : valid).push(reason ? {...mod, reason} : mod);
    }
    return {valid, rejected};
  }
  function sampleAreas(c){
    const step=0.4;
    let total=0, restricted=0;
    for(let s=0; s<=basis.len; s+=step){
      for(let t=0; t<=basis.maxT; t+=step){
        const pt=fromST(s,t);
        if(pointInPoly(pt, local)){
          total += step*step;
          if(isRestrictedST({s,t},c).blocked) restricted += step*step;
        }
      }
    }
    return {total, restricted, useful: Math.max(0,total-restricted), method:'malla 0.4 m'};
  }
  function resize(){
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(600, Math.floor(r.width*devicePixelRatio));
    canvas.height = Math.max(420, Math.floor(r.height*devicePixelRatio));
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    draw();
  }
  function fit(pt){
    const xs=local.map(p=>p.x), ys=local.map(p=>p.y);
    const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
    const w=canvas.clientWidth-pad*2, h=canvas.clientHeight-pad*2;
    scale = Math.min(w/(maxX-minX+20), h/(maxY-minY+20));
    return {x: pad+(pt.x-minX+10)*scale, y: canvas.clientHeight-pad-(pt.y-minY+10)*scale};
  }
  function pathPoly(poly, close=true){
    ctx.beginPath();
    poly.forEach((p,i)=>{ const q=fit(p); i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y); });
    if(close) ctx.closePath();
  }
  function drawBand(t1,t2,color){
    const pts=[];
    for(let s=0;s<=basis.len;s+=1) pts.push(fromST(s,t1));
    for(let s=basis.len;s>=0;s-=1) pts.push(fromST(s,t2));
    pathPoly(pts); ctx.fillStyle=color; ctx.fill();
  }
  function drawLineST(t, style, label){
    const a=fit(fromST(0,t)), b=fit(fromST(basis.len,t));
    ctx.save(); ctx.setLineDash(style.dash||[]); ctx.strokeStyle=style.color; ctx.lineWidth=style.width||2; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle=style.color; ctx.font='12px ui-monospace, monospace'; ctx.fillText(label, a.x+8, a.y-8); ctx.restore();
  }
  function drawModule(m, ok){
    pathPoly(m.corners); ctx.fillStyle = ok ? 'rgba(255,179,107,.28)' : 'rgba(176,85,60,.12)'; ctx.strokeStyle = ok ? '#ffb36b' : '#b0553c'; ctx.lineWidth=2; ctx.setLineDash(ok?[]:[7,5]); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    const q=fit(m.corners[0]); ctx.fillStyle= ok ? '#ffd36b' : '#ffb0a0'; ctx.font='11px ui-monospace, monospace'; ctx.fillText(ok?m.id:`${m.id} X`, q.x+4,q.y-4);
  }
  function draw(){
    if(!local) return;
    const p=params(), c=constraints();
    const areas=sampleAreas(c); const mods=computeModules(p,c);
    ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight);
    ctx.fillStyle='#061526'; ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);

    const effectiveEast = Math.max(c.roadSetbackM-c.roadAxisOffsetM, c.railSetbackM-c.railAxisOffsetM, 0);
    if(effectiveEast>0) drawBand(0,effectiveEast,'rgba(176,85,60,.22)');
    if(c.waterBufferM>0) drawBand(basis.maxT-c.waterBufferM,basis.maxT,'rgba(80,140,170,.18)');
    if(p.parkBand>0) drawBand(effectiveEast, effectiveEast+p.parkBand, 'rgba(180,190,255,.10)');
    if(p.walkBand>0) drawBand(effectiveEast+p.parkBand, effectiveEast+p.parkBand+p.walkBand, 'rgba(255,255,255,.08)');

    drawLineST(c.roadAxisOffsetM, {color:'#8fe5ff', width:2.2}, 'EJE VIAL (PRELIMINAR)');
    drawLineST(c.railAxisOffsetM, {color:'#ffd36b', width:2, dash:[8,6]}, 'EJE FÉRREO (PRELIMINAR)');
    drawLineST(c.oldRoadAxisOffsetM, {color:'#b9e5ff', width:1.6, dash:[2,7]}, 'VÍA ANTIGUA (PRELIMINAR)');

    pathPoly(local); ctx.strokeStyle='#8fe5ff'; ctx.lineWidth=2.5; ctx.fillStyle='rgba(143,229,255,.06)'; ctx.fill(); ctx.stroke();
    mods.valid.forEach(m=>drawModule(m,true)); mods.rejected.forEach(m=>drawModule(m,false));

    ctx.save(); ctx.translate(canvas.clientWidth/2, canvas.clientHeight/2); ctx.rotate(-Math.PI/9); ctx.font='700 24px ui-monospace, monospace'; ctx.fillStyle='rgba(255,211,107,.16)'; ctx.textAlign='center'; ctx.fillText('PRELIMINAR — PENDIENTE TOPOGRAFÍA',0,0); ctx.restore();

    lastExport = { project:'KAIROS PARADOR — LINEAR STATION', generatedAt:new Date().toISOString(), params:p, constraints:c, metrics:{ areaTotalM2:+areas.total.toFixed(1), areaRestrictedM2:+areas.restricted.toFixed(1), areaUsefulM2:+areas.useful.toFixed(1), method:areas.method }, validModules:mods.valid.map(m=>({id:m.id,type:m.type,s:m.s,t:m.t})), rejectedModules:mods.rejected.map(m=>({id:m.id,type:m.type,reason:m.reason,s:m.s,t:m.t})), warnings:['PRELIMINAR — pendiente topografía georreferenciada','Ejes modelados paralelos al lindero A→B; no son ejes oficiales','Buffer hídrico medido desde lindero occidental por convención del lab'] };
    metricsEl.innerHTML = `<h4>Métricas</h4><p><b>Área KML:</b> ${areas.total.toFixed(1)} m²</p><p><b>Restringida preliminar:</b> ${areas.restricted.toFixed(1)} m²</p><p><b>Útil preliminar:</b> ${areas.useful.toFixed(1)} m²</p><p><b>Módulos válidos:</b> ${mods.valid.length} · <b>rechazados:</b> ${mods.rejected.length}</p><p class="pend">PRELIMINAR — pendiente topografía</p>`;
  }
  function applyLayout(l){
    if(l.params){ Object.entries(l.params).forEach(([k,v])=>setVal(k,v)); }
    if(l.constraints){ Object.entries(l.constraints).forEach(([k,v])=>{ if(typeof v==='number') setVal(k,v); }); }
    updateOutputs(); draw();
  }
  function updateOutputs(){ ids.forEach(id=>out(id,val(id))); }
  async function loadManifest(){
    try{ const m=await fetch(MANIFEST_URL).then(r=>r.json()); (m.layouts||[]).forEach(l=>{ const o=document.createElement('option'); o.value=l.file; o.textContent=l.label; versionSelect.appendChild(o); }); }catch(e){}
  }
  async function init(){
    lot = await fetch(LOT_URL).then(r=>r.json());
    local = projectLL(lot.polygon);
    basis = { A: local[0], B: local[1] };
    basis.u = norm(sub(basis.B,basis.A)); basis.n = {x:-basis.u.y, y:basis.u.x}; basis.len=len(sub(basis.B,basis.A));
    basis.maxT = Math.max(...local.map(p=>toST(p).t));
    ids.forEach(id=>{ const el=$(id); if(el) el.addEventListener('input',()=>{updateOutputs(); draw();}); });
    versionSelect.addEventListener('change', async e=>{ if(!e.target.value) return; const l=await fetch(`../../data/layouts/${e.target.value}`).then(r=>r.json()); applyLayout(l); });
    exportBtn.addEventListener('click',()=>{ const blob=new Blob([JSON.stringify(lastExport,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='layout-export-setbacks.json'; a.click(); URL.revokeObjectURL(a.href); });
    await loadManifest(); updateOutputs(); resize();
  }
  addEventListener('resize', resize);
  init().catch(err=>{ metricsEl.innerHTML = `<h4>Error</h4><p>${err.message}</p>`; });
})();
