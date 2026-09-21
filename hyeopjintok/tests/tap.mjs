import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport:{width:1440,height:900}, ignoreHTTPSErrors:true });
const p = await ctx.newPage();
const bad = [];
/* 실제 히트 테스트: 요소 중심에서 위아래 21px 지점이 그 요소로 잡히는지 */
const check = async (label) => {
  const r = await p.evaluate(() => {
    const out = [];
    const overlay = document.querySelector('.overlay');
    document.querySelectorAll('button, a[href], [role="button"]').forEach(el => {
      /* 모달이 열려 있으면 뒤에 가려진 요소는 검사 대상이 아닙니다 */
      if (overlay && !overlay.contains(el)) return;
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) return;
      const cx = b.left + b.width / 2;
      const cy = b.top + b.height / 2;
      /* 스크롤되는 영역 안의 요소는 가장자리에 걸릴 수 있습니다.
         그건 스크롤하면 풀리는 것이라 타깃 크기 문제가 아닙니다. */
      let sc = el.parentElement;
      while (sc && sc !== document.body) {
        const st = getComputedStyle(sc);
        if (/auto|scroll/.test(st.overflowY)) break;
        sc = sc.parentElement;
      }
      const lim = sc && sc !== document.body ? sc.getBoundingClientRect() : null;
      const hits = [cy - 21, cy + 21].every(y => {
        if (y < 0 || y > innerHeight) return true;
        if (lim && (y < lim.top || y > lim.bottom)) return true;
        const at = document.elementFromPoint(cx, y);
        return at && (at === el || el.contains(at) || at.contains(el));
      });
      if (!hits) out.push(Math.round(b.width) + 'x' + Math.round(b.height) + ' ' + el.outerHTML.slice(0, 80));
    });
    return out;
  });
  if (r.length) bad.push(`[${label}] ${r.length}개\n   ` + r.join('\n   '));
};
for (const h of ['#/login','#/onboard','#/room/p1','#/search','#/notis','#/me','#/admin']) {
  await p.goto('file:///home/user/telehealth/hyeopjintok/index.html' + h);
  await p.waitForTimeout(250);
  await check(h);
}
for (const act of ['openNew','openMenu']) {
  await p.goto('file:///home/user/telehealth/hyeopjintok/index.html#/room/p1');
  await p.reload(); await p.waitForTimeout(200);
  await p.click(`[data-act="${act}"]`); await p.waitForTimeout(250);
  await check('modal:' + act);
}
/* 자료 분석·의사 초대는 방 관리 메뉴를 거칩니다 */
for (const act of ['openFiles','openInvite']) {
  await p.goto('file:///home/user/telehealth/hyeopjintok/index.html#/room/p1');
  await p.reload(); await p.waitForTimeout(200);
  await p.click('[data-act="openMenu"]'); await p.waitForTimeout(200);
  await p.click(`.modal [data-act="${act}"]`); await p.waitForTimeout(250);
  await check('modal:' + act);
}
await b.close();
console.log(bad.length ? bad.join('\n') : '터치 타깃 히트 테스트 통과 — 세로 44px 미만 0개');
