// /assets/tools/shell.js
// - 나라별 index.html에서 공통으로 사용
// - body의 data-tool 값에 따라 해당 tool page 모듈을 동적 import해서 실행

export async function mountTool(ctx) {
  const tool = (document.body?.dataset?.tool || "").trim(); // e.g. "stock/backtest"
  if (!tool) {
    document.getElementById("toolRoot").innerHTML =
      `<div class="rounded-3xl bg-white border border-rose-200 p-6">
        Missing <b>data-tool</b> on &lt;body&gt;.
      </div>`;
    return;
  }

  // "/assets/tools/stock/backtest/page.js" 같은 구조를 기대
  const modPath = `/assets/tools/${tool}/page.js`;

  try {
    const mod = await import(modPath);

    // page.js는 init(ctx) 형태를 권장
    if (typeof mod.init === "function") {
      await mod.init(ctx);
      return;
    }

    // default export도 허용
    if (typeof mod.default === "function") {
      await mod.default(ctx);
      return;
    }

    document.getElementById("toolRoot").innerHTML =
      `<div class="rounded-3xl bg-white border border-rose-200 p-6">
        Module loaded but no <b>init(ctx)</b> or <b>default(ctx)</b>: <code>${modPath}</code>
      </div>`;
  } catch (e) {
    document.getElementById("toolRoot").innerHTML =
      `<div class="rounded-3xl bg-white border border-rose-200 p-6">
        Failed to load tool module: <code>${modPath}</code><br/>
        <div class="mt-2 text-sm text-slate-600">${String(e).slice(0, 180)}</div>
      </div>`;
    console.error(e);
  }
}
