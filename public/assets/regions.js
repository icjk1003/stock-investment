/**
 * regions.js
 * - 국가(Region)별 기본 정책
 */
export const REGIONS = {
  kr: { code:"kr", locale:"ko-KR", lang:"ko", localCcy:"KRW", showFx:true, fxPair:"USDKRW", defaultTaxDiv:0.15, defaultDisplayCcy:"LOCAL" },
  us: { code:"us", locale:"en-US", lang:"en", localCcy:"USD", showFx:false, fxPair:null, defaultTaxDiv:0.00, defaultDisplayCcy:"USD" },
  ca: { code:"ca", locale:"en-CA", lang:"en", localCcy:"CAD", showFx:true, fxPair:"USDCAD", defaultTaxDiv:0.15, defaultDisplayCcy:"LOCAL" },
};
export function getRegion(code) {
  return REGIONS[code] || REGIONS.kr;
}
