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

let __regionDelegatedBound = false;
let __goDelegatedBound = false;

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

function guessRegionFromPath(pathname = location.pathname) {
  const parts = String(pathname).split("/").filter(Boolean);
  const p0 = (parts[0] || "").toLowerCase();
  return normalizeRegion(p0);
}

function guessTickerFromPath(pathname = location.pathname) {
  // 예: /kr/guide/nasdaq/ticker/schd/ -> SCHD
  const parts = String(pathname).split("/").filter(Boolean);
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
function swapRegionInPath(targetRegion, pathname = location.pathname) {
  const parts = String(pathname).split("/").filter(Boolean);
  const p0 = (parts[0] || "").toLowerCase();

  if (normalizeRegion(p0)) parts[0] = targetRegion;
  else parts.unshift(targetRegion);

  return "/" + parts.join("/") + (String(pathname).endsWith("/") ? "/" : "");
}

/**
 * ✅ header 로고 링크를 "현재 region 홈"으로 자동 교체
 * - header.html은 href="/"로 고정해도 됨
 * - 주입 후에 app.js가 /kr/, /us/, /ca/로 교체
 * - scope를 header slot로 제한(다른 "/" 링크 오염 방지)
 */
function patchHeaderLogoHref(regionCode) {
  const r = normalizeRegion(regionCode) || DEFAULT_REGION;
  const headerSlot = document.querySelector('[data-partial="header"]');
  if (!headerSlot) return;

  headerSlot.querySelectorAll('a[href="/"]').forEach((a) => {
    const cls = a.getAttribute("class") || "";
    if (cls.includes("flex") && cls.includes("items-center")) {
      a.setAttribute("href", `/${r}/`);
    }
  });
}

/**
 * ✅ Region 버튼 클릭 정책 (통일)
 * - localStorage(mvp_region)에 저장
 * - 현재 경로 유지 + region prefix만 교체
 * - query는 유지하되 region/r 파라미터는 제거
 *
 * ⚠️ 기존 방식(요소별 addEventListener)은 동적 주입/렌더 타이밍에 놓칠 수 있어
 * ✅ document 이벤트 위임 방식으로 교체
 */
function bindRegionNavDelegated() {
  if (__regionDelegatedBound) return;
  __regionDelegatedBound = true;

  document.addEventListener("click", (e) => {
    const a = e.target?.closest?.(".region-btn[data-region]");
    if (!a) return;

    const target = normalizeRegion(a.getAttribute("data-region"));
    if (!target) return;

    e.preventDefault();

    // ctx는 boot에서 window에 저장해 둠
    const ctx = window.__MVP_CTX || null;

    setStoredRegion(target);

    const u = new URL(location.href);
    const sp = new URLSearchParams(u.search);

    // region 관련 query 제거 (path가 기준)
    sp.delete("region");
    sp.delete("r");

    // ticker 유지(도구 페이지 등에서 필요)
    const ticker =
      (ctx?.ticker || "").toUpperCase() ||
      (sp.get("ticker") || "").toUpperCase() ||
      guessTickerFromPath() ||
      "";

    if (ticker) sp.set("ticker", ticker);

    // ✅ "현재 페이지 경로 유지 + region prefix만 교체"
    const nextPath = swapRegionInPath(target, location.pathname);
    const qs = sp.toString();
    const nextUrl = qs ? `${nextPath}?${qs}` : nextPath;

    location.href = nextUrl;
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

/**
 * ✅ go-link도 delegation으로(동적 주입 후 재바인딩 불필요)
 */
function bindGoLinksDelegated() {
  if (__goDelegatedBound) return;
  __goDelegatedBound = true;

  document.addEventListener("click", (e) => {
    const a = e.target?.closest?.("[data-go][data-ticker]");
    if (!a) return;

    const kind = String(a.getAttribute("data-go") || "").toLowerCase();
    const ticker = a.getAttribute("data-ticker") || "";
    const market = a.getAttribute("data-market") || "nasdaq";

    const ctx = window.__MVP_CTX || null;
    const region = ctx?.region?.code || guessRegionFromPath() || DEFAULT_REGION;

    const url = goUrl(kind, region, ticker, market);
    e.preventDefault();
    location.href = url;
  });
}

/**
 * (호환 유지용) 예전 코드가 bindGoLinks를 호출해도 문제 없게 no-op 수준으로 둠
 * - 이제는 delegated가 처리하므로 굳이 매번 붙일 필요 없음
 */
export function bindGoLinks(_region) {
  // delegated가 이미 처리
  bindGoLinksDelegated();
}

/**
 * ✅ 페이지 공통 부트스트랩
 * - partial 주입 -> ctx -> i18n -> header logo href 패치 -> region active -> (delegated) nav/go 바인딩
 */
export async function boot() {
  await injectPartials();

  const ctx = getContext();
  window.__MVP_CTX = ctx; // ✅ 어디서든 현재 ctx 참조 가능

  applyI18n(ctx.dict);
  patchHeaderLogoHref(ctx.region.code);
  applyActiveRegion(ctx.region.code);

  // ✅ delegation 바인딩 (한 번만)
  bindRegionNavDelegated();
  bindGoLinksDelegated();

  return ctx;
}
