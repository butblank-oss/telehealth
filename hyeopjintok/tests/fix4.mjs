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

console.log('① 파일 고르기 버튼으로 실제 첨부');
await step('버튼을 눌러 고른 파일이 목록에 잡힌다', async () => {
  await p.click('[data-act="attach"]');
  await p.waitForSelector('#attach-input');
  const chooser = p.waitForEvent('filechooser');
  await p.click('[data-act="pickFiles"]');
  const fc = await chooser;
  await fc.setFiles(['fixtures/knee_ap.png', 'fixtures/knee_lat.png']);
  await p.waitForSelector('.up-item');
  if ((await p.locator('.up-item').count()) !== 2) throw new Error('목록에 안 잡힘');
});
await step('첨부하기 버튼이 눌린다', async () => {
  const dis = await p.locator('[data-act="submitSheet"]').getAttribute('aria-disabled');
  if (dis === 'true') throw new Error('버튼이 비활성');
  await p.fill('[data-k="attachPart"]', '우측 무릎 전후면');
  await p.click('[data-act="submitSheet"]');
  await p.waitForSelector('.attach-pending');
});
await step('더 고르기로 이어서 추가할 수 있다', async () => {
  await p.click('[data-act="editPending"]');
  await p.waitForSelector('.up-item');
  const chooser = p.waitForEvent('filechooser');
  await p.click('[data-act="pickFiles"]');
  (await chooser).setFiles(['fixtures/gait.dcm']);
  await p.waitForTimeout(500);
  if ((await p.locator('.up-item').count()) !== 3) throw new Error('추가 안 됨');
  await p.click('[data-act="submitSheet"]');
  await p.click('[data-act="send"]');
  await p.waitForTimeout(400);
});

console.log('\n② 자료 삭제와 되돌리기');
await step('시드 자료도 삭제할 수 있다', async () => {
  await p.click('[data-act="panel"][data-arg="files"]');
  await p.waitForTimeout(300);
  const before = await p.locator('.panel .digest').innerText();
  await p.locator('.panel .file-row').first().click();
  await p.waitForSelector('.viewer');
  await p.click('[data-act="startEdit"]');
  await p.waitForSelector('[data-act="deleteFile"]');
  await p.click('[data-act="deleteFile"]');
  await p.waitForTimeout(350);
  if (await p.locator('.viewer').count()) throw new Error('뷰어가 안 닫힘');
  const after = await p.locator('.panel .digest').innerText();
  if (before === after) throw new Error('자료 수가 그대로: ' + after);
});
await step('되돌리기 줄이 뜨고 실제로 되돌아간다', async () => {
  await p.waitForSelector('.undo-bar');
  const t = await p.locator('.undo-bar').innerText();
  if (!/삭제했습니다/.test(t)) throw new Error('undo=' + t);
  const gone = await p.locator('.panel .digest').innerText();
  await p.click('.undo-bar [data-act="undeleteFile"]');
  await p.waitForTimeout(350);
  const back = await p.locator('.panel .digest').innerText();
  if (gone === back) throw new Error('복구 안 됨');
  if (await p.locator('.undo-bar').count()) throw new Error('되돌리기 줄이 안 사라짐');
});
await p.screenshot({path:'shots/y1-undo.png'});
await step('자료 분석에서 삭제 예정 목록으로도 복구된다', async () => {
  await p.locator('.panel .file-row').first().click();
  await p.waitForSelector('.viewer');
  await p.click('[data-act="startEdit"]');
  await p.click('[data-act="deleteFile"]');
  await p.waitForTimeout(300);
  await p.click('[data-act="openMenu"]');
  await p.click('.modal [data-act="openFiles"]');
  await p.waitForSelector('.modal .trash-row');
  const t = await p.locator('.modal .trash-row').innerText();
  if (!/30일 뒤 삭제/.test(t)) throw new Error('유예 안내 없음: ' + t);
  await p.click('.modal .trash-row [data-act="undeleteFile"]');
  await p.waitForTimeout(300);
  if (await p.locator('.modal .trash-row').count()) throw new Error('복구 안 됨');
  await p.keyboard.press('Escape');
});
await step('삭제하면 감사 로그에 남는다', async () => {
  await p.locator('.panel .file-row').first().click();
  await p.click('[data-act="startEdit"]');
  await p.click('[data-act="deleteFile"]');
  await p.waitForTimeout(300);
  await p.click('.navrail [data-arg="admin"]');
  await p.click('[data-act="adminTab"][data-arg="audit"]');
  await p.click('[data-act="auditF"][data-arg="delete"]');
  await p.waitForTimeout(250);
  const t = await p.locator('.table').innerText();
  if (!/협진톡/.test(t)) throw new Error('자료 삭제 기록 없음');
});
await step('새로고침해도 삭제 상태가 유지된다', async () => {
  await p.goto(F+'#/room/p1'); await p.waitForTimeout(500);
  await p.click('[data-act="panel"][data-arg="files"]');
  await p.waitForTimeout(300);
  const t = await p.locator('.panel .digest').innerText();
  if (/\b8건\b/.test(t)) throw new Error('삭제가 유지되지 않음: ' + t);
});

console.log('\n③ 팝업 크기가 흔들리지 않기');
await step('자료를 넘겨도 팝업과 그림 크기가 같다', async () => {
  await p.locator('.panel .file-row').first().click();
  await p.waitForSelector('.viewer');
  const sizes = [];
  for (let i = 0; i < 5; i++) {
    sizes.push(await p.evaluate(() => {
      const v = document.querySelector('.viewer').getBoundingClientRect();
      const s = document.querySelector('.viewer__image').getBoundingClientRect();
      return v.height + ':' + Math.round(s.height);
    }));
    await p.click('[data-act="viewerNext"]');
    await p.waitForTimeout(200);
  }
  const uniq = [...new Set(sizes)];
  if (uniq.length !== 1) throw new Error('크기가 바뀜: ' + JSON.stringify(sizes));
});
await step('편집 모드로 들어가도 크기가 같다', async () => {
  const before = await p.locator('.viewer').evaluate(el => el.getBoundingClientRect().height);
  await p.click('[data-act="startEdit"]');
  await p.waitForTimeout(250);
  const after = await p.locator('.viewer').evaluate(el => el.getBoundingClientRect().height);
  if (Math.abs(before - after) > 1) throw new Error(before + ' → ' + after);
  await p.click('[data-act="cancelEdit"]');
});
await p.screenshot({path:'shots/y2-viewer.png'});

console.log('\n모바일');
const m=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,ignoreHTTPSErrors:true});
const mp=await m.newPage();
mp.on('pageerror',e=>errs.push('M PAGEERROR: '+e.message));
await mp.goto(F+'#/room/p1'); await mp.waitForTimeout(500);
await step('모바일: 팝업이 화면을 넘지 않는다', async () => {
  await mp.locator('#thread .bubble__caption').first().click();
  await mp.waitForSelector('.viewer');
  const box = await mp.locator('.viewer').boundingBox();
  if (box.y + box.height > 845) throw new Error('세로 넘침 ' + JSON.stringify(box));
});

await b.close();
console.log('\n=== 에러 '+errs.length+'건 ===');
errs.forEach(e=>console.log(' '+e));
process.exit(errs.length?1:0);
