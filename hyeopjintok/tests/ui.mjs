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
await step('줄에는 전체·안 읽음만', async () => {
  const chips = await p.locator('.rail__tabs .chip:not(.chip--more)').allInnerTexts();
  if (chips.length !== 2) throw new Error('chips=' + JSON.stringify(chips));
  if (!chips[0].startsWith('전체') || !chips[1].startsWith('안 읽음')) throw new Error(JSON.stringify(chips));
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
  if (chips.length !== 3 || !chips[2].startsWith('종료')) throw new Error('chips=' + JSON.stringify(chips));
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
await step('"내 차례"는 어디에도 없다', async () => {
  if ((await p.locator('.rail').innerText()).includes('내 차례')) throw new Error('목록에 남아 있음');
  await p.click('.navrail [data-arg="home"]');
  await p.waitForSelector('.home');
  if ((await p.locator('.home').innerText()).includes('내 차례')) throw new Error('홈에 남아 있음');
  await p.click('.navrail [data-arg="rooms"]');
  await p.waitForTimeout(250);
});
await step('목록 검색칸은 그 자리에서 목록만 거른다', async () => {
  await p.fill('[data-k="railq"]', '발목');
  await p.waitForTimeout(300);
  if (await p.evaluate(() => S.page) !== 'room') throw new Error('화면이 바뀜');
  const names = await p.locator('.rail .room-row__name').allInnerTexts();
  if (names.join(',') !== '이*연') throw new Error('걸러진 결과=' + names);
  await p.fill('[data-k="railq"]', 'zzz없음');
  await p.waitForTimeout(300);
  if (!/찾는 환자가 없습니다/.test(await p.locator('.rail').innerText())) throw new Error('빈 상태 없음');
  await p.click('[data-act="clearRailQ"]');
  await p.waitForTimeout(300);
  if (await p.locator('.rail .room-row').count() !== 5) throw new Error('지워도 안 돌아옴');
});
await p.screenshot({path:'shots/d2-list.png'});

console.log('\n새 협진 · 제외 확인 · 추정값 표시');
await step('새 협진 요청 버튼에 글자가 붙어 있다', async () => {
  const t = await p.locator('.rail .rail__new').innerText();
  if (!/새 협진 요청/.test(t)) throw new Error('글자 없음: ' + t);
  const box = await p.locator('.rail .rail__new').boundingBox();
  if (box.height < 44) throw new Error('버튼이 작음: ' + box.height);
});
await step('의사를 뺄 때는 먼저 묻는다', async () => {
  await p.goto(F + '#/room/p1'); await p.waitForTimeout(400);
  const before = await p.locator('.panel .member-row').count();
  await p.locator('.panel [data-act="askRemove"]').first().click();
  await p.waitForSelector('.modal');
  const t = await p.locator('.modal').innerText();
  if (!/더는 볼 수 없습니다/.test(t)) throw new Error('무엇이 끊기는지 안 알려줌');
  /* 취소하면 아무 일도 없어야 한다 */
  await p.click('.modal__foot [data-act="closeSheet"]');
  await p.waitForSelector('.modal', { state:'detached' });
  if (await p.locator('.panel .member-row').count() !== before) throw new Error('취소했는데 빠짐');
  /* 확인하면 그때 빠진다 */
  await p.locator('.panel [data-act="askRemove"]').first().click();
  await p.waitForSelector('.modal');
  await p.click('[data-act="submitSheet"]');
  await p.waitForTimeout(300);
  if (await p.locator('.panel .member-row').count() !== before - 1) throw new Error('확인했는데 안 빠짐');
});
await step('추정값은 잰 값처럼 보이지 않는다', async () => {
  const cap = await p.locator('#thread .bubble__caption').first().innerText();
  if (!/자동 추정/.test(cap)) throw new Error('배지=' + cap);
  if (!/≈/.test(cap)) throw new Error('어림 표시 없음: ' + cap);
  const style = await p.locator('#thread .bubble__caption').first()
    .evaluate(el => getComputedStyle(el).borderStyle);
  if (style !== 'dashed') throw new Error('점선이 아님: ' + style);
  await p.locator('#thread .bubble__caption').first().click();
  await p.waitForSelector('.viewer .auto-note');
  const note = await p.locator('.viewer .auto-note').innerText();
  if (!/진단 근거가 되지 않습니다/.test(note)) throw new Error('고지 문구 없음: ' + note);
  await p.click('.viewer__head [data-act="closeViewer"]');
});
await step('환자 이름은 기본으로 가려진다', async () => {
  const names = await p.locator('.rail .room-row__name').allInnerTexts();
  if (names.some(n => /박정우|김성호/.test(n))) throw new Error('이름이 그대로: ' + names);
  if (!names.includes('김*호')) throw new Error('가림 규칙이 다름: ' + names);
  /* 방 안에서는 잠깐 풀어볼 수 있어야 한다 */
  await p.click('.panel [data-act="reveal"]');
  await p.waitForTimeout(200);
  const shown = await p.locator('.room-header__title .t2').innerText();
  if (shown !== '박정우') throw new Error('안 풀림: ' + shown);
  await p.click('.panel [data-act="reveal"]');
  await p.waitForTimeout(200);
  /* 내 정보에서 아예 끌 수도 있다 */
  await p.click('.navrail [data-arg="me"]');
  await p.click('[data-act="toggle"][data-arg="mask"]');
  await p.click('.navrail [data-arg="rooms"]');
  await p.waitForTimeout(250);
  const off = await p.locator('.rail .room-row__name').allInnerTexts();
  if (!off.includes('김성호')) throw new Error('끄기가 안 먹음: ' + off);
  await p.click('.navrail [data-arg="me"]');
  await p.click('[data-act="toggle"][data-arg="mask"]');
  await p.goto(F + '#/room/p1'); await p.waitForTimeout(400);
});
await step('새 협진 요청은 환자 → 문의 → 의사 순서다', async () => {
  await p.click('[data-act="openNew"]');
  await p.waitForSelector('.modal');
  const order = await p.locator('.modal [data-k]').evaluateAll(
    ns => ns.map(n => n.dataset.k));
  const want = ['f_pname', 'f_age', 'f_sex', 'formTitle'];
  if (order.slice(0, 4).join(',') !== want.join(',')) throw new Error('순서=' + order);
  /* 성별은 고르는 칸이고, 기본은 아무것도 안 고른 [선택]이어야 합니다. */
  const opts = await p.locator('.modal #f_sex option').allInnerTexts();
  if (opts.join(',') !== '선택,남성,여성') throw new Error('보기=' + opts);
  if (await p.locator('.modal #f_sex').inputValue() !== '') throw new Error('기본값이 비어 있지 않음');
  await p.selectOption('.modal #f_sex', '남성');
  await p.waitForTimeout(200);
  if (await p.evaluate(() => S.form.sex) !== '남성') throw new Error('선택 안 됨');
  await p.selectOption('.modal #f_sex', '');
  await p.waitForTimeout(200);
  if (await p.evaluate(() => S.form.sex) !== '') throw new Error('[선택]로 못 돌아감');
  const t = await p.locator('.modal').innerText();
  for (const gone of ['부위', '거주 도시']) {
    if (t.includes(gone)) throw new Error('지운 칸이 남음: ' + gone);
  }
  await p.keyboard.press('Escape');
  await p.waitForSelector('.modal', { state:'detached' });
});
await step('물어본 문장이 첫 메시지로 전송된다', async () => {
  await p.click('[data-act="openNew"]');
  await p.waitForSelector('.modal');
  await p.fill('[data-k="f_pname"]', '정민석');
  await p.fill('[data-k="f_age"]', '45');
  await p.selectOption('#f_sex', '여성');
  await p.fill('[data-k="formTitle"]', '어깨 회전근개 파열 의심되는데 소견 부탁드립니다');
  await p.click('[data-act="submitSheet"]');
  await p.waitForTimeout(400);
  const t = await p.locator('#thread').innerText();
  if (!t.includes('어깨 회전근개 파열 의심되는데 소견 부탁드립니다')) throw new Error('첫 메시지 없음: ' + t);
  /* 적은 환자 정보가 첫 줄에 함께 실리고, 이름은 거기서도 가려져야 한다 */
  const intro = await p.locator('#thread .bubble__intro').first().innerText();
  if (intro !== '정*석, 45세, 여성') throw new Error('소개 줄=' + intro);
  /* 목록 마지막 줄도 시스템 문구가 아니라 그 질문이어야 한다 */
  const row = await p.locator('.rail .room-row').first().innerText();
  if (/방이 만들어졌습니다/.test(row)) throw new Error('목록에 시스템 문구가 남음');
  if (!/어깨 회전근개 파열/.test(row)) throw new Error('목록 줄=' + row);
});
await step('문의가 하나면 주제 바도 구분선도 안 나온다', async () => {
  if (await p.locator('.topic-bar').count()) throw new Error('주제 바가 보임');
  if (await p.locator('#thread .divider-topic').count()) throw new Error('주제 구분선이 보임');
  /* 그래도 방 안 검색은 열려야 한다 — 문의 개수와 무관한 기능이다 */
  await p.click('[data-act="openSearch"]');
  await p.waitForSelector('[data-k="roomq"]');
  await p.click('[data-act="closeSearch"]');
  await p.waitForTimeout(200);
  /* 문의가 둘인 방에서는 바가 나온다 */
  await p.goto(F + '#/room/p1'); await p.waitForTimeout(400);
  if (!(await p.locator('.topic-bar .chip').count())) throw new Error('문의 2개 방에 바가 없음');
});
await step('문의 이름은 낱말 중간에서 안 잘린다', async () => {
  const label = await p.evaluate(() => S.extraRooms[0].threads[0].label);
  if (!/^어깨 회전근개 파열$/.test(label)) throw new Error('label=' + label);
});
await step('목록은 무조건 최신순이다', async () => {
  await p.goto(F + '#/room/p5'); await p.waitForTimeout(400);
  await p.fill('[data-k="draft"]', '경과 확인했습니다');
  await p.click('[data-act="send"]');
  await p.waitForTimeout(400);
  const names = await p.locator('.rail .room-row__name').allInnerTexts();
  if (names[0] !== '이*민') throw new Error('방금 답한 방이 맨 위가 아님: ' + names);
  const whens = await p.locator('.rail .room-row__when').allInnerTexts();
  if (whens[0] !== '방금') throw new Error('시간 순서가 아님: ' + whens);
});
await step('방을 열면 그 방 안 읽음이 사라진다', async () => {
  await p.click('[data-act="tab"][data-arg="unread"]');
  await p.waitForTimeout(250);
  const before = await p.locator('.rail .room-row').count();
  if (!before) throw new Error('안 읽음 방이 없음');
  await p.locator('.rail .room-row').first().click();
  await p.waitForTimeout(400);
  const after = await p.locator('.rail .room-row').count();
  if (after !== before - 1) throw new Error(`안 읽음이 안 줄어듦 ${before} → ${after}`);
  await p.click('[data-act="tab"][data-arg="all"]');
  await p.waitForTimeout(250);
});
await step('목록에서 바로 보관·삭제할 수 있다', async () => {
  const rows = await p.locator('.rail .room-row').count();
  await p.locator('.rail [data-act="rowMenu"]').first().click({ force: true });
  await p.waitForSelector('.room-row__pop');
  const items = await p.locator('.room-row__pop').innerText();
  if (!/보관/.test(items) || !/삭제/.test(items)) throw new Error('메뉴=' + items);
  await p.click('.room-row__pop [data-act="rowArchive"]');
  await p.waitForTimeout(350);
  if (await p.evaluate(() => Object.keys(S.archived).length) !== 1) throw new Error('보관 안 됨');
  if (await p.locator('.rail .room-row').count() !== rows - 1) throw new Error('목록에서 안 빠짐');
  /* 보관함에서 되돌릴 수도 있어야 한다 */
  await p.click('[data-act="toggleTabMenu"]');
  await p.click('.tabmenu__item[data-arg="archive"]');
  await p.waitForTimeout(300);
  await p.locator('.rail [data-act="rowMenu"]').first().click({ force: true });
  await p.click('.room-row__pop [data-act="rowArchive"]');
  await p.waitForTimeout(300);
  if (await p.evaluate(() => Object.keys(S.archived).length) !== 0) throw new Error('보관 해제 안 됨');
  await p.click('[data-act="tab"][data-arg="all"]');
  await p.waitForTimeout(250);
});
await step('날짜와 주제 구분선이 서로를 밀어내지 않는다', async () => {
  /* 앞 단계에서 의사를 빼고 보관하고 별을 달았습니다.
     여기부터는 처음 상태에서 봐야 하므로 새로 읽습니다. */
  await p.goto(F + '#/room/p1'); await p.reload(); await p.waitForTimeout(600);
  const days = await p.locator('#thread .divider-day').allInnerTexts();
  const want = await p.evaluate(() => {
    const o = []; ['p1t1','p1t2'].forEach(k => MSGS[k].forEach(m => { if (m.day && o.indexOf(m.day) < 0) o.push(m.day); }));
    return o;
  });
  if (days.join(',') !== want.join(',')) throw new Error(`날짜 ${days} ≠ 데이터 ${want}`);
  if (!(await p.locator('#thread .divider-topic').count())) throw new Error('주제 구분선이 사라짐');
});
await step('누구 말이든 중요 표시를 달고 뗄 수 있다', async () => {
  const before = await p.locator('#thread .msg__star.is-on').count();
  const other = p.locator('#thread .msg:not(.msg--mine) [data-act="toggleMsgStar"]').first();
  await other.click({ force: true });
  await p.waitForTimeout(300);
  if (await p.locator('#thread .msg__star.is-on').count() !== before + 1) throw new Error('상대 메시지에 별이 안 달림');
  await other.click({ force: true });
  await p.waitForTimeout(300);
  if (await p.locator('#thread .msg__star.is-on').count() !== before) throw new Error('별이 안 떨어짐');
});
await step('★ 중요 칩으로 표시한 것만 모아 본다', async () => {
  const chip = p.locator('[data-act="topic"][data-arg="star"]');
  if (!(await chip.count())) throw new Error('중요 칩이 없음');
  const n = +(await chip.innerText()).replace(/\D/g, '');
  await chip.click();
  await p.waitForTimeout(350);
  const shown = await p.locator('#thread .msg').count();
  if (shown !== n) throw new Error(`칩은 ${n}건인데 ${shown}건 보임`);
  const off = await p.locator('#thread .msg__star:not(.is-on)').count();
  if (off) throw new Error('중요가 아닌 메시지가 섞임');
  await p.click('[data-act="topic"][data-arg="all"]');
  await p.waitForTimeout(300);
});
await step('읽음을 누르면 누가 읽었고 누가 아직인지 나온다', async () => {
  const reads = p.locator('#thread [data-act="toggleRead"]');
  const labels = await reads.allInnerTexts();
  if (!labels.some(t => /읽음 1/.test(t))) throw new Error('부분 읽음이 없음: ' + labels);
  const idx = labels.findIndex(t => /읽음 1/.test(t));
  await reads.nth(idx).click({ force: true });
  await p.waitForSelector('.readpop');
  const t = (await p.locator('.readpop').innerText()).replace(/\n/g, ' ');
  if (!/읽음/.test(t) || !/아직/.test(t)) throw new Error('읽음/아직이 안 갈림: ' + t);
  if (!/원장/.test(t)) throw new Error('이름이 없음: ' + t);
  const bb = await p.locator('.readpop').boundingBox();
  if (bb.x < 0 || bb.x + bb.width > 1440) throw new Error('팝업이 화면 밖');
  await p.keyboard.press('Escape');
  await p.click('#thread', { position: { x: 20, y: 20 } });
  await p.waitForTimeout(250);
});
await step('소견을 길게 쓰면 입력칸이 늘어난다', async () => {
  const h1 = (await p.locator('[data-k="draft"]').boundingBox()).height;
  await p.fill('[data-k="draft"]', '한 줄\n두 줄\n세 줄\n네 줄\n다섯 줄');
  await p.waitForTimeout(300);
  const h2 = (await p.locator('[data-k="draft"]').boundingBox()).height;
  if (h2 <= h1) throw new Error(`안 늘어남 ${h1} → ${h2}`);
  if (await p.locator('[data-k="draft"]').evaluate(el => el.scrollHeight > el.clientHeight + 1))
    throw new Error('다섯 줄인데 스크롤이 생김');
  /* 끝없이 늘어나면 대화가 안 보입니다 — 여섯 줄에서 멈춰야 합니다 */
  await p.fill('[data-k="draft"]', Array.from({length:12},(_,i)=>'줄 '+i).join('\n'));
  await p.waitForTimeout(300);
  const h3 = (await p.locator('[data-k="draft"]').boundingBox()).height;
  if (h3 > 170) throw new Error('안 멈춤: ' + h3);
  await p.fill('[data-k="draft"]', '');
  await p.waitForTimeout(250);
});
await step('입력 영역에서 중요 체크박스와 보관 기한 문구를 뺐다', async () => {
  const t = await p.locator('.composer').innerText();
  if (/중요 표시/.test(t)) throw new Error('체크박스가 남음');
  if (/보관 기한/.test(t)) throw new Error('보관 기한 문구가 남음');
});
await step('보낸 메시지를 지우면 자리만 남는다', async () => {
  const del = p.locator('#thread .msg--mine [data-act="askDeleteMsg"]');
  if (await p.locator('#thread .msg:not(.msg--mine) [data-act="askDeleteMsg"]').count())
    throw new Error('상대 메시지에도 삭제가 붙음');
  await del.last().click({ force: true });
  await p.waitForSelector('.delpop');
  await p.click('[data-act="cancelDeleteMsg"]');
  await p.waitForTimeout(250);
  if (await p.locator('.bubble--gone').count()) throw new Error('취소했는데 삭제됨');
  await del.last().click({ force: true });
  await p.waitForSelector('.delpop');
  await p.click('[data-act="deleteMsg"]');
  await p.waitForTimeout(350);
  if (!/삭제된 메시지입니다/.test(await p.locator('.bubble--gone').innerText()))
    throw new Error('자리가 안 남음');
  const row = await p.evaluate(() => AUDIT_ROWS[0]);
  if (row[2] !== '삭제' || !/대화/.test(row[3])) throw new Error('감사 로그=' + row);
});
await step('부위·소견이 비면 한 번 묻고, 그래도 보낼 수 있다', async () => {
  await p.click('[data-act="attach"]');
  await p.waitForSelector('#attach-input');
  await p.setInputFiles('#attach-input', ['fixtures/knee_ap.png']);
  await p.waitForSelector('.up-item');
  await p.click('[data-act="submitSheet"]');
  await p.waitForTimeout(350);
  if (!(await p.locator('.modal').count())) throw new Error('그냥 첨부돼 버림');
  const w = await p.locator('.note-warn').innerText();
  if (!/knee_ap\.png/.test(w)) throw new Error('무엇만 보이는지 안 알려줌: ' + w);
  await p.click('[data-act="confirmNoPart"]');
  await p.waitForTimeout(350);
  if (!(await p.locator('.attach-pending').count())) throw new Error('그래도 첨부가 안 됨');
  await p.click('[data-act="clearFile"]');
  await p.waitForTimeout(250);
});
await step('헤더에 대화 기간이 있다', async () => {
  const t = await p.locator('.room-header__title').innerText();
  if (!/3월 11일 ~ 3월 14일/.test(t)) throw new Error('기간 없음: ' + t);
});
await step('협진이라고 부른다 — 상담이 아니라', async () => {
  const t = await p.locator('#thread .close-cta').innerText();
  if (!/협진 종료하기/.test(t)) throw new Error('버튼=' + t);
  if (/상담/.test(t)) throw new Error('상담이 남아 있음');
});

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
await step('모바일: 정리 버튼이 손가락에 늘 보이고 화면을 안 넘친다', async () => {
  const btn = mp.locator('.screen__body [data-act="rowMenu"]').first();
  const bb = await btn.boundingBox();
  if (!bb || bb.height < 44) throw new Error('버튼 크기=' + JSON.stringify(bb));
  if (await btn.evaluate(el => getComputedStyle(el).opacity) !== '1') throw new Error('버튼이 안 보임');
  await btn.click({ force: true });
  await mp.waitForSelector('.room-row__pop');
  const pop = await mp.locator('.room-row__pop').boundingBox();
  if (pop.x < 0 || pop.x + pop.width > 391) throw new Error('메뉴가 화면 밖: ' + JSON.stringify(pop));
  const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (over > 0) throw new Error('가로 넘침 ' + over);
});

await b.close();
console.log('\n=== 에러 '+errs.length+'건 ===');
errs.forEach(e=>console.log(' '+e));
process.exit(errs.length?1:0);
