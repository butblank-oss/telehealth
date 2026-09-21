import { chromium } from 'playwright';
const FILE = 'file:///home/user/telehealth/hyeopjintok/index.html';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport:{width:1440,height:900}, ignoreHTTPSErrors:true });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
p.on('console', m => { if (m.type()==='error' && !/ERR_CERT|ERR_TOO_MANY|net::/.test(m.text())) errs.push('CONSOLE: ' + m.text()); });
const step = async (n, fn) => {
  const b0 = errs.length;
  try { await fn(); } catch (e) { errs.push(`${n}: ${e.message}`); }
  if (errs.length > b0) { console.log(`  ✗ ${n}`); errs.slice(b0).forEach(x => console.log(`      ${x.split('\n')[0]}`)); }
  else console.log(`  ✓ ${n}`);
};

await p.goto(FILE + '#/room/p1'); await p.waitForTimeout(400);

console.log('① 자료 분석 → 캡션');
await step('말풍선 안 이미지에 자동 계측 캡션이 붙는다', async () => {
  const caps = await p.locator('#thread .bubble__caption').count();
  if (caps < 2) throw new Error('captions=' + caps);
  const txt = await p.locator('#thread .bubble__caption').first().innerText();
  if (!/관절간격/.test(txt)) throw new Error('caption text=' + txt);
});
await step('무릎 굽힘 각도가 대화 안에서 바로 보인다', async () => {
  const all = await p.locator('#thread').innerText();
  /* 값 앞의 ≈는 "잰 값이 아니라 어림값"이라는 표시라 반드시 붙어 있어야 합니다 */
  if (!/굽힘 최대 ≈118°/.test(all)) throw new Error('보행 영상 캡션 없음');
});
await step('캡션을 누르면 확대 뷰어와 계측표가 열린다', async () => {
  await p.locator('#thread .bubble__caption').last().click();
  await p.waitForSelector('.viewer .metric-row');
  const rows = await p.locator('.viewer .metric-row').count();
  if (rows < 4) throw new Error('metric rows=' + rows);
  const t = await p.locator('.viewer').innerText();
  if (!/판독과 진단은 의사가 합니다/.test(t)) throw new Error('의료법 고지 없음');
});
await p.keyboard.press('Escape');
await step('패널 자료 탭에 분석 정리 + 카드 캡션', async () => {
  await p.click('[data-act="panel"][data-arg="files"]');
  const d = await p.locator('.panel .digest').innerText();
  if (!/자료/.test(d) || !/계측값/.test(d)) throw new Error('digest=' + d);
});
await step('자료 분석 전체보기: 모든 자료의 계측표', async () => {
  await p.click('.panel [data-act="openFiles"]');
  await p.waitForSelector('.modal .file-detail');
  const n = await p.locator('.modal .file-detail').count();
  if (n !== 6) throw new Error('details=' + n);
});
await p.screenshot({ path:'shots/f1-files.png' });
await p.keyboard.press('Escape');

console.log('\n② 대화창에서 상담 종료 → 요약 → 종료함');
await step('취소하면 종료되지 않는다', async () => {
  await p.click('#thread [data-act="askClose"]');
  await p.waitForSelector('.modal .sum');
  await p.click('.modal__foot [data-act="closeSheet"]');
  await p.waitForSelector('.modal', { state: 'detached' });
  if (await p.evaluate(() => !!S.closed[S.roomId])) throw new Error('취소했는데 종료됨');
  if (!(await p.locator('#thread .close-cta').count())) throw new Error('종료 버튼이 사라짐');
});
await step('대화창의 [상담 종료하기] → 요약 확인 → 종료함', async () => {
  // 대화 끝에 종료 버튼이 있어야 한다
  await p.waitForSelector('#thread .close-cta [data-act="askClose"]');
  await p.click('#thread [data-act="askClose"]');
  // 종료 전에 요약을 먼저 보여준다
  await p.waitForSelector('.modal .sum');
  const pre = await p.locator('.modal').innerText();
  if (!/어떻게 진행됐나/.test(pre)) throw new Error('요약 미리보기 없음');
  if (await p.evaluate(() => !!S.closed[S.roomId])) throw new Error('확인 전에 이미 종료됨');
  await p.click('[data-act="submitSheet"]');
  await p.waitForTimeout(250);
  // 종료함으로 이동했는지
  const tab = await p.evaluate(() => S.tab);
  if (tab !== 'closed') throw new Error('종료함으로 안 감: ' + tab);
  const active = await p.textContent('.rail__tabs .chip.is-active');
  if (!/종료/.test(active)) throw new Error('탭=' + active);
  if (await p.locator('#thread .close-cta').count()) throw new Error('종료 버튼이 남아 있음');
  await p.waitForSelector('#thread .sum-card');
  const t = await p.locator('#thread .sum-card').innerText();
  for (const h of ['어떻게 시작했나','어떻게 진행됐나','핵심 의견','남긴 자료','남은 것']) {
    if (!t.includes(h)) throw new Error('빠진 항목: ' + h);
  }
});
await step('요약이 실제 대화에서 뽑혀 있다', async () => {
  const t = await p.locator('#thread .sum-card').innerText();
  if (!/무릎 통증/.test(t) || !/재활 계획/.test(t)) throw new Error('주제 누락');
  if (!/관절 보존이 가능한 단계/.test(t)) throw new Error('★ 중요 의견이 핵심 의견에 안 들어감');
  if (!/3월 11일/.test(t)) throw new Error('기간 없음');
});
await p.locator('#thread .sum-card').scrollIntoViewIfNeeded();
await p.screenshot({ path:'shots/f2-summary.png' });
await step('배너 · 방 관리에서도 요약을 열 수 있다', async () => {
  await p.click('.state-banner [data-act="openSummary"]');
  await p.waitForSelector('.modal .sum');
  await p.keyboard.press('Escape');
  await p.waitForSelector('.modal', { state: 'detached' });
  await p.click('[data-act="openMenu"]');
  await p.click('.modal [data-act="openSummary"]');
  await p.waitForSelector('.modal .sum');
  await p.keyboard.press('Escape');
  await p.waitForSelector('.modal', { state: 'detached' });
});
await step('다시 열면 요약 카드 대신 종료 버튼이 돌아온다', async () => {
  await p.click('.state-banner [data-act="bannerAction"]');
  await p.waitForTimeout(250);
  if (await p.locator('#thread .sum-card').count()) throw new Error('요약이 아직 남아 있음');
  if (!(await p.locator('#thread .close-cta').count())) throw new Error('종료 버튼이 안 돌아옴');
});

