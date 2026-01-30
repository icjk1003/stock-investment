/**
 * app.js
 * - 공통 런타임 엔트리: region/ticker 파싱, i18n 적용, 공통 포맷/유틸, partials 주입
 */
import { getRegion } from "./regions.js";
import { I18N } from "./i18n.js";

export function parseParams() {
  const u = new URL(location.href);
  const region = (u.searchParams.get("region") || "").toLowerCase() || guessRegionFromPath();
  const ticker = (u.searchParams.get("ticker") || "").toUpperCase();
  const lang = (u.searchParams.get("lang") || "");
  return { region, ticker, lang };
}

function guessRegionFromPath(){
  const parts = location.pathname.split("/").filter(Boolean);
  const p0 = (parts[0] || "").toLowerCase();
  return ["kr","us","ca"].includes(p0) ? p0 : "kr";
}

export function getContext() {
  const { region: r, ticker, lang } = parseParams();
  const region = getRegion(r);
  const finalLang = (lang && (lang==="ko"||lang==="en")) ? lang : region.lang;
  return { region, ticker, lang: finalLang, dict: I18N[finalLang] || I18N.ko };
}

export function applyI18n(dict){
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const key = el.getAttribute("data-i18n");
    if (dict[key] != null) el.textContent = dict[key];
  });
}

export function fmtMoney(v, currency, locale){
  if (!Number.isFinite(v)) return "-";
  return new Intl.NumberFormat(locale, { style:"currency", currency }).format(v);
}

export async function injectPartials(){
  // 선택: 페이지에 <div data-partial="header"></div> 넣으면 자동 주입
  const slots = document.querySelectorAll("[data-partial]");
  for (const slot of slots) {
    const name = slot.getAttribute("data-partial");
    const res = await fetch(`/assets/partials/${name}.html`);
    if (res.ok) slot.innerHTML = await res.text();
  }
}

export function setActiveNav(current){
  document.querySelectorAll("[data-nav]").forEach(a=>{
    if (a.getAttribute("data-nav") === current) a.classList.add("text-amber-600");
  });
}
