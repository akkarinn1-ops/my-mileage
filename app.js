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
function toISO(d){
  const y = d.getFullYear(), m = d.getMonth()+1, dd = d.getDate();
  return `${y}-${String(m).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
}
function fmt(n, unit=''){
  return (n==null || n==='') ? '' : `${Number(n).toLocaleString('ja-JP')}${unit}`;
}

// 指定日より前で最新のオドを返す
function prevOdo(dateStr, entries){
  const t = new Date(dateStr).getTime();
  const prevs = entries
    .filter(e => new Date(e.date).getTime() < t && isFinite(e.odo))
    .sort((a,b)=>new Date(b.date)-new Date(a.date));
  return prevs.length ? Number(prevs[0].odo) : null;
}

// すべての記録から「日付ごとの走行距離・オド」を集計
// dateStr -> { sumKm, cnt, lastOdo }
function buildDailyStats() {
  const all = load();
  const map = new Map();

  for (const e of all) {
    if (!e.date) continue;
    const key = e.date;
    const cur = map.get(key) || { sumKm: 0, cnt: 0, lastOdo: null };

    // その日の走行距離: 明示trip優先、なければオド差分
    let dayKm = 0;
    if (e.trip != null && e.trip !== '') {
      dayKm = Number(e.trip) || 0;
    }
    if (!dayKm && e.odo != null) {
      const p = prevOdo(e.date, all);
      if (p != null) dayKm = Math.max(0, Number(e.odo) - p);
    }

    cur.sumKm += dayKm;
    cur.cnt += 1;
    if (e.odo != null) cur.lastOdo = e.odo;

    map.set(key, cur);
  }

  return { map, all };
}

// ====== calendar render (月カレンダー) ======
function renderCalendar(){
  ym.textContent = `${viewY}年 ${viewM+1}月`;
  grid.innerHTML = '';

  const first = new Date(viewY, viewM, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(viewY, viewM+1, 0).getDate();
  const prevDays = new Date(viewY, viewM, 0).getDate();

  const { map } = buildDailyStats();

  let monthTotalKm = 0;

  const cells = [];
  for(let i=startDow-1;i>=0;i--){
    const d = prevDays-i;
    const dt = toISO(new Date(viewY, viewM-1, d));
    cells.push({d,dt,off:true});
  }
  for(let d=1; d<=daysInMonth; d++){
    const dt = toISO(new Date(viewY, viewM, d));
    cells.push({d,dt,off:false});
  }
  while(cells.length%7){
    const d = cells.length-(startDow+daysInMonth)+1;
    const dt = toISO(new Date(viewY, viewM+1, d));
    cells.push({d,dt,off:true});
  }

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
    `;
    div.onclick = ()=>{
      selectedDate = cell.dt;
      dateI.value = selectedDate;
      renderCalendar();
      renderList();
      renderHMonth();
    };
    grid.appendChild(div);
  }

  monthSum.textContent = `この月の合計: ${fmt(monthTotalKm,'km')}`;
}

