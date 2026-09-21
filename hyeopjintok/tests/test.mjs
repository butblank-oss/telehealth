import { chromium } from 'playwright';

const FILE = 'file:///home/user/telehealth/hyeopjintok/index.html';
const errs = [];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|ERR_TOO_MANY|net::/.test(m.text())) errs.push('CONSOLE: ' + m.text()); });

const shot = async (name) => { await page.screenshot({ path: `shots/${name}.png`, fullPage: false }); };
const step = async (name, fn) => {
  const before = errs.length;
  try { await fn(); } catch (e) { errs.push(`STEP ${name} FAILED: ${e.message}`); }
  await page.waitForTimeout(120);
  if (errs.length > before) console.log(`  ✗ ${name}`); else console.log(`  ✓ ${name}`);
};

await page.goto(FILE);
await page.waitForTimeout(400);

console.log('PC 1440x900');
await step('login renders', async () => {
  const t = await page.textContent('h1'); if (!t.includes('협진톡')) throw new Error('no title: ' + t);
});
await shot('01-login');
await step('login → 홈 대시보드', async () => {
  await page.click('[data-act="login"]');
  await page.waitForSelector('.home');
});
await step('홈 → 협진', async () => {
  await page.click('.navrail [data-arg="rooms"]');
  await page.waitForSelector('.rail');
});
await shot('02-room');

await step('네비 레일: 홈·협진·검색·알림·운영자·내 정보', async () => {
  const labels = await page.locator('.navrail__label').allInnerTexts();
  if (labels.join(',') !== '홈,협진,검색,알림,운영자,내 정보') throw new Error('navrail=' + labels);
  const active = await page.locator('.navrail__item.is-active').innerText();
  if (!/협진/.test(active)) throw new Error('active=' + active);
  // 목록 열에는 네비 버튼이 남아 있지 않아야 한다
  if (await page.locator('.rail__foot').count()) throw new Error('목록 열에 네비 푸터가 남음');
});
await step('rail room list has 5 rows', async () => {
  const n = await page.locator('.rail .room-row').count();
  if (n !== 5) throw new Error('rows=' + n);
});
await step('thread has messages', async () => {
  const n = await page.locator('#thread .msg').count();
  if (n < 5) throw new Error('msgs=' + n);
});
await step('topic filter', async () => {
  await page.click('.topic-bar__chips .chip:nth-child(2)');
  const n = await page.locator('#thread .msg').count();
  if (n !== 7) throw new Error('t1 msgs=' + n);
  await page.click('.topic-bar__chips .chip:nth-child(1)');
});
await step('send a message', async () => {
  await page.fill('[data-k="draft"]', '재활 강도 조정 의견 부탁드립니다');
  await page.click('[data-act="send"]');
  const last = await page.locator('#thread .msg').last().textContent();
  if (!last.includes('재활 강도')) throw new Error('not sent: ' + last);
});
await shot('03-sent');
await step('in-room search', async () => {
  await page.click('[data-act="openSearch"]');
  await page.fill('[data-k="roomq"]', '물리치료');
  const n = await page.locator('#thread .msg').count();
  if (n < 1) throw new Error('search hits=' + n);
  await page.click('[data-act="closeSearch"]');
});
await step('panel toggle + files tab', async () => {
  await page.click('[data-act="panel"][data-arg="files"]');
  await page.waitForSelector('.panel .file-row');
  const n = await page.locator('.panel .file-row').count();
  if (n !== 5) throw new Error('files=' + n);
  const txt = await page.locator('.panel .file-row__cap').first().innerText();
  if (!/관절간격/.test(txt)) throw new Error('caption=' + txt);
  const digest = await page.locator('.panel .digest').count();
  if (!digest) throw new Error('no analysis digest in panel');
  await page.click('[data-act="panel"][data-arg="info"]');
});
await shot('04-panel');
await step('새 협진 요청 modal', async () => {
  await page.click('[data-act="openNew"]');
  await page.waitForSelector('.modal');
  const h = await page.locator('.modal__body').evaluate(el => el.getBoundingClientRect().height);
  if (h < 100) throw new Error('modal body collapsed h=' + h);
});
await shot('05-modal-new');
await step('create room', async () => {
  await page.fill('[data-k="f_pname"]', '한지은');
  await page.fill('[data-k="f_age"]', '38');
  await page.click('[data-act="formSex"][data-arg="여성"]');
  await page.fill('[data-k="formTitle"]', '어깨 회전근개 소견 부탁드립니다');
  await page.click('[data-act="submitSheet"]');
  await page.waitForTimeout(200);
  /* 화면에는 가운데를 가린 이름이 뜹니다 */
  const name = await page.textContent('.room-header__title .t2');
  if (!name.includes('한*은')) throw new Error('room name=' + name);
  const n = await page.locator('.rail .room-row').count();
  if (n !== 6) throw new Error('rows after create=' + n);
});
await shot('06-new-room');
await step('방 관리 → 종료', async () => {
  await page.click('[data-act="openMenu"]');
  await page.click('.modal [data-act="askClose"]');
  await page.waitForSelector('.modal .sum');
  await page.click('[data-act="submitSheet"]');
  await page.waitForTimeout(250);
  const b = await page.textContent('.state-banner__text');
  if (!b.includes('종료된 협진')) throw new Error('banner=' + b);
  const active = await page.textContent('.rail__tabs .chip.is-active');
  if (!active.includes('종료')) throw new Error('tab=' + active);
});
await shot('07-closed');
await step('배너로 다시 열기', async () => {
  await page.click('[data-act="bannerAction"]');
  await page.waitForTimeout(150);
  if (await page.locator('.state-banner').count()) throw new Error('banner still there');
});
await step('의사 초대', async () => {
  await page.click('[data-act="tab"][data-arg="all"]');
  await page.click('.rail .room-row >> nth=1');
  await page.click('[data-act="openInvite"]');
  await page.waitForSelector('.modal');
  await page.click('.pick-row >> nth=0');
  await page.click('[data-act="submitSheet"]');
  await page.waitForTimeout(150);
  const sub = await page.textContent('.room-header__title .t4');
  if (!/참여 \d+명/.test(sub)) throw new Error('sub=' + sub);
});
await step('전역 검색', async () => {
  await page.click('.navrail [data-arg="notis"]');
  await page.waitForTimeout(100);
  const n = await page.locator('.noti-row').count();
  if (n !== 4) throw new Error('notis=' + n);
  await page.click('[data-act="readAll"]');
});
await shot('08-notis');
await step('내 정보', async () => {
  await page.click('.navrail [data-arg="me"]');
  await page.waitForSelector('.setting-row');
  await page.click('[data-act="toggle"][data-arg="file"]');
  const on = await page.locator('[data-act="toggle"][data-arg="file"]').getAttribute('aria-pressed');
  if (on !== 'true') throw new Error('toggle=' + on);
});
await shot('09-me');
await step('운영자', async () => {
  await page.click('[data-act="goAdmin"]');
  await page.waitForSelector('.stat-card');
  await page.click('[data-act="adminTab"][data-arg="audit"]');
  const rows = await page.locator('.table__row').count();
  if (rows !== 6) throw new Error('audit rows=' + rows);
  await page.click('[data-act="auditF"][data-arg="delete"]');
  const f = await page.locator('.table__row').count();
  if (f !== 1) throw new Error('filtered=' + f);
  await page.click('[data-act="adminTab"][data-arg="members"]');
});
await shot('10-admin');
await step('온보딩 검증', async () => {
  await page.click('[data-act="goOnboard"]');
  await page.click('[data-act="onbNext"]');
  await page.click('[data-act="onbNext"]');
  await page.waitForSelector('[data-k="onbLicense"]');
  const blocked = await page.locator('[data-act="onbNext"]').getAttribute('aria-disabled');
  if (blocked !== 'true') throw new Error('license gate not enforced');
  await page.click('[data-act="onbNext"]', { force: true });
  await page.waitForTimeout(100);
  if (!(await page.locator('[data-k="onbLicense"]').count())) throw new Error('advanced without license');
  await page.fill('[data-k="onbLicense"]', '30112');
  await page.click('[data-act="onbShot"]');
  await page.click('[data-act="onbNext"]');
  await page.waitForTimeout(100);
  const t = await page.textContent('h1');
  if (!t.includes('가입이 끝났습니다')) throw new Error('t=' + t);
});
await shot('11-onboard');
await page.click('[data-act="onbDone"]');

