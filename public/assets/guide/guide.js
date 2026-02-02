// assets/guide/guide.js
import { GUIDE_DATA } from "./guide-data.js";
import { bindGoLinks } from "/assets/app.js"; // ✅ 동적 주입 후 go-link 다시 바인딩

function el(id) { return document.getElementById(id); }
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

// region별 FX 정책 (네 기존 endpoint 혼용을 감안해서 안전하게 구성)
function getFxPolicy(ctx) {
  const r = (ctx?.region?.code || "kr").toLowerCase();
  if (r === "kr") return { showFx: true, localCcy: "KRW", locale: "ko-KR", pair: "USDKRW" };
  if (r === "ca") return { showFx: true, localCcy: "CAD", locale: "en-CA", pair: "USDCAD" };
  return { showFx: false, localCcy: "USD", locale: "en-US", pair: "USDUSD" };
}

function fmtPct(v) {
  if (!Number.isFinite(v)) return "-";
  const sign = v > 0 ? "+" : "";
  return sign + (v * 100).toFixed(2) + "%";
}
function fmtUSD(v) {
  if (!Number.isFinite(v)) return "-";
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtLocal(v, currency, locale) {
  if (!Number.isFinite(v)) return "-";
  if (currency === "KRW") return "₩" + Math.round(v).toLocaleString(locale);
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(v);
}
function ymd(d) { return new Date(d).toISOString().slice(0, 10); }
function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function calcStartByRange(endStr, range) {
  if (range === "1M") return addDays(endStr, -40);
  if (range === "6M") return addDays(endStr, -220);
  if (range === "1Y") return addDays(endStr, -400);
  if (range === "5Y") return addDays(endStr, -2000);
  return addDays(endStr, -400);
}
function normalizeDateKey(d) { return d ? String(d).slice(0, 10) : null; }
function pickFxValue(p) {
  const v = p?.close ?? p?.rate ?? p?.value ?? p?.fx ?? p?.price ?? p?.adjClose ?? p?.adj_close;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function buildFxMap(rows) {
  const map = new Map();
  for (const x of rows || []) {
    const k = normalizeDateKey(x?.date);
    const n = pickFxValue(x);
    if (k && n && n > 0) map.set(k, n);
  }
  return map;
}
function getFxSmart(dateStr, fxMap, fxDatesSorted) {
  if (fxMap.has(dateStr)) return fxMap.get(dateStr);
  const next = addDays(dateStr, +1);
  if (fxMap.has(next)) return fxMap.get(next);
  for (let k = 1; k <= 7; k++) {
    const prev = addDays(dateStr, -k);
    if (fxMap.has(prev)) return fxMap.get(prev);
  }
  // binary search floor
  let lo = 0, hi = fxDatesSorted.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (fxDatesSorted[mid] <= dateStr) { ans = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  if (ans >= 0) return fxMap.get(fxDatesSorted[ans]);
  return fxMap.get(fxDatesSorted[0]) || null;
}

async function fetchHistory(ticker, start, end) {
  const url = `/api/schdHistory?ticker=${encodeURIComponent(ticker)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ✅ fxHistory endpoint가 pair 유/무가 섞여있어서: pair로 시도 → 실패하면 pair 없이 재시도
async function fetchFX(pair, start, end) {
  const try1 = `/api/fxHistory?pair=${encodeURIComponent(pair)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  let r = await fetch(try1);
  if (r.ok) return r.json();

  const try2 = `/api/fxHistory?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  r = await fetch(try2);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function buildKeyCards(cards) {
  const grid = document.getElementById("g_key_grid");
  grid.innerHTML = "";
  for (const c of cards || []) {
    const div = document.createElement("div");
    div.className = "rounded-2xl bg-white border border-slate-100 p-5";
    div.innerHTML = `
      <div class="text-xs font-black text-slate-500 uppercase">${escapeHtml(c.k)}</div>
      <div class="mt-2 font-extrabold text-lg">${escapeHtml(c.v)}</div>
      <p class="mt-2 text-sm text-slate-600">${escapeHtml(c.d)}</p>
    `;
    grid.appendChild(div);
  }
}

function buildList(ulId, items) {
  const ul = document.getElementById(ulId);
  ul.innerHTML = "";
  for (const s of items || []) {
    const li = document.createElement("li");
    li.textContent = String(s);
    ul.appendChild(li);
  }
}

function buildFaq(list) {
  const wrap = document.getElementById("g_faq_list");
  wrap.innerHTML = "";
  for (const it of list || []) {
    const d = document.createElement("details");
    d.className = "rounded-2xl border border-slate-200 bg-slate-50 p-4";
    d.innerHTML = `
      <summary class="font-extrabold cursor-pointer">${escapeHtml(it.q)}</summary>
      <p class="mt-2 text-sm text-slate-600 leading-relaxed">${escapeHtml(it.a)}</p>
    `;
    wrap.appendChild(d);
  }
}

function buildOtherTickers(otherTickers, market, regionCode) {
  const grid = document.getElementById("g_other_grid");
  grid.innerHTML = "";
  const list = (otherTickers || []).slice(0, 3);
  for (const t of list) {
    const a = document.createElement("a");
    a.href = `/${regionCode}/guide/${market}/ticker/${String(t).toLowerCase()}/`;
    a.setAttribute("data-go", "guide");
    a.setAttribute("data-market", market);
    a.setAttribute("data-ticker", String(t).toUpperCase());
    a.className = "go-link rounded-2xl border border-slate-200 hover:border-slate-300 bg-slate-50 p-5 transition";
    a.innerHTML = `
      <div class="text-xs font-black text-slate-500 uppercase">Guide</div>
      <div class="mt-2 text-lg font-extrabold">${escapeHtml(String(t).toUpperCase())}</div>
      <p class="mt-2 text-sm text-slate-600">Open guide</p>
    `;
    grid.appendChild(a);
  }
}

export async function renderGuide(ctx, { ticker, market = "nasdaq", accent = "#f59e0b" }) {
  const t = String(ticker || "").toUpperCase();
  if (!GUIDE_DATA[t]) throw new Error(`GUIDE_DATA missing: ${t}`);

  // 템플릿 로드 & 삽입
  const tplRes = await fetch("/assets/guide/template.html", { cache: "no-cache" });
  if (!tplRes.ok) throw new Error("template.html not found");
  const tpl = await tplRes.text();

  const root = document.getElementById("guideRoot");
  root.innerHTML = tpl;

  // accent
  root.style.setProperty("--accent", accent);

  const lang = (ctx?.lang || ctx?.region?.lang || "ko") === "en" ? "en" : "ko";
  const data = GUIDE_DATA[t][lang];

  // HERO
  el("g_badge").textContent = data.badge;
  el("g_title").textContent = `${data.title} (${String(ctx?.region?.code || "").toUpperCase()})`;
  el("g_desc").innerHTML = data.desc; // 데이터에서 <b> 허용한 경우가 있어 innerHTML
  el("g_btn_backtest").textContent = data.btnBacktest;
  el("g_btn_future").textContent = data.btnFuture;

  el("g_btn_backtest").setAttribute("data-ticker", t);
  el("g_btn_future").setAttribute("data-ticker", t);

  // PRICE labels
  el("g_price_title").textContent = data.priceTitle;
  el("g_price_sub").textContent = data.priceSub;
  el("g_ticker_label").textContent = t;
  el("g_trend_label").textContent = data.trendLabel;

  // KEY/GOOD/WATCH/FAQ/DISCLAIMER
  buildKeyCards(data.keyCards);
  el("g_good_title").textContent = data.goodTitle;
  el("g_watch_title").textContent = data.watchTitle;
  buildList("g_good_list", data.good);
  buildList("g_watch_list", data.watch);

  el("g_faq_title").textContent = data.faqTitle;
  el("g_faq_sub").textContent = data.faqSub;
  buildFaq(data.faq);

  el("g_disclaimer_title").textContent = data.disclaimerTitle;
  el("g_disclaimer_desc").textContent = data.disclaimerDesc;
  el("g_disclaimer_data").textContent = data.disclaimerData;

  el("g_other_title").textContent = data.otherTitle;
  el("g_other_sub").textContent = data.otherSub;
  el("g_region_label").textContent = String(ctx?.region?.code || "").toUpperCase();

  // other tickers (자기 자신 제외 추천)
  const others = ["SCHD", "SPY", "QQQ", "TQQQ"].filter(x => x !== t);
  buildOtherTickers(others, market, ctx.region.code);

  // ✅ 동적 주입 후 go-link 재바인딩(중요)
  bindGoLinks(ctx.region.code);

  // ✅ Price widget init (공용)
  initPriceWidget(ctx, t);
}

/***********************
 * Price Widget (shared)
 ***********************/
let _chart;
let _displayCurrencyMode = "USD";
let _cachedRange = "1Y";
let _cachedPrices = [];
let _fxMap = new Map();
let _fxDates = [];
let _fxOk = false;
let _fxPolicy = null;

function updateToggleUI(ctx) {
  const r = (ctx?.region?.code || "kr").toLowerCase();
  const isFx = _fxPolicy?.showFx && _fxPolicy?.localCcy !== "USD";

  const toggle = el("g_fx_toggle");
  const btnUSD = el("btnUSD");
  const btnLOCAL = el("btnLOCAL");

  // return label
  el("retLabel").textContent = (r === "kr") ? "기간 수익률" : "Period Return";

  if (!isFx) {
    toggle.style.display = "none";
    el("priceLabel").textContent = (r === "kr") ? "현재가(USD)" : "Current (USD)";
    return;
  }

  toggle.style.display = "";
  btnLOCAL.textContent = _fxPolicy.localCcy;

  if (_displayCurrencyMode === "USD") {
    btnUSD.className = "px-3 py-2 rounded-xl font-extrabold text-sm bg-white shadow-sm";
    btnLOCAL.className = "px-3 py-2 rounded-xl font-extrabold text-sm text-slate-700 hover:bg-slate-200";
    el("priceLabel").textContent = (r === "kr") ? "현재가(USD)" : "Current (USD)";
  } else {
    btnLOCAL.className = "px-3 py-2 rounded-xl font-extrabold text-sm bg-white shadow-sm";
    btnUSD.className = "px-3 py-2 rounded-xl font-extrabold text-sm text-slate-700 hover:bg-slate-200";
    el("priceLabel").textContent = (r === "kr") ? `현재가(${_fxPolicy.localCcy})` : `Current (${_fxPolicy.localCcy})`;
  }
}

window.setDisplayCurrency = function(mode) {
  if (!_fxPolicy?.showFx || _fxPolicy.localCcy === "USD") {
    _displayCurrencyMode = "USD";
    updateToggleUI(window.__GUIDE_CTX);
    if (_cachedPrices.length) renderFromCache(window.__GUIDE_CTX);
    return;
  }
  if (mode === "LOCAL" && !_fxOk) {
    alert("FX data not ready yet. Check fxHistory function.");
    return;
  }
  _displayCurrencyMode = mode;
  updateToggleUI(window.__GUIDE_CTX);
  if (_cachedPrices.length) renderFromCache(window.__GUIDE_CTX);
};

function drawChart(labels, values, prefix) {
  const ctx2d = el("etfChart").getContext("2d");
  if (_chart) _chart.destroy();
  _chart = new Chart(ctx2d, {
    type: "line",
    data: { labels, datasets: [{ label: "price", data: values, pointRadius: 0, borderWidth: 2, fill: false }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxTicksLimit: 6 } },
        y: { ticks: { callback: v => (prefix || "") + v } }
      }
    }
  });
}

function fmtFxLine(fx, dateStr) {
  if (!Number.isFinite(fx) || fx <= 0) return "-";
  if (_fxPolicy.localCcy === "KRW") {
    return `적용 환율: 1 USD = ${Math.round(fx).toLocaleString("ko-KR")} KRW (${dateStr})`;
  }
  return `FX: 1 USD = ${fx.toLocaleString(_fxPolicy.locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ${_fxPolicy.localCcy} (${dateStr})`;
}

function renderFromCache(ctx) {
  const r = (ctx?.region?.code || "kr").toLowerCase();

  const prices = _cachedPrices;
  if (prices.length < 5) return;

  const first = prices[0];
  const last = prices[prices.length - 1];

  el("etfRange").textContent = `${first.date} ~ ${last.date} (${_cachedRange})`;
  el("etfPriceDate").textContent = (r === "kr") ? ("기준일: " + last.date) : ("As of: " + last.date);

  const firstUSD = Number(first.close);
  const lastUSD = Number(last.close);

  // downsample
  const maxPoints = 260;
  let use = prices;
  if (prices.length > maxPoints) {
    const step = Math.ceil(prices.length / maxPoints);
    use = prices.filter((_, i) => i % step === 0);
    if (use[use.length - 1].date !== last.date) use.push(last);
  }

  const canFx = _fxPolicy.showFx && _fxPolicy.localCcy !== "USD" && _fxOk && _displayCurrencyMode === "LOCAL";
  if (!canFx) {
    el("etfReturn").textContent = fmtPct((lastUSD / firstUSD) - 1);
    el("etfPrice").textContent = fmtUSD(lastUSD);
    el("etfFxLine").textContent = "-";
    drawChart(use.map(p => p.date), use.map(p => Number(p.close)), "$");
    el("etfStatus").textContent = (r === "kr") ? "완료 (USD)" : "Done (USD)";
    return;
  }

  const firstFx = getFxSmart(first.date, _fxMap, _fxDates);
  const lastFx = getFxSmart(last.date, _fxMap, _fxDates);
  if (!firstFx || !lastFx) {
    el("etfStatus").textContent = (r === "kr") ? "환율 데이터 부족" : "Not enough FX data";
    return;
  }

  const firstLocal = firstUSD * firstFx;
  const lastLocal = lastUSD * lastFx;

  el("etfReturn").textContent = fmtPct((lastLocal / firstLocal) - 1);
  el("etfPrice").textContent = fmtLocal(lastLocal, _fxPolicy.localCcy, _fxPolicy.locale);
  el("etfFxLine").textContent = fmtFxLine(lastFx, last.date);

  const labels = [];
  const values = [];
  for (const p of use) {
    const fx = getFxSmart(p.date, _fxMap, _fxDates);
    if (!fx) continue;
    labels.push(p.date);
    values.push(Number(p.close) * fx);
  }
  const prefix = (_fxPolicy.localCcy === "KRW") ? "₩" : "";
  drawChart(labels, values, prefix);
  el("etfStatus").textContent = (r === "kr")
    ? `완료 (${_fxPolicy.localCcy}, ${_fxPolicy.pair})`
    : `Done (${_fxPolicy.localCcy}, ${_fxPolicy.pair})`;
}

async function initPriceWidget(ctx, ticker) {
  window.__GUIDE_CTX = ctx;
  _fxPolicy = getFxPolicy(ctx);

  // region 기본 표시 통화
  _displayCurrencyMode = (_fxPolicy.showFx && _fxPolicy.localCcy !== "USD") ? "LOCAL" : "USD";
  updateToggleUI(ctx);

  // first load
  await window.loadPrice("1Y");
}

window.loadPrice = async function(range = "1Y") {
  const ctx = window.__GUIDE_CTX;
  const r = (ctx?.region?.code || "kr").toLowerCase();

  try {
    _cachedRange = range;
    el("etfStatus").textContent = (r === "kr") ? "불러오는 중..." : "Loading...";
    el("etfPrice").textContent = "-";
    el("etfPriceDate").textContent = "-";
    el("etfFxLine").textContent = "-";
    el("etfReturn").textContent = "-";
    el("etfRange").textContent = "-";

    const end = ymd(new Date());
    const start = calcStartByRange(end, range);

    const data = await fetchHistory(ticker, start, end);
    const prices = (data.prices || [])
      .filter(p => p?.date && Number.isFinite(Number(p.close)))
      .map(p => ({ date: String(p.date).slice(0,10), close: Number(p.close) }));

    if (prices.length < 5) {
      el("etfStatus").textContent = (r === "kr") ? "가격 데이터가 충분하지 않아요." : "Not enough price data.";
      return;
    }
    _cachedPrices = prices;

    // FX
    _fxOk = false;
    _fxMap = new Map();
    _fxDates = [];

    if (_fxPolicy.showFx && _fxPolicy.localCcy !== "USD") {
      try {
        const fxStart = addDays(start, -30);
        const fxData = await fetchFX(_fxPolicy.pair, fxStart, end);
        const raw = (fxData.prices || fxData.rates || fxData.data || []);
        _fxMap = buildFxMap(raw);
        _fxDates = Array.from(_fxMap.keys()).sort();
        _fxOk = _fxDates.length > 0;
      } catch (e) {
        _fxOk = false;
      }
    }

    // FX 없으면 LOCAL → USD로 자동 다운그레이드
    if (_displayCurrencyMode === "LOCAL" && (!_fxOk || !_fxPolicy.showFx)) _displayCurrencyMode = "USD";

    updateToggleUI(ctx);
    renderFromCache(ctx);

    if (_fxPolicy.showFx && _fxPolicy.localCcy !== "USD" && !_fxOk) {
      el("etfStatus").textContent = (r === "kr")
        ? "완료 (USD). KRW/LOCAL 변환은 fxHistory가 필요합니다."
        : "Done (USD). LOCAL conversion needs fxHistory.";
    }
  } catch (e) {
    el("etfStatus").textContent = "Error: " + String(e).slice(0, 180);
  }
};
