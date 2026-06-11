const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRnQeNpiinQXa19q67YIsKqBKawpygHn_gp_VsW7lk6QOYOZVBR5KlEPxSvyqHmhMkzwfYQVlcXQ9L9/pub?gid=1660025948&single=true&output=csv";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw-gu_vG1mtHRn3v4w5FRuZcWSyMD2Ks5Gnj1mISzHBNxxdrf1dC9Xf3zjD596DyJbw/exec";
const STOPWORDS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRnQeNpiinQXa19q67YIsKqBKawpygHn_gp_VsW7lk6QOYOZVBR5KlEPxSvyqHmhMkzwfYQVlcXQ9L9/pub?gid=2029562547&single=true&output=csv";

const PRIORITY_CONFIG = {
  '긴급':        { bg: '#fef2f2', border: '#fca5a5', badge: '#ef4444' },
  '신규수급필요': { bg: '#fff7ed', border: '#fdba74', badge: '#f97316' },
  '필요':        { bg: '#fefce8', border: '#fde68a', badge: '#ca8a04' },
  '여유':        { bg: '#f0fdf4', border: '#86efac', badge: '#22c55e' },
};
const DEFAULT_CONFIG = { bg: '#f8fafc', border: '#e2e8f0', badge: '#64748b' };

let sortedKeywords = [];
let activeCards = [];
let nextIdx = 0;
let currentView = 'card';

function parseCSVLine(line) {
  const cols = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));

  return lines.slice(1).filter(l => l.trim()).map(l => {
    const c = parseCSVLine(l);
    return {
      rank: parseInt(c[idx['rank']]) || 0,
      keyword: (c[idx['keyword']] || '').trim(),
      predicted_growth_rate: parseFloat(c[idx['predicted_growth_rate']]) || 0,
      clip_count: parseInt(c[idx['clip_count']]) || 0,
      priority: (c[idx['priority']] || '').trim(),
      month: (c[idx['month']] || '').trim(),
    };
  }).filter(r => r.rank > 0 && r.keyword);
}

function getCurrentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtGrowth(v) {
  if (isNaN(v)) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
}

function fmtNum(v) {
  return Number(v).toLocaleString('ko-KR');
}

function makeCard(kw) {
  const c = PRIORITY_CONFIG[kw.priority] || DEFAULT_CONFIG;
  const gr = kw.predicted_growth_rate;
  const grCls = gr > 0 ? 'stat-up' : gr < 0 ? 'stat-down' : '';

  const el = document.createElement('div');
  el.className = 'keyword-card';
  el.dataset.rank = kw.rank;
  el.style.cssText = `border-color:${c.border};background:${c.bg}`;
  el.innerHTML = `
    <div class="card-top">
      <span class="rank">#${kw.rank}</span>
      <span class="priority-badge" style="background:${c.badge}">${kw.priority || '미분류'}</span>
    </div>
    <div class="keyword-name">${kw.keyword}</div>
    <div class="stats">
      <div class="stat">
        <span class="stat-label">예측 성장률</span>
        <span class="stat-value ${grCls}">${fmtGrowth(gr)}</span>
      </div>
      <div class="stat">
        <span class="stat-label">클립 수</span>
        <span class="stat-value">${fmtNum(kw.clip_count)}</span>
      </div>
    </div>
    <div class="card-actions">
      <div class="card-hint">클릭하여 제거</div>
      <button class="exclude-btn" onclick="excludeKeyword(event, '${kw.keyword}', ${kw.rank}, this.closest('.keyword-card'))">제외하기</button>
    </div>`;

  el.addEventListener('click', () => removeCard(kw.rank, el));
  return el;
}

function updateCounter() {
  const remaining = Math.max(0, Math.min(50, sortedKeywords.length) - nextIdx);
  const el = document.getElementById('counter');
  if (el) {
    el.textContent = remaining > 0
      ? `대기 키워드 ${remaining}개`
      : '모든 키워드 표시 완료';
  }
}

async function excludeFromList(keyword, rank) {
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ keyword }),
    });

    // sortedKeywords에서 제거
    sortedKeywords = sortedKeywords.filter(k => k.keyword !== keyword);

    // 카드에서도 제거
    const cardEl = document.querySelector(`.keyword-card[data-rank="${rank}"]`);
    if (cardEl) removeCard(rank, cardEl);

    // 목록 다시 렌더링
    renderListView();
  } catch (e) {
    alert('제외 처리 중 오류가 발생했어요.');
  }
}