// 레이아웃 굶주림 검사
await step('본문 폭이 굶지 않음', async () => {
  await page.click('.navrail [data-arg="rooms"]');
  await page.waitForSelector('.main');
  const w = await page.locator('.main').evaluate(el => el.getBoundingClientRect().width);
  if (w < 440) throw new Error('main width=' + w);
});

console.log('\n모바일 390x844');
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
const mp = await m.newPage();
mp.on('pageerror', e => errs.push('M PAGEERROR: ' + e.message));
mp.on('console', c => { if (c.type() === 'error' && !/ERR_CERT|ERR_TOO_MANY|net::/.test(c.text())) errs.push('M CONSOLE: ' + c.text()); });
await mp.goto(FILE);
await mp.waitForTimeout(300);
const mshot = async (n) => mp.screenshot({ path: `shots/m-${n}.png` });
const mstep = async (name, fn) => {
  const b = errs.length;
  try { await fn(); } catch (e) { errs.push(`M STEP ${name}: ${e.message}`); }
  await mp.waitForTimeout(120);
  console.log(errs.length > b ? `  ✗ ${name}` : `  ✓ ${name}`);
};
await mstep('login → 홈 → 협진', async () => {
  await mp.click('[data-act="login"]');
  await mp.waitForSelector('.home');
  await mp.click('.tabbar [data-arg="rooms"]');
  await mp.waitForSelector('.room-row');
  if (await mp.locator('.rail').isVisible()) throw new Error('rail visible on mobile');
  const n = await mp.locator('.room-row').count();
  if (n !== 5) throw new Error('rows=' + n);
});
await mshot('01-rooms');
await mstep('방 열기 + 뒤로', async () => {
  await mp.click('.room-row >> nth=0');
  await mp.waitForSelector('#thread');
  await mp.click('[data-act="go"][data-arg="rooms"]');
  await mp.waitForSelector('.room-row');
});
await mp.click('.room-row >> nth=0');
await mp.waitForTimeout(150);
await mshot('02-room');
await mstep('하단 시트', async () => {
  await mp.click('[data-act="openMenu"]');
  await mp.waitForSelector('.modal');
  const box = await mp.locator('.modal').boundingBox();
  if (box.height < 100) throw new Error('sheet h=' + box.height);
  if (box.y + box.height > 850) throw new Error('sheet overflows: ' + JSON.stringify(box));
});
await mshot('03-sheet');
await mp.keyboard.press('Escape');
await mstep('탭바 이동', async () => {
  for (const t of ['home', 'search', 'notis', 'me']) {
    await mp.click(`.tabbar [data-arg="${t}"]`);
    await mp.waitForTimeout(100);
  }
});
await mshot('04-me');
await mstep('가로 스크롤 없음', async () => {
  const over = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (over > 0) throw new Error('horizontal overflow ' + over + 'px');
});

await browser.close();
console.log('\n=== 에러 ' + errs.length + '건 ===');
errs.forEach(e => console.log(' ' + e));
process.exit(errs.length ? 1 : 0);
