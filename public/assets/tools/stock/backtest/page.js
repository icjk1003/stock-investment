// /assets/tools/stock/backtest/page.js
import { applyI18n } from "/assets/app.js";

let unifiedChart;

function el(id) { return document.getElementById(id); }

function ymd(d) {
  const x = new Date(d);
  return x.toISOString().slice(0, 10);
}
function isDateStr(x) { return /^\d{4}-\d{2}-\d{2}$/.test(x); }
function monthKey(dateStr) { return dateStr.slice(0, 7); }
function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}
function fmtUSD(v) {
  if (!Number.isFinite(v)) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

function getTicker(ctx) {
  const u = new URL(location.href);
  const q = (u.searchParams.get("ticker") || "").toUpperCase();
  const c = (ctx?.ticker || "").toUpperCase();
  return (q || c || "SCHD").trim();
}

function toggleMonths(key) {
  document.querySelectorAll(`.month-${key}`).forEach(r => r.classList.toggle("active"));
}
window.toggleMonths = toggleMonths;

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
  const ctx2d = el("unifiedChart").getContext("2d");
  if (unifiedChart) unifiedChart.destroy();

  unifiedChart = new Chart(ctx2d, {
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
      scales: { y: { stacked: true, ticks: { callback: v => "$" + Math.round(v / 1000) + "k" } } },
      plugins: { legend: { display: false } }
    }
  });
}

