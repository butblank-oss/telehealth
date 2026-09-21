import { chromium } from 'playwright';
const F='file:///home/user/telehealth/hyeopjintok/index.html';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const ctx=await b.newContext({viewport:{width:1512,height:920},ignoreHTTPSErrors:true});
const p=await ctx.newPage();
const errs=[];
p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/ERR_CERT|ERR_TOO_MANY|net::/.test(m.text()))errs.push('CONSOLE: '+m.text());});
const step=async(n,fn)=>{const b0=errs.length;try{await fn();}catch(e){errs.push(`${n}: ${e.message}`);}
  if(errs.length>b0){console.log(`  ✗ ${n}`);errs.slice(b0).forEach(x=>console.log(`      ${x.split('\n')[0]}`));}else console.log(`  ✓ ${n}`);};

await p.goto(F+'#/room/p1'); await p.waitForTimeout(600);

console.log('① 대화창 캡션 → 뷰어 → 계측 수정');
await step('캡션을 누르면 확대 뷰어가 열린다', async () => {
  await p.locator('#thread .bubble__caption').last().click();
  await p.waitForSelector('.viewer__image');
  if (!(await p.locator('.viewer__nav').count())) throw new Error('자료 이동 없음');
});
await step('보행 영상 계측이 보인다 (무릎 굽힘 118°)', async () => {
  const t = await p.locator('.viewer__side').innerText();
  if (!/최대 굽힘 각도/.test(t) || !/118°/.test(t)) throw new Error(t.slice(0,120));
});
await p.screenshot({path:'shots/v2-viewer.png'});
await step('[수정] → 값이 입력칸이 된다', async () => {
  await p.click('[data-act="startEdit"]');
  await p.waitForSelector('.metric-list.is-editing input');
  const n = await p.locator('.metric-list input').count();
  if (n !== 5) throw new Error('inputs=' + n);
});
await step('값을 고치고 저장', async () => {
  await p.fill('[data-k="mx0"]', '124°');
  await p.fill('[data-k="mx1"]', '-1°');
  await p.click('[data-act="saveEdit"]');
  await p.waitForTimeout(300);
  const t = await p.locator('.viewer__side').innerText();
  if (!/124°/.test(t)) throw new Error('저장 안 됨: ' + t.slice(0,120));
  if (!/수정됨/.test(t)) throw new Error('수정됨 표시 없음');
});
await p.screenshot({path:'shots/v3-edited.png'});

console.log('\n② 대화창·자료 양쪽 반영');
await step('대화창 캡션이 고친 값으로 바뀐다', async () => {
  await p.click('.viewer__head [data-act="closeViewer"]'); await p.waitForTimeout(300);
  const caps = await p.locator('#thread .bubble__caption-text').allInnerTexts();
  const hit = caps.find(c => /124°/.test(c));
  if (!hit) throw new Error('캡션 미반영: ' + JSON.stringify(caps));
  if (!/-1°/.test(hit)) throw new Error('두 번째 값 미반영: ' + hit);
});
await step('패널 자료 카드에도 반영 + 수정됨 배지', async () => {
  await p.click('[data-act="panel"][data-arg="files"]');
  await p.waitForTimeout(250);
  const t = await p.locator('.panel').innerText();
  if (!/124°/.test(t)) throw new Error('패널 미반영');
  if (!(await p.locator('.panel .file-row .viewer__item-dot').count())) throw new Error('수정됨 표시 없음');
});
await step('자료 분석 목록에도 반영', async () => {
  await p.click('[data-act="openMenu"]');
  await p.click('.modal [data-act="openFiles"]');
  await p.waitForSelector('.modal .file-detail');
  const t = await p.locator('.modal').innerText();
  if (!/124°/.test(t)) throw new Error('목록 미반영');
  await p.keyboard.press('Escape');
});

console.log('\n③ 편집 히스토리');
await step('수정 내역 2건이 남는다', async () => {
  await p.locator('#thread .bubble__caption').last().click();
  await p.waitForSelector('.viewer');
  const toggle = await p.locator('[data-act="toggleHist"]').innerText();
  if (!/수정 내역 2건/.test(toggle)) throw new Error('toggle=' + toggle);
  await p.click('[data-act="toggleHist"]');
  await p.waitForSelector('.viewer__hist-item');
  const t = await p.locator('.viewer__hist-list').innerText();
  if (!/118°/.test(t) || !/124°/.test(t)) throw new Error('before/after 없음: ' + t);
  if (!/한상호 원장/.test(t)) throw new Error('작성자 없음');
});
await p.screenshot({path:'shots/v4-history.png'});
await step('감사 로그에도 남는다', async () => {
  await p.click('.viewer__head [data-act="closeViewer"]');
  await p.click('.navrail [data-arg="admin"]');
  await p.click('[data-act="adminTab"][data-arg="audit"]');
  await p.waitForTimeout(200);
  const t = await p.locator('.table').innerText();
  if (!/계측 수정/.test(t)) throw new Error('감사 로그 없음');
});
await step('새로고침해도 유지된다', async () => {
  await p.goto(F+'#/room/p1'); await p.waitForTimeout(500);
  const caps = await p.locator('#thread .bubble__caption-text').allInnerTexts();
  if (!caps.find(c => /124°/.test(c))) throw new Error('새로고침 후 사라짐');
});
await step('취소하면 저장되지 않는다', async () => {
  await p.locator('#thread .bubble__caption').last().click();
  await p.waitForSelector('.viewer');
  await p.click('[data-act="startEdit"]');
  await p.fill('[data-k="mx0"]', '999°');
  await p.click('[data-act="cancelEdit"]');
  await p.waitForTimeout(250);
  const t = await p.locator('.viewer__side').innerText();
  if (/999/.test(t)) throw new Error('취소가 안 먹음');
  await p.click('.viewer__head [data-act="closeViewer"]');
});

