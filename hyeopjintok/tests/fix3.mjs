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

console.log('② 입력창 하단 고정');
await step('대화가 길어져도 입력창이 화면 바닥에 붙어 있다', async () => {
  for (let i = 0; i < 20; i++) {
    await p.fill('[data-k="draft"]', '경과 기록 ' + (i+1));
    await p.click('[data-act="send"]');
  }
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => {
    const c = document.querySelector('.composer').getBoundingClientRect();
    const t = document.querySelector('.thread');
    return { cBottom: Math.round(c.bottom), vh: innerHeight, sh: t.scrollHeight, ch: t.clientHeight };
  });
  if (Math.abs(r.cBottom - r.vh) > 2) throw new Error('입력창이 화면 밖: ' + JSON.stringify(r));
  if (r.sh <= r.ch) throw new Error('대화가 스크롤되지 않음');
});
await step('페이지 자체는 세로 스크롤이 없다', async () => {
  const o = await p.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight);
  if (o > 0) throw new Error('페이지가 세로로 넘침 ' + o);
});
await p.screenshot({path:'shots/x1-long.png'});

console.log('\n① 뷰어에서 이름·설명 고치기 · 자료 빼기');
await step('편집을 열면 이름·설명 칸이 있다', async () => {
  await p.goto(F+'#/room/p2'); await p.waitForTimeout(500);
  await p.locator('#thread .bubble__caption').first().click();
  await p.waitForSelector('.viewer');
  await p.click('[data-act="startEdit"]');
  await p.waitForSelector('[data-k="vname"]');
  if (!(await p.locator('[data-k="vnote"]').count())) throw new Error('설명 칸 없음');
});
await p.screenshot({path:'shots/x2-edit.png'});
await step('이름을 고치면 뷰어·리스트·패널·대화가 함께 바뀐다', async () => {
  await p.fill('[data-k="vname"]', '우측 발목 외측 (재촬영)');
  await p.fill('[data-k="vnote"]', '스트레스 촬영으로 다시 찍었습니다. 좌우 비교 가능합니다.');
  await p.click('[data-act="saveEdit"]');
  await p.waitForTimeout(350);
  const head = await p.locator('.viewer__head').innerText();
  if (!/재촬영/.test(head)) throw new Error('뷰어 제목=' + head);
  const side = await p.locator('.viewer__side').innerText();
  if (!/스트레스 촬영으로 다시/.test(side)) throw new Error('설명 미반영');
  const list = await p.locator('.viewer__list').innerText();
  if (!/재촬영/.test(list)) throw new Error('리스트 미반영');
  await p.click('.viewer__head [data-act="closeViewer"]');
  await p.click('[data-act="panel"][data-arg="files"]');
  await p.waitForTimeout(300);
  if (!/재촬영/.test(await p.locator('.panel').innerText())) throw new Error('패널 미반영');
});
await step('이름·설명 변경도 수정 내역에 남는다', async () => {
  await p.locator('.panel .file-row').first().click();
  await p.waitForSelector('[data-act="toggleHist"]');
  await p.click('[data-act="toggleHist"]');
  await p.waitForSelector('.viewer__hist-item');
  const t = await p.locator('.viewer__hist-list').innerText();
  if (!/자료 이름/.test(t)) throw new Error('이름 내역 없음');
  if (!/설명/.test(t)) throw new Error('설명 내역 없음');
});
await step('삭제는 30일 유예로 안내된다', async () => {
  await p.click('[data-act="startEdit"]');
  await p.waitForSelector('[data-act="deleteFile"]');
  const t = await p.locator('.viewer__side').innerText();
  if (!/30일 뒤 영구 삭제되며 그 전에는 되돌릴 수 있습니다/.test(t)) throw new Error('유예 안내 없음');
  await p.click('[data-act="cancelEdit"]');
  await p.click('.viewer__head [data-act="closeViewer"]');
});

console.log('\n③ 여러 파일을 올릴 때 무엇인지 보이기');
await step('이미지가 아닌 파일도 종류 아이콘과 이름이 뜬다', async () => {
  await p.waitForSelector('[data-act="attach"]');
  await p.click('[data-act="attach"]');
  await p.waitForSelector('#attach-input');
  await p.setInputFiles('#attach-input', ['fixtures/knee_ap.png', 'fixtures/gait.dcm', 'fixtures/knee_lat.png']);
  await p.waitForSelector('.up-item');
  const names = await p.locator('.up-item .t4-strong').allInnerTexts();
  if (names.length !== 3) throw new Error('목록=' + JSON.stringify(names));
  if (!names.includes('gait.dcm')) throw new Error('파일명 미표시');
  if ((await p.locator('.up-item__thumb svg').count()) !== 1) throw new Error('비이미지 아이콘 없음');
});
await step('보내기 전 대기 바에 미리보기와 이름이 뜬다', async () => {
  await p.fill('[data-k="updesc0"]', '우측 전후면');
  await p.fill('[data-k="updesc1"]', '보행 영상');
  await p.fill('[data-k="attachPart"]', '우측 발목 인대 손상 의심');
  await p.click('[data-act="submitSheet"]');
  await p.waitForSelector('.attach-pending');
  const n = await p.locator('.pend-thumb').count();
  if (n !== 3) throw new Error('미리보기=' + n);
  const t = await p.locator('.attach-pending').innerText();
  if (!/우측 전후면/.test(t) || !/보행 영상/.test(t)) throw new Error('이름 미표시: ' + t);
});
await p.screenshot({path:'shots/x3-pending.png'});
await step('보낸 뒤에도 타일마다 이름이 보인다', async () => {
  await p.click('[data-act="send"]');
  await p.waitForTimeout(400);
  const last = p.locator('#thread .msg').last();
  const names = await last.locator('.bubble__tile-name').allInnerTexts();
  if (names.length !== 3) throw new Error('타일 이름=' + JSON.stringify(names));
  if (!names.includes('우측 전후면')) throw new Error('설명이 이름으로 안 붙음');
  /* 설명을 적은 자료는 그 설명이, 안 적은 자료는 원본 파일명이 이름이 된다 */
  if (!names.includes('보행 영상')) throw new Error('설명이 이름으로 안 붙음: ' + JSON.stringify(names));
  if (!names.includes('knee_lat.png')) throw new Error('설명 없는 파일의 이름이 없음: ' + JSON.stringify(names));
});
await p.screenshot({path:'shots/x4-sent.png'});
await step('올린 자료는 뷰어에서 뺄 수 있다', async () => {
  await p.locator('#thread .bubble__tile').last().click();
  await p.waitForSelector('.viewer');
  await p.click('[data-act="startEdit"]');
  await p.waitForSelector('[data-act="deleteFile"]');
  const before = await p.locator('.viewer__item').count();
  await p.click('[data-act="deleteFile"]');
  await p.waitForTimeout(350);
  if (await p.locator('.viewer').count()) throw new Error('뷰어가 안 닫힘');
  const tiles = await p.locator('#thread .msg').last().locator('.bubble__tile').count();
  if (tiles !== 2) throw new Error('메시지에서 안 빠짐: ' + tiles);
});

await b.close();
console.log('\n=== 에러 '+errs.length+'건 ===');
errs.forEach(e=>console.log(' '+e));
process.exit(errs.length?1:0);
