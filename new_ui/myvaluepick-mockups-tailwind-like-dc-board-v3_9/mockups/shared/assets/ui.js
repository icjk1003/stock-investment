(function () {
  const $ = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => Array.from(el.querySelectorAll(q));

  function qs(name) {
    try {
      return new URLSearchParams(location.search).get(name);
    } catch (e) {
      return null;
    }
  }

  // ===== Theme =====
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("mvp_theme", theme); } catch (e) {}
    const btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = theme === "light" ? "🌞 Light" : "🌙 Dark";
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem("mvp_theme"); } catch (e) {}
    const prefersLight =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    const theme = saved || (prefersLight ? "light" : "dark");
    applyTheme(theme);

    const btn = document.getElementById("themeToggle");
    if (btn) {
      btn.addEventListener("click", () => {
        const cur = document.documentElement.getAttribute("data-theme") || "dark";
        applyTheme(cur === "dark" ? "light" : "dark");
      });
    }
  }

  // ===== Active nav (optional) =====
  function setActiveTabs() {
    const current = document.body.getAttribute("data-page") || "";
    $$("[data-nav]").forEach((a) => {
      if (a.getAttribute("data-nav") === current) a.classList.add("active");
    });
  }

  // ===== Search form (mock) =====
  function wireSearch() {
    const form = $("#quickSearch");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const market = $("#q_market")?.value || "nasdaq";
      const symbol = ($("#q_symbol")?.value || "").trim();
      const country = document.body.getAttribute("data-country") || "us";

      if (!symbol) {
        alert(country === "kr" ? "종목 코드를 입력해줘." : "Enter a symbol.");
        return;
      }
      location.href = `security.html?market=${encodeURIComponent(market)}&symbol=${encodeURIComponent(
        symbol.toUpperCase()
      )}`;
    });

    // prefill
    const market = qs("market");
    const symbol = qs("symbol");
    if (market && $("#q_market")) $("#q_market").value = market;
    if (symbol && $("#q_symbol")) $("#q_symbol").value = symbol;
  }

  // ===== Keep market/symbol across links =====
  function keepQueryOnLinks() {
    const market = qs("market");
    const symbol = qs("symbol");
    const title = $("#secTitle");
    if (title && market && symbol) {
      title.textContent = `${market.toUpperCase()} / ${String(symbol).toUpperCase()}`;
    }

    $$("[data-keep]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (!href) return;
      const u = new URL(href, location.href);
      if (market) u.searchParams.set("market", market);
      if (symbol) u.searchParams.set("symbol", symbol);
      a.setAttribute("href", u.pathname + "?" + u.searchParams.toString());
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    setActiveTabs();
    wireSearch();
    keepQueryOnLinks();
  });
})();
/* MVP_V34: Theme + Global Search + Calendar + Board (safe append) */
(function(){
  const SYMBOLS = [
    {symbol:"TSLA", name:"Tesla, Inc.", market:"NASDAQ"},
    {symbol:"AAPL", name:"Apple Inc.", market:"NASDAQ"},
    {symbol:"NVDA", name:"NVIDIA Corporation", market:"NASDAQ"},
    {symbol:"SPY", name:"SPDR S&P 500 ETF Trust", market:"NYSE"},
    {symbol:"QQQ", name:"Invesco QQQ Trust", market:"NASDAQ"},
    {symbol:"SCHD", name:"Schwab U.S. Dividend Equity ETF", market:"NYSE"},
    {symbol:"TQQQ", name:"ProShares UltraPro QQQ", market:"NASDAQ"},
    {symbol:"005930", name:"삼성전자", market:"KOSPI"},
    {symbol:"000660", name:"SK하이닉스", market:"KOSPI"},
    {symbol:"035420", name:"NAVER", market:"KOSPI"},
  ];

  function wireThemeToggle(){
    const btn = document.querySelector("[data-theme-toggle]");
    if (!btn) return;
    function setTheme(t){
      document.documentElement.setAttribute("data-theme", t);
      try{ localStorage.setItem("mvp_theme", t); }catch(e){}
      btn.textContent = (t==="dark") ? "☀️ Light" : "🌙 Dark";
    }
    let saved="light";
    try{ saved = localStorage.getItem("mvp_theme") || "light"; }catch(e){}
    if (saved!=="dark" && saved!=="light") saved="light";
    setTheme(saved);
    btn.addEventListener("click", ()=>{
      const cur = document.documentElement.getAttribute("data-theme") || "light";
      setTheme(cur==="dark" ? "light" : "dark");
    });
  }

  function wireGlobalSearch(){
    const form=document.getElementById("globalSearch");
    const input=document.getElementById("globalSearchInput");
    const results=document.getElementById("globalSearchResults");
    const btn=document.getElementById("globalSearchBtn");
    if(!form||!input||!results) return;

    function match(q){
      q=(q||"").trim();
      if(!q) return [];
      const uq=q.toUpperCase();
      const isKo=/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(q);
      return SYMBOLS.filter(s=> s.symbol.includes(uq) || (isKo ? s.name.includes(q) : s.name.toUpperCase().includes(uq)));
    }

    function openSymbol(it){
      results.style.display="none";
      input.value=it.symbol;
      location.href=`security.html?market=${encodeURIComponent(it.market.toLowerCase())}&symbol=${encodeURIComponent(it.symbol)}`;
    }

    function render(items){
      results.innerHTML="";
      if(!items.length){ results.style.display="none"; return; }
      const frag=document.createDocumentFragment();
      items.slice(0,8).forEach(it=>{
        const div=document.createElement("div");
        div.className="searchItem";
        div.innerHTML=`<div class="l"><div class="sym mono">${it.symbol} <span class="tag">· ${it.market}</span></div><div class="nm">${it.name}</div></div><div class="tag">Open</div>`;
        div.addEventListener("click",()=>openSymbol(it));
        frag.appendChild(div);
      });
      results.appendChild(frag);
      results.style.display="block";
    }

    function submit(){ const items=match(input.value); if(items.length) openSymbol(items[0]); }

    input.addEventListener("input",()=>render(match(input.value)));
    input.addEventListener("focus",()=>render(match(input.value)));
    form.addEventListener("submit",(e)=>{ e.preventDefault(); submit(); });
    if(btn) btn.addEventListener("click",submit);
    document.addEventListener("click",(e)=>{ if(!results.contains(e.target) && e.target!==input) results.style.display="none"; });
  }

  function wireCalendar(){
    const cal=document.getElementById("calendar");
    const list=document.getElementById("eventList");
    const selected=document.getElementById("eventSelected");
    if(!cal && !list && !selected) return;

    const EVENTS=[
      {date:"2026-02-06", title:"FOMC Chair speech", type:"macro", symbols:["SPY","QQQ"]},
      {date:"2026-02-10", title:"TSLA Earnings", type:"earnings", symbols:["TSLA"]},
      {date:"2026-02-12", title:"삼성전자 실적발표", type:"earnings", symbols:["005930"]},
      {date:"2026-02-18", title:"US CPI", type:"macro", symbols:["SPY"]},
      {date:"2026-02-20", title:"NVDA Earnings", type:"earnings", symbols:["NVDA"]},
    ];
    const byDate=EVENTS.reduce((m,e)=>{(m[e.date]=m[e.date]||[]).push(e); return m;},{});
    let cur=new Date(); cur.setDate(1);
    let selectedDate=null;

    function iso(d){ const y=d.getFullYear(),m=d.getMonth()+1,dd=d.getDate(); return `${y}-${String(m).padStart(2,"0")}-${String(dd).padStart(2,"0")}`; }

    function renderSelected(){
      if(!selected) return;
      if(!selectedDate){ selected.innerHTML=""; return; }
      const items=(byDate[selectedDate]||[]);
      if(!items.length){ selected.innerHTML=`<div class="hint">No events on <span class="mono">${selectedDate}</span></div>`; return; }
      selected.innerHTML=`<div class="mono" style="font-weight:900;margin-bottom:6px">${selectedDate}</div>
      <div style="display:grid;gap:8px">${items.map(e=>`<div class="evt"><div><div style="font-weight:800">${e.title}</div><div class="mono" style="opacity:.7;margin-top:2px">${(e.symbols||[]).join(", ")||"-"}</div></div><div class="badge">${e.type}</div></div>`).join("")}</div>`;
    }

    function renderCal(){
      if(!cal) return;
      cal.innerHTML="";
      ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(x=>{ const el=document.createElement("div"); el.className="dow"; el.textContent=x; cal.appendChild(el); });
      const first=new Date(cur);
      const startDow=first.getDay();
      const start=new Date(first); start.setDate(1-startDow);
      const todayIso=iso(new Date());

      for(let i=0;i<42;i++){ 
        const d=new Date(start); d.setDate(start.getDate()+i);
        const inMonth=d.getMonth()===cur.getMonth();
        const di=iso(d);
        const el=document.createElement("div");
        el.className="day"+(inMonth?"":" muted")+(di===todayIso?" today":"")+(di===selectedDate?" sel":"");
        el.textContent=String(d.getDate());
        if(byDate[di]?.length){ const dot=document.createElement("div"); dot.className="dot"; el.appendChild(dot); }
        el.addEventListener("click",()=>{ selectedDate=di; renderCal(); renderSelected(); });
        cal.appendChild(el);
      }
    }

    function renderUpcoming(){
      if(!list) return;
      const today=new Date().toISOString().slice(0,10);
      const upcoming=EVENTS.slice().sort((a,b)=>a.date.localeCompare(b.date)).filter(e=>e.date>=today).slice(0,4);
      list.innerHTML="";
      upcoming.forEach(e=>{
        const row=document.createElement("div");
        row.className="evt";
        row.innerHTML=`<div><div class="mono" style="font-weight:900">${e.date}</div><div style="margin-top:2px">${e.title}</div></div><div class="badge">${e.type}</div>`;
        row.addEventListener("click",()=>{ selectedDate=e.date; renderCal(); renderSelected(); });
        list.appendChild(row);
      });
    }

    renderCal(); renderUpcoming(); renderSelected();
  }

  function wireBoard(){
    const tbody=document.getElementById("boardRows");
    const pager=document.getElementById("boardPagination");
    const sel=document.getElementById("boardSearchType");
    const q=document.getElementById("boardSearchInput");
    const btn=document.getElementById("boardSearchBtn");
    if(!tbody||!pager) return;

    const TAGS=["실적","거시","수급","백테스트","잡담"];
    const USERS=["alpha12","mvp_user","stonks","kim34","delta","quant","valuepick","bear","bull","swing"];
    const TITLES=[
      "이번 분기 가이던스 어떻게 봄?","실적 발표 전 체크리스트 공유","백테스트 결과 공유합니다","오늘 수급 이상한데 뭐냐",
      "장기 투자 vs 단기 트레이딩","배당 재투자 효과 체감됨","환율 영향 얼마나 큼?","옵션 OI 급증 이유","CPI 앞두고 포지션 어떻게?",
      "FOMC 의사록 핵심 요약","기관이 담는 종목 리스트","테마주 과열 구간 분석",
    ];
    const SYMS=["TSLA","NVDA","AAPL","SPY","QQQ","005930","SCHD","TQQQ",""];
    const pick=(arr)=>arr[Math.floor(Math.random()*arr.length)];
    const POSTS=[];
    let baseNo=10500;
    for(let i=0;i<45;i++){ 
      const no=baseNo-i;
      const tag=TAGS[i%TAGS.length];
      const user=USERS[i%USERS.length];
      const title=`${pick(SYMS)} ${pick(TITLES)}`.trim();
      const up=5+(i*3)%140;
      const views=200+(i*137)%12000;
      const cmt=(i*7)%120;
      const time=`02-05 ${String(23-(i%16)).padStart(2,"0")}:${String((i*11)%60).padStart(2,"0")}`;
      POSTS.push({no,tag,title,up,views,time,user,cmt,body:`내용 샘플 ${i} ...`});
    }
    let state={page:1,pageSize:15,q:"",type:"all"};

    function filtered(){
      let arr=POSTS.slice();
      const qq=(state.q||"").trim().toLowerCase();
      if(qq){
        if(state.type==="title") arr=arr.filter(p=>p.title.toLowerCase().includes(qq));
        else if(state.type==="body") arr=arr.filter(p=>p.body.toLowerCase().includes(qq));
        else if(state.type==="user") arr=arr.filter(p=>p.user.toLowerCase().includes(qq));
        else if(state.type==="comment") arr=arr.filter(p=>String(p.cmt).includes(qq));
        else arr=arr.filter(p=>p.title.toLowerCase().includes(qq)||p.body.toLowerCase().includes(qq)||p.user.toLowerCase().includes(qq));
      }
      return arr;
    }

    function render(){
      const arr=filtered();
      const totalPages=Math.max(1,Math.ceil(arr.length/state.pageSize));
      if(state.page>totalPages) state.page=totalPages;

      const start=(state.page-1)*state.pageSize;
      const rows=arr.slice(start,start+state.pageSize);

      const out=[];
      out.push(`<tr>
        <td class="colNo"><span class="chip notice">공지</span></td>
        <td class="colTag"><span class="chip notice">공지</span></td>
        <td><span class="postTitle">[필독] 이용 규칙 / 투자유의</span></td>
        <td class="colVotes">-</td><td class="colViews">12,345</td><td class="colTime">상시</td>
      </tr>`);

      rows.forEach((p,idx)=>{
        out.push(`<tr>
          <td class="colNo">${p.no}</td>
          <td class="colTag"><span class="chip">${p.tag}</span></td>
          <td title="${p.title}"><a class="postTitle" href="post-detail.html?post=${p.no}">${p.title} <span class="mono" style="opacity:.6">[${p.cmt}]</span></a></td>
          <td class="colVotes">${p.up}</td>
          <td class="colViews">${Number(p.views).toLocaleString()}</td>
          <td class="colTime">${p.time}</td>
        </tr>`);
        if(idx===3||idx===8){
          out.push(`<tr class="adRow"><td colspan="6"><div class="adInline"><div><strong>Ad</strong> · Sponsored link</div><div class="mono">native-row</div></div></td></tr>`);
        }
      });
      tbody.innerHTML=out.join("");

      pager.innerHTML="";
      const mk=(label,page,active=false)=>{
        const a=document.createElement("a");
        a.href="#"; a.textContent=label;
        if(active) a.classList.add("active");
        a.addEventListener("click",(e)=>{ e.preventDefault(); state.page=page; render(); window.scrollTo({top:0,behavior:"smooth"}); });
        return a;
      };
      const maxButtons=5;
      let startP=Math.max(1,state.page-2);
      let endP=Math.min(totalPages,startP+maxButtons-1);
      startP=Math.max(1,endP-maxButtons+1);

      pager.appendChild(mk("‹",Math.max(1,state.page-1),false));
      for(let p=startP;p<=endP;p++) pager.appendChild(mk(String(p),p,p===state.page));
      pager.appendChild(mk("›",Math.min(totalPages,state.page+1),false));
    }

    function applySearch(){
      state.type=sel?sel.value:"all";
      state.q=q?q.value:"";
      state.page=1;
      render();
    }
    if(btn) btn.addEventListener("click",applySearch);
    if(q) q.addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); applySearch(); } });
    if(sel) sel.addEventListener("change",applySearch);

    render();
  }

  function ready(fn){ if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", fn); else fn(); }

  ready(()=>{
    try{ wireThemeToggle(); }catch(e){}
    try{ wireGlobalSearch(); }catch(e){}
    try{ wireCalendar(); }catch(e){}
    try{ wireBoard(); }catch(e){}
  });
})();

