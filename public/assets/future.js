// /assets/future.js
import { buildUrlWithParams, fmtMoney } from "/assets/app.js";

let unifiedChart;

function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function fmt(v, currency, locale) {
  return fmtMoney(v, currency, locale);
}

function localToUsd(region, localAmount, fxLocalPerUsd) {
  if (!region.showFx) return localAmount;      // US: USD 그대로
  const fx = Math.max(0.000001, toNum(fxLocalPerUsd));
  return localAmount / fx;                     // local per 1 USD
}

function usdToLocal(region, usdAmount, fxLocalPerUsd) {
  if (!region.showFx) return usdAmount;
  const fx = Math.max(0.000001, toNum(fxLocalPerUsd));
  return usdAmount * fx;
}

function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v;
}
function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function updateChart(labels, p, g, d, t) {
  const ctx = document.getElementById("unifiedChart").getContext("2d");
  if (unifiedChart) unifiedChart.destroy();

  unifiedChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Principal", data: p, stack: "a", fill: true, pointRadius: 0 },
        { label: "Cap Gains", data: g, stack: "a", fill: true, pointRadius: 0 },
        { label: "Dividends", data: d, stack: "a", fill: true, pointRadius: 0 },
        { label: "Total Value", data: t, borderWidth: 2, fill: false, pointRadius: 0 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          stacked: true,
          ticks: {
            callback: v => Math.round(v / 1000).toLocaleString() + "k"
          }
        }
      }
    }
  });
}

function toggleMonths(y) {
  document.querySelectorAll(`.year-${y}`).forEach(r => r.classList.toggle("active"));
}

function render(root, ctx) {
  const r = ctx.region;
  const d = ctx.dict;
  const ticker = (ctx.ticker || "SCHD").toUpperCase();

  root.innerHTML = `
    <style>
      .month-row { display:none; }
      .month-row.active { display: table-row; }
      .clamp-2{ display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    </style>

    <div class="bg-white border rounded-3xl p-6 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-xs text-slate-500 font-bold uppercase">Ticker</div>
          <div class="text-2xl font-extrabold text-slate-900">${ticker}</div>
          <div class="text-xs text-slate-400 mt-1 clamp-2">
            * This is a parameter-based simulator (yield/growth inputs). Ticker is used for presets/SEO.
          </div>
        </div>

        <div class="flex gap-2">
          <a id="toBacktest" class="px-4 py-2 rounded-xl bg-blue-600 text-white font-extrabold hover:bg-blue-700 transition">Backtest</a>
          <a id="toGuide" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-extrabold hover:bg-slate-200 transition">Guide</a>
        </div>
      </div>
    </div>

    <div class="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-8">
      <!-- Left: Inputs -->
      <div class="lg:col-span-1">
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <h2 class="text-xl font-semibold border-b pb-2 text-gray-800">
            ${d.futureSettingsTitle} (${r.localCcy})
          </h2>

          <div>
            <label class="block text-xs font-medium text-gray-500">${d.futureInitial}</label>
            <input type="number" id="initialLocal" value="${r.code === "kr" ? 50000000 : 50000}"
              class="w-full mt-1 p-2 border rounded-md outline-blue-500">
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-500">${d.futureMonthly}</label>
            <input type="number" id="monthlyLocal" value="${r.code === "kr" ? 2000000 : 1000}"
              class="w-full mt-1 p-2 border rounded-md outline-blue-500">
          </div>

          <div id="fxBlock" class="${r.showFx ? "" : "hidden"}">
            <label class="block text-xs font-medium text-gray-500">${d.futureFx}</label>
            <input type="number" id="fxLocalPerUsd" value="${r.code === "kr" ? 1300 : 1.35}" step="0.1"
              class="w-full mt-1 p-2 border rounded-md outline-blue-500">
            <p class="text-[11px] text-gray-400 mt-1">local per 1 USD (example)</p>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-500">${d.futureYield}</label>
            <input type="number" id="yield" value="3.4" step="0.1"
              class="w-full mt-1 p-2 border rounded-md outline-blue-500">
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-500">${d.futureDivGrowth}</label>
            <input type="number" id="divGrowth" value="11" step="0.1"
              class="w-full mt-1 p-2 border rounded-md outline-blue-500">
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-500">${d.futurePriceGrowth}</label>
            <input type="number" id="priceGrowth" value="5" step="0.1"
              class="w-full mt-1 p-2 border rounded-md outline-blue-500">
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-500">${d.futureTax}</label>
            <input type="number" id="tax" value="${Math.round((r.defaultTaxDiv || 0.15) * 1000) / 10}" step="0.1"
              class="w-full mt-1 p-2 border rounded-md outline-blue-500">
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-500">${d.futureYears}</label>
            <input type="number" id="years" value="20"
              class="w-full mt-1 p-2 border rounded-md outline-blue-500">
          </div>

          <div class="flex items-center gap-2">
            <input type="checkbox" id="displayLocal" class="h-4 w-4" ${r.showFx ? "checked" : "checked"}>
            <label for="displayLocal" class="text-sm text-gray-700 font-semibold">${d.futureDisplayLocal}</label>
          </div>

          <button id="btnRun"
            class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition">
            ${d.futureCalc}
          </button>

          <p class="text-[11px] text-gray-400 leading-relaxed">
            * This is a monthly compounding model.<br/>
            * Net dividends after tax are reinvested monthly.
          </p>
        </div>
      </div>

      <!-- Right -->
      <div class="lg:col-span-3 space-y-6">
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div style="position: relative; height:450px; width:100%">
            <canvas id="unifiedChart"></canvas>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div class="bg-slate-900 p-5 rounded-2xl text-white shadow-lg">
            <p class="text-slate-400 text-xs uppercase">${d.futureTotalBalance}</p>
            <p id="resTotal" class="text-xl font-bold mt-1">-</p>
          </div>
          <div class="bg-emerald-600 p-5 rounded-2xl text-white shadow-lg">
            <p class="text-emerald-100 text-xs uppercase">${d.futureTotalGains}</p>
            <p id="resProfit" class="text-xl font-bold mt-1">-</p>
          </div>
          <div class="bg-amber-500 p-5 rounded-2xl text-white shadow-lg">
            <p class="text-amber-50 text-xs uppercase">${d.futureMonthlyDiv}</p>
            <p id="resMonthlyDiv" class="text-xl font-bold mt-1">-</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="mt-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
      <h2 class="text-xl font-semibold mb-4 border-b pb-2">${d.futureAnnualDetail}</h2>
      <table class="w-full text-left text-sm border-collapse">
        <thead>
          <tr class="bg-gray-100 text-gray-600 border-b text-xs uppercase">
            <th class="p-3">${d.futureYearMonth}</th>
            <th class="p-3">${d.futurePrincipal}</th>
            <th class="p-3">${d.futureCapGains}</th>
            <th class="p-3">${d.futureDividends}</th>
            <th class="p-3">${d.futureTotalValue}</th>
            <th class="p-3">${d.futureMonthlyDivCol}</th>
          </tr>
        </thead>
        <tbody id="tableBody"></tbody>
      </table>
    </div>
  `;

  // links
  const regionCode = r.code;
  document.getElementById("toBacktest").href = buildUrlWithParams("/backtest/", { region: regionCode, ticker });
  document.getElementById("toGuide").href = `/${regionCode}/`;
}

