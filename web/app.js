/* ============================================================
   LIFELOG · 生活日志  -  纯前端 / localStorage
   数据模型:
     equipment: { id, name, muscle, mode:'weighted'|'bodyweight', lastSets:[{reps,weight}]|null }
     entries:   { id, date, equipmentId, mode, sets:[{reps,weight}], createdAt }
     practice:  { id, date, minutes, note, createdAt }
     snacks:    { id, date, name, kj, note, createdAt }
   ============================================================ */

const KEY = 'liftlog.db.v1';
let DB = load();
migrate();
const state = { tab:'record', editor:null, practiceEditor:null, snackEditor:null, settingsOpen:false, settingsExpand:{}, libEdit:null, libEditVals:null, newEq:{muscle:'胸', mode:'weighted'}, range:{kind:'all'}, reportsView:'fitness', historyView:'all' };

/* ---------- storage ---------- */
function load(){
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && Array.isArray(d.equipment)) return d; }
  catch {}
  return { equipment: [], entries: [], practice: [], snacks: [] };
}
function save(){ localStorage.setItem(KEY, JSON.stringify(DB)); }
/* 旧版数据迁移:单组 sets/reps/weight -> 多组;补 practice 数组 */
function migrate(){
  DB.equipment.forEach(e=>{ if(!e.mode) e.mode='weighted'; if(!e.lastSets) e.lastSets=null; });
  DB.entries.forEach(e=>{
    if(!Array.isArray(e.sets)){
      const n = e.sets||0, reps = e.reps||0, weight = e.weight||0;
      e.sets = Array.from({length:n}, ()=>({reps, weight}));
      delete e.reps; delete e.weight;
    }
    if(!e.mode){ const q=eq(e.equipmentId); e.mode = q?.mode || 'weighted'; }
  });
  if(!Array.isArray(DB.practice)) DB.practice = [];
  if(!Array.isArray(DB.snacks)) DB.snacks = [];
}

/* ---------- muscle groups ---------- */
const MUSCLE = ['胸','背','肩','肱二头','肱三头','前臂','腿','臀','小腿','核心','有氧','其他'];
const GROUP_COLORS = {
  '胸':'#c8ff3a','背':'#00e5ff','肩':'#ff7a3c','肱二头':'#ff3c6e','肱三头':'#b388ff',
  '前臂':'#ffd23c','腿':'#3cffa0','臀':'#ff3cc8','小腿':'#3cb8ff','核心':'#ffe23c',
  '有氧':'#9aa0a6','其他':'#6b7280'
};
const groupColor = g => GROUP_COLORS[g] || '#c8ff3a';

const SAMPLE = [
  {name:'杠铃卧推', muscle:'胸', mode:'weighted'}, {name:'哑铃飞鸟', muscle:'胸', mode:'weighted'},
  {name:'胸部推举机', muscle:'胸', mode:'weighted'}, {name:'高位下拉', muscle:'背', mode:'weighted'},
  {name:'低位下拉', muscle:'背', mode:'weighted'}, {name:'罗马尼亚硬拉', muscle:'背', mode:'weighted'},
  {name:'杠铃划船', muscle:'背', mode:'weighted'}, {name:'杠铃深蹲', muscle:'腿', mode:'weighted'},
  {name:'腿举', muscle:'腿', mode:'weighted'}, {name:'哑铃肩推', muscle:'肩', mode:'weighted'},
  {name:'哑铃弯举', muscle:'肱二头', mode:'weighted'}, {name:'绳索下压', muscle:'肱三头', mode:'weighted'},
  {name:'俯卧撑', muscle:'胸', mode:'bodyweight'}, {name:'双杠臂屈伸', muscle:'肱三头', mode:'bodyweight'},
];

/* ---------- utils ---------- */
const WD = ['日','一','二','三','四','五','六'];
const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const todayStr = () => fmt(new Date());
const fmtShort = s => s.slice(5).replace('-','.');
const weekdayStr = s => '周' + WD[new Date(s+'T00:00:00').getDay()];
const fmtNum = n => Math.round(n).toLocaleString();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eq = id => DB.equipment.find(e => e.id === id);
const vol = e => (!e || !Array.isArray(e.sets) || e.mode==='bodyweight') ? 0 : e.sets.reduce((s,st)=>s + (st.reps||0)*(st.weight||0), 0);
const totalReps = e => Array.isArray(e?.sets) ? e.sets.reduce((s,st)=>s+(st.reps||0),0) : 0;
const totalSets = e => Array.isArray(e?.sets) ? e.sets.length : 0;
function startOfWeek(d){ const x = new Date(d); x.setHours(0,0,0,0); const day = (x.getDay()+6)%7; x.setDate(x.getDate()-day); return x; }

/* ---------- fitness aggregates ---------- */
function sumVolume(fn){ return DB.entries.filter(fn).reduce((s,e)=>s+vol(e),0); }
function sumSets(fn){ return DB.entries.filter(fn).reduce((s,e)=>s+totalSets(e),0); }
function todayEntries(){ return DB.entries.filter(e=>e.date===todayStr()).sort((a,b)=>a.createdAt-b.createdAt); }
function thisWeekRange(){ const s = startOfWeek(new Date(todayStr()+'T00:00:00')); const e = new Date(s); e.setDate(e.getDate()+6); return [s,e]; }
function periodVolume(kind){
  if(kind==='today') return sumVolume(e=>e.date===todayStr());
  if(kind==='week'){ const [s,e]=thisWeekRange(); return sumVolume(en=>{const d=new Date(en.date+'T00:00:00'); return d>=s&&d<=e;}); }
  const n=new Date(), s=new Date(n.getFullYear(),n.getMonth(),1), e=new Date(n.getFullYear(),n.getMonth()+1,0);
  return sumVolume(en=>{const d=new Date(en.date+'T00:00:00'); return d>=s&&d<=e;});
}
function dailySeries(n){
  const out=[]; const t=new Date(todayStr()+'T00:00:00');
  for(let i=n-1;i>=0;i--){ const d=new Date(t); d.setDate(d.getDate()-i); const s=fmt(d); out.push({label:fmtShort(s), value:sumVolume(e=>e.date===s)}); }
  return out;
}
function periodSets(kind){
  if(kind==='today') return sumSets(e=>e.date===todayStr());
  if(kind==='week'){ const [s,e]=thisWeekRange(); return sumSets(en=>{const d=new Date(en.date+'T00:00:00'); return d>=s&&d<=e;}); }
  const n=new Date(), s=new Date(n.getFullYear(),n.getMonth(),1), e=new Date(n.getFullYear(),n.getMonth()+1,0);
  return sumSets(en=>{const d=new Date(en.date+'T00:00:00'); return d>=s&&d<=e;});
}
function dailySetsSeries(n){
  const out=[]; const t=new Date(todayStr()+'T00:00:00');
  for(let i=n-1;i>=0;i--){ const d=new Date(t); d.setDate(d.getDate()-i); const s=fmt(d); out.push({label:fmtShort(s), value:sumSets(e=>e.date===s)}); }
  return out;
}
function fitnessStreak(){
  const set=new Set(DB.entries.map(e=>e.date));
  let streak=0; const d=new Date(todayStr()+'T00:00:00');
  if(!set.has(fmt(d))) d.setDate(d.getDate()-1);
  while(set.has(fmt(d))){ streak++; d.setDate(d.getDate()-1); }
  return streak;
}
/* range filter for fitness breakdowns (按器械 / 按部位) */
function inRange(dateStr){
  const r=state.range; const d=new Date(dateStr+'T00:00:00');
  if(r.kind==='all') return true;
  if(r.kind==='custom'){ if(!r.from||!r.to) return true; const f=new Date(r.from+'T00:00:00'); const t=new Date(r.to+'T00:00:00'); return d>=f&&d<=t; }
  const days=parseInt(r.kind); const cut=new Date(todayStr()+'T00:00:00'); cut.setDate(cut.getDate()-days+1); return d>=cut;
}
function rangeLabel(){
  const r=state.range;
  if(r.kind==='all') return '全部时间';
  if(r.kind==='custom') return `${r.from||'?'} ~ ${r.to||'?'}`;
  return `近 ${r.kind} 天`;
}
function rangeBar(){
  const r=state.range;
  const opts=[['all','全部'],['30','近30天'],['90','近90天'],['365','近1年'],['custom','自定义']];
  return `<div class="range-bar">${opts.map(o=>`<button class="chip ${r.kind===o[0]?'on':''}" data-act="range" data-r="${o[0]}">${o[1]}</button>`).join('')}</div>`
    + (r.kind==='custom'?`<div class="range-custom"><input type="date" id="r-from" value="${r.from||todayStr()}"><span>-</span><input type="date" id="r-to" value="${r.to||todayStr()}"></div>`:'');
}
function byEquipmentKg(){
  const m={}; DB.entries.filter(e=>e.mode!=='bodyweight' && inRange(e.date)).forEach(e=>{ m[e.equipmentId]=(m[e.equipmentId]||0)+vol(e); });
  return Object.entries(m).map(([id,v])=>({label:eq(id)?.name||'已删除', value:v})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value);
}
function byEquipmentSets(){
  const m={}; DB.entries.filter(e=>inRange(e.date)).forEach(e=>{ m[e.equipmentId]=(m[e.equipmentId]||0)+totalSets(e); });
  return Object.entries(m).map(([id,v])=>({label:eq(id)?.name||'已删除', value:v})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value);
}
function byEquipmentReps(){
  const m={}; DB.entries.filter(e=>e.mode==='bodyweight' && inRange(e.date)).forEach(e=>{ m[e.equipmentId]=(m[e.equipmentId]||0)+totalReps(e); });
  return Object.entries(m).map(([id,v])=>({label:eq(id)?.name||'已删除', value:v})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value);
}
function byMuscle(){
  const m={}; DB.entries.filter(e=>e.mode!=='bodyweight' && inRange(e.date)).forEach(e=>{ const g=eq(e.equipmentId)?.muscle||'其他'; m[g]=(m[g]||0)+vol(e); });
  return Object.entries(m).map(([g,v])=>({label:g, value:v})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value);
}
function byMuscleSets(){
  const m={}; DB.entries.filter(e=>inRange(e.date)).forEach(e=>{ const g=eq(e.equipmentId)?.muscle||'其他'; m[g]=(m[g]||0)+totalSets(e); });
  return Object.entries(m).map(([g,v])=>({label:g, value:v})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value);
}

