// /assets/backtest.js
import { fmtMoney, buildUrlWithParams } from "/assets/app.js";

let unifiedChart;

function ymd(d) {
  const x = new Date(d);
  return x.toISOString().slice(0, 10);
}
function isDateStr(x) {
  return /^\d{4}-\d{2}-\d{2}$/.test(x);
}
function monthKey(dateStr) { return dateStr.slice(0, 7); }
function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}
function fmtUSD(v) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}
function toggleMonths(key) {
  document.querySelectorAll(`.month-${key}`).forEach(r => r.classList.toggle("active"));
}

// direction: "next"(start) / "prev"(end)
function clampToNearestTradingDay(pricesAll, dateStr, direction) {
  if (!pricesAll?.length) return null;
  if (!isDateStr(dateStr)) return null;

  if (direction === "next") {
    return pricesAll.find(p => p.date >= dateStr)?.date || null;
  } else {
    for (let i = pricesAll.length - 1; i >= 0; i--) {
      if (pricesAll[i].date <= dateStr) return pricesAll[i].date;
    }
    return null;
  }
}

async function fetchHistory(ticker, start, end) {
  const url = `/api/schdHistory?ticker=${encodeURIComponent(ticker)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Failed to fetch price/dividend data: " + (await r.text()));
  return r.json();
}

function buildContributionSet(prices, freq, startDateStr) {
  const isContribution = new Set();

  if (freq === "daily") {
    for (const p of prices) isContribution.add(p.date);
    return isContribution;
  }

  // monthly: first trading day in each month (after start)
  let lastMonth = null;
  for (const p of prices) {
    const mk = monthKey(p.date);
    if (mk !== lastMonth) {
      lastMonth = mk;
      if (p.date >= startDateStr) isContribution.add(p.date);
    }
  }
  return isContribution;
}

function updateChart(labels, principal, capGain, divNet, total) {
  const ctx = document.getElementById("unifiedChart").getContext("2d");
  if (unifiedChart) unifiedChart.destroy();

  unifiedChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Principal", data: principal, stack: "a", fill: true, pointRadius: 0 },
        { label: "Capital Gain", data: capGain, stack: "a", fill: true, pointRadius: 0 },
        { label: "Dividends (Net)", data: divNet, stack: "a", fill: true, pointRadius: 0 },
        { label: "Total Value", data: total, borderWidth: 2, fill: false, pointRadius: 0 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          stacked: true,
          ticks: { callback: v => "$" + Math.round(v / 1000) + "k" }
        }
      }
    }
  });
}

// ✅ allocate quarterly dividends into 3 months (boundary-adjusted)
function buildMonthlyDivAllocatedUSD(months) {
  const n = months.length;
  const alloc = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    const q = months[i].monthDivNetUSD || 0;
    if (q <= 0) continue;

    // default: current month + previous 2 months
    const candidate = [i, i - 1, i - 2];
    let picked = candidate.filter(idx => idx >= 0 && idx < n);

    // if missing (early boundary), push forward to fill 3 months
    let next = i + 1;
    while (picked.length < 3 && next < n) {
      if (!picked.includes(next)) picked.push(next);
      next++;
    }

    const k = picked.length;
    if (k === 0) continue;

    const part = q / k;
    for (const idx of picked) alloc[idx] += part;
  }

  return alloc;
}

// LOCAL -> USD (fx: local per 1 USD)
function localToUsd(region, localAmount, fxLocalPerUsd) {
  if (!region.showFx) return localAmount; // US: USD 그대로
  const fx = Math.max(0.000001, toNum(fxLocalPerUsd));
  return localAmount / fx;
}

function setInputValue(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v;
}
function getInputValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function ui(root, ctx) {
  const r = ctx.region;
  const dict = ctx.dict;

  root.innerHTML = `
    <style>
      .month-row { display:none; }
      .month-row.active { display: table-row; }
    </style>

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <!-- Left: Inputs -->
      <div class="lg:col-span-1">
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <h2 class="text-xl font-semibold border-b pb-2 text-gray-800">
            ${dict.settingsTitle} (${r.localCcy})
          </h2>

          <div>
            <label class="block text-xs font-medium text-gray-500">${dict.ticker}</label>
            <input type="text" id="ticker" value="${ctx.ticker || "SCHD"}"
              class="w-full mt-1 p-2 border rounded-md outline-blue-500"/>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-500">${dict.startDate}</label>
            <input type="date" id="startDate" class="w-full mt-1 p-2 border rounded-md outline-blue-500"/>
            <p class="text-[11px] text-gray-400 mt-1">${dict.noticeAdjust}</p>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-500">${dict.endDate}</label>
            <input type="date" id="endDate" class="w-full mt-1 p-2 border rounded-md outline-blue-500"/>
            <p class="text-[11px] text-gray-400 mt-1">${dict.noticeAdjust}</p>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-500">${dict.freq}</label>
            <select id="freq" class="w-full mt-1 p-2 border rounded-md outline-blue-500">
              <option value="monthly" selected>${dict.freqMonthly}</option>
              <option value="daily">${dict.freqDaily}</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-500">${dict.contribution} (${r.localCcy})</label>
            <input type="number" id="buyLocal" value="${r.code === "kr" ? 2000000 : 1500}" step="1"
              class="w-full mt-1 p-2 border rounded-md outline-blue-500"/>
            <p class="text-[11px] text-gray-400 mt-1">Fractional shares, converted to USD if FX enabled.</p>
          </div>

          <div id="fxBlock" class="${r.showFx ? "" : "hidden"}">
            <label class="block text-xs font-medium text-gray-500">${dict.fx}</label>
            <input type="number" id="fxLocalPerUsd" value="${r.code === "kr" ? 1300 : 1.35}" step="0.1"
              class="w-full mt-1 p-2 border rounded-md outline-blue-500"/>
            <p class="text-[11px] text-gray-400 mt-1">KRW: 1300, CAD: 1.35 (examples)</p>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-500">${dict.tax}</label>
            <input type="number" id="tax" value="${Math.round((r.defaultTaxDiv || 0.15) * 1000) / 10}" step="0.1"
              class="w-full mt-1 p-2 border rounded-md outline-blue-500"/>
          </div>

          <div class="flex items-center gap-2">
            <input type="checkbox" id="drip" checked class="h-4 w-4"/>
            <label for="drip" class="text-sm text-gray-700 font-semibold">${dict.drip}</label>
          </div>

          <button id="btnRun"
            class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition">
            ${dict.calc}
          </button>

          <div class="mt-2 grid grid-cols-2 gap-2">
            <a id="toFuture" class="text-center px-4 py-2 rounded-xl bg-slate-900 text-white font-extrabold hover:bg-slate-800 transition">Future</a>
            <a id="toGuide" class="text-center px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-extrabold hover:bg-slate-200 transition">Guide</a>
          </div>
        </div>
      </div>

      <!-- Right: Chart + summary -->
      <div class="lg:col-span-3 space-y-6">
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p id="dataNotice" class="text-xs text-gray-400 mb-2"></p>
          <div style="position: relative; height:450px; width:100%">
            <canvas id="unifiedChart"></canvas>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div class="bg-slate-900 p-5 rounded-2xl text-white shadow-lg">
            <p class="text-slate-400 text-xs uppercase">${dict.finalValue}</p>
            <p id="resTotal" class="text-xl font-bold mt-1">-</p>
          </div>
          <div class="bg-emerald-600 p-5 rounded-2xl text-white shadow-lg">
            <p class="text-emerald-100 text-xs uppercase">${dict.totalProfit}</p>
            <p id="resProfit" class="text-xl font-bold mt-1">-</p>
          </div>
          <div class="bg-amber-500 p-5 rounded-2xl text-white shadow-lg">
            <p class="text-amber-50 text-xs uppercase">${dict.finalMonthlyDiv}</p>
            <p id="resMonthlyDiv" class="text-xl font-bold mt-1">-</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="mt-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
      <h2 class="text-xl font-semibold mb-4 border-b pb-2">${dict.yearlyDetails}</h2>
      <table class="w-full text-left text-sm border-collapse">
        <thead>
          <tr class="bg-gray-100 text-gray-600 border-b text-xs uppercase">
            <th class="p-3">${dict.ym}</th>
            <th class="p-3">${dict.principal}</th>
            <th class="p-3 text-emerald-600">${dict.capGain}</th>
            <th class="p-3 text-amber-600">${dict.divNet}</th>
            <th class="p-3 font-bold text-slate-900">${dict.totalValue}</th>
            <th class="p-3">${dict.monthDiv}</th>
            <th class="p-3">${dict.quarterDiv}</th>
          </tr>
        </thead>
        <tbody id="tableBody"></tbody>
      </table>
    </div>
  `;

  // quick links (현재 ticker/region 유지)
  const ticker = (ctx.ticker || "SCHD").toUpperCase();
  document.getElementById("toFuture").href = buildUrlWithParams("/future/", { region: r.code, ticker });
  document.getElementById("toGuide").href = `/${r.code}/`;
}

async function runBacktest(ctx) {
  const region = ctx.region;

  const ticker = getInputValue("ticker").trim().toUpperCase() || "SCHD";
  let startInput = getInputValue("startDate");
  let endInput = getInputValue("endDate");

  if (!startInput) { alert("Pick a start date!"); return; }
  if (!endInput) { alert("Pick an end date!"); return; }
  if (endInput < startInput) { alert("End date must be after start date."); return; }

  const freq = getInputValue("freq");
  const buyLocal = Math.max(0, toNum(getInputValue("buyLocal")));
  const fxLocalPerUsd = toNum(getInputValue("fxLocalPerUsd") || (region.code === "kr" ? 1300 : 1.35));
  const buyUSD = localToUsd(region, buyLocal, fxLocalPerUsd);

  const taxRate = Math.max(0, toNum(getInputValue("tax")) / 100);
  const drip = document.getElementById("drip").checked;

  // 1) fetch history
  const data = await fetchHistory(ticker, startInput, endInput);
  const pricesAll = data.prices || [];
  const divsAll = data.dividends || [];

  if (pricesAll.length < 10) {
    alert("Not enough price data. Check ticker / date range.");
    return;
  }

  // 2) clamp by data range, then adjust to nearest trading days
  const firstAvailable = data.firstDate || pricesAll[0].date;
  const lastAvailable = data.lastDate || pricesAll[pricesAll.length - 1].date;

  if (startInput < firstAvailable) startInput = firstAvailable;
  if (endInput > lastAvailable) endInput = lastAvailable;

  const startAdj = clampToNearestTradingDay(pricesAll, startInput, "next");
  const endAdj = clampToNearestTradingDay(pricesAll, endInput, "prev");

  if (!startAdj || !endAdj) {
    alert("Failed to adjust to trading days. Try different dates.");
    return;
  }

  if (startAdj !== startInput) alert(`Start date ${startInput} is not a trading day.\nAdjusted to ${startAdj}.`);
  if (endAdj !== endInput) alert(`End date ${endInput} is not a trading day.\nAdjusted to ${endAdj}.`);

  const startDate = startAdj;
  const endDate = endAdj;

  setInputValue("startDate", startDate);
  setInputValue("endDate", endDate);

  if (endDate < startDate) {
    alert("After adjustment, end date became earlier than start date.");
    return;
  }

  const prices = pricesAll.filter(p => p.date >= startDate && p.date <= endDate);

  // 3) dividend map (date -> perShare)
  const divMap = new Map();
  for (const d of divsAll) {
    if (!d?.date) continue;
    const amt = toNum(d.amount);
    if (amt <= 0) continue;
    divMap.set(d.date, (divMap.get(d.date) || 0) + amt);
  }

  // 4) contribution days
  const contributeSet = buildContributionSet(prices, freq, startDate);

  // 5) simulate (USD)
  let shares = 0;
  let principalUSD = 0;
  let divNetUSD = 0;
  let cashUSD = 0;

  const months = [];
  let currentMonth = null;
  let monthDivNetUSD = 0;

  for (let i = 0; i < prices.length; i++) {
    const { date, close } = prices[i];
    const mk = monthKey(date);

    if (currentMonth === null) {
      currentMonth = mk;
    } else if (mk !== currentMonth) {
      const prev = prices[i - 1];
      const valueUSD = shares * prev.close + cashUSD;
      const capGainUSD = valueUSD - principalUSD - divNetUSD;

      months.push({
        key: currentMonth,
        endDate: prev.date,
        principalUSD,
        divNetUSD,
        capGainUSD,
        valueUSD,
        monthDivNetUSD,
        shares,
      });

      currentMonth = mk;
      monthDivNetUSD = 0;
    }

    // (A) buy
    if (contributeSet.has(date)) {
      shares += (buyUSD / close);
      principalUSD += buyUSD;
    }

    // (B) dividend event
    const perShare = divMap.get(date) || 0;
    if (perShare > 0) {
      const gross = shares * perShare;
      const net = gross * (1 - taxRate);
      divNetUSD += net;
      monthDivNetUSD += net;

      if (drip) shares += (net / close);
      else cashUSD += net;
    }
  }

  // last month snapshot
  const last = prices[prices.length - 1];
  const lastValueUSD = shares * last.close + cashUSD;
  const lastCapGainUSD = lastValueUSD - principalUSD - divNetUSD;

  months.push({
    key: currentMonth,
    endDate: last.date,
    principalUSD,
    divNetUSD,
    capGainUSD: lastCapGainUSD,
    valueUSD: lastValueUSD,
    monthDivNetUSD,
    shares,
  });

  // ✅ allocate monthly dividend from quarterly payouts
  const monthlyAllocUSD = buildMonthlyDivAllocatedUSD(months);

  // summary cards
  const finalMonthlyDivUSD = monthlyAllocUSD[months.length - 1] || 0;

  document.getElementById("resTotal").innerText = fmtUSD(lastValueUSD);
  document.getElementById("resProfit").innerText = fmtUSD(lastValueUSD - principalUSD);
  document.getElementById("resMonthlyDiv").innerText = fmtUSD(finalMonthlyDivUSD);

  document.getElementById("dataNotice").innerText =
    `Price data: ${data.firstDate || "-"} ~ ${data.lastDate || "-"} / Backtest: ${startDate} ~ ${endDate}`;

  // build table/chart
  const labels = ["Start"];
  const pData = [0];
  const gData = [0];
  const dData = [0];
  const tData = [0];

  const tableBody = document.getElementById("tableBody");
  tableBody.innerHTML = "";

  // group by year
  const byYear = new Map();
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const year = m.key.slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push({ ...m, idx: i });
  }

  const years = Array.from(byYear.keys()).sort();
  for (const y of years) {
    const list = byYear.get(y);

    const yLast = list[list.length - 1];
    const yPrincipal = yLast.principalUSD;
    const yDiv = yLast.divNetUSD;
    const yCapGain = yLast.capGainUSD;
    const yValue = yLast.valueUSD;

    const yearKey = `y${y}`;

    tableBody.innerHTML += `
      <tr class="year-header border-b hover:bg-blue-50 cursor-pointer" onclick="(${toggleMonths.toString()})('${yearKey}')">
        <td class="p-3 font-bold text-blue-700">▶ ${y}</td>
        <td class="p-3">${fmtUSD(yPrincipal)}</td>
        <td class="p-3 text-emerald-600 font-semibold">${fmtUSD(yCapGain)}</td>
        <td class="p-3 text-amber-600 font-semibold">${fmtUSD(yDiv)}</td>
        <td class="p-3 font-black text-slate-900 bg-slate-50">${fmtUSD(yValue)}</td>
        <td class="p-3 font-bold text-gray-700">-</td>
        <td class="p-3 font-bold text-gray-700">-</td>
      </tr>
    `;

    for (const mm of list) {
      const principal = mm.principalUSD;
      const div = mm.divNetUSD;
      const capGain = mm.capGainUSD;
      const value = mm.valueUSD;

      const quarterDiv = mm.monthDivNetUSD || 0;
      const monthlyDiv = monthlyAllocUSD[mm.idx] || 0;

      labels.push(mm.key);
      pData.push(principal);
      gData.push(capGain);
      dData.push(div);
      tData.push(value);

      const quarterDivText = (quarterDiv > 0) ? fmtUSD(quarterDiv) : "-";

      tableBody.innerHTML += `
        <tr class="month-row month-${yearKey} bg-gray-50 border-b text-gray-500 text-xs">
          <td class="p-2 pl-8 font-medium text-blue-400">ㄴ ${mm.key}</td>
          <td class="p-2">${fmtUSD(principal)}</td>
          <td class="p-2">${fmtUSD(capGain)}</td>
          <td class="p-2">${fmtUSD(div)}</td>
          <td class="p-2 font-bold">${fmtUSD(value)}</td>
          <td class="p-2 text-amber-500">${fmtUSD(monthlyDiv)}</td>
          <td class="p-2 text-amber-500">${quarterDivText}</td>
        </tr>
      `;
    }
  }

  updateChart(labels, pData, gData, dData, tData);

  // ✅ URL도 현재 선택을 반영(공유 링크)
  const nextUrl = buildUrlWithParams("/backtest/", { region: region.code, ticker });
  history.replaceState({}, "", nextUrl);
}

export function initBacktest(root, ctx) {
  ui(root, ctx);

  // 기본값: query -> 없으면 오늘
  const end = ymd(Date.now());
  setInputValue("endDate", end);

  // query ticker 반영
  const sp = new URLSearchParams(location.search);
  const t = (sp.get("ticker") || ctx.ticker || "SCHD").toUpperCase();
  setInputValue("ticker", t);

  // defaults (start date 자동)
  (async function initDefaults() {
    try {
      const data = await fetchHistory(t, "2011-01-01", end);
      const pricesAll = data.prices || [];
      const first = data.firstDate || (pricesAll[0]?.date);
      if (first) setInputValue("startDate", first);
      else setInputValue("startDate", "2012-01-03");
    } catch (e) {
      setInputValue("startDate", "2012-01-03");
    }
  })();

  document.getElementById("btnRun").addEventListener("click", () => {
    runBacktest(ctx).catch(err => {
      alert(String(err?.message || err));
      console.error(err);
    });
  });
}