function runSimulation(ctx) {
  const r = ctx.region;

  const initialLocal = Math.max(0, toNum(getVal("initialLocal")));
  const monthlyLocal = Math.max(0, toNum(getVal("monthlyLocal")));
  const yieldRate = Math.max(0, toNum(getVal("yield"))) / 100;
  const divGrowth = Math.max(0, toNum(getVal("divGrowth"))) / 100;
  const priceGrowth = toNum(getVal("priceGrowth")) / 100;
  const tax = Math.max(0, toNum(getVal("tax"))) / 100;
  const years = Math.max(1, Math.floor(toNum(getVal("years"))));

  const fxLocalPerUsd = toNum(getVal("fxLocalPerUsd") || (r.code === "kr" ? 1300 : 1.35));

  // ✅ 계산은 USD 베이스로 통일 (원하면 나중에 LOCAL 베이스로도 가능)
  let initialUSD = localToUsd(r, initialLocal, fxLocalPerUsd);
  let monthlyUSD = localToUsd(r, monthlyLocal, fxLocalPerUsd);

  let currentBalanceUSD = initialUSD;
  let totalPrincipalUSD = initialUSD;
  let totalCapGainUSD = 0;
  let totalDivUSD = 0;
  let currentYield = yieldRate;

  const labels = ["Start"];
  const pData = [initialUSD];
  const gData = [0];
  const dData = [0];
  const tData = [initialUSD];

  const tableBody = document.getElementById("tableBody");
  tableBody.innerHTML = "";

  for (let y = 1; y <= years; y++) {
    let yearlyDivTotalUSD = 0;
    let monthHtml = "";

    for (let m = 1; m <= 12; m++) {
      totalPrincipalUSD += monthlyUSD;
      currentBalanceUSD += monthlyUSD;

      const gain = currentBalanceUSD * (priceGrowth / 12);
      totalCapGainUSD += gain;
      currentBalanceUSD += gain;

      const netDiv = (currentBalanceUSD * (currentYield / 12)) * (1 - tax);
      yearlyDivTotalUSD += netDiv;
      totalDivUSD += netDiv;
      currentBalanceUSD += netDiv;

      // month row (USD for now, convert at render)
      monthHtml += `
        <tr class="month-row year-${y} bg-gray-50 border-b text-gray-400 text-xs">
          <td class="p-2 pl-8 font-medium text-blue-400">ㄴ Mo ${m}</td>
          <td class="p-2" data-usd="${totalPrincipalUSD}"></td>
          <td class="p-2" data-usd="${totalCapGainUSD}"></td>
          <td class="p-2" data-usd="${totalDivUSD}"></td>
          <td class="p-2 font-bold" data-usd="${currentBalanceUSD}"></td>
          <td class="p-2 text-amber-500" data-usd="${netDiv}"></td>
        </tr>
      `;
    }

    currentYield *= (1 + divGrowth);

    labels.push("Yr " + y);
    pData.push(totalPrincipalUSD);
    gData.push(totalCapGainUSD);
    dData.push(totalDivUSD);
    tData.push(currentBalanceUSD);

    tableBody.innerHTML += `
      <tr class="year-header border-b hover:bg-blue-50 cursor-pointer" onclick="(${toggleMonths.toString()})(${y})">
        <td class="p-3 font-bold text-blue-700">▶ Year ${y}</td>
        <td class="p-3" data-usd="${totalPrincipalUSD}"></td>
        <td class="p-3 font-semibold" data-usd="${totalCapGainUSD}"></td>
        <td class="p-3 font-semibold" data-usd="${totalDivUSD}"></td>
        <td class="p-3 font-black text-slate-900 bg-slate-50" data-usd="${currentBalanceUSD}"></td>
        <td class="p-3 font-bold text-gray-700" data-usd="${yearlyDivTotalUSD / 12}"></td>
      </tr>
    ` + monthHtml;

    if (y === years) {
      // 마지막 summary는 아래에서 표시통화로 변환 후 세팅
      document.getElementById("resTotal").dataset.usd = String(currentBalanceUSD);
      document.getElementById("resProfit").dataset.usd = String(totalCapGainUSD + totalDivUSD);
      document.getElementById("resMonthlyDiv").dataset.usd = String(yearlyDivTotalUSD / 12);
    }
  }

  updateChart(labels, pData, gData, dData, tData);

  // ✅ 표시 통화 적용
  applyDisplayCurrency(ctx);

  // ✅ URL 공유 반영
  const ticker = (ctx.ticker || "SCHD").toUpperCase();
  const nextUrl = buildUrlWithParams("/future/", { region: ctx.region.code, ticker });
  history.replaceState({}, "", nextUrl);
}