await step('배경을 누르면 닫히고, 카드 안쪽을 눌러도 안 닫힌다', async () => {
  await p.locator('#thread .bubble__caption').last().click();
  await p.waitForSelector('.viewer');
  await p.locator('.viewer__image').click();          // 안쪽 → 유지
  await p.waitForTimeout(200);
  if (!(await p.locator('.viewer').count())) throw new Error('안쪽 클릭에 닫힘');
  await p.locator('.viewer-overlay').click({ position: { x: 12, y: 12 } });  // 배경 → 닫힘
  await p.waitForTimeout(250);
  if (await p.locator('.viewer').count()) throw new Error('배경 클릭에 안 닫힘');
});

console.log('\n④ 홈 대시보드 · 네비');
await step('네비: 홈이 협진 위, 검색은 그대로', async () => {
  const labels = await p.locator('.navrail__label').allInnerTexts();
  if (labels.join(',') !== '홈,협진,검색,알림,운영자,내 정보') throw new Error('navrail=' + labels);
  await p.click('.navrail [data-arg="search"]');
  await p.waitForSelector('[data-k="gq"]');
  const t = await p.locator('.screen').innerText();
  if (!/환자/.test(t)) throw new Error('검색 결과 비어 있음');
});
await step('홈 대시보드가 실제 데이터로 채워진다', async () => {
  await p.click('.navrail [data-arg="home"]');
  await p.waitForSelector('.home');
  const t = await p.locator('.home').innerText();
  for (const k of ['진행 중 협진','내 답변 대기','안 읽음','24시간 넘게 답 없음',
                   '내 답변을 기다리는 협진','눈여겨볼 계측값','최근 올라온 자료']) {
    if (!t.includes(k)) throw new Error('빠진 항목: ' + k);
  }
  const cards = await p.locator('.home .stat-card__value').allInnerTexts();
  if (cards.some(c => /NaN|undefined/.test(c))) throw new Error('지표 계산 오류: ' + cards);
  const clickable = await p.locator('.home .stat-card--link').count();
  if (clickable !== 4) throw new Error('지표를 누를 수 없음: ' + clickable);
});
await p.screenshot({path:'shots/v5-home.png'});
await step('홈에서 자료를 눌러도 뷰어가 열린다', async () => {
  await p.locator('.home .file-card').first().click();
  await p.waitForSelector('.viewer__image');
  await p.click('.viewer__head [data-act="closeViewer"]');
});
await step('홈에서는 목록 열이 숨는다 (전체 폭 사용)', async () => {
  if (await p.locator('.rail').count()) throw new Error('목록 열이 남아 있음');
  if (!(await p.locator('.navrail').count())) throw new Error('네비가 없음');
});
await step('데모 초기화로 되돌릴 수 있다', async () => {
  await p.click('.navrail [data-arg="me"]');
  await p.click('[data-act="resetDemo"]');
  await p.waitForTimeout(250);
  await p.goto(F+'#/room/p1'); await p.waitForTimeout(400);
  const caps = await p.locator('#thread .bubble__caption-text').allInnerTexts();
  if (caps.find(c => /124°/.test(c))) throw new Error('초기화 안 됨');
});

console.log('\n모바일');
const m=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,ignoreHTTPSErrors:true});
const mp=await m.newPage();
mp.on('pageerror',e=>errs.push('M PAGEERROR: '+e.message));
await mp.goto(F+'#/room/p1'); await mp.waitForTimeout(500);
await step('모바일: 뷰어가 화면에 들어오고 편집 가능', async () => {
  await mp.locator('#thread .bubble__caption').last().click();
  await mp.waitForSelector('.viewer');
  const box = await mp.locator('.viewer').boundingBox();
  if (box.width > 391) throw new Error('폭 넘침 ' + box.width);
  if (box.y + box.height > 845) throw new Error('세로 넘침');
  await mp.click('[data-act="startEdit"]');
  await mp.waitForSelector('.metric-list.is-editing input');
});
await mp.screenshot({path:'shots/v6-m-viewer.png'});
await step('모바일 탭바: 홈/협진/알림/내 정보', async () => {
  await mp.click('[data-act="cancelEdit"]');
  await mp.click('.viewer__head [data-act="closeViewer"]');
  const labels = await mp.locator('.tabbar__label').allInnerTexts();
  if (labels.join(',') !== '홈,협진,검색,알림,내 정보') throw new Error('탭바=' + labels);
});

await b.close();
console.log('\n=== 에러 '+errs.length+'건 ===');
errs.forEach(e=>console.log(' '+e));
process.exit(errs.length?1:0);