function buildMonthlyDivAllocatedUSD(months) {
  const n = months.length;
  const alloc = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    const q = months[i].monthDivNetUSD || 0;
    if (q <= 0) continue;

    const candidate = [i, i - 1, i - 2];
    let picked = candidate.filter(idx => idx >= 0 && idx < n);

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

async function runBacktest() {
  const ticker = (el("ticker").value.trim() || "").toUpperCase();
  if (!ticker) { alert("Ticker is required."); return; }

  let startInput = el("startDate").value;
  let endInput = el("endDate").value;

  if (!startInput) { alert("Pick a start date!"); return; }
  if (!endInput) { alert("Pick an end date!"); return; }
  if (endInput < startInput) { alert("End date must be after start date."); return; }

  const freq = el("freq").value;
  const buyUSD = Math.max(0, toNum(el("buyUSD").value));
  const taxRate = Math.max(0, toNum(el("tax").value) / 100);
  const drip = el("drip").checked;

  const data = await fetchHistory(ticker, startInput, endInput);
  const pricesAll = data.prices || [];
  const divsAll = data.dividends || [];

  if (pricesAll.length < 10) {
    alert("Not enough price data. Check ticker / date range.");
    return;
  }

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

  el("startDate").value = startDate;
  el("endDate").value = endDate;

  const prices = pricesAll.filter(p => p.date >= startDate && p.date <= endDate);

  const divMap = new Map();
  for (const d of divsAll) {
    if (!d?.date) continue;
    const amt = toNum(d.amount);
    if (amt <= 0) continue;
    divMap.set(d.date, (divMap.get(d.date) || 0) + amt);
  }

  const contributeSet = buildContributionSet(prices, freq, startDate);

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

    if (currentMonth === null) currentMonth = mk;
    else if (mk !== currentMonth) {
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

    if (contributeSet.has(date)) {
      shares += (buyUSD / close);
      principalUSD += buyUSD;
    }

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

  const monthlyAllocUSD = buildMonthlyDivAllocatedUSD(months);
  const finalMonthlyDivUSD = monthlyAllocUSD[months.length - 1] || 0;

  el("resTotal").innerText = fmtUSD(lastValueUSD);
  el("resProfit").innerText = fmtUSD(lastValueUSD - principalUSD);
  el("resMonthlyDiv").innerText = fmtUSD(finalMonthlyDivUSD);

  el("dataNotice").innerText =
    `Price data: ${data.firstDate || "-"} ~ ${data.lastDate || "-"} / Backtest: ${startDate} ~ ${endDate}`;

  const labels = ["Start"];
  const pData = [0];
  const gData = [0];
  const dData = [0];
  const tData = [0];

  const tableBody = el("tableBody");
  tableBody.innerHTML = "";

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
    const yearKey = `y${y}`;

    tableBody.innerHTML += `
      <tr class="year-header border-b hover:bg-blue-50 cursor-pointer" onclick="toggleMonths('${yearKey}')">
        <td class="p-3 font-bold text-blue-700">▶ ${y}</td>
        <td class="p-3">${fmtUSD(yLast.principalUSD)}</td>
        <td class="p-3 text-emerald-600 font-semibold">${fmtUSD(yLast.capGainUSD)}</td>
        <td class="p-3 text-amber-600 font-semibold">${fmtUSD(yLast.divNetUSD)}</td>
        <td class="p-3 font-black text-slate-900 bg-slate-50">${fmtUSD(yLast.valueUSD)}</td>
        <td class="p-3 font-bold text-gray-700">-</td>
        <td class="p-3 font-bold text-gray-700">-</td>
      </tr>
    `;

    for (const mm of list) {
      labels.push(mm.key);
      pData.push(mm.principalUSD);
      gData.push(mm.capGainUSD);
      dData.push(mm.divNetUSD);
      tData.push(mm.valueUSD);

      const quarterDiv = mm.monthDivNetUSD || 0;
      const monthlyDiv = monthlyAllocUSD[mm.idx] || 0;
      const quarterDivText = (quarterDiv > 0) ? fmtUSD(quarterDiv) : "-";

      tableBody.innerHTML += `
        <tr class="month-row month-${yearKey} bg-gray-50 border-b text-gray-500 text-xs">
          <td class="p-2 pl-8 font-medium text-blue-400">ㄴ ${mm.key}</td>
          <td class="p-2">${fmtUSD(mm.principalUSD)}</td>
          <td class="p-2">${fmtUSD(mm.capGainUSD)}</td>
          <td class="p-2">${fmtUSD(mm.divNetUSD)}</td>
          <td class="p-2 font-bold">${fmtUSD(mm.valueUSD)}</td>
          <td class="p-2 text-amber-500">${fmtUSD(monthlyDiv)}</td>
          <td class="p-2 text-amber-500">${quarterDivText}</td>
        </tr>
      `;
    }
  }

  updateChart(labels, pData, gData, dData, tData);
}

async function initDefaults(ticker) {
  el("ticker").value = ticker;
  el("endDate").value = ymd(Date.now());

  try {
    const end = ymd(Date.now());
    const data = await fetchHistory(ticker, "1900-01-01", end);
    const pricesAll = data.prices || [];
    const first = data.firstDate || pricesAll[0]?.date;

    if (first) {
      el("startDate").value = first;
      el("dataNotice").innerText = `Default start (first trading day): ${first} / Default end: ${end}`;
    } else {
      el("startDate").value = "2012-01-03";
    }
  } catch (e) {
    el("startDate").value = "2012-01-03";
  }
}

export async function init(ctx) {
  const root = document.getElementById("toolRoot");

  const res = await fetch("/assets/tools/stock/backtest/template.html", { cache: "no-cache" });
  if (!res.ok) {
    root.innerHTML = `<div class="rounded-3xl bg-white border border-rose-200 p-6">
      template not found: <code>/assets/tools/stock/backtest/template.html</code>
    </div>`;
    return;
  }

  root.innerHTML = await res.text();

  // ✅ template가 DOM에 생긴 뒤 i18n 적용
  applyI18n(ctx.dict);

  const ticker = getTicker(ctx);

  // ✅ 타이틀/설명 ko/en 분기
  const isKo = (ctx?.lang || ctx?.region?.lang) === "ko";
  el("pageTitle").textContent = isKo ? `${ticker} 백테스트 (적립식) 📈` : `${ticker} Backtest (DCA) 📈`;
  el("pageDesc").textContent = isKo
    ? `${ticker}를 과거 특정 시점부터 적립식으로 매수했을 때 가격 + 배당(세후) 누적 성과를 계산합니다.`
    : `If you bought ${ticker} from a past date with monthly/daily contributions, this shows cumulative performance with price & dividends (USD).`;

  el("btnCalc").addEventListener("click", runBacktest);

  await initDefaults(ticker);
}