console.log('\n③ 협진 통화');
await step('음성통화: 연결 중 → 통화 중 → 타이머가 흐른다', async () => {
  await p.click('[data-act="toggleCallMenu"]');
  await p.click('[data-act="startVoice"]');
  await p.waitForSelector('.call');
  const c0 = await p.locator('[data-call-timer]').innerText();
  if (!/연결 중/.test(c0)) throw new Error('연결 중 아님: ' + c0);
  await p.waitForTimeout(2600);
  const c1 = await p.locator('[data-call-timer]').innerText();
  if (!/^\d\d:\d\d$/.test(c1)) throw new Error('타이머 아님: ' + c1);
  await p.waitForTimeout(1200);
  const c2 = await p.locator('[data-call-timer]').innerText();
  if (c1 === c2) throw new Error('타이머가 안 흐름 ' + c1);
});
await p.screenshot({ path:'shots/f3-voice.png' });
await step('음소거 토글', async () => {
  await p.click('[data-act="toggleMute"]');
  const on = await p.locator('[data-act="toggleMute"]').getAttribute('aria-pressed');
  if (on !== 'true') throw new Error('mute=' + on);
});
await step('종료하면 대화에 통화 기록이 남는다', async () => {
  await p.click('[data-act="endCall"]');
  await p.waitForTimeout(300);
  if (await p.locator('.call').count()) throw new Error('통화 화면이 안 닫힘');
  const sys = await p.locator('#thread .msg-system').last().innerText();
  if (!/음성 협진 통화/.test(sys)) throw new Error('기록=' + sys);
});
await step('영상통화: 상대 화면 + 내 화면 + 카메라 토글', async () => {
  await p.click('[data-act="toggleCallMenu"]');
  await p.click('[data-act="startVideo"]');
  await p.waitForTimeout(2200);
  if (!(await p.locator('.call__remote').count())) throw new Error('원격 화면 없음');
  if (!(await p.locator('.call__self').count())) throw new Error('내 화면 없음');
  await p.click('[data-act="toggleCam"]');
  const t = await p.locator('.call__self').innerText();
  if (!/카메라 꺼짐/.test(t)) throw new Error('카메라 토글 반영 안 됨: ' + t);
});
await p.screenshot({ path:'shots/f3-video.png' });
await step('실제 연결이 아님을 화면에 밝힌다', async () => {
  const t = await p.locator('.call__note').innerText();
  if (!/실제 통화는 연결되지 않습니다/.test(t)) throw new Error('고지 없음');
});
await p.click('[data-act="endCall"]'); await p.waitForTimeout(300);
await step('감사 로그에 통화가 기록된다', async () => {
  await p.click('[data-act="go"][data-arg="me"]');
  await p.click('[data-act="goAdmin"]');
  await p.click('[data-act="adminTab"][data-arg="audit"]');
  await p.click('[data-act="auditF"][data-arg="call"]');
  await p.waitForTimeout(150);
  const n = await p.locator('.table__row').count();
  if (n !== 2) throw new Error('통화 로그 ' + n + '건 (음성+영상 2건이어야 함)');
});
await step('요약에 통화가 포함된다', async () => {
  await p.goto(FILE + '#/room/p1'); await p.waitForTimeout(300);
  await p.click('#thread [data-act="askClose"]');
  await p.waitForSelector('.modal .sum');
  const t = await p.locator('.modal .sum').innerText();
  if (!/통화/.test(t)) throw new Error('요약에 통화 없음');
});

console.log('\n모바일');
const m = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, ignoreHTTPSErrors:true });
const mp = await m.newPage();
mp.on('pageerror', e => errs.push('M PAGEERROR: ' + e.message));
await mp.goto(FILE + '#/room/p1'); await mp.waitForTimeout(400);
await step('모바일: 캡션 + 통화 화면이 화면 안에 들어온다', async () => {
  if (!(await mp.locator('#thread .bubble__caption').count())) throw new Error('캡션 없음');
  await mp.click('[data-act="toggleCallMenu"]');
  await mp.click('[data-act="startVideo"]');
  await mp.waitForTimeout(2200);
  const box = await mp.locator('.call').boundingBox();
  if (box.width > 391 || box.height > 845) throw new Error('통화 화면이 넘침 ' + JSON.stringify(box));
  const over = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (over > 0) throw new Error('가로 넘침 ' + over);
});
await mp.screenshot({ path:'shots/f3-m-video.png' });
await mp.click('[data-act="endCall"]');

await b.close();
console.log('\n=== 에러 ' + errs.length + '건 ===');
errs.forEach(e => console.log(' ' + e));
process.exit(errs.length ? 1 : 0);