/* MVP_V35: enhanced home calendar */
(function(){
  function wireCalendarV35(){
    const cal=document.getElementById("calendar");
    const selected=document.getElementById("eventSelected");
    const upcoming=document.getElementById("eventUpcoming");
    if(!cal && !selected && !upcoming) return;

    const EVENTS=[
      {date:"2026-02-06", title:"FOMC Chair speech", type:"macro", symbols:["SPY","QQQ"]},
      {date:"2026-02-10", title:"TSLA Earnings", type:"earnings", symbols:["TSLA"]},
      {date:"2026-02-12", title:"삼성전자 실적발표", type:"earnings", symbols:["005930"]},
      {date:"2026-02-18", title:"US CPI", type:"macro", symbols:["SPY"]},
      {date:"2026-02-20", title:"NVDA Earnings", type:"earnings", symbols:["NVDA"]},
    ];
    const byDate=EVENTS.reduce((m,e)=>{(m[e.date]=m[e.date]||[]).push(e); return m;},{});
    let cur=new Date(); cur.setDate(1);
    let selectedDate=null;

    function iso(d){ const y=d.getFullYear(),m=d.getMonth()+1,dd=d.getDate(); return `${y}-${String(m).padStart(2,"0")}-${String(dd).padStart(2,"0")}`; }

    function renderSelected(){
      if(!selected) return;
      if(!selectedDate){
        selected.innerHTML = `<div class="hint">날짜를 선택하면 이벤트가 표시됩니다.</div>`;
        return;
      }
      const items=(byDate[selectedDate]||[]);
      if(!items.length){
        selected.innerHTML = `<div class="hint"><span class="mono">${selectedDate}</span> 에는 이벤트가 없습니다.</div>`;
        return;
      }
      selected.innerHTML = `
        <div class="mono" style="font-weight:900;margin-bottom:6px">${selectedDate}</div>
        <div style="display:grid;gap:8px">
          ${items.map(e=>`
            <div class="evt">
              <div>
                <div style="font-weight:800">${e.title}</div>
                <div class="mono" style="opacity:.7;margin-top:2px">${(e.symbols||[]).join(", ")||"-"}</div>
              </div>
              <div class="badge">${e.type}</div>
            </div>
          `).join("")}
        </div>`;
    }

    function renderCal(){
      if(!cal) return;
      cal.innerHTML="";
      ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(x=>{ const el=document.createElement("div"); el.className="dow"; el.textContent=x; cal.appendChild(el); });
      const first=new Date(cur);
      const startDow=first.getDay();
      const start=new Date(first); start.setDate(1-startDow);
      const todayIso=iso(new Date());

      for(let i=0;i<42;i++){
        const d=new Date(start); d.setDate(start.getDate()+i);
        const inMonth=d.getMonth()===cur.getMonth();
        const di=iso(d);
        const el=document.createElement("div");
        el.className="day"+(inMonth?"":" muted")+(di===todayIso?" today":"")+(di===selectedDate?" sel":"");
        el.textContent=String(d.getDate());
        if(byDate[di]?.length){
          const dot=document.createElement("div"); dot.className="dot"; el.appendChild(dot);
        }
        el.addEventListener("click",()=>{ selectedDate=di; renderCal(); renderSelected(); });
        cal.appendChild(el);
      }
    }

    function renderUpcoming(){
      if(!upcoming) return;
      const today=new Date().toISOString().slice(0,10);
      const ups=EVENTS.slice().sort((a,b)=>a.date.localeCompare(b.date)).filter(e=>e.date>=today).slice(0,6);
      upcoming.innerHTML = ups.map(e=>`
        <div class="eventCardMini">
          <div class="left">
            <div class="d mono">${e.date}</div>
            <div class="t">${e.title}</div>
          </div>
          <div class="type">${e.type}</div>
        </div>
      `).join("");
    }

    renderCal();
    renderSelected();
    renderUpcoming();
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    try{ wireCalendarV35(); }catch(e){}
  });
})();


