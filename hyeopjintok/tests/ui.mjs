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

console.log('① 파랑은 누를 수 있는 것에만');
await step('환자 요약이 더 이상 파랑이 아니다', async () => {
  const c = await p.locator('.room-row__summary').first().evaluate(el => getComputedStyle(el).color);
  if (c === 'rgb(27, 100, 218)') throw new Error('아직 accent: ' + c);
});
await step('선택된 행·활성 탭·주 버튼은 여전히 파랑', async () => {
  const row = await p.locator('.room-row.is-active').evaluate(el => getComputedStyle(el).backgroundColor);
  if (row !== 'rgb(232, 243, 255)') throw new Error('선택 행 강조 사라짐: ' + row);
  const chip = await p.locator('.rail__tabs .chip.is-active').evaluate(el => getComputedStyle(el).backgroundColor);
  if (chip !== 'rgb(27, 100, 218)') throw new Error('활성 탭=' + chip);
});

console.log('\n② 상태 탭 3개 + 더보기');
await step('줄에는 전체·진행 중·안 읽음만', async () => {
  const chips = await p.locator('.rail__tabs .chip:not(.chip--more)').allInnerTexts();
  if (chips.length !== 3) throw new Error('chips=' + JSON.stringify(chips));
  if (!chips[0].startsWith('전체')) throw new Error(chips[0]);
});
await step('더보기를 열면 종료·보관함이 나온다', async () => {
  await p.click('[data-act="toggleTabMenu"]');
  await p.waitForSelector('.tabmenu__pop');
  const items = await p.locator('.tabmenu__item').allInnerTexts();
  if (items.length !== 2) throw new Error('items=' + JSON.stringify(items));
  if (!items[0].includes('종료') || !items[1].includes('보관함')) throw new Error(JSON.stringify(items));
});
await p.screenshot({path:'shots/d1-tabmenu.png'});
await step('고르면 그 탭이 줄에 남는다', async () => {
  await p.locator('.tabmenu__item').first().click();
  await p.waitForTimeout(250);
  if (await p.locator('.tabmenu__pop').count()) throw new Error('메뉴가 안 닫힘');
  const chips = await p.locator('.rail__tabs .chip:not(.chip--more)').allInnerTexts();
  if (chips.length !== 4 || !chips[3].startsWith('종료')) throw new Error('chips=' + JSON.stringify(chips));
  const active = await p.locator('.rail__tabs .chip.is-active').innerText();
  if (!active.startsWith('종료')) throw new Error('active=' + active);
});
await step('바깥을 누르면 메뉴가 닫힌다', async () => {
  await p.click('[data-act="tab"][data-arg="all"]');
  await p.click('[data-act="toggleTabMenu"]');
  await p.waitForSelector('.tabmenu__pop');
  await p.locator('.rail__head').click();
  await p.waitForTimeout(250);
  if (await p.locator('.tabmenu__pop').count()) throw new Error('안 닫힘');
});
await step('레일이 320px로 줄고 대화가 넓어졌다', async () => {
  const w = await p.evaluate(() => ({
    rail: Math.round(document.querySelector('.rail').getBoundingClientRect().width),
    main: Math.round(document.querySelector('.main').getBoundingClientRect().width),
    tabsOverflow: (() => { const e = document.querySelector('.rail__tabs'); return e.scrollWidth - e.clientWidth; })()
  }));
  if (w.rail !== 320) throw new Error('rail=' + w.rail);
  if (w.main < 780) throw new Error('main=' + w.main);
  if (w.tabsOverflow > 0) throw new Error('탭이 넘침 ' + w.tabsOverflow);
});

console.log('\n③ 목록 행 3줄');
await step('행이 3줄 · 80px 안쪽', async () => {
  const h = await p.locator('.room-row').first().evaluate(el => el.getBoundingClientRect().height);
  if (h > 84) throw new Error('height=' + h);
});
await step('문의 1건 배지는 사라지고 2건부터만 보인다', async () => {
  const texts = await p.locator('.room-row').allInnerTexts();
  if (texts.some(t => /문의 1/.test(t))) throw new Error('문의 1이 남아 있음');
  if (!texts.some(t => /문의 2/.test(t))) throw new Error('문의 2가 안 보임');
});
await step('내 차례인 방에 답변 대기가 붙는다', async () => {
  const texts = await p.locator('.room-row').allInnerTexts();
  if (!texts.some(t => /답변 대기/.test(t))) throw new Error('답변 대기 없음');
  // 안 읽음이 있으면 답변 대기와 겹치지 않는다
  const both = texts.filter(t => /답변 대기/.test(t) && /\d+건 안 읽음/.test(t));
  if (both.length) throw new Error('배지가 겹침');
});
await step('홈이 답변 대기로 꼽은 방은 목록에도 표시가 있다', async () => {
  await p.click('.navrail [data-arg="home"]');
  await p.waitForSelector('.home');
  const names = await p.locator('.home .result-row .t3-strong').allInnerTexts();
  if (!names.length) throw new Error('홈에 답변 대기가 없음');
  await p.click('.navrail [data-arg="rooms"]');
  await p.waitForTimeout(250);
  /* 안 읽음이 있으면 그게 더 강한 신호라 답변 대기 대신 미읽음 배지가 붙습니다 */
  for (const n of names) {
    const row = p.locator('.room-row', { hasText: n }).first();
    const t = await row.innerText();
    if (!/답변 대기/.test(t) && !/건 안 읽음/.test(t)) throw new Error(`${n}: 표시 없음 — ${t}`);
  }
});
await p.screenshot({path:'shots/d2-list.png'});

console.log('\n모바일');
const m=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,ignoreHTTPSErrors:true});
const mp=await m.newPage();
mp.on('pageerror',e=>errs.push('M PAGEERROR: '+e.message));
await mp.goto(F+'#/rooms'); await mp.waitForTimeout(500);
await step('모바일에서도 탭이 안 잘리고 더보기가 뜬다', async () => {
  const o = await mp.evaluate(() => { const e = document.querySelector('.rail__tabs'); return e.scrollWidth - e.clientWidth; });
  if (o > 0) throw new Error('탭 넘침 ' + o);
  await mp.click('[data-act="toggleTabMenu"]');
  await mp.waitForSelector('.tabmenu__pop');
  const box = await mp.locator('.tabmenu__pop').boundingBox();
  if (box.x + box.width > 391) throw new Error('메뉴가 화면 밖: ' + JSON.stringify(box));
});
await mp.screenshot({path:'shots/d3-m-tabs.png'});

await b.close();
console.log('\n=== 에러 '+errs.length+'건 ===');
errs.forEach(e=>console.log(' '+e));
process.exit(errs.length?1:0);