/* ---------- practice aggregates ---------- */
function todayPractice(){ return DB.practice.filter(p=>p.date===todayStr()).sort((a,b)=>a.createdAt-b.createdAt); }
function practiceSum(fn){ return DB.practice.filter(fn).reduce((s,p)=>s+(+p.minutes||0),0); }
function practicePeriod(kind){
  if(kind==='today') return practiceSum(p=>p.date===todayStr());
  if(kind==='week'){ const [s,e]=thisWeekRange(); return practiceSum(p=>{const d=new Date(p.date+'T00:00:00'); return d>=s&&d<=e;}); }
  const n=new Date(), s=new Date(n.getFullYear(),n.getMonth(),1), e=new Date(n.getFullYear(),n.getMonth()+1,0);
  return practiceSum(p=>{const d=new Date(p.date+'T00:00:00'); return d>=s&&d<=e;});
}
function practiceDailySeries(n){
  const out=[]; const t=new Date(todayStr()+'T00:00:00');
  for(let i=n-1;i>=0;i--){ const d=new Date(t); d.setDate(d.getDate()-i); const s=fmt(d); out.push({label:fmtShort(s), value:practiceSum(p=>p.date===s)}); }
  return out;
}
function practiceDailyHoursSeries(n){
  const out=[]; const t=new Date(todayStr()+'T00:00:00');
  for(let i=n-1;i>=0;i--){ const d=new Date(t); d.setDate(d.getDate()-i); const s=fmt(d); out.push({label:fmtShort(s), value:+(practiceSum(p=>p.date===s)/60).toFixed(2)}); }
  return out;
}
function practiceStreak(){
  const set=new Set(DB.practice.map(p=>p.date));
  let streak=0; const d=new Date(todayStr()+'T00:00:00');
  if(!set.has(fmt(d))) d.setDate(d.getDate()-1);
  while(set.has(fmt(d))){ streak++; d.setDate(d.getDate()-1); }
  return streak;
}

/* ---------- snack aggregates ---------- */
function todaySnacks(){ return DB.snacks.filter(s=>s.date===todayStr()).sort((a,b)=>a.createdAt-b.createdAt); }
function snackKjSum(fn){ return DB.snacks.filter(fn).reduce((s,x)=>s+(+x.kj||0),0); }
function snackKcalSum(fn){ return kjToKcal(snackKjSum(fn)); }
function snackPeriod(kind){
  if(kind==='today') return snackKcalSum(s=>s.date===todayStr());
  if(kind==='week'){ const [s,e]=thisWeekRange(); return snackKcalSum(x=>{const d=new Date(x.date+'T00:00:00'); return d>=s&&d<=e;}); }
  const n=new Date(), s=new Date(n.getFullYear(),n.getMonth(),1), e=new Date(n.getFullYear(),n.getMonth()+1,0);
  return snackKcalSum(x=>{const d=new Date(x.date+'T00:00:00'); return d>=s&&d<=e;});
}
function snackDailySeries(n){
  const out=[]; const t=new Date(todayStr()+'T00:00:00');
  for(let i=n-1;i>=0;i--){ const d=new Date(t); d.setDate(d.getDate()-i); const s=fmt(d); out.push({label:fmtShort(s), value:snackKcalSum(x=>x.date===s)}); }
  return out;
}
function snackStreak(){
  const set=new Set(DB.snacks.map(s=>s.date));
  let streak=0; const d=new Date(todayStr()+'T00:00:00');
  if(!set.has(fmt(d))) d.setDate(d.getDate()-1);
  while(set.has(fmt(d))){ streak++; d.setDate(d.getDate()-1); }
  return streak;
}

/* ---------- charts ---------- */
function vbars(data, height=180){
  const max = Math.max(1, ...data.map(d=>d.value));
  const total = data.reduce((s,d)=>s+d.value,0);
  if(!total) return `<div class="chart-empty">暂无数据,去记录第一条吧</div>`;
  const n = data.length;
  return `<div class="vbars" style="height:${height}px">${data.map((d,i)=>{
    const h = (d.value/max*100).toFixed(2);
    const show = (n-1-i)%3===0;
    return `<div class="vbar-col">
      <div class="vbar-val">${d.value?fmtNum(d.value):''}</div>
      <div class="vbar-track"><div class="vbar" style="--h:${h}%;animation-delay:${i*35}ms"></div></div>
      <div class="vbar-lbl">${show?d.label:''}</div>
    </div>`;
  }).join('')}</div>`;
}

function hbars(data, {top=12}={}){
  const d = data.slice(0, top);
  const max = Math.max(1, ...d.map(x=>x.value));
  if(!d.length || d.every(x=>!x.value)) return `<div class="chart-empty">暂无数据</div>`;
  return `<div class="hbars">${d.map((x,i)=>{
    const w = (x.value/max*100).toFixed(2);
    return `<div class="hbar-row">
      <div class="hbar-name">${esc(x.label)}</div>
      <div class="hbar-track"><div class="hbar" style="width:${w}%;animation-delay:${i*45}ms"></div></div>
      <div class="hbar-val">${fmtNum(x.value)}</div>
    </div>`;
  }).join('')}</div>`;
}

function donut(data){
  const total = data.reduce((s,d)=>s+d.value,0);
  if(!total) return `<div class="chart-empty">暂无数据</div>`;
  const r=60, c=2*Math.PI*r, cx=80, cy=80; let acc=0;
  const segs = data.map(d=>{
    const frac = d.value/total, dash = frac*c;
    const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${groupColor(d.label)}" stroke-width="22" stroke-dasharray="${dash} ${c-dash}" stroke-dashoffset="${-acc}" transform="rotate(-90 ${cx} ${cy})"/>`;
    acc += dash; return seg;
  }).join('');
  return `<div class="donut-wrap"><svg viewBox="0 0 160 160" class="donut">${segs}
    <text x="80" y="75" text-anchor="middle" class="donut-num">${fmtNum(total)}</text>
    <text x="80" y="93" text-anchor="middle" class="donut-lbl">总训练量 kg</text></svg>
    <div class="legend">${data.map(d=>`<div class="legend-item"><span class="dot" style="background:${groupColor(d.label)}"></span>${esc(d.label)}<b>${fmtNum(d.value)}</b></div>`).join('')}</div></div>`;
}

