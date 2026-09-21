import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport:{width:1440,height:900}, ignoreHTTPSErrors:true });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|ERR_TOO_MANY|net::/.test(m.text())) errs.push('CONSOLE: ' + m.text()); });

const step = async (name, fn) => {
  const before = errs.length;
  try { await fn(); } catch (e) { errs.push(`STEP ${name}: ${e.message}`); }
  console.log(errs.length > before ? `  ✗ ${name}` : `  ✓ ${name}`);
};

await p.goto('file:///home/user/telehealth/hyeopjintok/index.html#/room/p1');
await p.waitForTimeout(300);

await step('기본 폭에서 주요 탭 3개 + 더보기가 한 줄', async () => {
  const r = await p.evaluate(() => {
    const el = document.querySelector('.rail__tabs');
    return { scrollW: el.scrollWidth, clientW: el.clientWidth, wrap: getComputedStyle(el).flexWrap,
             chips: el.querySelectorAll('.chip:not(.chip--more)').length,
             more: el.querySelectorAll('.chip--more').length };
  });
  if (r.wrap !== 'nowrap') throw new Error('wrap=' + r.wrap);
  if (r.chips !== 3 || r.more !== 1) throw new Error(JSON.stringify(r));
  if (r.scrollW > r.clientW + 1) throw new Error(`탭이 넘침 scrollW=${r.scrollW} clientW=${r.clientW}`);
});
await step('레일 기본 폭 = 320px', async () => {
  const w = await p.locator('.rail').evaluate(el => el.getBoundingClientRect().width);
  if (Math.abs(w - 320) > 1) throw new Error('rail width=' + w);
});
await step('리사이저 존재 + 접근성 속성', async () => {
  const h = p.locator('[data-resizer="rail"]');
  if (!(await h.count())) throw new Error('no resizer');
  const role = await h.getAttribute('role');
  const label = await h.getAttribute('aria-label');
  if (role !== 'separator' || !label) throw new Error('a11y attrs missing: ' + role + ' / ' + label);
});
await step('드래그로 넓히면 실제 rail 폭이 늘어남', async () => {
  const handle = await p.locator('[data-resizer="rail"]').boundingBox();
  const before = await p.locator('.rail').evaluate(el => el.getBoundingClientRect().width);
  await p.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await p.mouse.down();
  await p.mouse.move(handle.x + 120, handle.y + handle.height / 2, { steps: 5 });
  await p.mouse.up();
  await p.waitForTimeout(100);
  const after = await p.locator('.rail').evaluate(el => el.getBoundingClientRect().width);
  if (after - before < 100) throw new Error(`before=${before} after=${after}`);
});
await step('넓힌 상태에서도 탭이 다 보임 + 본문 폭이 굶지 않음', async () => {
  const n = await p.locator('.rail__tabs .chip').count();
  if (n !== 4) throw new Error('chips=' + n);
  const w = await p.locator('.main').evaluate(el => el.getBoundingClientRect().width);
  if (w < 440) throw new Error('main width=' + w);
});
await step('새로고침해도 넓힌 폭이 유지됨(localStorage)', async () => {
  const wBefore = await p.locator('.rail').evaluate(el => el.getBoundingClientRect().width);
  await p.reload();
  await p.waitForTimeout(300);
  const wAfter = await p.locator('.rail').evaluate(el => el.getBoundingClientRect().width);
  if (Math.abs(wBefore - wAfter) > 1) throw new Error(`before=${wBefore} after=${wAfter}`);
});
await step('더블클릭으로 기본 폭 복귀', async () => {
  await p.locator('[data-resizer="rail"]').dblclick();
  await p.waitForTimeout(100);
  const w = await p.locator('.rail').evaluate(el => el.getBoundingClientRect().width);
  if (Math.abs(w - 320) > 1) throw new Error('after dblclick width=' + w);
});
await step('키보드로 조절(방향키) + Home/End', async () => {
  await p.locator('[data-resizer="rail"]').focus();
  await p.keyboard.press('ArrowRight');
  await p.keyboard.press('ArrowRight');
  let w = await p.locator('.rail').evaluate(el => el.getBoundingClientRect().width);
  if (Math.abs(w - (320 + 32)) > 1) throw new Error('after 2x ArrowRight width=' + w);
  await p.keyboard.press('End');
  w = await p.locator('.rail').evaluate(el => el.getBoundingClientRect().width);
  if (Math.abs(w - 560) > 1) throw new Error('after End width=' + w);
  await p.keyboard.press('Home');
  w = await p.locator('.rail').evaluate(el => el.getBoundingClientRect().width);
  if (Math.abs(w - 260) > 1) throw new Error('after Home width=' + w);
});
await step('아주 좁게 줄여도(Home=260px) 본문은 굶지 않는다', async () => {
  const main = await p.locator('.main').evaluate(el => el.getBoundingClientRect().width);
  if (main < 440) throw new Error('main starved at narrow rail: ' + main);
});
await step('과도하게 늘려도(MAX=560) 페이지 자체 가로 스크롤은 생기지 않음(뷰포트 1440)', async () => {
  await p.locator('[data-resizer="rail"]').dblclick(); // reset first
  await p.locator('[data-resizer="rail"]').focus();
  await p.keyboard.press('End');
  await p.waitForTimeout(100);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) throw new Error('page horizontal overflow ' + overflow + 'px');
});
await p.locator('[data-resizer="rail"]').dblclick();

console.log('\n모바일에서는 리사이저가 없어야 함');
const m = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, ignoreHTTPSErrors:true });
const mp = await m.newPage();
await mp.goto('file:///home/user/telehealth/hyeopjintok/index.html#/rooms');
await mp.waitForTimeout(300);
await step('모바일: 리사이저 미존재, 탭 5개 정상', async () => {
  if (await mp.locator('[data-resizer="rail"]').count()) throw new Error('모바일에 리사이저가 있음');
  const n = await mp.locator('.rail__tabs .chip').count();
  if (n !== 4) throw new Error('chips=' + n);
});
await mp.screenshot({ path: 'shots/m-rail-tabs2.png' });

await p.screenshot({ path: 'shots/resize-default.png' });
await b.close();
console.log('\n=== 에러 ' + errs.length + '건 ===');
errs.forEach(e => console.log(' ' + e));
process.exit(errs.length ? 1 : 0);