/* ===== MVP_BOOT_V38 (based on v3.5) ===== */
(function(){
  const ICON = `<svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" stroke-width="2"/><path d="M16.5 16.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  const SYMBOLS = [
    {symbol:"TSLA", name:"Tesla, Inc.", market:"NASDAQ"},
    {symbol:"AAPL", name:"Apple Inc.", market:"NASDAQ"},
    {symbol:"NVDA", name:"NVIDIA Corporation", market:"NASDAQ"},
    {symbol:"SPY", name:"SPDR S&P 500 ETF Trust", market:"NYSE"},
    {symbol:"QQQ", name:"Invesco QQQ Trust", market:"NASDAQ"},
    {symbol:"SCHD", name:"Schwab U.S. Dividend Equity ETF", market:"NYSE"},
    {symbol:"TQQQ", name:"ProShares UltraPro QQQ", market:"NASDAQ"},
    {symbol:"005930", name:"삼성전자", market:"KOSPI"},
    {symbol:"000660", name:"SK하이닉스", market:"KOSPI"},
    {symbol:"035420", name:"NAVER", market:"KOSPI"},
  ];

  function ready(fn){ if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", fn); else fn(); }

  function wireThemeToggle(){
    const btn = document.querySelector("[data-theme-toggle]");
    if (!btn) return;

    function setTheme(t){
      document.documentElement.setAttribute("data-theme", t);
      try{ localStorage.setItem("mvp_theme", t); }catch(e){}
      btn.textContent = (t==="dark") ? "☀️ Light" : "🌙 Dark";
    }

    let saved="light";
    try{ saved = localStorage.getItem("mvp_theme") || "light"; }catch(e){}
    if (saved!=="dark" && saved!=="light") saved="light";
    setTheme(saved);

    btn.addEventListener("click", ()=>{
      const cur = document.documentElement.getAttribute("data-theme") || "light";
      setTheme(cur==="dark" ? "light" : "dark");
    });
  }

  function wireGlobalSearch(){
    const form=document.getElementById("globalSearch");
    const input=document.getElementById("globalSearchInput");
    const results=document.getElementById("globalSearchResults");
    const btn=document.getElementById("globalSearchBtn");
    if(!form||!input||!results) return;

    function match(q){
      q=(q||"").trim();
      if(!q) return [];
      const uq=q.toUpperCase();
      const isKo=/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(q);
      return SYMBOLS.filter(s=> s.symbol.includes(uq) || (isKo ? s.name.includes(q) : s.name.toUpperCase().includes(uq)));
    }

    function openSymbol(it){
      results.style.display="none";
      input.value=it.symbol;
      location.href=`security.html?market=${encodeURIComponent(it.market.toLowerCase())}&symbol=${encodeURIComponent(it.symbol)}`;
    }

    function render(items){
      results.innerHTML="";
      if(!items.length){ results.style.display="none"; return; }
      const frag=document.createDocumentFragment();
      items.slice(0,8).forEach(it=>{
        const div=document.createElement("div");
        div.className="searchItem";
        div.innerHTML=`<div class="l"><div class="sym mono">${it.symbol} <span class="tag">· ${it.market}</span></div><div class="nm">${it.name}</div></div><div class="tag">Open</div>`;
        div.addEventListener("click",()=>openSymbol(it));
        frag.appendChild(div);
      });
      results.appendChild(frag);
      results.style.display="block";
    }

    function submit(){ const items=match(input.value); if(items.length) openSymbol(items[0]); }

    input.addEventListener("input",()=>render(match(input.value)));
    input.addEventListener("focus",()=>render(match(input.value)));
    form.addEventListener("submit",(e)=>{ e.preventDefault(); submit(); });
    if(btn) btn.addEventListener("click", submit);
    document.addEventListener("click",(e)=>{ if(!results.contains(e.target) && e.target!==input) results.style.display="none"; });
  }

  function wireCalendar(){
    const cal=document.getElementById("calendar");
    const selected=document.getElementById("eventSelected");
    const upcoming=document.getElementById("eventUpcoming");
    const selMonth=document.getElementById("calMonth");
    const selYear=document.getElementById("calYear");
    const btnPrev=document.getElementById("calPrev");
    const btnNext=document.getElementById("calNext");
    if(!cal) return;

    const EVENTS=[
      {date:"2026-02-06", title:"FOMC Chair speech", type:"macro", symbols:["SPY","QQQ"]},
      {date:"2026-02-10", title:"TSLA Earnings", type:"earnings", symbols:["TSLA"]},
      {date:"2026-02-12", title:"삼성전자 실적발표", type:"earnings", symbols:["005930"]},
      {date:"2026-02-18", title:"US CPI", type:"macro", symbols:["SPY"]},
      {date:"2026-02-20", title:"NVDA Earnings", type:"earnings", symbols:["NVDA"]},
    ];
    const byDate=EVENTS.reduce((m,e)=>{(m[e.date]=m[e.date]||[]).push(e); return m;},{});
    const now=new Date();
    let cur=new Date(now.getFullYear(), now.getMonth(), 1);
    let selectedDate=null;

    function iso(d){ const y=d.getFullYear(),m=d.getMonth()+1,dd=d.getDate(); return `${y}-${String(m).padStart(2,"0")}-${String(dd).padStart(2,"0")}`; }

    function ensureControls(){
      if(!selMonth || !selYear) return;
      // months
      if(!selMonth.dataset.ready){
        selMonth.innerHTML = Array.from({length:12},(_,i)=>`<option value="${i}">${i+1}월</option>`).join("");
        selMonth.dataset.ready="1";
      }
      if(!selYear.dataset.ready){
        const y=now.getFullYear();
        const ys=[];
        for(let k=y-3;k<=y+3;k++) ys.push(`<option value="${k}">${k}년</option>`);
        selYear.innerHTML = ys.join("");
        selYear.dataset.ready="1";
      }
      selMonth.value=String(cur.getMonth());
      selYear.value=String(cur.getFullYear());

      function sync(){
        cur=new Date(parseInt(selYear.value,10), parseInt(selMonth.value,10), 1);
        renderCal();
      }
      selMonth.addEventListener("change", sync);
      selYear.addEventListener("change", sync);

      if(btnPrev) btnPrev.addEventListener("click", ()=>{
        cur=new Date(cur.getFullYear(), cur.getMonth()-1, 1);
        selMonth.value=String(cur.getMonth());
        selYear.value=String(cur.getFullYear());
        renderCal();
      });
      if(btnNext) btnNext.addEventListener("click", ()=>{
        cur=new Date(cur.getFullYear(), cur.getMonth()+1, 1);
        selMonth.value=String(cur.getMonth());
        selYear.value=String(cur.getFullYear());
        renderCal();
      });
    }

    function renderSelected(){
      if(!selected) return;
      if(!selectedDate){ selected.innerHTML = `<div class="hint">날짜를 선택하면 이벤트가 표시됩니다.</div>`; return; }
      const items=(byDate[selectedDate]||[]);
      if(!items.length){ selected.innerHTML = `<div class="hint"><span class="mono">${selectedDate}</span> 에는 이벤트가 없습니다.</div>`; return; }
      selected.innerHTML = `
        <div class="mono" style="font-weight:900;margin-bottom:6px">${selectedDate}</div>
        <div style="display:grid;gap:8px">
          ${items.map(e=>`
            <div class="evt">
              <div>
                <div style="font-weight:800">${e.title}</div>
                <div class="mono" style="opacity:.7;margin-top:2px">${(e.symbols||[]).join(", ")||"-"}</div>
              </div>
              <div class="badge">${e.type}</div>
            </div>
          `).join("")}
        </div>`;
    }

    function renderCal(){
      cal.innerHTML="";
      ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(x=>{ const el=document.createElement("div"); el.className="dow"; el.textContent=x; cal.appendChild(el); });
      const first=new Date(cur.getFullYear(), cur.getMonth(), 1);
      const startDow=first.getDay();
      const start=new Date(first); start.setDate(1-startDow);
      const todayIso=iso(new Date());

      for(let i=0;i<42;i++){ 
        const d=new Date(start); d.setDate(start.getDate()+i);
        const inMonth=d.getMonth()===cur.getMonth();
        const di=iso(d);
        const el=document.createElement("div");
        el.className="day"+(inMonth?"":" muted")+(di===todayIso?" today":"")+(di===selectedDate?" sel":"");
        el.textContent=String(d.getDate());
        if(byDate[di]?.length){ const dot=document.createElement("div"); dot.className="dot"; el.appendChild(dot); }
        el.addEventListener("click", ()=>{ selectedDate=di; renderCal(); renderSelected(); });
        cal.appendChild(el);
      }
    }

    function renderUpcoming(){
      if(!upcoming) return;
      const today=new Date().toISOString().slice(0,10);
      const ups=EVENTS.slice().sort((a,b)=>a.date.localeCompare(b.date)).filter(e=>e.date>=today).slice(0,6);
      upcoming.innerHTML = ups.map(e=>`
        <div class="eventCardMini">
          <div class="left">
            <div class="d mono">${e.date}</div>
            <div class="t">${e.title}</div>
          </div>
          <div class="type">${e.type}</div>
        </div>
      `).join("");
    }

    ensureControls();
    renderCal();
    renderSelected();
    renderUpcoming();
  }

  function wireBoard(){
    const tbody=document.getElementById("boardRows");
    const pager=document.getElementById("boardPagination");
    const sel=document.getElementById("boardSearchType");
    const q=document.getElementById("boardSearchInput");
    const btn=document.getElementById("boardSearchBtn");
    if(!tbody||!pager) return;

    const TAGS=["실적","거시","수급","백테스트","잡담"];
    const USERS=["alpha12","mvp_user","stonks","kim34","delta","quant","valuepick","bear","bull","swing"];
    const TITLES=[
      "이번 분기 가이던스 어떻게 봄?","실적 발표 전 체크리스트 공유","백테스트 결과 공유합니다","오늘 수급 이상한데 뭐냐",
      "장기 투자 vs 단기 트레이딩","배당 재투자 효과 체감됨","환율 영향 얼마나 큼?","옵션 OI 급증 이유","CPI 앞두고 포지션 어떻게?",
      "FOMC 의사록 핵심 요약","기관이 담는 종목 리스트","테마주 과열 구간 분석",
    ];
    const SYMS=["TSLA","NVDA","AAPL","SPY","QQQ","005930","SCHD","TQQQ",""];
    const pick=(arr)=>arr[Math.floor(Math.random()*arr.length)];
    const POSTS=[];
    let baseNo=10500;
    for(let i=0;i<45;i++){ 
      const no=baseNo-i;
      const tag=TAGS[i%TAGS.length];
      const user=USERS[i%USERS.length];
      const title=`${pick(SYMS)} ${pick(TITLES)}`.trim();
      const up=5+(i*3)%140;
      const views=200+(i*137)%12000;
      const cmt=(i*7)%120;
      const time=`02-05 ${String(23-(i%16)).padStart(2,"0")}:${String((i*11)%60).padStart(2,"0")}`;
      POSTS.push({no,tag,title,up,views,time,user,cmt,body:`내용 샘플 ${i} ...`});
    }
    let state={page:1,pageSize:15,q:"",type:"all"};

    function filtered(){
      let arr=POSTS.slice();
      const qq=(state.q||"").trim().toLowerCase();
      if(qq){
        if(state.type==="title") arr=arr.filter(p=>p.title.toLowerCase().includes(qq));
        else if(state.type==="body") arr=arr.filter(p=>p.body.toLowerCase().includes(qq));
        else if(state.type==="user") arr=arr.filter(p=>p.user.toLowerCase().includes(qq));
        else if(state.type==="comment") arr=arr.filter(p=>String(p.cmt).includes(qq));
        else arr=arr.filter(p=>p.title.toLowerCase().includes(qq)||p.body.toLowerCase().includes(qq)||p.user.toLowerCase().includes(qq));
      }
      return arr;
    }

    function render(){
      const arr=filtered();
      const totalPages=Math.max(1,Math.ceil(arr.length/state.pageSize));
      if(state.page>totalPages) state.page=totalPages;

      const start=(state.page-1)*state.pageSize;
      const rows=arr.slice(start,start+state.pageSize);

      const out=[];
      out.push(`<tr>
        <td class="colNo"><span class="chip notice">공지</span></td>
        <td class="colTag"><span class="chip notice">공지</span></td>
        <td><span class="postTitle">[필독] 이용 규칙 / 투자유의</span></td>
        <td class="colVotes">-</td><td class="colViews">12,345</td><td class="colTime">상시</td>
      </tr>`);

      rows.forEach((p,idx)=>{
        out.push(`<tr>
          <td class="colNo">${p.no}</td>
          <td class="colTag"><span class="chip">${p.tag}</span></td>
          <td title="${p.title}"><a class="postTitle" href="post-detail.html?post=${p.no}">${p.title} <span class="mono" style="opacity:.6">[${p.cmt}]</span></a></td>
          <td class="colVotes">${p.up}</td>
          <td class="colViews">${Number(p.views).toLocaleString()}</td>
          <td class="colTime">${p.time}</td>
        </tr>`);
        if(idx===3||idx===8){
          out.push(`<tr class="adRow"><td colspan="6"><div class="adInline"><div><strong>Ad</strong> · Sponsored link</div><div class="mono">native-row</div></div></td></tr>`);
        }
      });
      tbody.innerHTML=out.join("");

      pager.innerHTML="";
      const mk=(label,page,active=false)=>{
        const a=document.createElement("a");
        a.href="#"; a.textContent=label;
        if(active) a.classList.add("active");
        a.addEventListener("click",(e)=>{ e.preventDefault(); state.page=page; render(); window.scrollTo({top:0,behavior:"smooth"}); });
        return a;
      };
      const maxButtons=5;
      let startP=Math.max(1,state.page-2);
      let endP=Math.min(totalPages,startP+maxButtons-1);
      startP=Math.max(1,endP-maxButtons+1);

      pager.appendChild(mk("‹",Math.max(1,state.page-1),false));
      for(let p=startP;p<=endP;p++) pager.appendChild(mk(String(p),p,p===state.page));
      pager.appendChild(mk("›",Math.min(totalPages,state.page+1),false));
    }

    function applySearch(){
      state.type=sel?sel.value:"all";
      state.q=q?q.value:"";
      state.page=1;
      render();
    }
    if(btn) btn.addEventListener("click",applySearch);
    if(q) q.addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); applySearch(); } });
    if(sel) sel.addEventListener("change",applySearch);

    render();
  }

  ready(()=>{
    try{ wireThemeToggle(); }catch(e){}
    try{ wireGlobalSearch(); }catch(e){}
    try{ wireCalendar(); }catch(e){}
    try{ wireBoard(); }catch(e){}
  });
})();