/* ---------- heatmap (generic grid, 近6月) ---------- */
function heatColor(sets){
  if(sets<=0) return '#171b21';
  if(sets<=2) return 'rgba(200,255,58,.22)';
  if(sets<=5) return 'rgba(200,255,58,.45)';
  if(sets<=9) return 'rgba(200,255,58,.7)';
  return 'rgba(200,255,58,.95)';
}
function hourColor(h){
  if(h<=0) return '#171b21';
  if(h<=0.25) return 'rgba(200,255,58,.22)';
  if(h<=0.5) return 'rgba(200,255,58,.45)';
  if(h<=1) return 'rgba(200,255,58,.7)';
  return 'rgba(200,255,58,.95)';
}
function heatGrid({valueFn, colorFn, titleFn}){
  const weeks=27, cell=13, gap=3, labelW=22, topH=16;
  const today=new Date(todayStr()+'T00:00:00');
  const endMon=startOfWeek(today);
  const startMon=new Date(endMon); startMon.setDate(startMon.getDate()-(weeks-1)*7);
  const w=labelW+weeks*(cell+gap), h=topH+7*(cell+gap);
  const monthNames=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  let rects='', monthLabels='', prevMonth=-1;
  for(let d=0; d<weeks*7; d++){
    const date=new Date(startMon); date.setDate(date.getDate()+d);
    const ds=fmt(date);
    const col=Math.floor(d/7), row=d%7;
    const x=labelW+col*(cell+gap), y=topH+row*(cell+gap);
    if(row===0){ const m=date.getMonth(); if(m!==prevMonth){ monthLabels+=`<text x="${x}" y="11" class="heat-month">${monthNames[m]}</text>`; prevMonth=m; } }
    if(date>today){ rects+=`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="#0c0e12"/>`; continue; }
    const v=valueFn(ds);
    const title=titleFn(ds, v);
    rects+=`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${colorFn(v)}" data-act="heat" data-info="${esc(title)}"><title>${esc(title)}</title></rect>`;
  }
  const wd=['一','','三','','五','','日']; let wdText='';
  for(let i=0;i<7;i++){ if(wd[i]) wdText+=`<text x="${labelW-4}" y="${topH+i*(cell+gap)+cell-2}" text-anchor="end" class="heat-wd">${wd[i]}</text>`; }
  return `<div class="heat-scroll"><svg viewBox="0 0 ${w} ${h}" class="heat">${monthLabels}${wdText}${rects}</svg></div>
    <div class="heat-legend"><span>少</span><i style="background:#171b21"></i><i style="background:rgba(200,255,58,.22)"></i><i style="background:rgba(200,255,58,.45)"></i><i style="background:rgba(200,255,58,.7)"></i><i style="background:rgba(200,255,58,.95)"></i><span>多</span><span class="heat-cap" id="heat-cap">点方块查看当天</span></div>`;
}
function fitnessHeatmap(){
  const map={};
  DB.entries.forEach(e=>{ if(!map[e.date]) map[e.date]={sets:0,reps:0,vol:0}; map[e.date].sets+=totalSets(e); map[e.date].reps+=totalReps(e); map[e.date].vol+=vol(e); });
  return heatGrid({
    valueFn: ds => map[ds]?.sets||0,
    colorFn: heatColor,
    titleFn: (ds) => { const i=map[ds]; return i ? `${ds} · ${i.sets} 组 · ${i.reps} 次${i.vol>0?` · ${fmtNum(i.vol)} kg`:''}` : `${ds} · 休息`; }
  });
}
function practiceHeatmap(){
  const map={};
  DB.practice.forEach(p=>{ map[p.date]=(map[p.date]||0)+(+p.minutes||0); });
  return heatGrid({
    valueFn: ds => +((map[ds]||0)/60).toFixed(2),
    colorFn: hourColor,
    titleFn: (ds,v) => v>0 ? `${ds} · ${v} h` : `${ds} · 休息`
  });
}
function kjToKcal(k){ return Math.round((+k||0)/4.184); }
function kcalColor(c){
  if(c<=0) return '#171b21';
  if(c<=200) return 'rgba(255,122,60,.22)';
  if(c<=500) return 'rgba(255,122,60,.45)';
  if(c<=1000) return 'rgba(255,122,60,.7)';
  return 'rgba(255,122,60,.95)';
}
function snackHeatmap(){
  const map={};
  DB.snacks.forEach(s=>{ map[s.date]=(map[s.date]||0)+kjToKcal(s.kj); });
  return heatGrid({
    valueFn: ds => map[ds]||0,
    colorFn: kcalColor,
    titleFn: (ds,v) => v>0 ? `${ds} · ${fmtNum(v)} kcal` : `${ds} · 无记录`
  });
}

