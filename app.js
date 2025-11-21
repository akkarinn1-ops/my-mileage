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
const dateI = document.getElementById('date');
const odoI = document.getElementById('odo');
const tripI = document.getElementById('trip');
const memoI = document.getElementById('memo');
const listEl = document.getElementById('list');
const selTitle = document.getElementById('selTitle');

// 初期日付
if (dateI) {
  dateI.value = selectedDate;
}

// ====== utils ======
function toISO(d) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const dd = d.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

function fmt(n, unit = '') {
  return (n == null || n === '') ? '' : `${Number(n).toLocaleString('ja-JP')}${unit}`;
}

// 指定日より前で最新のオドを返す
function prevOdo(dateStr, entries) {
  const t = new Date(dateStr).getTime();
  const prevs = entries
    .filter(e => e.date && new Date(e.date).getTime() < t && isFinite(e.odo))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  return prevs.length ? Number(prevs[0].odo) : null;
}

// 1レコードの「その日走った距離」を計算（区間優先・なければオド差分）
function calcEntryDistance(e, allEntries) {
  if (e.trip != null && e.trip !== '') {
    return Number(e.trip) || 0;
  }
  if (e.odo != null && e.odo !== '') {
    const p = prevOdo(e.date, allEntries);
    if (p != null) {
      return Math.max(0, Number(e.odo) - p);
    }
  }
  return 0;
}

// 指定月の「日単位集計」と「月合計」を作る
function buildMonthStats(year, monthIndex) {
  const all = load();
  const daily = new Map(); // dateStr -> { sumKm, lastOdo }

  for (const e of all) {
    if (!e.date) continue;
    const d = new Date(e.date);
    if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;

    const key = e.date;
    const cur = daily.get(key) || { sumKm: 0, lastOdo: null };

    const dayKm = calcEntryDistance(e, all);
    cur.sumKm += dayKm;
    if (e.odo != null && e.odo !== '') {
      cur.lastOdo = e.odo;
    }

    daily.set(key, cur);
  }

  let monthTotalKm = 0;
  for (const v of daily.values()) {
    monthTotalKm += v.sumKm;
  }

  return { daily, monthTotalKm };
}

// ====== 週列ビュー（月→週ごとに右へ1列ずつ） ======
function renderHMonth() {
  const wrap = document.getElementById('hmonth');
  const title = document.getElementById('hmTitle');
  const monthSumEl = document.getElementById('hMonthSum');
  if (!wrap || !title) return;

  wrap.innerHTML = '';
  if (monthSumEl) monthSumEl.textContent = '';

  const y = viewY;
  const m = viewM;
  title.textContent = `${y}年 ${m + 1}月`;

  const first = new Date(y, m, 1);
  const lastDate = new Date(y, m + 1, 0).getDate();

  const { daily, monthTotalKm } = buildMonthStats(y, m);

  const dow = ['日', '月', '火', '水', '木', '金', '土'];

  // 週の開始（日曜）にそろえる
  let weekStart = new Date(first);
  weekStart.setDate(first.getDate() - first.getDay());

  while (true) {
    const col = document.createElement('div');
    col.className = 'week-col';

    const wsM = weekStart.getMonth() + 1;
    const wsD = weekStart.getDate();

    col.innerHTML = `
      <div class="whead">${wsM}/${wsD}週</div>
      <div class="days"></div>
    `;
    const daysBox = col.querySelector('.days');

    let weekTotalKm = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const inMonth = (d.getMonth() === m);
      const dt = toISO(d);

      const st = daily.get(dt);
      const sumKm = st ? st.sumKm : 0;
      const lastOdo = st ? st.lastOdo : null;

      if (inMonth && sumKm) {
        weekTotalKm += sumKm;
      }

      const cell = document.createElement('div');
      cell.className = 'daycell' + (inMonth ? '' : ' off') + (dt === selectedDate ? ' sel' : '');

      const tripTxt = sumKm ? `<div class="trip">＋${fmt(sumKm, 'km')}</div>` : '';
      const odoTxt = (lastOdo != null)
        ? `<div class="odo">${fmt(lastOdo, 'km')}</div>`
        : '';

      cell.innerHTML = `
        <div class="d">${d.getDate()} (${dow[d.getDay()]})</div>
        ${tripTxt}
        ${odoTxt}
      `;
      cell.onclick = () => {
        selectedDate = dt;
        if (dateI) dateI.value = selectedDate;
        renderList();
        renderHMonth();
      };

      daysBox.appendChild(cell);
    }

    // 週合計
    const wTotal = document.createElement('div');
    wTotal.className = 'week-total';
    if (weekTotalKm) {
      wTotal.textContent = `週合計：＋${fmt(weekTotalKm, 'km')}`;
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

  if (monthSumEl) {
    monthSumEl.textContent = `この月の合計: ${fmt(monthTotalKm, 'km')}`;
  }
}

// ====== 選択日のリスト ======
function renderList() {
  const items = load().filter(e => e.date === selectedDate).sort((a, b) => b.ts - a.ts);
  if (selTitle) {
    selTitle.textContent = `${selectedDate} の記録（${items.length}件）`;
  }
  if (!listEl) return;

  listEl.innerHTML = '';
  for (const it of items) {
    const row = document.createElement('div');
    row.className = 'item';
    const tripTxt = it.trip ? ` / 区間 ${fmt(it.trip, 'km')}` : '';
    row.innerHTML = `
      <div class="left">
        <div>オド ${fmt(it.odo, 'km')}${tripTxt}</div>
        <div class="muted">${new Date(it.ts).toLocaleTimeString()} - ${it.memo ? escapeHTML(it.memo) : ''}</div>
      </div>
      <div class="right">
        <button data-id="${it.id}" class="del">削除</button>
      </div>
    `;
    listEl.appendChild(row);
  }

  listEl.querySelectorAll('.del').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const arr = load().filter(x => String(x.id) !== String(id));
      saveAll(arr);
      renderList();
      renderHMonth();
    };
  });
}

// ====== HTMLエスケープ ======
function escapeHTML(s) {
  return s.replace(/[&<>\"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

// ====== イベント ======

// 月送り（週ビュー用）
document.getElementById('hPrev')?.addEventListener('click', () => {
  if (viewM === 0) {
    viewM = 11;
    viewY--;
  } else {
    viewM--;
  }
  renderHMonth();
  renderList();
});

document.getElementById('hNext')?.addEventListener('click', () => {
  if (viewM === 11) {
    viewM = 0;
    viewY++;
  } else {
    viewM++;
  }
  renderHMonth();
  renderList();
});

// 保存
document.getElementById('save')?.addEventListener('click', () => {
  const date = dateI?.value || toISO(new Date());
  const odo = (odoI && odoI.value !== '') ? Number(odoI.value) : null;
  const trip = (tripI && tripI.value !== '') ? Number(tripI.value) : null;
  if (odo == null && trip == null) {
    alert('オドか区間距離のどちらかは入れてね');
    return;
  }
  const memo = memoI?.value || '';
  const arr = load();
  arr.push({
    id: Date.now() + '' + Math.random().toString(16).slice(2),
    date,
    odo,
    trip,
    memo,
    ts: Date.now()
  });
  saveAll(arr);
  if (memoI) memoI.value = '';
  selectedDate = date;
  if (dateI) dateI.value = selectedDate;
  renderList();
  renderHMonth();
});

// エクスポート
document.getElementById('export')?.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(load(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'my-mileage-export.json';
  a.click();
  URL.revokeObjectURL(url);
});

// ====== init ======
renderHMonth();
renderList();

// ====== PWA SW（任意） ======
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
