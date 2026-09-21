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

console.log('① 자료 뷰어 왼쪽 리스트');
await step('리스트에 이 방 자료 6건이 세워진다', async () => {
  await p.locator('#thread .bubble__caption').last().click();
  await p.waitForSelector('.viewer__list');
  const n = await p.locator('.viewer__item').count();
  if (n !== 6) throw new Error('items=' + n);
  const active = await p.locator('.viewer__item.is-active .viewer__item-name').innerText();
  if (active !== '보행 영상') throw new Error('active=' + active);
});
await step('리스트를 누르면 바로 넘어간다', async () => {
  await p.locator('.viewer__item').first().click();
  await p.waitForTimeout(250);
  const title = await p.locator('.viewer__head .t2').innerText();
  if (title !== '기립 전후면') throw new Error('title=' + title);
  const t = await p.locator('.viewer__side').innerText();
  if (!/내측 관절간격/.test(t)) throw new Error('계측 안 바뀜');
  const nav = await p.locator('.viewer__nav .num').innerText();
  if (nav !== '1 / 6') throw new Error('nav=' + nav);
});
await p.screenshot({path:'shots/b1-list.png'});
await step('수정된 자료는 리스트에서 점으로 표시된다', async () => {
  await p.click('[data-act="startEdit"]');
  await p.fill('[data-k="mx0"]', '2.9 mm');
  await p.click('[data-act="saveEdit"]');
  await p.waitForTimeout(300);
  if (!(await p.locator('.viewer__item.is-active .viewer__item-dot').count())) throw new Error('점 없음');
});

console.log('\n② 여러 자료 한 번에 첨부');
await step('첨부 버튼 → 파일 고르기 모달', async () => {
  await p.click('.viewer__head [data-act="closeViewer"]');
  await p.click('[data-act="attach"]');
  await p.waitForSelector('.modal #attach-input');
  const t = await p.locator('.modal').innerText();
  if (!/10개까지/.test(t)) throw new Error('최대 개수 안내 없음');
  if (!/부위 · 소견/.test(t)) throw new Error('부위·소견 없음');
  /* 종류·측·시점을 고르던 칩 14개는 없어지고, 입력칸은 부위·소견 하나뿐이어야 한다 */
  if (await p.locator('.modal [data-act="attachPick"]').count()) throw new Error('선택 칩이 남아 있음');
  const fields = await p.locator('.modal input[type="text"]').count();
  if (fields !== 1) throw new Error('입력칸 수=' + fields);
});
await step('파일 3개를 한 번에 고른다', async () => {
  await p.setInputFiles('#attach-input', ['fixtures/knee_ap.png', 'fixtures/knee_lat.png', 'fixtures/gait.dcm']);
  await p.waitForSelector('.up-item');
  const n = await p.locator('.up-item').count();
  if (n !== 3) throw new Error('items=' + n);
  const t = await p.locator('.modal').innerText();
  if (!t.includes('3 / 10개 선택됨')) throw new Error('개수 표시 없음');
  if (!/사진/.test(t) || !/X-ray/.test(t)) throw new Error('종류 추론 실패');
  if ((await p.locator('.up-item__thumb img').count()) !== 2) throw new Error('미리보기 없음');
});
await step('자료마다 설명, 묶음에 부위·소견', async () => {
  await p.fill('[data-k="updesc0"]', '우측 기립 전후면');
  await p.fill('[data-k="updesc1"]', '우측 측면');
  await p.fill('[data-k="attachPart"]', '우측 무릎 내측 반월상연골 파열');
  await p.waitForTimeout(200);
});
await step('하나 빼면 개수가 줄어든다', async () => {
  await p.locator('.up-item [data-act="attachRemove"]').last().click();
  await p.waitForTimeout(250);
  if ((await p.locator('.up-item').count()) !== 2) throw new Error('빼기 실패');
  const label = await p.locator('[data-act="submitSheet"]').innerText();
  if (!/2개 첨부하기/.test(label)) throw new Error('버튼=' + label);
});
await p.screenshot({path:'shots/b2-attach.png'});
await step('첨부하면 입력창 위에 정리되어 뜬다', async () => {
  await p.click('[data-act="submitSheet"]');
  await p.waitForSelector('.attach-pending');
  const t = await p.locator('.attach-pending').innerText();
  if (!/자료 2건/.test(t)) throw new Error('대기 바=' + t);
  if (!/우측 무릎 내측 반월상연골 파열/.test(t)) throw new Error('부위·소견 미표시');
});
await step('전송하면 말풍선에 자료 2개가 붙는다', async () => {
  await p.fill('[data-k="draft"]', '수술 전 사진 올립니다.');
  await p.click('[data-act="send"]');
  await p.waitForTimeout(400);
  const last = p.locator('#thread .msg').last();
  if ((await last.locator('.bubble__tile').count()) !== 2) throw new Error('타일 수 불일치');
  if ((await last.locator('.bubble__tile-img').count()) !== 2) throw new Error('이미지 미리보기 없음');
  if (!/우측 무릎 내측 반월상연골 파열/.test(await last.innerText())) throw new Error('부위·소견 캡션 없음');
});
await p.screenshot({path:'shots/b3-sent.png'});
await step('자료 목록·패널에도 등록된다', async () => {
  await p.click('[data-act="panel"][data-arg="files"]');
  await p.waitForTimeout(300);
  const t = await p.locator('.panel .digest').innerText();
  if (!/8건/.test(t)) throw new Error('자료 건수 미반영: ' + t);
});
await step('뷰어에서 설명·부위·소견과 실제 그림이 보인다', async () => {
  await p.locator('#thread .bubble__tile').last().click();
  await p.waitForSelector('.viewer .attach-info');
  const t = await p.locator('.viewer__side').innerText();
  if (!/우측 무릎 내측 반월상연골 파열/.test(t)) throw new Error('부위·소견 없음');
  if (!/자동 계측 결과가 아직 없습니다/.test(t)) throw new Error('안내 없음');
  /* 올린 그림이 회색 상자가 아니라 실제로 보여야 한다 */
  if (!(await p.locator('.viewer__img').count())) throw new Error('뷰어에 그림이 없음');
  const ok = await p.locator('.viewer__img').evaluate(el => el.complete && el.naturalWidth > 0);
  if (!ok) throw new Error('그림이 안 그려짐');
  if (!(await p.locator('.viewer__item-thumb img').count())) throw new Error('리스트 썸네일에 그림이 없음');
  const head = await p.locator('.viewer__head').innerText();
  if (!/knee_/.test(head)) throw new Error('원본 파일명 없음: ' + head);
  await p.click('.viewer__head [data-act="closeViewer"]');
});
await step('10개를 넘겨 고르면 알려준다', async () => {
  await p.click('[data-act="attach"]');
  await p.waitForSelector('#attach-input');
  const many = Array.from({ length: 12 }, () => 'fixtures/knee_ap.png');
  await p.setInputFiles('#attach-input', many);
  await p.waitForTimeout(400);
  const n = await p.locator('.up-item').count();
  if (n !== 10) throw new Error('담긴 수=' + n);
  const t = await p.locator('.modal').innerText();
  if (!/2개는 담지 못했습니다/.test(t)) throw new Error('넘침 안내 없음');
  await p.click('.modal__foot [data-act="closeSheet"]');
  await p.waitForSelector('.modal', { state: 'detached' });
});