/* ---------- shell ---------- */
const GEAR_SVG = '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>';
const BACK_SVG = '<polyline points="15 18 9 12 15 6"/>';
function header(){
  if(state.settingsOpen){
    return `<header class="top">
      <button class="icon-btn" data-act="close-settings" aria-label="返回"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${BACK_SVG}</svg></button>
      <div class="settings-title">设置</div>
      <div class="icon-btn" style="visibility:hidden"><svg viewBox="0 0 24 24" width="18" height="18"></svg></div>
    </header>`;
  }
  return `<header class="top">
    <div class="brand"><svg class="brand-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="9" width="3" height="6" rx="1"/><rect x="4" y="7" width="2.4" height="10" rx="1"/><line x1="6.4" y1="12" x2="17.6" y2="12"/><rect x="17.6" y="7" width="2.4" height="10" rx="1"/><rect x="20" y="9" width="3" height="6" rx="1"/></svg>LIFELOG<span class="brand-sub">生活日志</span></div>
    <button class="icon-btn" data-act="open-settings" aria-label="设置"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GEAR_SVG}</svg></button>
  </header>`;
}
function navbar(){
  if(state.settingsOpen) return '';
  const items = [
    ['record','记录','<path d="M12 5v14M5 12h14"/>'],
    ['reports','报表','<line x1="6" y1="20" x2="6" y2="13"/><line x1="12" y1="20" x2="12" y2="5"/><line x1="18" y1="20" x2="18" y2="10"/>'],
    ['history','历史','<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
  ];
  return `<nav class="navbar">${items.map(it=>`
    <button class="navitem ${state.tab===it[0]?'on':''}" data-act="tab" data-tab="${it[0]}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${it[2]}</svg>
      <span>${it[1]}</span>
    </button>`).join('')}</nav>`;
}
function view(){
  if(state.settingsOpen) return renderSettings();
  if(state.tab==='record') return renderRecord();
  if(state.tab==='reports') return renderReports();
  return renderHistory();
}
function render(){
  document.getElementById('app').innerHTML = header() + `<main class="container">${view()}</main>` + navbar();
}

/* ---------- record view ---------- */
function statCard(label,val,unit){ return `<div class="stat"><div class="stat-val">${val}<span>${unit}</span></div><div class="stat-lbl">${label}</div></div>`; }
function entrySummary(e){
  const reps = e.sets.map(s=>s.reps||0);
  const sets = e.sets.length;
  const repsTotal = reps.reduce((a,b)=>a+b,0);
  if(e.mode==='bodyweight'){
    return {meta:`${reps.join('/')} 次 · ${sets} 组`, vol:String(repsTotal), volUnit:'次'};
  }
  const weights = e.sets.map(s=>s.weight||0);
  const wInfo = weights.every(w=>w===weights[0]) ? `${weights[0]} kg` : `${Math.min(...weights)}–${Math.max(...weights)} kg`;
  return {meta:`${reps.join('/')} 次 @ ${wInfo} · ${sets} 组`, vol:fmtNum(vol(e)), volUnit:'kg'};
}
function entryRow(e){
  const q = eq(e.equipmentId);
  const s = entrySummary(e);
  return `<div class="entry-swipe" data-id="${e.id}">
    <div class="entry" data-act="edit" data-id="${e.id}">
      <div class="entry-main">
        <div class="entry-name">${esc(q?.name||'已删除')}<span class="tag" style="--c:${groupColor(q?.muscle||'其他')}">${esc(q?.muscle||'其他')}</span>${e.mode==='bodyweight'?'<span class="tag" style="--c:#9aa0a6">自重</span>':''}</div>
        <div class="entry-meta">${s.meta}</div>
      </div>
      <div class="entry-vol">${s.vol}<span>${s.volUnit}</span></div>
    </div>
    <button class="entry-del" data-act="del-entry" data-id="${e.id}">删除</button>
  </div>`;
}
function practiceRow(p){
  return `<div class="entry-swipe" data-id="${p.id}">
    <div class="entry" data-act="edit-practice" data-id="${p.id}">
      <div class="entry-main">
        <div class="entry-name">吉他练习<span class="tag" style="--c:#3cb8ff">练习</span></div>
        <div class="entry-meta">${p.note?esc(p.note):'今日练习'}</div>
      </div>
      <div class="entry-vol">${p.minutes}<span>分</span></div>
    </div>
    <button class="entry-del" data-act="del-practice" data-id="${p.id}">删除</button>
  </div>`;
}
function snackRow(s, {dual=false}={}){
  const kcal = kjToKcal(s.kj);
  const vol = dual
    ? `${fmtNum(s.kj)}<span>kJ</span><small style="display:block;font-size:10px;color:var(--dim);font-family:'Space Mono',monospace">≈${kcal} kcal</small>`
    : `${fmtNum(kcal)}<span>kcal</span>`;
  return `<div class="entry-swipe" data-id="${s.id}">
    <div class="entry" data-act="edit-snack" data-id="${s.id}">
      <div class="entry-main">
        <div class="entry-name">${esc(s.name)}<span class="tag" style="--c:#ff7a3c">热量</span></div>
        <div class="entry-meta">${s.note?esc(s.note):'热量记录'}</div>
      </div>
      <div class="entry-vol">${vol}</div>
    </div>
    <button class="entry-del" data-act="del-snack" data-id="${s.id}">删除</button>
  </div>`;
}
function renderRecord(){
  const te = todayEntries();
  const tVol = te.reduce((s,e)=>s+vol(e),0);
  const tSets = te.reduce((s,e)=>s+totalSets(e),0);
  const tReps = te.reduce((s,e)=>s+totalReps(e),0);
  const tp = todayPractice();
  const tpMin = tp.reduce((s,p)=>s+(+p.minutes||0),0);
  const ts = todaySnacks();
  const tsKj = ts.reduce((s,x)=>s+(+x.kj||0),0);
  const dstr = todayStr();
  return `
  <section class="reveal">
    <div class="day-head">
      <div>
        <div class="day-date">${fmtShort(dstr)}<span class="wd">${weekdayStr(dstr)}</span></div>
        <div class="day-title">今日</div>
      </div>
    </div>
    <div class="sub-head"><span class="sub-title">训练</span><button class="sec-add" data-act="new">+ 记录器械</button></div>
    <div class="stat-row">
      ${statCard('训练量', fmtNum(tVol), 'kg')}
      ${statCard('总组数', tSets, '组')}
      ${statCard('总次数', tReps, '次')}
    </div>
    ${te.length ? `<div class="entry-list">${te.map(entryRow).join('')}</div>` : `<div class="empty">还没有训练记录,点「+ 记录器械」开始</div>`}
  </section>
  <section class="reveal">
    <div class="sub-head"><span class="sub-title">练习<em>${tpMin} 分钟</em></span><button class="sec-add" data-act="new-practice">+ 记录</button></div>
    ${tp.length ? `<div class="entry-list">${tp.map(practiceRow).join('')}</div>` : `<div class="empty">还没有练习记录,点「+ 记录」开始</div>`}
  </section>
  <section class="reveal">
    <div class="sub-head"><span class="sub-title">热量<em>${fmtNum(tsKj)} kJ · ≈${kjToKcal(tsKj)} kcal</em></span><button class="sec-add" data-act="new-snack">+ 记录</button></div>
    ${ts.length ? `<div class="entry-list">${ts.map(s=>snackRow(s,{dual:true})).join('')}</div>` : `<div class="empty">还没有热量记录,点「+ 记录」开始</div>`}
  </section>`;
}

/* ---------- library (equipment) ---------- */
function eqRow(e, editing){
  if(editing){
    const v = state.libEditVals || {muscle:e.muscle, mode:e.mode};
    return `<div class="eq editing">
      <input id="edit-name-${e.id}" value="${esc(e.name)}">
      <div class="form-row"><span class="form-label">部位</span>
        <div class="pills">${MUSCLE.map(m=>`<button class="chip ${v.muscle===m?'on':''}" data-act="edit-muscle" data-m="${m}">${m}</button>`).join('')}</div>
      </div>
      <div class="form-row"><span class="form-label">类型</span>
        <div class="seg">
          <button class="chip ${v.mode==='weighted'?'on':''}" data-act="edit-mode" data-m="weighted">有重量</button>
          <button class="chip ${v.mode==='bodyweight'?'on':''}" data-act="edit-mode" data-m="bodyweight">自重</button>
        </div>
      </div>
      <div class="edit-actions">
        <button class="btn primary sm" data-act="save-eq" data-id="${e.id}">保存</button>
        <button class="btn ghost sm" data-act="cancel-eq">取消</button>
      </div>
    </div>`;
  }
  return `<div class="eq">
    <div class="eq-main"><div class="eq-name">${esc(e.name)}<span class="tag" style="--c:${groupColor(e.muscle)}">${esc(e.muscle)}</span>${e.mode==='bodyweight'?'<span class="tag" style="--c:#9aa0a6">自重</span>':''}</div></div>
    <div class="eq-last">${e.lastSets?.length?`上次 ${e.lastSets.length} 组`:'未使用'}</div>
    <div class="eq-act">
      <button data-act="edit-eq" data-id="${e.id}">改</button>
      <button data-act="del-eq" data-id="${e.id}">删</button>
    </div>
  </div>`;
}
function equipmentSection(){
  return `
    <div class="sec-title">新增器械</div>
    <div class="add-eq">
      <input id="new-eq-name" placeholder="器械名称(如 胸部推举机)" autocomplete="off">
      <div class="form-row"><span class="form-label">部位</span>
        <div class="pills">${MUSCLE.map(m=>`<button class="chip ${state.newEq.muscle===m?'on':''}" data-act="new-muscle" data-m="${m}">${m}</button>`).join('')}</div>
      </div>
      <div class="form-row"><span class="form-label">类型</span>
        <div class="seg">
          <button class="chip ${state.newEq.mode==='weighted'?'on':''}" data-act="new-mode" data-m="weighted">有重量</button>
          <button class="chip ${state.newEq.mode==='bodyweight'?'on':''}" data-act="new-mode" data-m="bodyweight">自重</button>
        </div>
      </div>
      <button class="btn primary" data-act="add-eq" style="width:100%">添加</button>
    </div>
    <div class="hint">「自重」类(如俯卧撑)不记重量,按次数统计。</div>
    <div class="sec-title" style="margin-top:20px">器械库</div>
    ${DB.equipment.length
      ? `<div class="eq-list">${DB.equipment.map(e=>eqRow(e, state.libEdit===e.id)).join('')}</div>`
      : `<div class="empty">还没有器械。<button class="link" data-act="load-samples">载入常用示例</button> 或 在上方添加</div>`}`;
}

/* ---------- settings view ---------- */
function settingsGroup(key, title, inner){
  const open = !!state.settingsExpand[key];
  return `<div class="settings-group reveal">
    <button class="settings-group-head" data-act="toggle-settings" data-key="${key}">
      <span>${title}</span>
      <svg class="arrow ${open?'open':''}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
    </button>
    <div class="settings-group-body ${open?'':'hidden'}">${inner}</div>
  </div>`;
}
function renderSettings(){
  return settingsGroup('equipment', `器械管理<span class="sec-sub">${DB.equipment.length} 项</span>`, equipmentSection())
       + settingsGroup('data', '数据管理', `
    <div class="settings-list">
      <button class="settings-row" data-act="export"><span>导出 JSON 备份</span><span class="dim">下载全部数据</span></button>
      <button class="settings-row" data-act="import"><span>导入 JSON</span><span class="dim">从备份文件恢复</span></button>
      <button class="settings-row danger" data-act="clear"><span>清空所有数据</span><span class="dim">不可恢复</span></button>
    </div>
    <div class="hint">数据存于浏览器 localStorage,导出的 JSON 文件可作备份。</div>`);
}

/* ---------- reports view ---------- */
function renderReports(){
  const toggle = `<div class="rpt-toggle"><button class="chip ${state.reportsView==='fitness'?'on':''}" data-act="rpt-view" data-v="fitness">训练</button><button class="chip ${state.reportsView==='practice'?'on':''}" data-act="rpt-view" data-v="practice">练习</button><button class="chip ${state.reportsView==='snack'?'on':''}" data-act="rpt-view" data-v="snack">热量</button></div>`;
  return toggle + (state.reportsView==='practice' ? practiceReports() : state.reportsView==='snack' ? snackReports() : fitnessReports());
}
function fitnessReports(){
  const bwReps = byEquipmentReps();
  const rl = rangeLabel();
  const totalDays = new Set(DB.entries.map(e=>e.date)).size;
  const totalHours = (totalDays * 0.5).toFixed(1);
  return `
  <section class="reveal">
    <div class="stat-row">
      ${statCard('今日', periodSets('today'), '组')}
      ${statCard('本周', periodSets('week'), '组')}
      ${statCard('本月', periodSets('month'), '组')}
    </div>
  </section>
  <section class="reveal">
    <div class="stat-row">
      ${statCard('连续打卡', fitnessStreak(), '天')}
      ${statCard('总天数', totalDays, '天')}
      ${statCard('总时长', totalHours, 'h')}
    </div>
  </section>
  <section class="reveal"><div class="sec-title">近 14 天 · 每日组数</div>${vbars(dailySetsSeries(14))}</section>
  <section class="reveal"><div class="sec-title">训练热力图 · 近 6 月<span class="sec-sub">颜色 = 当天组数</span></div>${fitnessHeatmap()}</section>
  <section class="reveal">
    <div class="sec-title">区间统计<span class="sec-sub">${rl}</span></div>
    ${rangeBar()}
  </section>
  <section class="reveal"><div class="sec-title">按器械 · 组数<span class="sec-sub">${rl}</span></div>${hbars(byEquipmentSets())}</section>
  ${bwReps.length?`<section class="reveal"><div class="sec-title">按器械 · 自重次数<span class="sec-sub">${rl}</span></div>${hbars(bwReps)}</section>`:''}
  <section class="reveal"><div class="sec-title">按部位 · 组数分布<span class="sec-sub">${rl}</span></div>${donut(byMuscleSets())}</section>`;
}
function practiceReports(){
  const totalDays = new Set(DB.practice.map(p=>p.date)).size;
  const totalMin = DB.practice.reduce((s,p)=>s+(+p.minutes||0),0);
  const totalHrs = (totalMin/60).toFixed(1);
  return `
  <section class="reveal">
    <div class="stat-row">
      ${statCard('今日', (practicePeriod('today')/60).toFixed(1), 'h')}
      ${statCard('本周', (practicePeriod('week')/60).toFixed(1), 'h')}
      ${statCard('本月', (practicePeriod('month')/60).toFixed(1), 'h')}
    </div>
  </section>
  <section class="reveal">
    <div class="stat-row">
      ${statCard('连续打卡', practiceStreak(), '天')}
      ${statCard('总天数', totalDays, '天')}
      ${statCard('总时长', totalHrs, 'h')}
    </div>
  </section>
  <section class="reveal"><div class="sec-title">近 14 天 · 每日练习时长</div>${vbars(practiceDailyHoursSeries(14))}</section>
  <section class="reveal"><div class="sec-title">练习热力图 · 近 6 月<span class="sec-sub">颜色 = 当天时长</span></div>${practiceHeatmap()}</section>`;
}
function snackReports(){
  return `
  <section class="reveal">
    <div class="stat-row">
      ${statCard('今日', fmtNum(snackPeriod('today')), 'kcal')}
      ${statCard('本周', fmtNum(snackPeriod('week')), 'kcal')}
      ${statCard('本月', fmtNum(snackPeriod('month')), 'kcal')}
    </div>
  </section>
  <section class="reveal"><div class="sec-title">近 14 天 · 每日热量</div>${vbars(snackDailySeries(14))}</section>
  <section class="reveal"><div class="sec-title">热量热力图 · 近 6 月<span class="sec-sub">颜色 = 当天 kcal</span></div>${snackHeatmap()}</section>`;
}

/* ---------- history view ---------- */
function renderHistory(){
  if(!DB.entries.length && !DB.practice.length && !DB.snacks.length) return `<section class="reveal"><div class="empty">还没有历史记录</div></section>`;
  const v = state.historyView;
  const toggle = `<div class="rpt-toggle"><button class="chip ${v==='all'?'on':''}" data-act="hist-view" data-v="all">全部</button><button class="chip ${v==='fitness'?'on':''}" data-act="hist-view" data-v="fitness">训练</button><button class="chip ${v==='practice'?'on':''}" data-act="hist-view" data-v="practice">练习</button><button class="chip ${v==='snack'?'on':''}" data-act="hist-view" data-v="snack">热量</button></div>`;
  const showFit = v==='all' || v==='fitness';
  const showPrac = v==='all' || v==='practice';
  const showSnack = v==='all' || v==='snack';
  const byDate = {};
  if(showFit) DB.entries.forEach(e => { (byDate[e.date] ||= {fit:[], prac:[], snack:[]}).fit.push(e); });
  if(showPrac) DB.practice.forEach(p => { (byDate[p.date] ||= {fit:[], prac:[], snack:[]}).prac.push(p); });
  if(showSnack) DB.snacks.forEach(s => { (byDate[s.date] ||= {fit:[], prac:[], snack:[]}).snack.push(s); });
  const dates = Object.keys(byDate).sort((a,b)=>b.localeCompare(a));
  if(!dates.length) return toggle + `<section class="reveal"><div class="empty">该类型暂无记录</div></section>`;
  return toggle + dates.map(d=>{
    const {fit, prac, snack} = byDate[d];
    const es = (fit||[]).sort((a,b)=>a.createdAt-b.createdAt);
    const ps = (prac||[]).sort((a,b)=>a.createdAt-b.createdAt);
    const ss = (snack||[]).sort((a,b)=>a.createdAt-b.createdAt);
    const vk = es.reduce((s,e)=>s+vol(e),0);
    const sets = es.reduce((s,e)=>s+totalSets(e),0);
    const reps = es.reduce((s,e)=>s+totalReps(e),0);
    const pmin = ps.reduce((s,p)=>s+(+p.minutes||0),0);
    const skj = ss.reduce((s,x)=>s+(+x.kj||0),0);
    const skcal = kjToKcal(skj);
    const fitStr = es.length ? `${es.length} 器械 · ${sets} 组 · ${reps} 次${vk>0?` · ${fmtNum(vk)} kg`:''}` : '';
    const pracStr = ps.length ? `练习 ${pmin} 分` : '';
    const snackStr = ss.length ? `热量 ${fmtNum(skcal)} kcal` : '';
    const parts = [];
    if(es.length) parts.push(es.map(entryRow).join(''));
    if(ps.length) parts.push(`<div class="day-divider">练习</div>${ps.map(practiceRow).join('')}`);
    if(ss.length) parts.push(`<div class="day-divider">热量</div>${ss.map(s=>snackRow(s)).join('')}`);
    return `<section class="reveal">
      <div class="day-head sm"><div>
        <div class="day-date">${fmtShort(d)}<span class="wd">${weekdayStr(d)}</span></div>
        <div class="day-sub">${[fitStr, pracStr, snackStr].filter(Boolean).join(' · ')}</div>
      </div></div>
      <div class="entry-list">${parts.join('')}</div>
    </section>`;
  }).join('');
}

/* ---------- fitness editor modal ---------- */
function defaultRow(q, dirty){
  // 单组默认值:沿用上一次最后一组的次数/重量;dirty 标记本行是否已被用户确认/编辑
  if(q.lastSets && q.lastSets.length){
    const last = q.lastSets[q.lastSets.length-1];
    return {reps:last.reps, weight:last.weight, dirty};
  }
  return {reps:12, weight: q.mode==='bodyweight' ? null : 30, dirty};
}
function defaultRows(q){
  // 新建时默认 1 组(连续录入模式);选器械即视为确认这一组 -> dirty:true
  return [defaultRow(q, true)];
}
function openEditorNew(){ state.editor = {mode:'new', equipmentId:null, date:todayStr(), eqMode:'weighted', rows:null}; state.practiceEditor=null; state.snackEditor=null; renderModal(); }
function openEditorEdit(id){
  const e = DB.entries.find(x=>x.id===id); if(!e) return;
  state.editor = {mode:'edit', entryId:id, equipmentId:e.equipmentId, date:e.date, eqMode:e.mode, rows:e.sets.map(s=>({reps:s.reps, weight:s.weight}))};
  state.practiceEditor=null; state.snackEditor=null;
  renderModal();
}
function closeEditor(){
  // 连续录入中关闭:只自动保存用户编辑过(dirty)的有效组,不保存重置出的待填默认行
  const ed = state.editor;
  if(ed && ed.inflight){
    const sets = ed.rows.filter(r=>r.dirty && (+r.reps||0)>0).map(r=>({ reps:Math.round(+r.reps||0), weight: ed.eqMode==='bodyweight' ? null : (+r.weight||0) }));
    if(sets.length){
      const q = eq(ed.equipmentId); const mode = q?.mode || ed.eqMode;
      const entry = DB.entries.find(x=>x.id===ed.entryId);
      if(entry){
        const dateEl = document.getElementById('ed-date'); if(dateEl) ed.date=dateEl.value;
        entry.sets.push(...sets); entry.date=ed.date; entry.mode=mode;
        if(q) q.lastSets = entry.sets.map(s=>({reps:s.reps,weight:s.weight}));
        save();
      }
    }
  }
  state.editor = null; state.practiceEditor = null; state.snackEditor = null;
  const m = document.getElementById('modal'); if(m){ m.innerHTML=''; m.classList.remove('open'); }
}

function setStepper(field, i, val, unit){
  return `<div class="set-step">
    <button class="ss-btn" data-act="rstep" data-field="${field}" data-i="${i}" data-delta="-1">−</button>
    <input class="set-val" id="r-${field}-${i}" type="number" inputmode="decimal" value="${val}" data-field="${field}" data-i="${i}">
    <span class="ss-unit">${unit}</span>
    <button class="ss-btn" data-act="rstep" data-field="${field}" data-i="${i}" data-delta="1">+</button>
  </div>`;
}
function updatePreview(){
  const ed = state.editor; if(!ed) return;
  const p = document.getElementById('ed-preview'); if(!p || !ed.rows) return;
  const done = ed.rows.filter(r=>r.reps>0);
  const sets = done.length;
  const reps = done.reduce((s,r)=>s+(+r.reps||0),0);
  if(ed.eqMode==='bodyweight'){
    p.innerHTML = `${sets} <span>组</span> · ${reps} <span>次</span>`;
  } else {
    const kg = done.reduce((s,r)=>s+(+r.reps||0)*(+r.weight||0),0);
    p.innerHTML = `${sets} <span>组</span> · ${reps} <span>次</span> · <b>${fmtNum(kg)} kg</b>`;
  }
}
function renderSets(){
  const ed = state.editor; const cont = document.getElementById('sets-list');
  if(!cont || !ed || !ed.rows){ if(cont) cont.innerHTML=''; return; }
  cont.innerHTML = ed.rows.map((r,i)=>`
    <div class="set-row">
      <div class="set-no">${i+1}</div>
      ${setStepper('reps', i, r.reps, '次')}
      ${ed.eqMode==='bodyweight' ? '' : setStepper('weight', i, r.weight, 'kg')}
      <button class="set-del" data-act="del-set" data-i="${i}" title="删除本组">✕</button>
    </div>`).join('');
  updatePreview();
}
function rowStep(i, field, delta){
  const r = state.editor.rows[i]; if(!r) return;
  if(field==='reps') r.reps = Math.max(0, (+r.reps||0) + delta);
  else r.weight = Math.max(0, Math.round(((+r.weight||0) + delta*2.5)*10)/10);
  r.dirty = true;
  const el = document.getElementById(`r-${field}-${i}`); if(el) el.value = r[field];
  updatePreview();
}
function addSet(){
  const ed = state.editor; const last = ed.rows[ed.rows.length-1];
  ed.rows.push({ reps:12, weight: ed.eqMode==='bodyweight' ? null : (last?.weight ?? 30), dirty:false });
  renderSets();
}
function delSet(i){ state.editor.rows.splice(i,1); renderSets(); }

function renderModal(){
  const ed = state.editor; const wrap = document.getElementById('modal');
  if(!ed){ wrap.innerHTML=''; wrap.classList.remove('open'); return; }
  const q = ed.equipmentId ? eq(ed.equipmentId) : null;
  let body;
  if(ed.mode==='new' && !q){
    const list = DB.equipment.length ? DB.equipment.map(e=>`
      <button class="pick-item" data-act="pick-eq" data-id="${e.id}" data-name="${esc(e.name)}">
        <span class="pick-name">${esc(e.name)} ${e.mode==='bodyweight'?'<span class="tag" style="--c:#9aa0a6">自重</span>':''}</span>
        <span class="pick-last">${e.lastSets?.length?`上次 ${e.lastSets.length} 组`:'未使用'}</span>
      </button>`).join('')
      : `<div class="empty-mini">还没有器械。先去 <a data-act="open-settings">器械库</a> 添加。</div>`;
    body = `<div class="modal-head"><span>选择器械</span><button class="x" data-act="close">×</button></div>
      <div class="modal-body"><input class="search" data-act="search-eq" placeholder="搜索器械…" autocomplete="off">
      <div class="pick-list">${list}</div></div>`;
  } else {
    const inflight = ed.inflight;
    const isHistEdit = ed.mode==='edit' && !inflight;
    let banner = '';
    if(inflight){
      const entry = DB.entries.find(x=>x.id===ed.entryId);
      const savedSets = entry?.sets?.length || 0;
      const savedReps = entry ? entry.sets.reduce((s,r)=>s+(+r.reps||0),0) : 0;
      const savedKg = entry && ed.eqMode!=='bodyweight' ? entry.sets.reduce((s,r)=>s+(+r.reps||0)*(+r.weight||0),0) : 0;
      banner = `<div class="inflight-banner">✓ 已记 ${savedSets} 组${ed.eqMode==='bodyweight'?` · ${savedReps} 次`:` · ${savedReps} 次 · ${fmtNum(savedKg)} kg`}</div>`;
    }
    const fieldLbl = inflight ? '本组数据' : '训练组数据(可添加多组一次保存)';
    const actions = inflight
      ? `<button class="btn danger sm" data-act="del-in-editor">删除</button>
         <button class="btn ghost" data-act="finish-inflight">完成</button>
         <button class="btn primary" data-act="save-set">保存本组</button>`
      : isHistEdit
        ? `<button class="btn danger" data-act="del-in-editor">删除</button>
           <button class="btn primary" data-act="save">保存</button>`
        : `<button class="btn primary" data-act="save-set">保存本组</button>`;
    body = `<div class="modal-head"><span>${isHistEdit?'编辑记录':'记录训练'}</span><button class="x" data-act="close">×</button></div>
      <div class="modal-body">
        <div class="ed-eq"><div>
          <div class="ed-eq-name">${esc(q?.name||'?')} <span class="tag" style="--c:${groupColor(q?.muscle||'其他')}">${esc(q?.muscle||'其他')}</span> ${ed.eqMode==='bodyweight'?'<span class="tag" style="--c:#9aa0a6">自重</span>':''}</div>
        </div>${ed.mode==='new' || inflight ?`<button class="link" data-act="reset-eq">更换</button>`:''}</div>
        <label class="field"><span>日期</span><input type="date" id="ed-date" value="${ed.date}"></label>
        <div class="field-label">${fieldLbl}</div>
        <div class="sets" id="sets-list"></div>
        <button class="btn ghost sm add-set" data-act="add-set">+ 添加一组</button>
        <div class="preview" id="ed-preview"></div>
        ${banner}
        <div class="modal-actions">${actions}</div>
      </div>`;
  }
  wrap.innerHTML = `<div class="sheet">${body}</div>`;
  wrap.classList.add('open');
  renderSets();
}
function currentValidSets(ed){
  return ed.rows.filter(r=>(+r.reps||0)>0).map(r=>({ reps:Math.round(+r.reps||0), weight: ed.eqMode==='bodyweight' ? null : (+r.weight||0) }));
}
function saveEditor(){
  // 仅用于历史 entry 的整存整取编辑
  const ed = state.editor; if(!ed || !ed.equipmentId) return;
  const dateEl = document.getElementById('ed-date'); if(dateEl) ed.date = dateEl.value;
  const sets = currentValidSets(ed);
  if(!sets.length){ toast('请至少完成一组(次数大于 0)'); return; }
  const q = eq(ed.equipmentId); const mode = q?.mode || ed.eqMode;
  const e = DB.entries.find(x=>x.id===ed.entryId); if(e){ e.date=ed.date; e.sets=sets; e.mode=mode; if(q) q.lastSets=sets.map(s=>({reps:s.reps,weight:s.weight})); }
  save(); closeEditor(); render(); toast('已保存');
}
function saveSet(){
  // 连续录入:把当前 rows 追加到 in-flight entry(首次则创建),然后重置为 1 行
  const ed = state.editor; if(!ed || !ed.equipmentId) return;
  const dateEl = document.getElementById('ed-date'); if(dateEl) ed.date = dateEl.value;
  const sets = currentValidSets(ed);
  if(!sets.length){ toast('请输入次数(大于 0)'); return; }
  const q = eq(ed.equipmentId); const mode = q?.mode || ed.eqMode;
  let entry;
  if(ed.mode==='new' && !ed.entryId){
    entry = { id:uid(), date:ed.date, equipmentId:ed.equipmentId, mode, sets:[], createdAt:Date.now() };
    DB.entries.push(entry);
    ed.entryId = entry.id; ed.mode='edit'; ed.inflight = true;
  } else {
    entry = DB.entries.find(x=>x.id===ed.entryId);
  }
  if(entry){ entry.sets.push(...sets); entry.date=ed.date; entry.mode=mode; if(q) q.lastSets = entry.sets.map(s=>({reps:s.reps,weight:s.weight})); }
  save();
  // 重置为 1 行,沿用上一组重量(标记 dirty:false,完成/关闭时不当作有效组重复保存)
  ed.rows = [defaultRow(q || {mode:ed.eqMode, lastSets:sets.map(s=>({reps:s.reps,weight:s.weight}))}, false)];
  renderModal();
}
function finishInflight(){
  const ed = state.editor; if(!ed) return;
  // 只在当前行被编辑过(dirty)且有效时保存,避免把重置出的待填默认行存进去
  const cur = ed.rows[ed.rows.length-1];
  if(cur && cur.dirty && (+cur.reps||0)>0){ saveSet(); }
  closeEditor(); render();
}

/* ---------- practice editor modal ---------- */
function openPracticeNew(){ state.practiceEditor={mode:'new', date:todayStr(), minutes:30, note:''}; state.editor=null; state.snackEditor=null; renderPracticeModal(); }
function openPracticeEdit(id){
  const p = DB.practice.find(x=>x.id===id); if(!p) return;
  state.practiceEditor={mode:'edit', id, date:p.date, minutes:p.minutes, note:p.note||''};
  state.editor=null; state.snackEditor=null;
  renderPracticeModal();
}
function renderPracticeModal(){
  const ed=state.practiceEditor; const wrap=document.getElementById('modal');
  if(!ed){ wrap.innerHTML=''; wrap.classList.remove('open'); return; }
  wrap.innerHTML=`<div class="sheet">
    <div class="modal-head"><span>${ed.mode==='edit'?'编辑练习':'记录练习'}</span><button class="x" data-act="close">×</button></div>
    <div class="modal-body">
      <label class="field"><span>日期</span><input type="date" id="p-date" value="${ed.date}"></label>
      <div class="field-label">练习时长(分钟)</div>
      <div class="min-step">
        <button class="ss-btn" data-act="pstep" data-delta="-5">−</button>
        <input class="set-val" id="p-minutes" type="number" inputmode="numeric" value="${ed.minutes}">
        <span class="ss-unit">分钟</span>
        <button class="ss-btn" data-act="pstep" data-delta="5">+</button>
      </div>
      <label class="field" style="margin-top:14px"><span>备注</span><input type="text" id="p-note" value="${esc(ed.note)}" placeholder="可选,如 和弦练习"></label>
      <div class="modal-actions">
        ${ed.mode==='edit'?`<button class="btn danger" data-act="del-practice-modal">删除</button>`:''}
        <button class="btn primary" data-act="save-practice">保存</button>
      </div>
    </div>
  </div>`;
  wrap.classList.add('open');
}
function savePractice(){
  const ed=state.practiceEditor; if(!ed) return;
  const dateEl=document.getElementById('p-date'); if(dateEl) ed.date=dateEl.value;
  const noteEl=document.getElementById('p-note'); if(noteEl) ed.note=noteEl.value.trim();
  const minutes=parseInt(ed.minutes)||0;
  if(minutes<=0){ toast('请输入大于 0 的时长'); return; }
  if(ed.mode==='new'){
    DB.practice.push({ id:uid(), date:ed.date, minutes, note:ed.note, createdAt:Date.now() });
  } else {
    const p=DB.practice.find(x=>x.id===ed.id); if(p){ p.date=ed.date; p.minutes=minutes; p.note=ed.note; }
  }
  save(); closeEditor(); render(); toast('已保存');
}
function deletePractice(id, closeModal){
  if(!confirm('删除这条练习记录?')) return;
  DB.practice=DB.practice.filter(p=>p.id!==id);
  save(); if(closeModal) closeEditor(); render();
}

/* ---------- snack editor modal ---------- */
function openSnackNew(){ state.snackEditor={mode:'new', date:todayStr(), name:'', kj:800, note:''}; state.editor=null; state.practiceEditor=null; renderSnackModal(); }
function openSnackEdit(id){
  const s = DB.snacks.find(x=>x.id===id); if(!s) return;
  state.snackEditor={mode:'edit', id, date:s.date, name:s.name, kj:s.kj, note:s.note||''};
  state.editor=null; state.practiceEditor=null;
  renderSnackModal();
}
function updateSnackPreview(){
  const ed=state.snackEditor; const p=document.getElementById('s-preview');
  if(ed && p) p.textContent = `≈${kjToKcal(ed.kj)} kcal`;
}
function renderSnackModal(){
  const ed=state.snackEditor; const wrap=document.getElementById('modal');
  if(!ed){ wrap.innerHTML=''; wrap.classList.remove('open'); return; }
  wrap.innerHTML=`<div class="sheet">
    <div class="modal-head"><span>${ed.mode==='edit'?'编辑热量':'记录热量'}</span><button class="x" data-act="close">×</button></div>
    <div class="modal-body">
      <label class="field"><span>日期</span><input type="date" id="s-date" value="${ed.date}"></label>
      <label class="field" style="margin-top:14px"><span>名称</span><input type="text" id="s-name" value="${esc(ed.name)}" placeholder="如 薯片 / 辣条 / 奶茶"></label>
      <div class="field-label">热量 (kJ)</div>
      <div class="min-step">
        <button class="ss-btn" data-act="sstep" data-delta="-10">−</button>
        <input class="set-val" id="s-kj" type="number" inputmode="numeric" value="${ed.kj}">
        <span class="ss-unit">kJ</span>
        <button class="ss-btn" data-act="sstep" data-delta="10">+</button>
      </div>
      <div class="preview" id="s-preview">≈${Math.round((+ed.kj||0)/4.184)} kcal</div>
      <label class="field" style="margin-top:14px"><span>备注</span><input type="text" id="s-note" value="${esc(ed.note)}" placeholder="可选"></label>
      <div class="modal-actions">
        ${ed.mode==='edit'?`<button class="btn danger" data-act="del-snack-modal">删除</button>`:''}
        <button class="btn primary" data-act="save-snack">保存</button>
      </div>
    </div>
  </div>`;
  wrap.classList.add('open');
}
function saveSnack(){
  const ed=state.snackEditor; if(!ed) return;
  const dateEl=document.getElementById('s-date'); if(dateEl) ed.date=dateEl.value;
  const nameEl=document.getElementById('s-name'); if(nameEl) ed.name=nameEl.value.trim();
  const noteEl=document.getElementById('s-note'); if(noteEl) ed.note=noteEl.value.trim();
  const kj=parseInt(ed.kj)||0;
  if(!ed.name){ toast('请输入食物名称'); return; }
  if(kj<=0){ toast('请输入大于 0 的热量'); return; }
  if(ed.mode==='new'){
    DB.snacks.push({ id:uid(), date:ed.date, name:ed.name, kj, note:ed.note, createdAt:Date.now() });
  } else {
    const s=DB.snacks.find(x=>x.id===ed.id); if(s){ s.date=ed.date; s.name=ed.name; s.kj=kj; s.note=ed.note; }
  }
  save(); closeEditor(); render(); toast('已保存');
}
function deleteSnack(id, closeModal){
  if(!confirm('删除这条热量记录?')) return;
  DB.snacks=DB.snacks.filter(s=>s.id!==id);
  save(); if(closeModal) closeEditor(); render();
}

/* ---------- library actions ---------- */
function addEquipment(){
  const name = document.getElementById('new-eq-name').value.trim();
  if(!name){ toast('请输入器械名称'); return; }
  DB.equipment.push({ id:uid(), name, muscle:state.newEq.muscle, mode:state.newEq.mode, lastSets:null });
  save(); render();
}
function saveEquipmentEdit(id){
  const name = document.getElementById(`edit-name-${id}`).value.trim();
  const v = state.libEditVals || {};
  const e = eq(id); if(e && name){ e.name=name; e.muscle=v.muscle||e.muscle; e.mode=v.mode||e.mode; }
  state.libEdit = null; state.libEditVals=null; save(); render();
}
function deleteEquipment(id){
  const count = DB.entries.filter(e=>e.equipmentId===id).length;
  if(count && !confirm(`该器械有 ${count} 条训练记录,确定连同记录一起删除?`)) return;
  if(!count && !confirm('删除这个器械?')) return;
  DB.equipment = DB.equipment.filter(e=>e.id!==id);
  if(count) DB.entries = DB.entries.filter(e=>e.equipmentId!==id);
  save(); render();
}
function loadSamples(){
  SAMPLE.forEach(s=>DB.equipment.push({ id:uid(), name:s.name, muscle:s.muscle, mode:s.mode, lastSets:null }));
  save(); render(); toast('已载入示例器械');
}

/* ---------- data menu ---------- */
function exportData(){
  const json = JSON.stringify(DB,null,2);
  const fname = `lifelog-${todayStr()}.json`;
  /* Android WebView (Capacitor): use Web Share API */
  if(window.Capacitor && navigator.canShare && navigator.canShare({files:[new File([new Blob([json],{type:'application/json'})],fname)]})){
    const file = new File([new Blob([json],{type:'application/json'})], fname);
    navigator.share({files:[file],title:'LIFELOG 备份'}).catch(()=>{});
    return;
  }
  /* Desktop / browser fallback: <a download> click */
  const blob = new Blob([json], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = fname;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(a.href);
}
function importData(e){
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    try { const d = JSON.parse(r.result); if(!Array.isArray(d.equipment)||!Array.isArray(d.entries)) throw 0; DB = d; migrate(); save(); render(); toast('导入成功'); }
    catch { toast('导入失败:文件格式错误'); }
  };
  r.readAsText(f); e.target.value='';
}

/* ---------- toast ---------- */
function toast(msg){
  const t = document.createElement('div'); t.className='toast'; t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.classList.add('show'),10);
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),300); }, 1800);
}

