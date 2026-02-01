/**
 * app.js
 * - 공통 런타임: region/ticker 파싱, i18n 적용, partial 주입, region nav
 */
import { getRegion } from "./regions.js";
import { I18N } from "./i18n.js";

const VALID_REGIONS = new Set(["kr", "us", "ca"]);

export function parseParams() {
  const u = new URL(location.href);
  const region =
    (u.searchParams.get("region") || "").toLowerCase() || guessRegionFromPath();
  const ticker = (u.searchParams.get("ticker") || "").toUpperCase();
  const lang = u.searchParams.get("lang") || "";
  return { region, ticker, lang };
}

function guessRegionFromPath() {
  const parts = location.pathname.split("/").filter(Boolean);
  const p0 = (parts[0] || "").toLowerCase();
  return ["kr", "us", "ca"].includes(p0) ? p0 : "kr";
}

export function getContext() {
  const { region: r, ticker, lang } = parseParams();
  const region = getRegion(r);
  const finalLang = lang && (lang === "ko" || lang === "en") ? lang : region.lang;
  return { region, ticker, lang: finalLang, dict: I18N[finalLang] || I18N.ko };
}

export function applyI18n(dict) {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key] != null) el.textContent = dict[key];
  });
}

export function fmtMoney(v, currency, locale) {
  if (!Number.isFinite(v)) return "-";
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(v);
}

/**
 * ✅ partial 주입
 * 페이지에 <div data-partial="header"></div> 넣으면
 * /assets/partials/header.html 을 fetch해서 꽂아줌
 */
export async function injectPartials() {
  const slots = document.querySelectorAll("[data-partial]");
  for (const slot of slots) {
    const name = slot.getAttribute("data-partial");
    if (!name) continue;
    const res = await fetch(`/assets/partials/${name}.html`, { cache: "no-cache" });
    if (res.ok) slot.innerHTML = await res.text();
  }
}

/**
 * query 유지 + params 덮어쓰기
 */
export function buildUrlWithParams(pathname, params = {}) {
  const u = new URL(location.href);
  const sp = new URLSearchParams(u.search);

  // 1) 빈 값 제거
  for (const [k, v] of sp.entries()) {
    if (v == null || String(v).trim() === "") sp.delete(k);
  }

  // 2) 적용
  Object.entries(params).forEach(([k, v]) => {
    if (v == null || String(v).trim() === "") sp.delete(k);
    else sp.set(k, String(v));
  });

  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * ✅ Region 버튼 active 처리 (header에 class="region-btn" data-region="kr|us|ca" 필요)
 */
export function applyActiveRegion(regionCode) {
  const code = (regionCode || "kr").toLowerCase();
  document.querySelectorAll(".region-btn[data-region]").forEach((a) => {
    const r = (a.getAttribute("data-region") || "").toLowerCase();
    if (r === code) {
      a.classList.add("bg-slate-900", "text-white");
      a.classList.remove("hover:bg-slate-100");
    } else {
      a.classList.remove("bg-slate-900", "text-white");
      a.classList.add("hover:bg-slate-100");
    }
  });
}

/**
 * ✅ Region 버튼 클릭 정책
 * - /backtest/ , /future/ : path 유지 + region/ticker만 교체
 * - 그 외(가이드/홈): /{targetRegion}/ 로 이동 (region/ticker는 query로 유지)
 */
export function bindRegionNav(ctx) {
  const btns = document.querySelectorAll(".region-btn[data-region]");
  btns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const target = (btn.getAttribute("data-region") || "").toLowerCase();
      if (!VALID_REGIONS.has(target)) return;

      const path = (location.pathname || "/").toLowerCase();
      const sp = new URLSearchParams(location.search);

      // ticker 우선순위: ctx -> query -> 기본 SCHD
      const ticker =
        (ctx?.ticker || "").toUpperCase() ||
        (sp.get("ticker") || "").toUpperCase() ||
        "SCHD";

      let nextPath;
      if (path.startsWith("/backtest/")) nextPath = "/backtest/";
      else if (path.startsWith("/future/")) nextPath = "/future/";
      else nextPath = `/${target}/`;

      const nextUrl = buildUrlWithParams(nextPath, { region: target, ticker });
      e.preventDefault();
      location.href = nextUrl;
    });
  });
}