await step('새로 만든 방에 올린 자료도 뷰어가 찾는다', async () => {
  await p.click('[data-act="openNew"]');
  await p.waitForSelector('[data-k="formTitle"]');
  await p.fill('[data-k="formTitle"]', '어깨 회전근개 소견 부탁드립니다');
  await p.fill('[data-k="f_pname"]', 'Lê Minh Anh');
  await p.click('[data-act="submitSheet"]');
  await p.waitForTimeout(300);
  await p.click('[data-act="attach"]');
  await p.waitForSelector('#attach-input');
  await p.setInputFiles('#attach-input', ['fixtures/knee_ap.png']);
  await p.waitForSelector('.up-item');
  await p.fill('[data-k="attachPart"]', '우측 어깨 정면');
  await p.click('[data-act="submitSheet"]');
  await p.waitForSelector('.attach-pending');
  await p.click('[data-act="send"]');
  await p.waitForTimeout(400);
  await p.locator('#thread .bubble__tile').last().click();
  await p.waitForSelector('.viewer');
  const head = await p.locator('.viewer__head').innerText();
  if (!/Lê Minh Anh/.test(head)) throw new Error('방을 못 찾음: ' + head);
  if (!(await p.locator('.viewer__img').count())) throw new Error('그림 없음');
  await p.click('.viewer__head [data-act="closeViewer"]');
  await p.goto(F+'#/room/p1'); await p.waitForTimeout(400);
});

console.log('\n③ 한글 입력');
const cdp = await ctx.newCDPSession(p);
await step('조합 중에 자모로 쪼개지지 않는다', async () => {
  await p.fill('[data-k="draft"]', '');
  await p.click('[data-k="draft"]');
  for (const s of [{st:['ㅇ','오'],f:'오'},{st:['ㄹ','르'],f:'른'},{st:['ㅉ','쪼'],f:'쪽'}]) {
    for (const x of s.st) { await cdp.send('Input.imeSetComposition',{text:x,selectionStart:x.length,selectionEnd:x.length}); await p.waitForTimeout(20); }
    await cdp.send('Input.insertText',{text:s.f}); await p.waitForTimeout(20);
  }
  await p.waitForTimeout(250);
  const v = await p.inputValue('[data-k="draft"]');
  if (v !== '오른쪽') throw new Error('입력=' + JSON.stringify(v));
});
await step('조합 중 Enter는 전송되지 않는다', async () => {
  const before = await p.locator('#thread .msg').count();
  await cdp.send('Input.imeSetComposition',{text:'ㄱ',selectionStart:1,selectionEnd:1});
  await p.keyboard.press('Enter');
  await p.waitForTimeout(250);
  const after = await p.locator('#thread .msg').count();
  if (after !== before) throw new Error('조합 중에 전송됨');
});

console.log('\n모바일');
const m=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,ignoreHTTPSErrors:true});
const mp=await m.newPage();
mp.on('pageerror',e=>errs.push('M PAGEERROR: '+e.message));
await mp.goto(F+'#/room/p1'); await mp.waitForTimeout(500);
await step('모바일: 리스트가 가로 띠로 눕고 화면을 안 넘친다', async () => {
  await mp.locator('#thread .bubble__caption').last().click();
  await mp.waitForSelector('.viewer__list');
  const box = await mp.locator('.viewer').boundingBox();
  if (box.width > 391 || box.y + box.height > 845) throw new Error('넘침 ' + JSON.stringify(box));
  await mp.locator('.viewer__item').first().click();
  await mp.waitForTimeout(250);
  const t = await mp.locator('.viewer__head .t2').innerText();
  if (t !== '기립 전후면') throw new Error('이동 안 됨: ' + t);
});
await mp.screenshot({path:'shots/b4-m-viewer.png'});

await b.close();
console.log('\n=== 에러 '+errs.length+'건 ===');
errs.forEach(e=>console.log(' '+e));
process.exit(errs.length?1:0);