// === 横スクロール「週ビュー」（週ごとに1列） ===
function renderHMonth() {
  const wrap = document.getElementById('hmonth');
  const title = document.getElementById('hmTitle');
  const hMonthSum = document.getElementById('hMonthSum');
  if (!wrap || !title) return;

  wrap.innerHTML = '';
  if (hMonthSum) hMonthSum.textContent = '';

  const y = viewY, m = viewM;
  title.textContent = `${y}年 ${m+1}月`;

  const first = new Date(y, m, 1);
  const lastDate = new Date(y, m+1, 0).getDate();

  const { map } = buildDailyStats();

  // この月の合計距離
  let monthTotalKm = 0;
  for (let d = 1; d <= lastDate; d++) {
    const dt = toISO(new Date(y, m, d));
    const st = map.get(dt);
    if (st) monthTotalKm += st.sumKm;
  }

  // 週の開始（日曜）を first からさかのぼって決定
  let weekStart = new Date(first);
  weekStart.setDate(first.getDate() - first.getDay());

  const dow = ['日', '月', '火', '水', '木', '金', '土'];

  while (true) {
    const col = document.createElement('div');
    const wsY = weekStart.getFullYear();
    const wsM = weekStart.getMonth() + 1;
    const wsD = weekStart.getDate();

    col.className = 'week-col';
    col.innerHTML = `
      <div class="whead">${wsM}/${wsD}週</div>
      <div class="days"></div>
    `;

    const daysBox = col.querySelector('.days');
    let weekTotalKm = 0;

    // 7日分
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const inMonth = (d.getMonth() === m);
      const dt = toISO(d);
      const st = map.get(dt);

      const sumKm = st ? st.sumKm : 0;
      const lastOdo = st ? st.lastOdo : null;

      if (inMonth && sumKm) weekTotalKm += sumKm;

      const cell = document.createElement('div');
      cell.className = 'daycell' + (inMonth ? '' : ' off') + (dt === selectedDate ? ' sel' : '');

      const tripTxt = sumKm ? `<div class="trip">＋${fmt(sumKm,'km')}</div>` : '';
      const odoTxt  = lastOdo != null ? `<div class="odo">${fmt(lastOdo,'km')}</div>` : '';

      cell.innerHTML = `
        <div class="d">${d.getDate()} (${dow[d.getDay()]})</div>
        ${tripTxt}
        ${odoTxt}
      `;
      cell.onclick = () => {
        selectedDate = dt;
        dateI.value = selectedDate;
        renderCalendar();
        renderList();
        renderHMonth();
      };
      daysBox.appendChild(cell);
    }

    // 週合計（週の一番下）
    const wTotal = document.createElement('div');
    wTotal.className = 'week-total';
    if (weekTotalKm) {
      wTotal.textContent = `週合計：＋${fmt(weekTotalKm,'km')}`;
    }
    daysBox.appendChild(wTotal);

    wrap.appendChild(col);

    // 次の週へ
    weekStart.setDate(weekStart.getDate() + 7);

    const nextIsAfter =
      (weekStart.getFullYear() > y) ||
      (weekStart.getFullYear() === y && weekStart.getMonth() > m) ||
      (weekStart.getFullYear() === y && weekStart.getMonth() === m && weekStart.getDate() > lastDate + 6);

    if (nextIsAfter) break;
  }

  if (hMonthSum) {
    hMonthSum.textContent = `この月の合計: ${fmt(monthTotalKm,'km')}`;
  }
}

// 週列ビューの左右ナビ
document.getElementById('hPrev')?.addEventListener('click', ()=>{
  if (viewM === 0){ viewM = 11; viewY--; } else viewM--;
  renderCalendar();
  renderHMonth();
});
document.getElementById('hNext')?.addEventListener('click', ()=>{
  if (viewM === 11){ viewM = 0; viewY++; } else viewM++;
  renderCalendar();
  renderHMonth();
});

// もともとの「横1列7日」表示も残す（お好みで使う用）
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
      renderCalendar();
      renderHCalendar();
      renderHMonth();
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
      renderCalendar();
      renderList();
      renderHMonth();
    };
  });
}
renderHCalendar();

function escapeHTML(s){
  return s.replace(/[&<>"']/g, m=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

// ====== actions ======
document.getElementById('prev').onclick = ()=>{
  if(viewM===0){viewM=11;viewY--;} else viewM--;
  renderCalendar();
  renderHMonth();
};
document.getElementById('next').onclick = ()=>{
  if(viewM===11){viewM=0;viewY++;} else viewM++;
  renderCalendar();
  renderHMonth();
};

document.getElementById('save').onclick = ()=>{
  const date = dateI.value || toISO(new Date());
  const odo  = (odoI.value===''? null : Number(odoI.value));
  const trip = (tripI.value===''? null : Number(tripI.value));
  if (odo==null && trip==null){
    alert('オドか区間距離のどちらかは入れてね');
    return;
  }
  const memo = memoI.value || '';
  const arr = load();
  arr.push({
    id: Date.now()+''+Math.random().toString(16).slice(2),
    date, odo, trip, memo,
    ts: Date.now()
  });
  saveAll(arr);
  memoI.value = '';
  selectedDate = date;
  renderCalendar();
  renderList();
  renderHMonth();
  renderHCalendar();
};

document.getElementById('export').onclick = ()=>{
  const blob = new Blob([JSON.stringify(load(), null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'my-mileage-export.json';
  a.click();
  URL.revokeObjectURL(url);
};

// ====== init ======
renderCalendar();
renderList();
renderHMonth();

// ====== PWA SW（任意） ======
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
