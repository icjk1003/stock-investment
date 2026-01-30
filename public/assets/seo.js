/**
 * seo.js (선택)
 * - 최소 canonical 설정 도우미
 */
export function setCanonical(url){
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = url;
}
