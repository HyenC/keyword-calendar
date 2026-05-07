# 설정 방법

## 1. Google Sheets 준비

1. [Google Sheets](https://sheets.google.com)에서 새 스프레드시트를 만드세요.
2. **1행(헤더)**을 다음과 같이 입력하세요:

| year | month | primary | keyword2 | keyword3 | keyword4 | keyword5 |
|------|-------|---------|----------|----------|----------|----------|

3. **2행부터** 데이터를 입력하세요:

| year | month | primary   | keyword2  | keyword3 | keyword4 | keyword5 |
|------|-------|-----------|-----------|----------|----------|----------|
| 2026 | 1     | 신년      | 목표 설정 | 새 출발  | 계획     |          |
| 2026 | 2     | 발렌타인  | 겨울      | 설 연휴  |          |          |
| 2026 | 3     | 봄        | 새 학기   | 벚꽃     |          |          |

- `primary`: 대표 키워드 (보라색으로 강조 표시됨)
- `keyword2~5`: 추가 키워드 (최대 4개 추가 가능, 더 늘릴 수도 있음)

---

## 2. 스프레드시트 공개 설정

1. 상단 메뉴 → **파일** → **공유** → **웹에 게시**
2. **게시** 버튼 클릭
3. 링크 형식: `CSV` 선택
4. 생성된 URL을 복사하세요.

URL 예시:
```
https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/export?format=csv&gid=0
```

---

## 3. script.js에 URL 입력

`script.js` 파일 상단의 `SHEET_CSV_URL`에 복사한 URL을 붙여넣으세요:

```js
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/export?format=csv&gid=0";
```

---

## 4. 배포 (무료)

### GitHub Pages
1. 이 폴더를 GitHub 저장소에 push
2. 저장소 설정 → Pages → Branch: `main` / `root` 선택
3. 자동으로 `https://your-id.github.io/repo-name` 주소가 생성됨

### Vercel
1. [vercel.com](https://vercel.com)에서 GitHub 저장소 연결
2. 자동 배포 완료

---

## 5. 키워드 업데이트 방법

1. Google Sheets 파일을 열어 내용 수정
2. 저장 → 웹사이트에서 새로고침하면 즉시 반영됨

> **주의**: CORS 문제가 발생하면 `export?format=csv` 형식의 URL을 사용하세요.
