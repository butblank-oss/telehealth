import { chromium } from 'playwright';
const F='file:///home/user/telehealth/hyeopjintok/index.html';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const ctx=await b.newContext({viewport:{width:1512,height:920},ignoreHTTPSErrors:true});
const p=await ctx.newPage();
p.on('pageerror',e=>console.log('PAGEERROR:',e.message));
await p.goto(F+'#/room/p1'); await p.waitForTimeout(600);
const cdp = await ctx.newCDPSession(p);

// 실제 한글 IME처럼 조합 단계를 거쳐 한 음절씩 확정
const SYL = {
  '우':['ㅇ','우'], '측':['ㅊ','츠','측'], '다':['ㄷ','다'], '리':['ㄹ','리'],
  '인':['ㅇ','이','인'], '공':['ㄱ','고','공'], '관':['ㄱ','과','관'], '절':['ㅈ','저','절'],
  '수':['ㅅ','수'], '술':['ㅅ','수','술'], '전':['ㅈ','저','전'],
  '사':['ㅅ','사'], '진':['ㅈ','지','진'],
};
async function type(sel, text) {
  await p.click(sel);
  for (const ch of text) {
    if (ch === ' ') { await cdp.send('Input.insertText',{text:' '}); await p.waitForTimeout(30); continue; }
    const stages = SYL[ch] || [ch];
    for (const st of stages) {
      await cdp.send('Input.imeSetComposition',{text:st,selectionStart:st.length,selectionEnd:st.length});
      await p.waitForTimeout(25);
    }
    await cdp.send('Input.insertText',{text:ch});
    await p.waitForTimeout(25);
  }
}

let fail = 0;
const check = async (label, sel, expect) => {
  const v = await p.inputValue(sel);
  const ok = v === expect;
  if (!ok) fail++;
  console.log(`  ${ok?'✓':'✗'} ${label}` + (ok ? '' : `  기대 ${JSON.stringify(expect)} / 실제 ${JSON.stringify(v)}`));
};

// ① 영상과 같은 문장을 첨부 모달 입력칸에 (검색 결과가 갱신되는 곳은 아님)
await p.click('[data-act="attach"]'); await p.waitForSelector('#attach-input');
await p.setInputFiles('#attach-input', ['fixtures/knee_ap.png']);
await p.waitForSelector('.up-item');
await type('[data-k="attachPart"]', '우측 다리 인공관절 수술 전 사진');
await p.waitForTimeout(300);
console.log('① 첨부 모달 부위·소견');
await check('영상 속 문장이 그대로 들어간다', '[data-k="attachPart"]', '우측 다리 인공관절 수술 전 사진');

// ② 자료별 설명 칸
await type('[data-k="updesc0"]', '우측 사진');
await p.waitForTimeout(250);
console.log('② 자료 설명');
await check('설명도 깨지지 않는다', '[data-k="updesc0"]', '우측 사진');
await p.click('.modal__foot [data-act="closeSheet"]');
await p.waitForSelector('.modal',{state:'detached'});

// ③ 대화 입력창 — 보내기 버튼이 실시간으로 바뀌는 곳
await type('[data-k="draft"]', '우측 다리 인공관절 수술 전 사진');
await p.waitForTimeout(300);
console.log('③ 대화 입력창');
await check('타이핑이 깨지지 않는다', '[data-k="draft"]', '우측 다리 인공관절 수술 전 사진');
const sendOn = await p.locator('[data-act="send"]').getAttribute('aria-disabled');
console.log(`  ${sendOn===null?'✓':'✗'} 보내기 버튼이 살아난다`);
if (sendOn !== null) fail++;

// ④ 검색 — 결과 목록이 매 글자마다 다시 그려지는 가장 험한 곳
await p.click('.navrail [data-arg="search"]'); await p.waitForTimeout(400);
await p.fill('[data-k="gq"]', '');
await type('[data-k="gq"]', '인공관절');
await p.waitForTimeout(300);
console.log('④ 전역 검색 (결과가 매 글자 갱신됨)');
await check('검색어가 깨지지 않는다', '[data-k="gq"]', '인공관절');

// ⑤ 새 협진 요청 — 힌트와 버튼이 같이 바뀌는 곳
await p.click('.navrail [data-arg="rooms"]'); await p.waitForTimeout(300);
await p.click('[data-act="openNew"]'); await p.waitForSelector('[data-k="formTitle"]');
await type('[data-k="formTitle"]', '수술 전 사진');
await p.waitForTimeout(250);
console.log('⑤ 새 협진 요청 제목');
await check('제목이 깨지지 않는다', '[data-k="formTitle"]', '수술 전 사진');
await check('환자 이름 칸도', '[data-k="f_pname"]', '');

// ⑥ 보내고 나면 칸이 비어야 한다 — 조합 보호가 "비우기"까지 막으면
//    같은 말을 두 번 보내게 된다
await p.goto(F + '#/room/p1');
await p.reload();
await p.waitForSelector('[data-k="draft"]');
await p.waitForTimeout(400);
console.log('⑥ 보낸 뒤 입력칸');
await type('[data-k="draft"]', '재활 강도');
await p.waitForTimeout(200);
await p.keyboard.press('Enter');
await p.waitForTimeout(400);
await check('엔터로 보내면 칸이 비워진다', '[data-k="draft"]', '');
const sent = await p.locator('#thread .msg').last().innerText();
console.log(`  ${/재활 강도/.test(sent) ? '✓' : '✗'} 보낸 글이 대화에 남는다`);
if (!/재활 강도/.test(sent)) fail++;
await type('[data-k="draft"]', '두 번째');
await p.click('[data-act="send"]');
await p.waitForTimeout(400);
await check('보내기 버튼으로도 비워진다', '[data-k="draft"]', '');

await b.close();
console.log(fail ? `\n=== 실패 ${fail}건 ===` : '\n=== 전부 통과 ===');
process.exit(fail?1:0);