function applyDisplayCurrency(ctx) {
  const r = ctx.region;
  const showLocal = document.getElementById("displayLocal")?.checked ?? true;
  const fxLocalPerUsd = toNum(getVal("fxLocalPerUsd") || (r.code === "kr" ? 1300 : 1.35));

  const currency = (showLocal ? r.localCcy : "USD");
  const locale = r.locale;

  // summary
  ["resTotal", "resProfit", "resMonthlyDiv"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const usd = toNum(el.dataset.usd);
    const val = showLocal ? usdToLocal(r, usd, fxLocalPerUsd) : usd;
    el.innerText = fmt(val, currency, locale);
  });

  // table cells: data-usd -> display
  document.querySelectorAll("[data-usd]").forEach(el => {
    const usd = toNum(el.getAttribute("data-usd"));
    const val = showLocal ? usdToLocal(r, usd, fxLocalPerUsd) : usd;
    el.textContent = fmt(val, currency, locale);
  });
}

export function initFuture(root, ctx) {
  render(root, ctx);

  // region/ticker 링크 유지
  const sp = new URLSearchParams(location.search);
  const ticker = (sp.get("ticker") || ctx.ticker || "SCHD").toUpperCase();
  ctx.ticker = ticker;

  // 버튼
  document.getElementById("btnRun").addEventListener("click", () => {
    runSimulation(ctx);
  });

  // 표시통화 토글/FX 변경시 갱신
  const fxEl = document.getElementById("fxLocalPerUsd");
  const displayEl = document.getElementById("displayLocal");
  if (fxEl) fxEl.addEventListener("input", () => applyDisplayCurrency(ctx));
  if (displayEl) displayEl.addEventListener("change", () => applyDisplayCurrency(ctx));

  // 초기 1회 실행
  runSimulation(ctx);
}
