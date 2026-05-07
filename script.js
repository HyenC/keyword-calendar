// ============================================================
// Google Sheets 공개 CSV URL을 아래에 입력하세요.
// 설정 방법은 SETUP.md를 참고하세요.
// ============================================================
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRnQeNpiinQXa19q67YIsKqBKawpygHn_gp_VsW7lk6QOYOZVBR5KlEPxSvyqHmhMkzwfYQVlcXQ9L9/pub?gid=0&single=true&output=csv";

// 샘플 데이터 (SHEET_CSV_URL이 비어 있을 때 표시됩니다)
const SAMPLE_DATA = {
  2026: {
    1:  { keywords: ["신년", "목표 설정", "새 출발", "계획"], primary: "신년" },
    2:  { keywords: ["발렌타인", "겨울 마무리", "설 연휴"], primary: "발렌타인" },
    3:  { keywords: ["봄", "새 학기", "벚꽃", "환경의 날"], primary: "봄" },
    4:  { keywords: ["부활절", "봄나들이", "미세먼지", "어린이날 준비"], primary: "봄나들이" },
    5:  { keywords: ["어린이날", "어버이날", "가정의 달", "황금연휴"], primary: "가정의 달" },
    6:  { keywords: ["호국보훈", "현충일", "여름 준비", "환경"], primary: "호국보훈" },
    7:  { keywords: ["휴가", "여름 여행", "바캉스", "물놀이"], primary: "여름 여행" },
    8:  { keywords: ["광복절", "말복", "피서", "여름 끝"], primary: "광복절" },
    9:  { keywords: ["추석", "가을", "독서의 달", "등산"], primary: "추석" },
    10: { keywords: ["한글날", "단풍", "할로윈", "가을 여행"], primary: "단풍" },
    11: { keywords: ["수능", "블랙프라이데이", "빼빼로", "연말 준비"], primary: "수능" },
    12: { keywords: ["크리스마스", "연말", "새해 준비", "선물"], primary: "크리스마스" },
  }
};

const MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const MONTH_COLORS = [
  "#4f46e5","#0ea5e9","#10b981","#f59e0b",
  "#ef4444","#8b5cf6","#06b6d4","#f97316",
  "#ec4899","#84cc16","#6366f1","#14b8a6"
];

let currentYear = new Date().getFullYear();
let allData = {};

// CSV 파싱 (Google Sheets 형식: month, primary_keyword, keyword1, keyword2, ...)
function parseCSV(text) {
  const lines = text.trim().split("\n").slice(1); // 헤더 제거
  const result = {};

  for (const line of lines) {
    const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    if (!cols[0]) continue;

    const [yearStr, monthStr, primary, ...rest] = cols;
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    if (isNaN(year) || isNaN(month)) continue;

    if (!result[year]) result[year] = {};
    result[year][month] = {
      primary: primary || "",
      keywords: [primary, ...rest].filter(Boolean)
    };
  }
  return result;
}

async function loadData() {
  if (!SHEET_CSV_URL) {
    document.getElementById("setupBanner").style.display = "block";
    return SAMPLE_DATA;
  }

  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error("fetch 실패");
    const text = await res.text();
    return parseCSV(text);
  } catch (e) {
    console.error("데이터 로드 실패:", e);
    document.getElementById("calendarRoot").innerHTML = `
      <div class="error-box">
        데이터를 불러오는 데 실패했습니다.<br>
        Google Sheets URL을 확인하거나 네트워크 상태를 점검하세요.
      </div>`;
    return null;
  }
}

function render(year, data) {
  const root = document.getElementById("calendarRoot");
  const now = new Date();
  const yearData = data[year] || {};

  const cards = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const info = yearData[month] || { keywords: [], primary: "" };
    const isCurrent = now.getFullYear() === year && now.getMonth() + 1 === month;
    const color = MONTH_COLORS[i];

    const tagsHTML = info.keywords.length
      ? info.keywords.map(k =>
          `<span class="keyword-tag${k === info.primary ? " primary" : ""}">${k}</span>`
        ).join("")
      : `<span class="no-keywords">키워드 없음</span>`;

    return `
      <div class="month-card${isCurrent ? " current-month" : ""}">
        <div class="month-header">
          <div class="month-badge" style="background:${color}">${month}</div>
          <div>
            <div class="month-name">${MONTH_NAMES[i]}</div>
            ${isCurrent ? '<div class="month-sub">이번 달</div>' : ""}
          </div>
        </div>
        <div class="keywords">${tagsHTML}</div>
      </div>`;
  });

  root.innerHTML = `<div class="grid">${cards.join("")}</div>`;
  document.getElementById("yearLabel").textContent = year;
}

async function init() {
  document.getElementById("calendarRoot").innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>데이터를 불러오는 중...</p>
    </div>`;

  allData = await loadData();
  if (!allData) return;

  render(currentYear, allData);

  document.getElementById("prevYear").addEventListener("click", () => {
    currentYear--;
    render(currentYear, allData);
  });
  document.getElementById("nextYear").addEventListener("click", () => {
    currentYear++;
    render(currentYear, allData);
  });
}

init();
