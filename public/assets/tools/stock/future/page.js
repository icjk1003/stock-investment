// /assets/tools/stock/future/page.js
// - loads template.html into #toolRoot
// - runs future simulator for any ticker (?ticker=... or ctx.ticker)

let unifiedChart;

function el(id) { return document.getElementById(id); }

function getTicker(ctx) {
  const u = new URL(location.href);
  const q = (u.searchParams.get("ticker") || "").toUpperCase();
  const c = (ctx?.ticker || "").toUpperCase();
  return (q || c || "SCHD").trim();
}

function fmtUSD0(v) {
  if (!Number.isFinite(v)) return "-";
  return "$" + Math.round(v).toLocaleString("en-US");
}

function toggleMonths(y) {
  document.querySelectorAll(`.year-${y}`).forEach(r => r.classList.toggle("active"));
}
window.toggleMonths = toggleMonths;

function updateChart(labels, p, g, d, t) {
  const ctx2d = el("unifiedChart").getContext("2d");
  if (unifiedChart) unifiedChart.destroy();

  unifiedChart = new Chart(ctx2d, {
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
        y: { stacked: true, ticks: { callback: v => "$" + (v / 1000).toLocaleString("en-US") + "k" } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function runSimulation() {
  const ticker = (el("ticker").value.trim() || "").toUpperCase();
  if (!ticker) { alert("Ticker is required."); return; }

  const initial = parseFloat(el("initial").value);
  const monthly = parseFloat(el("monthly").value);
  const yieldRate = parseFloat(el("yield").value) / 100;
  const divGrowth = parseFloat(el("divGrowth").value) / 100;
  const priceGrowth = parseFloat(el("priceGrowth").value) / 100;
  const tax = parseFloat(el("tax").value) / 100;
  const years = parseInt(el("years").value, 10);

  if (!Number.isFinite(initial) || initial < 0) { alert("Invalid initial."); return; }
  if (!Number.isFinite(monthly) || monthly < 0) { alert("Invalid monthly."); return; }
  if (!Number.isFinite(yieldRate) || yieldRate < 0) { alert("Invalid yield."); return; }
  if (!Number.isFinite(divGrowth)) { alert("Invalid dividend growth."); return; }
  if (!Number.isFinite(priceGrowth)) { alert("Invalid price growth."); return; }
  if (!Number.isFinite(tax) || tax < 0) { alert("Invalid tax."); return; }
  if (!Number.isFinite(years) || years <= 0) { alert("Invalid years."); return; }

  let currentBalance = initial;
  let totalPrincipal = initial;
  let totalCapGain = 0;
  let totalDiv = 0;
  let currentYield = yieldRate;

  const labels = ["Start"];
  const pData = [initial];
  const gData = [0];
  const dData = [0];
  const tData = [initial];

  const tableBody = el("tableBody");
  tableBody.innerHTML = "";

  for (let y = 1; y <= years; y++) {
    let yearlyDivTotal = 0;
    let monthHtml = "";

    for (let m = 1; m <= 12; m++) {
      // deposit
      totalPrincipal += monthly;
      currentBalance += monthly;

      // capital gains (monthly)
      const gain = currentBalance * (priceGrowth / 12);
      totalCapGain += gain;
      currentBalance += gain;

      // dividends (monthly) and reinvest
      const netDiv = (currentBalance * (currentYield / 12)) * (1 - tax);
      yearlyDivTotal += netDiv;
      totalDiv += netDiv;
      currentBalance += netDiv;

      monthHtml += `
        <tr class="month-row year-${y} bg-gray-50 border-b text-gray-400 text-xs">
          <td class="p-2 pl-8 font-medium text-blue-400">ㄴ Mo ${m}</td>
          <td class="p-2">${fmtUSD0(totalPrincipal)}</td>
          <td class="p-2">${fmtUSD0(totalCapGain)}</td>
          <td class="p-2">${fmtUSD0(totalDiv)}</td>
          <td class="p-2 font-bold">${fmtUSD0(currentBalance)}</td>
          <td class="p-2 text-amber-500">${fmtUSD0(netDiv)}</td>
        </tr>
      `;
    }

    // dividend yield grows yearly
    currentYield *= (1 + divGrowth);

    labels.push("Yr " + y);
    pData.push(totalPrincipal);
    gData.push(totalCapGain);
    dData.push(totalDiv);
    tData.push(currentBalance);

    tableBody.innerHTML += `
      <tr class="year-header border-b hover:bg-blue-50 cursor-pointer" onclick="toggleMonths(${y})">
        <td class="p-3 font-bold text-blue-700">▶ Year ${y}</td>
        <td class="p-3">${fmtUSD0(totalPrincipal)}</td>
        <td class="p-3 font-semibold">${fmtUSD0(totalCapGain)}</td>
        <td class="p-3 font-semibold">${fmtUSD0(totalDiv)}</td>
        <td class="p-3 font-black text-slate-900 bg-slate-50">${fmtUSD0(currentBalance)}</td>
        <td class="p-3 font-bold text-gray-700">${fmtUSD0(yearlyDivTotal / 12)}</td>
      </tr>
      ${monthHtml}
    `;

    if (y === years) {
      el("resTotal").innerText = fmtUSD0(currentBalance);
      el("resProfit").innerText = fmtUSD0(totalCapGain + totalDiv);
      el("resMonthlyDiv").innerText = fmtUSD0(yearlyDivTotal / 12);
    }
  }

  updateChart(labels, pData, gData, dData, tData);
}

export async function init(ctx) {
  const root = document.getElementById("toolRoot");

  // load template
  const res = await fetch("/assets/tools/stock/future/template.html", { cache: "no-cache" });
  if (!res.ok) {
    root.innerHTML = `<div class="rounded-3xl bg-white border border-rose-200 p-6">
      template not found: <code>/assets/tools/stock/future/template.html</code>
    </div>`;
    return;
  }
  root.innerHTML = await res.text();

  const ticker = getTicker(ctx);
  el("ticker").value = ticker;

  // titles
  el("pageTitle").textContent = `${ticker} Asset Simulator 📈`;
  el("pageSub").textContent = "Principal · Capital Gains · Dividend Growth";

  // bind
  el("btnCalc").addEventListener("click", runSimulation);

  // first render (기존 future.html처럼 자동 실행)
  runSimulation();
}
