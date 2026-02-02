/**
 * app.js
 * - 공통 런타임: region/ticker 파싱, i18n 적용, partial 주입, region nav, go-link 라우팅
 * - Single source of truth:
 *    - region: path prefix (/kr/...) 우선, 단 query로 강제도 가능
 *    - region 저장: localStorage(mvp_region)
 */
import { getRegion } from "./regions.js";
import { I18N } from "./i18n.js";

const VALID_REGIONS = new Set(["kr", "us", "ca"]);
const DEFAULT_REGION = "kr";
const STORAGE_KEY = "mvp_region";

function normalizeRegion(v) {
  if (!v) return null;
  const r = String(v).trim().toLowerCase();
  return VALID_REGIONS.has(r) ? r : null;
}

function getStoredRegion() {
  try {
    return normalizeRegion(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    return null;
  }
}

function setStoredRegion(region) {
  try {
    localStorage.setItem(STORAGE_KEY, region);
  } catch (e) {}
}

function guessRegionFromPath() {
  const parts = location.pathname.split("/").filter(Boolean);
  const p0 = (parts[0] || "").toLowerCase();
  return normalizeRegion(p0);
}

function guessTickerFromPath() {
  // 예: /kr/guide/nasdaq/ticker/schd/ -> SCHD
  const parts = location.pathname.split("/").filter(Boolean);
  const idx = parts.findIndex((p) => String(p).toLowerCase() === "ticker");
  if (idx >= 0 && parts[idx + 1]) return String(parts[idx + 1]).toUpperCase();
  return "";
}

function guessRegionByLanguage() {
  const lang = (navigator.language || "").toLowerCase();
  const langs = (navigator.languages || []).map((x) => String(x).toLowerCase());
  if (lang.startsWith("ko") || langs.some((l) => l.startsWith("ko"))) return "kr";
  if (lang.startsWith("en") || langs.some((l) => l.startsWith("en"))) return "us";
  return null;
}

/**
 * ✅ parse: region/ticker/lang
 * region 우선순위:
 * 1) query (?region= or ?r=)  2) localStorage  3) path prefix  4) browser language  5) DEFAULT
 */
export function parseParams() {
  const u = new URL(location.href);

  const qRegion =
    normalizeRegion(u.searchParams.get("region")) ||
    normalizeRegion(u.searchParams.get("r"));

  const stored = getStoredRegion();
  const pathRegion = guessRegionFromPath();
  const langRegion = guessRegionByLanguage();

  const region = qRegion || stored || pathRegion || langRegion || DEFAULT_REGION;

  // ticker 우선순위: query -> path -> ""
  const qTicker = (u.searchParams.get("ticker") || "").toUpperCase();
  const pTicker = guessTickerFromPath();
  const ticker = qTicker || pTicker || "";

  const lang = u.searchParams.get("lang") || "";
  return { region, ticker, lang };
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
 * ✅ Region 버튼 active 처리
 */
export function applyActiveRegion(regionCode) {
  const code = (regionCode || DEFAULT_REGION).toLowerCase();
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
 * /kr/... -> /us/... (prefix swap)
 * region prefix가 없으면 앞에 삽입
 */
function swapRegionInPath(targetRegion) {
  const parts = location.pathname.split("/").filter(Boolean);
  const p0 = (parts[0] || "").toLowerCase();

  if (normalizeRegion(p0)) parts[0] = targetRegion;
  else parts.unshift(targetRegion);

  return "/" + parts.join("/") + (location.pathname.endsWith("/") ? "/" : "");
}

/**
 * ✅ Region 버튼 클릭 정책 (통일)
 * - localStorage(mvp_region)에 저장
 * - 현재 경로 유지 + region prefix만 교체
 * - query는 유지하되 region/r 파라미터는 제거
 */
export function bindRegionNav(ctx) {
  const btns = document.querySelectorAll(".region-btn[data-region]");
  btns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const target = normalizeRegion(btn.getAttribute("data-region"));
      if (!target) return;

      // 저장(루트 리다이렉트와 일치)
      setStoredRegion(target);

      const u = new URL(location.href);
      const sp = new URLSearchParams(u.search);

      // region 관련 query 제거 (path가 기준)
      sp.delete("region");
      sp.delete("r");

      // ticker는 tools에서 필요할 수 있어 유지
      const ticker =
        (ctx?.ticker || "").toUpperCase() ||
        (sp.get("ticker") || "").toUpperCase() ||
        guessTickerFromPath() ||
        "";
      if (ticker) sp.set("ticker", ticker);

      const nextPath = swapRegionInPath(target);
      const qs = sp.toString();
      const nextUrl = qs ? `${nextPath}?${qs}` : nextPath;

      e.preventDefault();
      location.href = nextUrl;
    });
  });
}

/**
 * ✅ data-go 링크 라우팅
 * - guide: /{region}/guide/{market}/ticker/{ticker}/
 * - backtest: /{region}/tools/backtest/?ticker=...
 * - future:  /{region}/tools/future/?ticker=...
 */
function goUrl(kind, region, ticker, market = "nasdaq") {
  const r = normalizeRegion(region) || DEFAULT_REGION;
  const t = (ticker || "").trim().toUpperCase();
  const m = (market || "nasdaq").trim().toLowerCase();

  if (!t) return `/${r}/`;

  if (kind === "guide") return `/${r}/guide/${m}/ticker/${t.toLowerCase()}/`;
  if (kind === "backtest") return `/${r}/tools/backtest/?ticker=${encodeURIComponent(t)}`;
  if (kind === "future") return `/${r}/tools/future/?ticker=${encodeURIComponent(t)}`;
  return `/${r}/`;
}

export function bindGoLinks(region) {
  const r = normalizeRegion(region) || DEFAULT_REGION;

  document.querySelectorAll("[data-go][data-ticker]").forEach((a) => {
    a.addEventListener("click", (e) => {
      const kind = String(a.getAttribute("data-go") || "").toLowerCase();
      const ticker = a.getAttribute("data-ticker") || "";
      const market = a.getAttribute("data-market") || "nasdaq";

      const url = goUrl(kind, r, ticker, market);
      e.preventDefault();
      location.href = url;
    });
  });
}

/**
 * ✅ 페이지 공통 부트스트랩
 * - partial 주입 -> ctx -> i18n -> region active -> nav 바인딩 -> go링크 바인딩
 */
export async function boot() {
  await injectPartials();

  const ctx = getContext();

  // header partial 들어온 뒤 적용
  applyI18n(ctx.dict);
  applyActiveRegion(ctx.region.code);

  bindRegionNav(ctx);
  bindGoLinks(ctx.region.code);

  return ctx;
}
