// Rabbit AI — автоматический перевод интерфейса на язык региона.
// Русский — исходный язык. Остальные языки переводит ИИ на сервере один раз и кэширует.
(() => {
  const V = "1";
  const CYR = /[А-Яа-яЁё]/;
  const RTL = ["ar", "fa", "he", "ur", "ps", "yi"];
  const ATTRS = ["placeholder", "title", "aria-label", "data-dark"];
  let dict = {}, lang = "ru";
  const fill = (s, v) => v ? s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "") : s;
  const t = (s, v) => fill(dict[s] || s, v);
  const orig = new WeakMap();
  const skip = el => !el || el.closest("textarea, input, select, .chat-item, script, style, [data-noi18n]") || (el.closest(".bubble") && !el.closest(".code-bar, .typing, .gen, .err"));
  function trNode(n) {
    if (!orig.has(n)) { if (!CYR.test(n.nodeValue)) return; orig.set(n, n.nodeValue); }
    const src = orig.get(n), key = src.trim(), val = lang === "ru" ? key : dict[key];
    if (!val) return;
    const out = src.replace(key, val);
    if (n.nodeValue !== out) n.nodeValue = out;
  }
  function trEl(el) {
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const k = "i18n" + a.replace(/-./g, m => m[1].toUpperCase());
      if (!el.dataset[k]) { const v = el.getAttribute(a); if (!CYR.test(v)) continue; el.dataset[k] = v; }
      const src = el.dataset[k], val = lang === "ru" ? src : dict[src.trim()];
      if (val && el.getAttribute(a) !== val) el.setAttribute(a, val);
    }
  }
  function apply(root = document.body) {
    if (!root) return;
    if (root.nodeType === 3) { if (!skip(root.parentElement)) trNode(root); return; }
    if (root.nodeType !== 1 || skip(root)) return;
    trEl(root);
    root.querySelectorAll("[placeholder],[title],[aria-label],[data-dark]").forEach(el => skip(el.parentElement) || trEl(el));
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) if (!skip(n.parentElement)) trNode(n);
    if (document.title && (CYR.test(document.title) || document.documentElement.dataset.title)) {
      const d = document.documentElement.dataset; d.title = d.title || document.title;
      document.title = lang === "ru" ? d.title : dict[d.title] || d.title;
    }
  }
  let busy = false;
  new MutationObserver(ms => {
    if (busy || lang === "ru") return; busy = true;
    for (const m of ms) { if (m.type === "characterData") apply(m.target); else m.addedNodes.forEach(n => apply(n)); }
    busy = false;
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  async function setLang(l) {
    l = (l || "ru").toLowerCase();
    if (l.startsWith("ru")) l = "ru";
    lang = l;
    document.documentElement.lang = l;
    try { if (window.RabbitAndroid && RabbitAndroid.setLang) RabbitAndroid.setLang(l === "ru" ? "ru-RU" : l); } catch {}
    document.documentElement.dir = RTL.includes(l.split("-")[0]) ? "rtl" : "ltr";
    if (l === "ru") { dict = {}; apply(); return; }
    const ck = "rabbit-i18n-" + V + "-" + l;
    try { dict = JSON.parse(localStorage.getItem(ck) || "{}"); } catch { dict = {}; }
    if (Object.keys(dict).length) apply();
    try {
      const r = await fetch("/api/i18n?lang=" + encodeURIComponent(l));
      if (r.ok) { const d = await r.json(); if (d.dict && Object.keys(d.dict).length) { dict = d.dict; try { localStorage.setItem(ck, JSON.stringify(dict)); } catch {} } }
    } catch {}
    apply();
    dispatchEvent(new Event("rabbit-lang"));
  }
  const names = l => { try { return new Intl.DisplayNames([l], { type: "language" }).of(l); } catch { return l; } };
  window.t = t;
  window.I18N = { t, setLang, apply, get lang() { return lang; }, name: names };
})();
