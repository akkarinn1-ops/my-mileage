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

// === 週列ビュー（月→週ごとに右へ1列ずつ） ===
function renderHMonth() {
  const wrap = document.getElementById('hmonth');
  const title = document.getElementById('hmTitle');
  if (!wrap || !title) return;

  wrap.innerHTML = '';

  const y = viewY, m = viewM; // 既存の月/年を共用
  title.textContent = `${y}年 ${m+1}月`;

  // 月の範囲
  const first = new Date(y, m, 1);
  const lastDate = new Date(y, m+1, 0).getDate();

  // その月の全レコードを日付→集計へ
  const entries = load().filter(e => {
    const d = new Date(e.date);
    return d.getFullYear() === y && d.getMonth() === m;
  });
  const map = new Map(); // dateStr -> {sum, cnt, odo?, trip?}
  for (const e of entries) {
    const key = e.date;
    const cur = map.get(key) || { sum:0, cnt:0, odo:null, trip:null };
    cur.sum += Number(e.amount || e.total || 0);
    cur.cnt += 1;
    if (e.odo != null) cur.odo = e.odo;
    if (e.trip != null) cur.trip = e.trip;
    map.set(key, cur);
  }

  // 週の開始（日曜）に揃えて weekStart を進めていく
  let weekStart = new Date(first);
  weekStart.setDate(first.getDate() - first.getDay()); // 前月分の埋めを含む

  while (true) {
    // この週の列を作成
    const col = document.createElement('div');
    col.className = 'week-col';
    const wsY = weekStart.getFullYear();
    const wsM = weekStart.getMonth()+1;
    const wsD = weekStart.getDate();

    col.innerHTML = `
      <div class="whead">${wsM}/${wsD}週</div>
      <div class="days"></div>
    `;
    const daysBox = col.querySelector('.days');

    // 7日分
    for (let i=0;i<7;i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate()+i);
      const inMonth = (d.getMonth() === m);
      const dt = toISO(d);
      const agg = map.get(dt);

      const cell = document.createElement('div');
      cell.className = 'daycell' + (inMonth ? '' : ' off') + (dt === selectedDate ? ' sel' : '');
      const odoTxt  = (agg && agg.odo != null)  ? `<div class="odo">${Number(agg.odo).toLocaleString()}km</div>` : '';
      const tripTxt = (agg && agg.trip != null) ? `<div class="trip">＋${agg.trip}km</div>` : '';
      cell.innerHTML = `
        <div class="d">${d.getDate()} (${['日','月','火','水','木','金','土'][d.getDay()]})</div>
        ${odoTxt}${tripTxt}
      `;
      cell.onclick = () => {
        selectedDate = dt;
        if (typeof dateI !== 'undefined' && dateI) dateI.value = selectedDate;
        renderCalendar();   // 既存の月カレンダーも同期
        if (typeof renderList === 'function') renderList?.();
        renderHMonth();     // 自分も選択枠を更新
      };
      daysBox.appendChild(cell);
    }

    wrap.appendChild(col);

    // 次の週へ
    weekStart.setDate(weekStart.getDate()+7);

    // 次の週の最初の日が今月を完全に過ぎたら終了
    const nextIsAfter = (weekStart.getMonth() > m && weekStart.getFullYear() === y)
                     || (weekStart.getFullYear() > y)
                     || (weekStart.getMonth() === m && weekStart.getDate() > lastDate + 6);
    if (nextIsAfter) break;
  }
}

// 週列ビューの左右ナビ
document.getElementById('hPrev')?.addEventListener('click', ()=>{
  if (viewM === 0){ viewM = 11; viewY--; } else viewM--;
  renderCalendar(); renderHMonth();
});
document.getElementById('hNext')?.addEventListener('click', ()=>{
  if (viewM === 11){ viewM = 0; viewY++; } else viewM++;
  renderCalendar(); renderHMonth();
});

function renderHCalendar() {
  const cont = document.getElementById('hcal');
  if (!cont) return;
  cont.innerHTML = '';

  const today = new Date();
  for (let i = -3; i <= 3; i++) {  // 今日を中心に前後3日
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = toISO(d);

    const entry = load().find(e => e.date === dateStr);
    const odo = entry?.odo;
    const trip = entry?.trip;

    const div = document.createElement('div');
    div.className = 'hcal-day';
    div.innerHTML = `
      <div class="d">${d.getDate()}日</div>
      ${odo ? `<div class="odo">${odo.toLocaleString()}km</div>` : ''}
      ${trip ? `<div class="trip">＋${trip}km</div>` : ''}
    `;
    div.onclick = () => {
      selectedDate = dateStr;
      dateI.value = selectedDate;
      renderList();
      renderCalendar();  // 月カレンダーも同期
      renderHCalendar(); // 横カレンダーも同期
    };
    cont.appendChild(div);
  }
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
renderHCalendar();

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
