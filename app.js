// ====== storage ======
const KEY = 'mileage_entries_v1'; // [{id,date,odo,trip,memo,ts}]
const load = () => JSON.parse(localStorage.getItem(KEY) || '[]');
const saveAll = (a) => localStorage.setItem(KEY, JSON.stringify(a));

// ====== version ======
const VERSION = 'v2025.09.12-cal-01';
document.getElementById('ver').textContent = VERSION;

// ====== state ======
let today = new Date();
let viewY = today.getFullYear();
let viewM = today.getMonth(); // 0-11
let selectedDate = toISO(new Date());

// ====== dom ======
const grid = document.getElementById('grid');
const ym = document.getElementById('ym');
const monthSum = document.getElementById('monthSum');
const dateI = document.getElementById('date');
const odoI = document.getElementById('odo');
const tripI = document.getElementById('trip');
const memoI = document.getElementById('memo');
const listEl = document.getElementById('list');
const selTitle = document.getElementById('selTitle');

// 初期日付
dateI.value = selectedDate;

// ====== utils ======
function toISO(d){ const y=d.getFullYear(), m=d.getMonth()+1, dd=d.getDate(); return `${y}-${String(m).padStart(2,'0')}-${String(dd).padStart(2,'0')}`; }
function fmt(n, unit=''){ return (n==null || n==='') ? '' : `${Number(n).toLocaleString('ja-JP')}${unit}`; }

// 指定日より前で最新のオドを返す
function prevOdo(dateStr, entries){
  const t = new Date(dateStr).getTime();
  const prevs = entries.filter(e => new Date(e.date).getTime() < t && isFinite(e.odo)).sort((a,b)=>new Date(b.date)-new Date(a.date));
  return prevs.length ? Number(prevs[0].odo) : null;
}

// ====== calendar render ======
function renderCalendar(){
  ym.textContent = `${viewY}年 ${viewM+1}月`;
  grid.innerHTML = '';

  const first = new Date(viewY, viewM, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(viewY, viewM+1, 0).getDate();
  const prevDays = new Date(viewY, viewM, 0).getDate();

  const all = load();
  // 集計: 日付 -> {sumKm, cnt, lastOdo}
  const map = new Map();
  for(const e of all){
    const m = map.get(e.date) || {sumKm:0, cnt:0, lastOdo:null};
    // “その日の移動距離”は、(明示trip) or (odo差分) を採用
    let dayKm = 0;
    if (e.trip) dayKm = Number(e.trip)||0;
    if (!dayKm && e.odo!=null && e.date){
      const p = prevOdo(e.date, all);
      if (p!=null) dayKm = Math.max(0, Number(e.odo) - p);
    }
    m.sumKm += dayKm;
    m.cnt += 1;
    m.lastOdo = e.odo ?? m.lastOdo;
    map.set(e.date, m);
  }

  let monthTotalKm = 0;

  const cells = [];
  for(let i=startDow-1;i>=0;i--){ const d=prevDays-i; const dt=toISO(new Date(viewY, viewM-1, d)); cells.push({d,dt,off:true}); }
  for(let d=1; d<=daysInMonth; d++){ const dt=toISO(new Date(viewY, viewM, d)); cells.push({d,dt,off:false}); }
  while(cells.length%7){ const d=cells.length-(startDow+daysInMonth)+1; const dt=toISO(new Date(viewY, viewM+1, d)); cells.push({d,dt,off:true}); }

  for(const cell of cells){
    const div = document.createElement('div');
    div.className = 'day' + (cell.off?' off':'');
    if(cell.dt === selectedDate) div.classList.add('selected');

    const m = map.get(cell.dt);
    const sumKm = m ? m.sumKm : 0;
    const lastOdo = m ? m.lastOdo : null;
    if(!cell.off) monthTotalKm += sumKm;

    div.innerHTML = `
      <div class="d">${cell.d}</div>
      ${sumKm ? `<div class="sum">＋${fmt(sumKm,'km')}</div>`: ''}
      ${lastOdo!=null ? `<div class="odo">${fmt(lastOdo,'km')}</div>`: ''}
      ${m && m.cnt ? `<div class="cnt">${m.cnt}件</div>`: ''}
    `;
    div.onclick = ()=>{
      selectedDate = cell.dt;
      dateI.value = selectedDate;
      renderCalendar(); renderList();
    };
    grid.appendChild(div);
  }

  monthSum.textContent = `この月の合計: ${fmt(monthTotalKm,'km')}`;
}

// ====== list render ======
function renderList(){
  const items = load().filter(e=>e.date===selectedDate).sort((a,b)=>b.ts-a.ts);
  selTitle.textContent = `${selectedDate} の記録（${items.length}件）`;
  listEl.innerHTML = '';
  for(const it of items){
    const row = document.createElement('div');
    row.className = 'item';
    const tripTxt = it.trip ? ` / 区間 ${fmt(it.trip,'km')}` : '';
    row.innerHTML = `
      <div class="left">
        <div>オド ${fmt(it.odo,'km')}${tripTxt}</div>
        <div class="muted">${new Date(it.ts).toLocaleTimeString()} - ${it.memo?escapeHTML(it.memo):''}</div>
      </div>
      <div class="right">
        <button data-id="${it.id}" class="del">削除</button>
      </div>
    `;
    listEl.appendChild(row);
  }
  listEl.querySelectorAll('.del').forEach(btn=>{
    btn.onclick = ()=>{
      const id = btn.getAttribute('data-id');
      const arr = load().filter(x=> String(x.id)!==String(id));
      saveAll(arr);
      renderCalendar(); renderList();
    };
  });
}
function escapeHTML(s){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// ====== actions ======
document.getElementById('prev').onclick = ()=>{ if(viewM===0){viewM=11;viewY--;} else viewM--; renderCalendar(); };
document.getElementById('next').onclick = ()=>{ if(viewM===11){viewM=0;viewY++;} else viewM++; renderCalendar(); };

document.getElementById('save').onclick = ()=>{
  const date = dateI.value || toISO(new Date());
  const odo  = (odoI.value===''? null : Number(odoI.value));
  const trip = (tripI.value===''? null : Number(tripI.value));
  if (odo==null && trip==null){ alert('オドか区間距離のどちらかは入れてね'); return; }
  const memo = memoI.value || '';
  const arr = load();
  arr.push({ id: Date.now()+''+Math.random().toString(16).slice(2), date, odo, trip, memo, ts: Date.now() });
  saveAll(arr);
  memoI.value = ''; // 入力は適宜残したければ消さなくてもOK
  selectedDate = date;
  renderCalendar(); renderList();
};

document.getElementById('export').onclick = ()=>{
  const blob = new Blob([JSON.stringify(load(), null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'my-mileage-export.json'; a.click();
  URL.revokeObjectURL(url);
};

// ====== init ======
renderCalendar();
renderList();

// ====== PWA SW（任意） ======
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
