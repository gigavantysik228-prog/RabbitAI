const ua = navigator.userAgent;
const os = /android/i.test(ua) ? "android" : /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ? "ios" : /windows/i.test(ua) ? "windows" : /mac/i.test(ua) ? "mac" : "";
const me = document.querySelector(`[data-os="${os}"]`); if (me) me.classList.add("me");
let deferred = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; document.getElementById("installBtn").hidden = false; });
document.getElementById("installBtn").onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; document.getElementById("installBtn").hidden = true; };
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
(async () => {
  let p = {}; try { p = JSON.parse(localStorage.getItem("rabbit-prefs") || "{}"); } catch {}
  let l = p.lang;
  if (!l) try { l = (await (await fetch("/api/config")).json()).geo?.lang; } catch {}
  if (l && l !== "ru") I18N.setLang(l);
})();