async function excludeKeyword(event, keyword, rank, el) {
  event.stopPropagation();
  
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ keyword }),
    });
    alert('해당 키워드가 제외되었습니다.');

    // sortedKeywords에서 제거
    sortedKeywords = sortedKeywords.filter(k => k.keyword !== keyword);

    // 카드 제거
    removeCard(rank, el);

    // 목록 뷰도 업데이트
    if (currentView === 'list') renderListView();
  } catch (e) {
    alert('제외 처리 중 오류가 발생했어요.');
  }
}

function removeCard(rank, el) {
  if (el.dataset.removing) return;
  el.dataset.removing = '1';
  el.classList.add('card-out');

  setTimeout(() => {
    const i = activeCards.findIndex(k => k.rank === rank);
    if (i === -1) return;

    if (nextIdx < sortedKeywords.length && nextIdx < 50) {
      const next = sortedKeywords[nextIdx++];
      activeCards[i] = next;
      const newEl = makeCard(next);
      newEl.classList.add('card-in');
      el.replaceWith(newEl);
      requestAnimationFrame(() => requestAnimationFrame(() => newEl.classList.remove('card-in')));
    } else {
      activeCards.splice(i, 1);
      el.remove();
    }
    updateCounter();
  }, 280);
}

function switchView(view) {
  currentView = view;
  document.getElementById('calendarRoot').style.display = view === 'card' ? '' : 'none';
  document.getElementById('listRoot').style.display = view === 'list' ? '' : 'none';
  document.getElementById('btnCard').classList.toggle('active', view === 'card');
  document.getElementById('btnList').classList.toggle('active', view === 'list');

  if (view === 'list') renderListView();
}

function renderListView() {
  const root = document.getElementById('listRoot');
  root.innerHTML = '';

  const table = document.createElement('table');
  table.className = 'keyword-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>순위</th>
        <th>키워드</th>
        <th>우선순위</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');
  sortedKeywords.slice(0, 50).forEach(kw => {
    const c = PRIORITY_CONFIG[kw.priority] || DEFAULT_CONFIG;
    const tr = document.createElement('tr');
    tr.dataset.rank = kw.rank;
    tr.innerHTML = `
      <td class="td-rank">#${kw.rank}</td>
      <td class="td-keyword">${kw.keyword}</td>
      <td><span class="list-badge" style="background:${c.badge}">${kw.priority}</span></td>
    `;
    tr.addEventListener('click', () => excludeFromList(kw.keyword, kw.rank));
    tbody.appendChild(tr);
  });

  root.appendChild(table);
}

function renderGrid() {
  const grid = document.createElement('div');
  grid.className = 'grid';
  activeCards.forEach(kw => grid.appendChild(makeCard(kw)));

  const root = document.getElementById('calendarRoot');
  root.innerHTML = '';
  root.appendChild(grid);
}

async function init() {
  const root = document.getElementById('calendarRoot');
  root.innerHTML = `<div class="loading"><div class="spinner"></div><p>데이터를 불러오는 중...</p></div>`;

  let rows, stopwords;
  try {
    const [sheetRes, stopRes] = await Promise.all([
      fetch(SHEET_CSV_URL),
      fetch(STOPWORDS_CSV_URL),
    ]);
    if (!sheetRes.ok) throw new Error(`HTTP ${sheetRes.status}`);
    rows = parseCSV(await sheetRes.text());

    // stopwords 읽기 (keyword 컬럼 첫 번째)
    const stopText = await stopRes.text();
    stopwords = new Set(
      stopText.trim().split(/\r?\n/)
        .slice(1)  // 헤더 제외
        .map(l => l.trim())
        .filter(l => l)
    );
  } catch (e) {
    console.error('데이터 로드 실패:', e);
    root.innerHTML = `<div class="error-box">데이터를 불러오지 못했습니다.<br>Google Sheets URL 또는 네트워크를 확인하세요.</div>`;
    return;
  }

  const target = getCurrentMonthStr();
  sortedKeywords = rows
    .filter(r => r.month === target && !stopwords.has(r.keyword))
    .sort((a, b) => a.rank - b.rank);

    if (!sortedKeywords.length) {
      sortedKeywords = rows
          .filter(r => !stopwords.has(r.keyword))
          .sort((a, b) => a.rank - b.rank);
    }

  const [y, m] = target.split('-');
  document.getElementById('monthLabel').textContent = `${y}년 ${parseInt(m)}월 추천 키워드`;

  const displayKeywords = sortedKeywords.slice(0, 50);
  activeCards = displayKeywords.slice(0, 9);
  nextIdx = 9;
  updateCounter();
  renderGrid();
}

init();