/* ---------- events ---------- */
function onDocClick(e){
  /* if tapping a swiped-open row, just close it */
  if(swipedEl){
    const sw = e.target.closest('.entry-swipe');
    if(sw === swipedEl){ closeSwipe(); e.stopPropagation(); return; }
    closeSwipe();
  }
  const t = e.target.closest('[data-act]');
  if(!t){
    if(e.target.closest('.sheet')) return;
    if(e.target.id==='modal') closeEditor();
    return;
  }
  const a = t.dataset.act;
  switch(a){
    case 'tab': state.tab=t.dataset.tab; state.settingsOpen=false; render(); break;
    case 'open-settings': state.settingsOpen=true; closeEditor(); render(); break;
    case 'close-settings': state.settingsOpen=false; state.libEdit=null; state.libEditVals=null; render(); break;
    case 'new': openEditorNew(); break;
    case 'edit': openEditorEdit(t.dataset.id); break;
    case 'del-entry': if(confirm('删除这条记录?')){ DB.entries=DB.entries.filter(x=>x.id!==t.dataset.id); save(); render(); } break;
    case 'pick-eq': { const q=eq(t.dataset.id); if(q){ state.editor.equipmentId=t.dataset.id; state.editor.eqMode=q.mode||'weighted'; state.editor.rows=defaultRows(q); renderModal(); } } break;
    case 'reset-eq': state.editor.equipmentId=null; state.editor.rows=null; renderModal(); break;
    case 'rstep': rowStep(+t.dataset.i, t.dataset.field, parseInt(t.dataset.delta)); break;
    case 'add-set': addSet(); break;
    case 'del-set': delSet(+t.dataset.i); break;
    case 'save': saveEditor(); break;
    case 'save-set': saveSet(); break;
    case 'finish-inflight': finishInflight(); break;
    case 'del-in-editor': {
      const ed=state.editor;
      if(confirm(ed.inflight?'放弃当前训练(删除所有已记组)?':'删除这条记录?')){
        if(ed.entryId) DB.entries=DB.entries.filter(x=>x.id!==ed.entryId);
        save(); state.editor=null; closeEditor(); render();
      }
      break;
    }
    case 'new-practice': openPracticeNew(); break;
    case 'edit-practice': openPracticeEdit(t.dataset.id); break;
    case 'del-practice': deletePractice(t.dataset.id, false); break;
    case 'del-practice-modal': deletePractice(state.practiceEditor.id, true); break;
    case 'pstep': { const ed=state.practiceEditor; if(ed){ ed.minutes=Math.max(0,(+ed.minutes||0)+parseInt(t.dataset.delta)); const el=document.getElementById('p-minutes'); if(el) el.value=ed.minutes; } } break;
    case 'save-practice': savePractice(); break;
    case 'new-snack': openSnackNew(); break;
    case 'edit-snack': openSnackEdit(t.dataset.id); break;
    case 'del-snack': deleteSnack(t.dataset.id, false); break;
    case 'del-snack-modal': deleteSnack(state.snackEditor.id, true); break;
    case 'sstep': { const ed=state.snackEditor; if(ed){ ed.kj=Math.max(0,Math.round(((+ed.kj||0)+parseInt(t.dataset.delta))/10)*10); const el=document.getElementById('s-kj'); if(el) el.value=ed.kj; updateSnackPreview(); } } break;
    case 'save-snack': saveSnack(); break;
    case 'rpt-view': state.reportsView=t.dataset.v; render(); break;
    case 'close': closeEditor(); break;
    case 'add-eq': addEquipment(); break;
    case 'edit-eq': { const e=eq(t.dataset.id); if(e){ state.libEdit=t.dataset.id; state.libEditVals={muscle:e.muscle, mode:e.mode}; } render(); } break;
    case 'cancel-eq': state.libEdit=null; state.libEditVals=null; render(); break;
    case 'save-eq': saveEquipmentEdit(t.dataset.id); break;
    case 'new-muscle': state.newEq.muscle=t.dataset.m; t.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on', c===t)); break;
    case 'new-mode': state.newEq.mode=t.dataset.m; t.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on', c===t)); break;
    case 'edit-muscle': if(state.libEditVals)state.libEditVals.muscle=t.dataset.m; t.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on', c===t)); break;
    case 'edit-mode': if(state.libEditVals)state.libEditVals.mode=t.dataset.m; t.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on', c===t)); break;
    case 'del-eq': deleteEquipment(t.dataset.id); break;
    case 'load-samples': loadSamples(); break;
    case 'range': state.range.kind=t.dataset.r; if(t.dataset.r==='custom' && !state.range.from){ state.range.from=todayStr(); state.range.to=todayStr(); } render(); break;
    case 'hist-view': state.historyView=t.dataset.v; render(); break;
    case 'heat': { const cap=document.getElementById('heat-cap'); if(cap) cap.textContent=t.dataset.info; } break;
    case 'export': exportData(); break;
    case 'import': document.getElementById('import-file').click(); break;
    case 'clear': if(confirm('清空所有数据?此操作不可恢复。')){ DB={equipment:[],entries:[],practice:[],snacks:[]}; save(); render(); } break;
    case 'toggle-settings': state.settingsExpand[t.dataset.key]=!state.settingsExpand[t.dataset.key]; render(); break;
  }
}
function onDocInput(e){
  const pm = e.target.closest('#p-minutes');
  if(pm && state.practiceEditor){ state.practiceEditor.minutes = parseInt(pm.value)||0; return; }
  const sk = e.target.closest('#s-kj');
  if(sk && state.snackEditor){ state.snackEditor.kj = parseInt(sk.value)||0; updateSnackPreview(); return; }
  const sv = e.target.closest('.set-val');
  if(sv){ const i=+sv.dataset.i, f=sv.dataset.field; const v=parseFloat(sv.value); const r=state.editor?.rows?.[i]; if(r && !isNaN(v)){ r[f]=v; r.dirty=true; updatePreview(); } return; }
  const s = e.target.closest('[data-act="search-eq"]');
  if(s){ const q=s.value.trim().toLowerCase(); document.querySelectorAll('#modal .pick-item').forEach(it=>{ it.style.display = it.dataset.name.toLowerCase().includes(q)?'':'none'; }); }
}
function onDocChange(e){
  const d = e.target.closest('#ed-date'); if(d && state.editor){ state.editor.date = d.value; return; }
  const sd = e.target.closest('#s-date'); if(sd && state.snackEditor){ state.snackEditor.date = sd.value; return; }
  const rf = e.target.closest('#r-from'); if(rf){ state.range.from=rf.value; render(); return; }
  const rt = e.target.closest('#r-to'); if(rt){ state.range.to=rt.value; render(); return; }
}

