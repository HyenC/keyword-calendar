const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRnQeNpiinQXa19q67YIsKqBKawpygHn_gp_VsW7lk6QOYOZVBR5KlEPxSvyqHmhMkzwfYQVlcXQ9L9/pub?gid=1660025948&single=true&output=csv";

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
    <div class="card-hint">클릭하여 제거</div>`;

  el.addEventListener('click', () => removeCard(kw.rank, el));
  return el;
}

function updateCounter() {
  const remaining = Math.max(0, sortedKeywords.length - nextIdx);
  const el = document.getElementById('counter');
  if (el) {
    el.textContent = remaining > 0
      ? `대기 키워드 ${remaining}개`
      : '모든 키워드 표시 완료';
  }
}

function removeCard(rank, el) {
  if (el.dataset.removing) return;
  el.dataset.removing = '1';
  el.classList.add('card-out');

  setTimeout(() => {
    const i = activeCards.findIndex(k => k.rank === rank);
    if (i === -1) return;

    if (nextIdx < sortedKeywords.length) {
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

  let rows;
  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rows = parseCSV(await res.text());
  } catch (e) {
    console.error('데이터 로드 실패:', e);
    root.innerHTML = `<div class="error-box">데이터를 불러오지 못했습니다.<br>Google Sheets URL 또는 네트워크를 확인하세요.</div>`;
    return;
  }

  const target = getCurrentMonthStr();
  sortedKeywords = rows
    .filter(r => r.month === target)
    .sort((a, b) => a.rank - b.rank);

  if (!sortedKeywords.length) {
    sortedKeywords = [...rows].sort((a, b) => a.rank - b.rank);
  }

  const [y, m] = target.split('-');
  document.getElementById('monthLabel').textContent = `${y}년 ${parseInt(m)}월 추천 키워드`;

  activeCards = sortedKeywords.slice(0, 9);
  nextIdx = 9;
  updateCounter();
  renderGrid();
}

init();
