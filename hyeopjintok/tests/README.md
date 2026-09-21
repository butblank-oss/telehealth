# 협진톡 테스트

Playwright로 실제 브라우저를 띄워 `../index.html`을 검사합니다. 서버가 필요 없습니다.

## 돌리기

```sh
npm i playwright
node test.mjs      # 기본 흐름 (로그인·목록·방·모달·온보딩·운영자)
node feat.mjs      # 자료 분석 캡션 · 상담 요약 · 협진 통화
node edit.mjs      # 계측 수정 · 편집 히스토리 · 홈 대시보드
node attach.mjs    # 여러 자료 첨부 · 뷰어 리스트
node fix3.mjs      # 입력창 하단 고정 · 자료 이름/설명 수정
node fix4.mjs      # 파일 고르기 · 자료 삭제와 되돌리기 · 팝업 크기
node ui.mjs        # 색 · 레일 폭 · 목록 위계
node resize.mjs    # 열 폭 조절
node ime2.mjs      # 한글 IME 조합 (실제 조합 이벤트로 검사)
node tap.mjs       # 터치 타깃 히트 테스트
```

브라우저 경로는 `chromium.launch({ executablePath })`에 박혀 있습니다.
환경이 다르면 그 줄만 고치면 됩니다.

## 왜 이렇게까지 하나

이 앱에서 났던 버그가 대부분 브라우저에서만 드러나는 것들이었습니다 —
세로 flex 안에서 요약 카드가 높이 0으로 눌리던 것, 닫는 태그 하나가 빠져
입력창이 화면 밖으로 밀려나던 것, 화면을 다시 그리는 바람에 파일 대화상자가
물고 있던 input이 떨어져 나가 첨부가 안 되던 것, 그리고 한글 조합이
자모로 흩어지던 것. 전부 단위 테스트로는 잡히지 않습니다.

`ime2.mjs`는 CDP의 `Input.imeSetComposition`으로 실제 한글 조합 단계를
재현합니다. `setInputFiles`로 input에 값을 직접 꽂으면 사용자가 실제로
거치는 경로를 건너뛰므로, `fix4.mjs`는 `filechooser` 이벤트를 씁니다.