document.addEventListener('click', onDocClick);
document.addEventListener('input', onDocInput);
document.addEventListener('change', onDocChange);
document.getElementById('import-file').addEventListener('change', importData);
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && (state.editor||state.practiceEditor||state.snackEditor)) closeEditor(); });

/* ---------- swipe-to-delete ---------- */
let swipedEl = null;
let swipeStartX = 0, swipeStartY = 0, swipeEntry = null, swipeMoved = false;
const SWIPE_W = 70;

function closeSwipe(){
  if(swipedEl){ swipedEl.querySelector('.entry').style.transform=''; swipedEl=null; }
}
document.addEventListener('touchstart', e=>{
  const sw = e.target.closest('.entry-swipe');
  if(!sw) { closeSwipe(); return; }
  closeSwipe();
  swipeStartX = e.touches[0].clientX;
  swipeStartY = e.touches[0].clientY;
  swipeEntry = sw.querySelector('.entry');
  swipeMoved = false;
}, {passive:true});
document.addEventListener('touchmove', e=>{
  if(!swipeEntry) return;
  const dx = e.touches[0].clientX - swipeStartX;
  const dy = e.touches[0].clientY - swipeStartY;
  if(Math.abs(dy) > Math.abs(dx)) { swipeEntry=null; return; }
  if(dx < 0){
    swipeMoved = true;
    swipeEntry.style.transition='none';
    swipeEntry.style.transform=`translateX(${Math.max(dx,-SWIPE_W)}px)`;
  }
}, {passive:true});
document.addEventListener('touchend', e=>{
  if(!swipeEntry) return;
  swipeEntry.style.transition='';
  const dx = e.changedTouches[0].clientX - swipeStartX;
  if(dx < -SWIPE_W/2){
    swipeEntry.style.transform=`translateX(-${SWIPE_W}px)`;
    swipedEl = swipeEntry.closest('.entry-swipe');
  } else {
    swipeEntry.style.transform='';
  }
  swipeEntry=null;
});

render();
