const $ = s => document.querySelector(s);
const chatEl = $("#chat"), welcome = $("#welcome"), input = $("#input"), send = $("#send"), main = $("#main"), list = $("#chatList");
let chats = JSON.parse(localStorage.getItem("rabbit-chats") || "[]");
let currentId = null, controller = null, pending = [];
let cfg = { plan: "free", remaining: null, limit: 20, plans: { free: { chars: 25000, images: 0, deep: 0 } } };
let mode = "auto";
let cat = localStorage.getItem("rabbit-cat") === "code" ? "code" : "chat";
const catOf = c => c.cat || "chat";
let prefs = { about: "", length: "normal", rate: 1, auto: false, enter: true, ...JSON.parse(localStorage.getItem("rabbit-prefs") || "{}") };
const myPlan = () => cfg.plans?.[cfg.plan] || cfg.plans.free;
let proToken = localStorage.getItem("rabbit-pro") || "";
const isDark = () => document.documentElement.classList.contains("dark");
const isDog = () => document.documentElement.classList.contains("dog");
const avaSrc = () => isDark() ? "/bunny-swag.svg" : isDog() ? "/dog.svg" : "/bunny.svg";
const isPro = () => cfg.plan !== "free";
const isOwner = () => cfg.plan === "owner";

const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const md = t => window.marked && window.DOMPurify ? DOMPurify.sanitize(marked.parse(t)) : esc(t);
const save = () => { try { localStorage.setItem("rabbit-chats", JSON.stringify(chats.slice(0, 50))); } catch { toast("Память браузера заполнена — удали старые чаты"); } };
const current = () => chats.find(c => c.id === currentId);
const toBottom = () => main.scrollTop = main.scrollHeight;
const toast = t => { const el = $("#toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2200); };
const headers = () => ({ "Content-Type": "application/json", ...(proToken ? { "X-Rabbit-Pro": proToken } : {}) });

/* ---------- подписка ---------- */
async function loadConfig() {
  const q = new URLSearchParams(); if (prefs.cur) q.set("cur", prefs.cur); if (prefs.lang) q.set("lang", prefs.lang);
  try { cfg = { ...cfg, ...(await (await fetch("/api/config?" + q, { headers: headers() })).json()) }; } catch {}
  const want = prefs.lang || cfg.geo?.lang || "ru";
  if (want !== I18N.lang) I18N.setLang(want);
  if (proToken && cfg.plan === "free") { proToken = ""; localStorage.removeItem("rabbit-pro"); }
  renderPlan(); renderAnnounce(); renderModelBtn(); applySite();
}
function applySite() {
  if (!localStorage.getItem("rabbit-theme") && ["light", "dark", "dog"].includes(cfg.defaultTheme) && !applySite.done) { applySite.done = 1; setTheme(cfg.defaultTheme); }
  const off = new Set(cfg.modesOff || []);
  document.querySelectorAll("[data-mode]").forEach(b => { if (off.has(b.dataset.mode)) b.style.display = "none"; else if (b.style.display === "none") b.style.display = ""; });
  if (cfg.welcome) document.querySelectorAll("#welcome .sub").forEach(p => { p.textContent = cfg.welcome; });
  const sup = $("#supportLink"); if (sup) { sup.hidden = !cfg.support; if (cfg.support) sup.href = cfg.support; }
  (cfg.inbox || []).forEach((m, i) => setTimeout(() => showInbox(m.text), 800 + i * 400)); cfg.inbox = [];
}
function showInbox(text) {
  const el = document.createElement("div"); el.className = "inbox-msg";
  el.innerHTML = `<b>✉️ ${esc(t("Сообщение от владельца Rabbit AI"))}</b><p></p><button>${esc(t("Понятно"))}</button>`;
  el.querySelector("p").textContent = text; el.querySelector("button").onclick = () => el.remove();
  document.body.appendChild(el);
}
const PLAN_UI = {
  free: { e: "🐰", extra: ["Быстрая модель", "Создание файлов, голос, озвучка"] },
  plus: { e: "⭐", extra: ["Умная модель (как в Pro)", "Режим «Глубоко» — думает дольше"] },
  pro: { e: "💎", tag: "ХИТ", extra: ["Самая умная модель, думает глубже", "Длинные подробные ответы"] },
  max: { e: "👑", tag: "МАКСИМУМ", extra: ["«Консилиум»: 2 ИИ решают и проверяют друг друга", "Самые длинные ответы и огромные файлы"] },
};
const n = v => v === "∞" ? "∞" : Number(v).toLocaleString(I18N.lang);
function renderPlans() {
  const box = $("#plans"); box.innerHTML = "";
  for (const k of ["free", "plus", "pro", "max"]) {
    const p = cfg.plans?.[k]; if (!p) continue;
    const ui = PLAN_UI[k], cur = cfg.plan === k;
    const li = [
      t("{n} сообщений в день", { n: `<b>${n(p.day)}</b>` }),
      ...ui.extra.map(x => t(x)),
      ...(k === "max" && cfg.maxPremium ? [t("Топовые мировые модели ИИ")] : []),
      ...(() => { const ms = k === "free" ? [] : (cfg.models || []).filter(m => m.min === k).map(m => m.name.replace(/^\S+\s/, "")); return ms.length ? [t("⚙️ Выбор моделей: {list}", { list: `<b>${esc((k === "plus" ? "" : "+ ") + ms.join(", "))}</b>` })] : []; })(),
      t("Файлы и PDF до {n} символов", { n: n(p.chars) }),
      t("🌐 Поиск в интернете: {n}/день", { n: n(p.search) }),
      t("🎨 Рисование картинок: {n}/день", { n: n(p.draw) }),
      t("👨‍💻 Отдельный раздел для кода"),
    ];
    const no = [];
    p.deep ? li.push(t("🧠 Глубокое мышление: {n}/день", { n: n(p.deep) })) : no.push(t("Глубокое мышление"));
    +p.video || p.video === "∞" ? li.push(t("🎬 Создание видео: {n}/день", { n: n(p.video) })) : no.push(t("Создание видео"));
    p.images ? li.push(t("📷 Анализ фото: до {n} за раз", { n: p.images })) : no.push(t("Анализ фото и картинок"));
    const el = document.createElement("div");
    el.className = "plan" + (k === "pro" ? " best" : "") + (k === "max" ? " max" : "") + (cur ? " cur" : "");
    el.innerHTML = `${ui.tag ? `<span class="ptag">${t(ui.tag)}</span>` : ""}<h3>${ui.e} ${esc(t(p.name))}</h3><div class="price">${esc(cfg.prices?.[k] ? cfg.prices[k].text + (k === "free" ? "" : " " + t("/ месяц")) : p.price)}</div><ul>${li.map(x => `<li>✓ ${x}</li>`).join("")}${no.map(x => `<li class="no">× ${x}</li>`).join("")}</ul>` +
      (k === "free" ? "" : cur ? `<span class="buy disabled">${t("✓ Ваш тариф")}</span>` : `<a class="buy${p.pay ? "" : " disabled"}" href="${esc(p.pay || "#")}" target="_blank" rel="noopener">${esc(t("Купить {name}", { name: p.name.replace("Rabbit ", "") }))}</a>`);
    el.querySelectorAll("a.buy.disabled").forEach(a => a.onclick = e => { e.preventDefault(); toast("Оплата скоро появится 💎 Напиши владельцу сайта"); });
    box.appendChild(el);
  }
}
function renderPlan() {
  $("#proLabel").textContent = isOwner() ? "VIP ∞" : isPro() ? (cfg.planName || "PRO").replace("Rabbit ", "").toUpperCase() : "Тарифы";
  $("#proBtn").classList.toggle("vip", isOwner());
  $("#proBtn").classList.toggle("active", isPro());
  $("#usage").textContent = cfg.remaining == null ? "" : `${cfg.remaining}/${cfg.limit}`;
  $("#usage").classList.toggle("low", !isPro() && cfg.remaining != null && cfg.remaining <= 3);
  renderPlans();
  $("#proActive").hidden = !isPro(); $("#codeForm").hidden = isPro();
  if (isPro()) $("#proText").textContent = isOwner() ? "👑 VIP владельца активен" : `${PLAN_UI[cfg.plan]?.e || "💎"} ` + t(cfg.forever ? "{plan} активен" : "{plan} активен до", { plan: cfg.planName });
  if (isPro() && cfg.exp) $("#proUntil").textContent = cfg.forever ? t("навсегда ∞") + (isOwner() ? " · " + t("без лимитов") : "") : new Date(cfg.exp).toLocaleDateString(I18N.lang);
}
const openPro = () => { $("#proModal").hidden = false; };
/* ---------- объявление от владельца ---------- */
function renderAnnounce() {
  const txt = cfg.announce || "", box = $("#announce");
  box.hidden = !txt || localStorage.getItem("rabbit-ann") === txt;
  $("#announceText").textContent = txt;
  $("#announceX").onclick = () => { localStorage.setItem("rabbit-ann", txt); box.hidden = true; };
}
/* ---------- выбор модели (Plus и выше) ---------- */
const RANK = { free: 0, plus: 1, pro: 2, max: 3, owner: 4 };
const canPickModel = () => RANK[cfg.plan] >= 1;
const PLAN_LABEL = { plus: "Plus", pro: "Pro", max: "Max" };
function renderModelBtn() {
  const m = (cfg.models || []).find(x => x.id === prefs.model);
  $("#modelBtn").classList.toggle("on", canPickModel() && !!m && m.id !== "auto");
  $("#modelBtn").title = t("Модель ИИ") + ": " + (canPickModel() && m ? m.name : "🐰 " + t("Авто"));
}
function openModels() {
  const box = $("#modelList"); box.innerHTML = "";
  const cur = canPickModel() ? prefs.model || "auto" : "auto";
  $("#modelNote").hidden = canPickModel();
  (cfg.models || [{ id: "auto", name: "🐰 Авто", desc: "Rabbit сам выбирает лучшую модель под задачу", min: "free" }]).forEach(m => {
    const locked = RANK[cfg.plan] < RANK[m.min];
    const b = document.createElement("button");
    b.className = "model-item" + (m.id === cur ? " on" : "") + (locked ? " locked" : "");
    b.innerHTML = `<b>${esc(m.name)}</b><span>${esc(t(m.desc))}</span>${locked ? `<em>🔒 ${esc(PLAN_LABEL[m.min] || "")}+</em>` : m.id === cur ? "<em>✓</em>" : ""}`;
    b.onclick = () => {
      if (locked) { toast(t("Эта модель — с тарифа {plan} 💎", { plan: PLAN_LABEL[m.min] })); return openPro(); }
      prefs.model = m.id; savePrefs(); openModels(); renderModelBtn();
    };
    box.appendChild(b);
  });
  $("#setRole").innerHTML = ROLES.map(([v, n]) => `<option value="${v}">${esc(t(n))}</option>`).join(""); $("#setRole").value = prefs.role || "";
  $("#setRole").onchange = () => { prefs.role = $("#setRole").value; savePrefs(); renderModelBtn(); toast(t("Роль: {r}", { r: t(ROLES.find(r => r[0] === prefs.role)[1]) })); };
  document.querySelectorAll("#setTemp button").forEach(b => { b.classList.toggle("on", b.dataset.v === (prefs.temp || "balanced")); b.onclick = () => { if (!canPickModel()) { toast("Настройка креативности — с тарифа Plus 💎"); return openPro(); } prefs.temp = b.dataset.v; savePrefs(); openModels(); }; });
  document.querySelectorAll("#setLength2 button").forEach(b => { b.classList.toggle("on", b.dataset.v === (prefs.length || "normal")); b.onclick = () => { prefs.length = b.dataset.v; savePrefs(); openModels(); }; });
  $("#modelModal").hidden = false;
}
$("#modelBtn").onclick = () => { if (!canPickModel()) toast("⚙️ Выбор модели — с тарифа Plus 💎"); openModels(); };
$("#modelClose").onclick = $("#modelSave").onclick = () => $("#modelModal").hidden = true;
$("#modelModal").onclick = e => { if (e.target.id === "modelModal") $("#modelModal").hidden = true; };
$("#proBtn").onclick = openPro; $("#openPro2").onclick = () => { openPro(); closeSide(); };
$("#proClose").onclick = () => $("#proModal").hidden = true;
$("#proModal").onclick = e => { if (e.target.id === "proModal") $("#proModal").hidden = true; };
$("#codeForm").onsubmit = async e => {
  e.preventDefault();
  const code = $("#codeInput").value.trim(); if (!code) return;
  const r = await fetch("/api/activate", { method: "POST", headers: headers(), body: JSON.stringify({ code }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return toast(d.error || "Не получилось");
  proToken = d.token; localStorage.setItem("rabbit-pro", proToken); $("#codeInput").value = "";
  await loadConfig(); toast(isOwner() ? "👑 VIP навсегда активирован. С возвращением, босс!" : isDark() ? t("{plan} активирован. Респект 😎", { plan: cfg.planName }) : t("{plan} активирован! 💎🐰", { plan: cfg.planName }));
};
$("#proLogout").onclick = () => { proToken = ""; localStorage.removeItem("rabbit-pro"); loadConfig(); };

/* ---------- список чатов ---------- */
function renderList() {
  const q = ($("#chatSearch").value || "").trim().toLowerCase();
  const pool = chats.filter(c => catOf(c) === cat).sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0));
  const shown = q ? pool.filter(c => c.title.toLowerCase().includes(q) || c.messages.some(m => (m.display ?? m.content).toLowerCase().includes(q))) : pool;
  list.innerHTML = shown.length ? "" : q ? '<p class="empty">Ничего не нашлось 🔍</p>' : (cat === "code" ? '<p class="empty">Тут будут чаты про код 👨‍💻</p>' : '<p class="empty">Тут пока пусто. Задай зайчику первый вопрос 🐰</p>');
  shown.forEach(c => {
    const b = document.createElement("button");
    b.className = "chat-item" + (c.id === currentId ? " active" : "");
    b.innerHTML = `<span><b class="ci"></b>${c.pin ? "📌 " : ""}${esc(c.title)}</span><i class="pin" title="Закрепить">📌</i><i class="ren" title="Переименовать">✏️</i><i class="del" title="Удалить">×</i>`;
    b.onclick = e => {
      if (e.target.classList.contains("pin")) { c.pin = !c.pin; save(); renderList(); return; }
      if (e.target.classList.contains("ren")) { const v = prompt(t("Новое название чата"), c.title); if (v && v.trim()) { c.title = v.trim().slice(0, 60); save(); renderList(); } return; }
      if (e.target.classList.contains("del")) { chats = chats.filter(x => x.id !== c.id); save(); if (c.id === currentId) newChat(); else renderList(); return; }
      openChat(c.id); closeSide();
    };
    list.appendChild(b);
  });
}

/* ---------- сообщения ---------- */
function speak(text, btn) {
  if (window.RabbitAndroid) { if (RabbitAndroid.speaking()) { RabbitAndroid.stopSpeak(); if (btn) btn.textContent = "🔊 Озвучить"; } else { RabbitAndroid.speak(text.slice(0, 4000)); if (btn) { btn.textContent = "⏹ Стоп"; setTimeout(() => btn.textContent = "🔊 Озвучить", 4000); } } return; }
  if (!("speechSynthesis" in window)) return toast("Озвучка не поддерживается в этом браузере");
  if (speechSynthesis.speaking) { speechSynthesis.cancel(); if (btn) btn.textContent = "🔊 Озвучить"; return; }
  const u = new SpeechSynthesisUtterance(text.slice(0, 4000)); u.rate = +prefs.rate || 1;
  const L2 = I18N.lang.split("-")[0]; u.lang = L2 === "ru" ? "ru-RU" : I18N.lang; const v = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith(L2)); if (v) u.voice = v;
  u.onend = () => { if (btn) btn.textContent = "🔊 Озвучить"; };
  if (btn) btn.textContent = "⏹ Стоп"; speechSynthesis.speak(u);
}
function addMsg(role, msg, opts = {}) {
  hideWelcome();
  const el = document.createElement("div");
  el.className = "msg " + (role === "user" ? "user" : "bot");
  const ava = avaSrc();
  el.innerHTML = role === "user"
    ? '<div class="body"><div class="att"></div><div class="bubble"></div><div class="actions u"><button data-a="edit">✏️ Изменить</button><button data-a="ucopy">📋</button></div></div>'
    : `<img class="avatar" src="${ava}" alt=""><div class="body"><div class="bubble"></div><div class="actions"><button data-a="copy">📋 Копировать</button><button data-a="speak">🔊 Озвучить</button><button data-a="word">📘 В Word</button>${navigator.share ? '<button data-a="share">📤</button>' : ""}<button data-a="shorter">✂️ Короче</button><button data-a="longer">📖 Подробнее</button><button data-a="retry">🔄 Ещё раз</button><button data-a="up" title="Хороший ответ">👍</button><button data-a="down" title="Плохой ответ">👎</button></div></div>`;
  const b = el.querySelector(".bubble");
  if (role === "user") {
    b.textContent = msg.display ?? msg.content;
    if (!b.textContent) b.remove();
    const att = el.querySelector(".att");
    (msg.files || []).forEach(f => { const s = document.createElement("span"); s.className = "chip"; s.textContent = (f.icon || "📄") + " " + f.name; att.appendChild(s); });
    (opts.images || []).forEach(src => { const i = document.createElement("img"); i.src = src; i.className = "thumb"; att.appendChild(i); });
    if (msg.mode && !["chat", "auto", "code"].includes(msg.mode)) { const s = document.createElement("span"); s.className = "chip mode-chip"; s.textContent = MODE_NAME[msg.mode] || msg.mode; att.prepend(s); }
    el.querySelectorAll(".actions button").forEach(btn => btn.onclick = () => {
      if (btn.dataset.a === "ucopy") { navigator.clipboard.writeText(msg.display ?? msg.content); return toast("Скопировано 🐾"); }
      editMsg(el);
    });
  } else {
    const lbl = { search: "Ищу в интернете…", deep: "Думаю очень глубоко… 🧠", draw: "Рисую… 🎨", codex: "CodeX пишет код… ⚡", meme: "Генерирую дичь… 🤪", video: "🎬 Снимаю видео… (1–3 мин)", translate: "Перевожу…", code: "Пишу код…" }[opts.mode];
    if (opts.loading) b.innerHTML = `<div class="typing"><i></i><i></i><i></i><em class="l-only">${t(lbl || "Зайчик думает…")}</em><em class="d-only">${t(lbl || "Думаю…")}</em><em class="g-only">${t(lbl || "Пёсик думает… 🐾")}</em></div>`;
    else { b.innerHTML = md(msg.content); finish(b); }
    el.querySelectorAll(".actions button").forEach(btn => btn.onclick = () => {
      const a = btn.dataset.a, raw = el.dataset.raw || msg.content || "";
      if (a === "copy") { navigator.clipboard.writeText(raw); toast("Скопировано 🐾"); }
      else if (a === "speak") speak(b.innerText, btn);
      else if (a === "word") RabbitFiles.download("rabbit-ai-otvet.doc", raw);
      else if (a === "share") navigator.share({ title: "Rabbit AI", text: raw.slice(0, 5000) }).catch(() => {});
      else if (a === "up" || a === "down") {
        if (el.dataset.voted) return toast(t("Спасибо, отзыв уже учтён 💕"));
        const note = a === "down" ? prompt(t("Что не так с ответом? (необязательно)")) : ""; if (note === null) return;
        el.dataset.voted = 1; btn.classList.add("voted");
        const c = current(), i = c ? c.messages.findIndex(m => m.content === raw) : -1, q = i > 0 ? c.messages[i - 1].content : "";
        fetch("/api/feedback", { method: "POST", headers: headers(), body: JSON.stringify({ v: a === "up" ? 1 : -1, q, a: raw, note, mode: msg.mode || "" }) }).catch(() => {});
        toast(a === "up" ? t("Спасибо! Зайчик рад 🥰") : t("Спасибо, учтём и станем лучше 🛠"));
      }
      else if (a === "shorter") ask(t("Сократи свой последний ответ: оставь только самое главное, коротко и ясно."));
      else if (a === "longer") ask(t("Объясни свой последний ответ подробнее: с деталями, примерами и пояснениями."));
      else retry();
    });
    el.dataset.raw = msg.content || "";
  }
  chatEl.appendChild(el); toBottom();
  return b;
}
const MODE_NAME = { search: "🌐 Интернет", deep: "🧠 Глубокое мышление", codex: "⚡ CodeX", meme: "🤪 Мем-чат", draw: "🎨 Картинка", video: "🎬 Видео", code: "👨‍💻 Код", tutor: "🎓 Репетитор", writer: "✍️ Писатель", translate: "🌍 Перевод" };
function finish(b) {
  RabbitFiles.enhance(b, true);
  b.querySelectorAll("a[href^='http']").forEach(a => { a.target = "_blank"; a.rel = "noopener"; });
  if (window.hljs) b.querySelectorAll("pre > code").forEach(c => { if (!/language-file:/.test(c.className) && !c.dataset.highlighted) try { hljs.highlightElement(c); } catch {} });
  b.querySelectorAll("a[href^='/api/video']").forEach(a => {
    if (a.closest(".gen")) return;
    const w = document.createElement("div"); w.className = "gen vid loading";
    w.innerHTML = `<p class="vid-wait">${t("🎬 Снимаю видео… (1–3 мин)")}</p>`;
    const v = document.createElement("video"); v.controls = true; v.playsInline = true; v.preload = "auto"; v.src = a.getAttribute("href");
    v.onloadeddata = () => { w.classList.remove("loading"); w.querySelector(".vid-wait")?.remove(); };
    v.onerror = () => { w.classList.remove("loading"); w.classList.add("fail"); const p = w.querySelector(".vid-wait"); if (p) p.textContent = t("😿 Видео не получилось. Возможно, закончился баланс Pollinations — попробуй позже"); };
    w.appendChild(v);
    const d = document.createElement("a"); d.href = v.src; d.target = "_blank"; d.rel = "noopener"; d.className = "gen-dl"; d.download = "rabbit-ai-video.mp4"; d.textContent = "⬇ Скачать";
    w.appendChild(d);
    (a.closest("p") || a).replaceWith(w);
  });
  b.querySelectorAll("img[src^='/api/image']").forEach(img => {
    if (img.closest(".gen")) return;
    const w = document.createElement("div"); w.className = "gen loading"; img.before(w); w.appendChild(img);
    img.onload = () => w.classList.remove("loading");
    img.onerror = () => { w.classList.remove("loading"); w.classList.add("fail"); };
    const a = document.createElement("a"); a.href = img.src; a.target = "_blank"; a.rel = "noopener"; a.className = "gen-dl"; a.download = "rabbit-ai-art.jpg"; a.textContent = "⬇ Скачать";
    if (window.RabbitAndroid) a.onclick = async e => { e.preventDefault(); try { const bl = await (await fetch(img.src)).blob(); const fr = new FileReader(); fr.onload = () => RabbitAndroid.save("rabbit-ai-art.jpg", fr.result.split(",")[1], bl.type); fr.readAsDataURL(bl); } catch { toast("Не удалось сохранить"); } };
    w.appendChild(a);
  });
}
function editMsg(el) {
  const c = current(); if (!c || controller) return;
  const ui = [...chatEl.querySelectorAll(".msg.user")].indexOf(el);
  const idx = c.messages.map((m, i) => m.role === "user" ? i : -1).filter(i => i >= 0)[ui]; const m = c.messages[idx]; if (!m) return;
  c.messages = c.messages.slice(0, idx); save(); openChat(c.id);
  input.value = m.display ?? m.content; input.dispatchEvent(new Event("input")); input.focus();
  if (m.mode) setMode(m.mode, true);
  toast("Измени сообщение и отправь заново ✏️");
}
function openChat(id) {
  currentId = id; chatEl.innerHTML = "";
  const c = current();
  if (c && catOf(c) !== cat) setCat(catOf(c), true);
  if (!c || !c.messages.length) showWelcome();
  else c.messages.forEach(m => addMsg(m.role, m));
  renderList();
}
function newChat() { currentId = null; chatEl.innerHTML = ""; showWelcome(); clearPending(); renderList(); input.focus(); }

async function stream(c, images = []) {
  const m = c.messages.at(-1)?.mode || (catOf(c) === "code" ? "code" : "auto");
  const bubble = addMsg("assistant", { content: "" }, { loading: true, mode: m });
  const msgEl = bubble.closest(".msg");
  send.classList.add("busy");
  controller = new AbortController();
  let answer = "";
  try {
    const r = await fetch("/api/chat", { method: "POST", headers: headers(), body: JSON.stringify({ messages: c.messages.map(m => ({ role: m.role, content: m.content })), images, mode: m, prefs: { about: prefs.about, length: prefs.length, lang: I18N.lang, theme: isDark() ? "swag" : isDog() ? "dog" : "bunny", model: canPickModel() ? prefs.model || "auto" : "auto", role: prefs.role || "", memory: prefs.memory || [], pluginsOff: prefs.pluginsOff || [], custom: (prefs.custom || []).filter(x => !x.off), temp: canPickModel() ? prefs.temp : undefined } }), signal: controller.signal });
    if (r.headers.get("X-Remaining")) { const n = h => { const v = r.headers.get(h); return v === "∞" ? v : +v; }; cfg.remaining = n("X-Remaining"); cfg.limit = n("X-Limit"); renderPlan(); }
    const usedPlug = (r.headers.get("X-Plugins") || "").split(",").filter(Boolean);
    if (usedPlug.length) { const box = document.createElement("div"); box.className = "plug-used"; box.innerHTML = usedPlug.map(id => { const p = id.startsWith("u:") ? (prefs.custom || []).find(x => x.id === id.slice(2)) : (cfg.plugins || []).find(x => x.id === id); if (p && id.startsWith("u:")) return `<span>${esc(p.e || "🧩")} ${esc(p.name)}</span>`; return `<span>${p ? p.e + " " + esc(t(p.name)) : "🧩 " + esc(id)}</span>`; }).join(""); bubble.before(box); }
    if (!r.ok) { const e = await r.json().catch(() => ({})); if (e.needPro) setTimeout(openPro, 600); throw new Error(e.error || "Ошибка " + r.status); }
    const reader = r.body.getReader(), dec = new TextDecoder();
    bubble.classList.add("cursor");
    let last = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      answer += dec.decode(value, { stream: true });
      if (Date.now() - last > 60) { bubble.innerHTML = md(answer); RabbitFiles.enhance(bubble, false); toBottom(); last = Date.now(); }
    }
    if (!answer) throw new Error("Пустой ответ");
  } catch (e) {
    if (e.name !== "AbortError") bubble.innerHTML = '<span class="err">😿 ' + esc(e.message) + "</span>";
  }
  bubble.classList.remove("cursor");
  if (answer) {
    c.messages.push({ role: "assistant", content: answer }); save();
    bubble.innerHTML = md(answer); finish(bubble); msgEl.dataset.raw = answer;
    if (prefs.auto && !["draw", "video"].includes(m) && !bubble.querySelector(".gen")) speak(bubble.innerText);
    if (bubble.querySelector(".file-card")) toast(isDark() ? "Файл готов. Забирай 📁" : "Файл готов! Жми «Скачать» 📁");
  }
  controller = null; send.classList.remove("busy"); input.focus();
}

async function ask(text) {
  text = text.trim();
  if ((!text && !pending.length) || controller) return;
  const files = pending.filter(p => p.kind === "text"), images = pending.filter(p => p.kind === "image").map(p => p.dataUrl);
  if (!text) text = images.length ? "Что на этом изображении? Опиши подробно." : "Изучи прикреплённый файл: кратко перескажи, выдели главное и предложи, чем могу помочь.";
  let content = text;
  files.forEach(f => content += `\n\n📎 Файл «${f.name}»:\n"""\n${f.text}\n"""`);
  if (images.length) content += `\n\n[Прикреплено изображений: ${images.length}]`;
  const remember = text.match(/^\s*(?:запомни|запомните|remember)(?:\s*,?\s*(?:что|that))?[\s,:]+(.{3,200})$/i);
  if (remember) { prefs.memory = [...(prefs.memory || []).filter(x => x !== remember[1].trim()), remember[1].trim()].slice(-30); savePrefs(); toast("🧠 Запомнил! Посмотреть можно в Настройках"); }
  const max = myPlan().chars === "∞" ? Infinity : +myPlan().chars || 25000;
  if (content.length > max) { toast(t("Файл слишком большой для тарифа {plan} 💎", { plan: cfg.planName || "" })); if (!isOwner()) openPro(); return; }
  let c = current();
  if (!c) { c = { id: Date.now().toString(36), cat, title: (text || files[0]?.name || "Файл").slice(0, 40), messages: [] }; chats.unshift(c); currentId = c.id; }
  const msg = { role: "user", content, display: text, mode: images.length ? (cat === "code" ? "code" : "chat") : cat === "code" && !["deep", "search", "codex"].includes(mode) ? "code" : mode, files: [...files.map(f => ({ name: f.name, icon: f.icon })), ...pending.filter(p => p.kind === "image").map(p => ({ name: p.name, icon: "🖼" }))] };
  c.messages.push(msg); save(); renderList();
  addMsg("user", msg, { images });
  clearPending();
  await stream(c, images);
}
function retry() {
  const c = current(); if (!c || controller) return;
  if (c.messages.at(-1)?.role === "assistant") c.messages.pop();
  save(); openChat(c.id); stream(c);
}

/* ---------- вложения ---------- */
function clearPending() { pending = []; renderPending(); }
function renderPending() {
  const box = $("#attachments"); box.innerHTML = "";
  pending.forEach((p, i) => {
    const s = document.createElement("span"); s.className = "chip pend";
    s.innerHTML = (p.kind === "image" ? `<img src="${p.dataUrl}" alt="">` : `<em>${p.icon}</em>`) + `<span>${esc(p.name)}</span><small>${p.kind === "text" ? Math.round(p.text.length / 1000) + " тыс. симв." : "фото"}</small><i title="Убрать">×</i>`;
    s.querySelector("i").onclick = () => { pending.splice(i, 1); renderPending(); };
    box.appendChild(s);
  });
  box.classList.toggle("has", pending.length > 0);
}
async function addFiles(fileList) {
  for (const f of fileList) {
    if (pending.length >= 6) { toast("Максимум 6 файлов за раз"); break; }
    if (f.type.startsWith("image/") && !+myPlan().images) { toast("Анализ фото — в тарифах Plus, Pro и Max 💎"); openPro(); continue; }
    if (f.type.startsWith("image/") && pending.filter(p => p.kind === "image").length >= +myPlan().images) { toast(t("Максимум {n} картинок за раз", { n: myPlan().images })); continue; }
    const tmp = { name: f.name, kind: "loading", icon: "⏳" }; pending.push(tmp); renderPending();
    try { Object.assign(tmp, await RabbitFiles.read(f)); if (tmp.kind === "text" && !tmp.text) throw new Error(`«${f.name}» пустой`); }
    catch (e) { pending.splice(pending.indexOf(tmp), 1); toast("😿 " + e.message); }
    renderPending();
  }
  input.focus();
}
$("#attachBtn").onclick = () => $("#fileInput").click();
$("#fileInput").onchange = e => { addFiles([...e.target.files]); e.target.value = ""; };
let dragN = 0;
addEventListener("dragenter", e => { if (e.dataTransfer?.types.includes("Files")) { dragN++; $("#drop").classList.add("show"); } });
addEventListener("dragleave", () => { if (--dragN <= 0) { dragN = 0; $("#drop").classList.remove("show"); } });
addEventListener("dragover", e => e.preventDefault());
addEventListener("drop", e => { e.preventDefault(); dragN = 0; $("#drop").classList.remove("show"); if (e.dataTransfer.files.length) addFiles([...e.dataTransfer.files]); });
input.addEventListener("paste", e => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); addFiles(fs); } });

/* ---------- голосовой ввод ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
window.onAndroidSpeech = t => { input.value = (input.value ? input.value + " " : "") + t; input.dispatchEvent(new Event("input")); input.focus(); };
if (window.RabbitAndroid) $("#micBtn").onclick = () => RabbitAndroid.listen();
else if (!SR) $("#micBtn").style.display = "none";
else {
  let rec = null;
  $("#micBtn").onclick = () => {
    if (rec) return rec.stop();
    rec = new SR(); rec.lang = I18N.lang.split("-")[0] === (navigator.language || "").split("-")[0] ? navigator.language : I18N.lang; rec.interimResults = true; rec.continuous = false;
    const base = input.value ? input.value + " " : "";
    rec.onresult = e => { input.value = base + [...e.results].map(r => r[0].transcript).join(""); input.dispatchEvent(new Event("input")); };
    rec.onerror = e => toast(e.error === "not-allowed" ? "Разреши доступ к микрофону" : "Не расслышал 🐰");
    rec.onend = () => { rec = null; $("#micBtn").classList.remove("rec"); };
    rec.start(); $("#micBtn").classList.add("rec"); toast(isDark() ? "Говори. Слушаю 🎙" : "Говори, я слушаю 🎙🐰");
  };
}

/* ---------- экспорт чата ---------- */
$("#exportChat").onclick = () => {
  const c = current(); if (!c) return toast("Сначала начни чат 🐰");
  const text = `# ${c.title}\n\n` + c.messages.map(m => `**${m.role === "user" ? "Вы" : "Rabbit AI"}:**\n\n${m.role === "user" ? (m.display || "") + (m.files?.length ? "\n\n📎 " + m.files.map(f => f.name).join(", ") : "") : m.content}`).join("\n\n---\n\n");
  RabbitFiles.download("rabbit-chat.md", text);
};

/* ---------- ввод ---------- */
$("#form").addEventListener("submit", e => {
  e.preventDefault();
  if (controller) return controller.abort();
  if (pending.some(p => p.kind === "loading")) return toast("Секунду, читаю файл…");
  const t = input.value; input.value = ""; input.style.height = "auto"; ask(t);
});
input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && (prefs.enter || e.ctrlKey || e.metaKey)) { e.preventDefault(); $("#form").requestSubmit(); } });
input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = input.scrollHeight + "px"; });
document.querySelectorAll(".card").forEach(c => c.addEventListener("click", () => { setMode(c.dataset.mode || "auto", true); ask(t(c.dataset.q)); }));

/* ---------- режимы ---------- */
const PH = { search: "Что найти в интернете?", deep: "Сложная задача? Зайчик подумает очень глубоко…", draw: "Опиши картинку, которую нарисовать…", meme: "Спроси что угодно — отвечу бредово, но правильно 🤪", codex: "CodeX: опиши программу, сайт, бота или вставь код с ошибкой…", video: "Опиши видео, которое снять…", code: "Какой код написать или исправить?", tutor: "Какую тему объяснить?", writer: "Что написать: сочинение, пост, письмо, стих…", translate: "Вставь текст для перевода (можно указать язык)…" };
function setMode(m, silent) {
  if (m === "deep" && !+myPlan().deep && myPlan().deep !== "∞") { toast("🧠 Глубокое мышление — в тарифах Plus, Pro и Max 💎"); openPro(); return; }
  if (m === "video" && !silent) { if (cfg.video === false) return toast("🎬 Видео пока не подключено владельцем сайта"); if (!+myPlan().video && myPlan().video !== "∞") { toast("🎬 Видео — в тарифах Plus, Pro и Max 💎"); openPro(); return; } }
  if (cat === "code" && ["draw", "video", "tutor", "writer", "translate", "meme"].includes(m)) m = "auto";
  mode = m;
  document.querySelectorAll("#modes button").forEach(b => b.classList.toggle("on", b.dataset.mode === m));
  input.placeholder = t(PH[m] || (cat === "code" ? PH.code : isDark() ? input.dataset.dark : ph));
  if (!silent && m !== "auto") toast(t(MODE_NAME[m]) + " — " + t("включено"));
}
document.querySelectorAll("#modes button").forEach(b => b.onclick = () => setMode(b.dataset.mode === mode ? "auto" : b.dataset.mode));
function showWelcome() { welcome.hidden = cat === "code"; $("#welcomeCode").hidden = cat !== "code"; welcome.style.display = ""; }
function hideWelcome() { welcome.hidden = true; $("#welcomeCode").hidden = true; }
function setCat(k, keepChat) {
  cat = k; localStorage.setItem("rabbit-cat", k);
  document.querySelectorAll("#cats button").forEach(b => b.classList.toggle("on", b.dataset.cat === k));
  document.querySelectorAll("#modes button[data-only]").forEach(b => b.hidden = b.dataset.only !== k);
  document.body.classList.toggle("cat-code", k === "code");
  setMode("auto", true);
  if (!keepChat) { const c = current(); if (!c || catOf(c) !== k) newChat(); else renderList(); }
}
document.querySelectorAll("#cats button").forEach(b => b.onclick = () => setCat(b.dataset.cat));

/* ---------- настройки ---------- */
const LANGS = ["ru", "en", "kk", "uz", "ky", "tg", "tk", "uk", "be", "az", "hy", "ka", "tr", "de", "fr", "es", "it", "pt", "pl", "nl", "cs", "ro", "el", "sv", "fi", "he", "ar", "fa", "ur", "hi", "bn", "zh", "zh-TW", "ja", "ko", "mn", "vi", "th", "id", "ms"];
const COMMON_CUR = ["KZT", "RUB", "USD", "EUR", "UZS", "KGS", "UAH", "BYN", "TRY", "GBP", "CNY", "INR", "AED"];
addEventListener("rabbit-lang", () => { swapBunnies(); renderPlan(); setMode(mode, true); });
const savePrefs = () => localStorage.setItem("rabbit-prefs", JSON.stringify(prefs));
function openSettings() {
  $("#setAbout").value = prefs.about || ""; $("#setRate").value = prefs.rate || 1; $("#setAuto").checked = !!prefs.auto; $("#setEnter").checked = prefs.enter !== false;
  document.querySelectorAll("#setLength button").forEach(b => b.classList.toggle("on", b.dataset.v === (prefs.length || "normal")));
  const auto = l => `<option value="">${esc(t("Авто (по региону)"))}${l ? " — " + esc(l) : ""}</option>`;
  $("#setLang").innerHTML = auto(cfg.geo?.lang ? I18N.name(cfg.geo.lang) : "") + LANGS.map(l => `<option value="${l}">${esc(I18N.name(l))}</option>`).join("");
  $("#setLang").value = prefs.lang || "";
  const curs = [...new Set([...COMMON_CUR, ...(cfg.currencies || [])])];
  $("#setCur").innerHTML = auto(cfg.geo?.currency || "") + curs.map(c => `<option value="${c}">${c}</option>`).join("");
  $("#setCur").value = prefs.cur || "";
  $("#setModal").hidden = false; closeSide();
}
$("#openSettings").onclick = openSettings;
function renderMem() {
  const box = $("#memList"); if (!box) return;
  const m = prefs.memory || [];
  box.innerHTML = m.length ? "" : `<p class="empty">${esc(t("Пока ничего. Напиши в чате: «Запомни, что я люблю котиков»"))}</p>`;
  m.forEach((x, i) => { const el = document.createElement("span"); el.className = "mem"; el.innerHTML = `${esc(x)} <i title="Забыть">×</i>`; el.querySelector("i").onclick = () => { prefs.memory.splice(i, 1); savePrefs(); renderMem(); }; box.appendChild(el); });
}
$("#openSettings").addEventListener("click", renderMem);
document.querySelectorAll("#setLength button").forEach(b => b.onclick = e => { e.preventDefault(); document.querySelectorAll("#setLength button").forEach(x => x.classList.toggle("on", x === b)); });
$("#setSave").onclick = () => {
  prefs = { ...prefs, about: $("#setAbout").value.trim().slice(0, 1500), rate: +$("#setRate").value, auto: $("#setAuto").checked, enter: $("#setEnter").checked, length: document.querySelector("#setLength button.on")?.dataset.v || "normal" };
  const changed = prefs.lang !== $("#setLang").value || prefs.cur !== $("#setCur").value;
  prefs.lang = $("#setLang").value; prefs.cur = $("#setCur").value;
  savePrefs(); $("#setModal").hidden = true; toast(t("Настройки сохранены 🐰"));
  if (changed) { if (!prefs.lang) I18N.setLang(cfg.geo?.lang || "ru"); loadConfig(); }
};
$("#setClose").onclick = () => $("#setModal").hidden = true;
$("#setModal").onclick = e => { if (e.target.id === "setModal") $("#setModal").hidden = true; };
$("#chatSearch").oninput = () => renderList();
$("#clearAll").onclick = () => { if (!chats.length) return toast("Чатов пока нет"); if (confirm(t("Удалить все чаты? Это нельзя отменить."))) { chats = []; save(); newChat(); toast("Все чаты удалены 🗑"); } };
$("#newChat").onclick = () => { newChat(); closeSide(); };
const closeSide = () => { $("#sidebar").classList.remove("open"); $("#overlay").classList.remove("show"); };
$("#openSide").onclick = () => { $("#sidebar").classList.add("open"); $("#overlay").classList.add("show"); };
$("#closeSide").onclick = closeSide; $("#overlay").onclick = closeSide;
addEventListener("keydown", e => {
  if (e.key === "Escape") { $("#proModal").hidden = true; $("#setModal").hidden = true; }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "o") { e.preventDefault(); newChat(); }
});

/* ---------- пушинки ---------- */
const cv = $("#fluff"), ctx = cv.getContext("2d"); let fl = [];
function resize() { const d = devicePixelRatio; cv.width = innerWidth * d; cv.height = innerHeight * d; fl = Array.from({ length: 45 }, () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: (Math.random() * 3 + 1.5) * d, vx: (Math.random() - .5) * .3, vy: (Math.random() * .3 + .1) * d, t: Math.random() * 6, c: ["255,255,255", "255,198,221", "214,200,255"][Math.floor(Math.random() * 3)], dc: ["255,255,255", "255,138,31", "150,150,150", "120,70,35", "30,30,30"][Math.floor(Math.random() * 5)] })); }
function tick() {
  ctx.clearRect(0, 0, cv.width, cv.height);
  const dk = isDark(), dg = isDog();
  for (const p of fl) {
    p.t += .015; p.x += p.vx + Math.sin(p.t) * .4; p.y += p.vy;
    if (p.y > cv.height + 10) { p.y = -10; p.x = Math.random() * cv.width; }
    const col = dk ? `hsla(${(p.t * 60 + p.x / 4) % 360},100%,60%,` : `rgba(${dg ? p.dc : p.c},`;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.2);
    g.addColorStop(0, col + (dk ? ".9)" : ".95)")); g.addColorStop(1, col + "0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.2, 0, 7); ctx.fill();
  }
  requestAnimationFrame(tick);
}
addEventListener("resize", resize); resize(); tick();

/* ---------- зайчик и тема ---------- */
const hb = $("#heroBunny");
hb.onclick = () => { hb.classList.remove("boing"); void hb.offsetWidth; hb.classList.add("boing"); const l = isDark() ? ["Не трогай очки.", "Чё надо?", "Я занят. Спрашивай.", "Свэг не продаётся 😎"] : isDog() ? ["Гав! 🐶", "Почеши за ушком 🐾", "Дай косточку — отвечу на всё 🦴", "Хвост виляет — спрашивай!"] : ["Пип! 🐰", "Щекотно! 🌸", "Спроси меня что-нибудь ✨", "Я тут! 🐾"]; toast(l[Math.floor(Math.random() * 4)]); };
hb.addEventListener("animationend", e => e.animationName.match(/boing|shrug/) && hb.classList.remove("boing"));
const ph = input.placeholder;
const swapBunnies = () => { const d = isDark(); input.placeholder = t(PH[mode] || (d ? input.dataset.dark : isDog() ? "Гав! Спроси пёсика о чём угодно… 🐾" : ph)); document.querySelectorAll('img.bunny, img.avatar, img.mini-bunny').forEach(i => i.src = avaSrc()); dogSky(); };
const BREEDS = ["shiba", "husky", "labrador", "golden", "pug", "dalmatian", "corgi", "doberman", "beagle", "poodle", "chihuahua", "frenchie"];
function dogSky() {
  const box = $("#dogSky"); if (!box) return;
  if (!isDog()) { box.innerHTML = ""; return; }
  if (box.children.length) return;
  const n = innerWidth < 640 ? 8 : 14;
  for (let i = 0; i < n; i++) { const im = document.createElement("img"); im.className = "dogface"; im.alt = ""; im.src = `/dogs/${BREEDS[i % BREEDS.length]}.svg`; im.style.cssText = `left:${(i / n) * 96 + Math.random() * 3}%;--s:${46 + Math.random() * 46}px;--d:${32 + Math.random() * 30}s;--dl:-${Math.random() * 60}s`; box.appendChild(im); }
}
function setTheme(name) {
  const c = document.documentElement.classList; c.toggle("dark", name === "dark"); c.toggle("dog", name === "dog");
  swapBunnies(); if (window.RabbitAndroid) RabbitAndroid.theme(name === "dark");
}
$("#themeBtn").onclick = () => {
  const next = isDark() ? "dog" : isDog() ? "light" : "dark";
  localStorage.setItem("rabbit-theme", next); setTheme(next);
  toast(t(next === "dark" ? "FLIP SWAG 😎" : next === "dog" ? "Режим пёсика 🐶🦴" : "Пушистый режим ☁️🐰"));
};
swapBunnies();
renderList();
(async () => {
  const ask = location.hash.match(/^#ask=(.+)$/);
  if (ask) { history.replaceState(null, "", "/"); input.value = decodeURIComponent(ask[1]); input.dispatchEvent(new Event("input")); }
  if (new URLSearchParams(location.search).get("new")) history.replaceState(null, "", "/");
  if ("serviceWorker" in navigator && !window.RabbitAndroid) navigator.serviceWorker.register("/sw.js").catch(() => {});
  const m = location.hash.match(/^#vip=(.+)$/);
  if (m) {
    history.replaceState(null, "", "/");
    const r = await fetch("/api/activate", { method: "POST", headers: headers(), body: JSON.stringify({ code: decodeURIComponent(m[1]) }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { proToken = d.token; localStorage.setItem("rabbit-pro", proToken); setTimeout(() => toast("👑 VIP навсегда активирован. С возвращением, босс!"), 400); }
  }
  setCat(cat, true); if (!current()) showWelcome();
  loadConfig();
})();

/* ---------- роли ---------- */
const ROLES = [["", "🐰 Обычный Rabbit AI"], ["teacher", "🎓 Учитель"], ["friend", "🤗 Лучший друг"], ["psych", "💛 Заботливый слушатель"], ["coach", "💼 Бизнес-коуч"], ["marketer", "📣 SMM-маркетолог"], ["chef", "👨‍🍳 Шеф-повар"], ["trainer", "💪 Фитнес-тренер"], ["historian", "🏛 Историк"], ["lawyer", "⚖️ Юрист-консультант"], ["english", "🇬🇧 Учитель английского"], ["interviewer", "🧑‍💼 Собеседование"], ["storyteller", "🐉 Квест-рассказчик"]];

/* ---------- 🧰 инструменты ИИ ---------- */
const TOOLS = [
  ["📝", "Краткий пересказ", "Сделай краткий пересказ этого текста — главное списком:\n\n"],
  ["✅", "Исправь ошибки", "Исправь все орфографические, пунктуационные и стилистические ошибки в тексте. Покажи исправленный текст, а ниже — список исправлений:\n\n"],
  ["🔁", "Перефразируй", "Перефразируй текст своими словами, сохранив смысл (3 варианта: проще, официальнее, живее):\n\n"],
  ["👶", "Объясни как ребёнку", "Объясни так, чтобы понял 7-летний ребёнок: "],
  ["🧮", "Реши задачу", "Реши задачу пошагово, объясни каждый шаг и проверь ответ:\n\n"],
  ["📚", "Конспект", "Составь подробный конспект по теме с заголовками, определениями и примерами: "],
  ["❓", "Тест-викторина", "Сделай тест из 10 вопросов с вариантами ответов (A–D) по теме, а ответы дай в конце: "],
  ["🃏", "Флеш-карточки", "Сделай 15 флеш-карточек для запоминания (вопрос — ответ) таблицей по теме: "],
  ["✍️", "Сочинение", "Напиши сочинение (около 350 слов) на тему: "],
  ["📧", "Письмо", "Напиши вежливое письмо. Кому и о чём: "],
  ["📱", "Пост для соцсетей", "Напиши цепляющий пост для Instagram/Telegram с хуком, эмодзи и хэштегами на тему: "],
  ["🎬", "Сценарий Reels/TikTok", "Напиши сценарий короткого вертикального видео (до 30 сек) с раскадровкой и текстом на экране на тему: "],
  ["📄", "Резюме (CV)", "Составь сильное резюме и сделай из него файл Word. Мои данные: "],
  ["🗓", "План / расписание", "Составь подробный план в виде таблицы и сделай файл. Задача: "],
  ["💡", "Идеи", "Придумай 15 креативных и необычных идей для: "],
  ["⚖️", "Плюсы и минусы", "Сравни варианты: плюсы, минусы, таблица и итоговая рекомендация. Варианты: "],
  ["🍳", "Рецепт из продуктов", "Что приготовить из этих продуктов? Дай 3 рецепта с граммовкой и временем. Продукты: "],
  ["💪", "Тренировка", "Составь программу тренировок на неделю. Цель и уровень: "],
  ["🧠", "Мозговой штурм", "Проведи мозговой штурм: задай мне 3 уточняющих вопроса, а потом предложи лучшие решения. Задача: "],
  ["🧑‍💻", "Объясни код", "Объясни, что делает этот код, построчно и простыми словами, и найди возможные ошибки:\n\n"],
  ["🐞", "Найди баг", "Найди и исправь ошибку в коде, покажи исправленный код целиком и объясни причину:\n\n"],
  ["🔗", "Прочитай ссылку", "Прочитай страницу и сделай краткий пересказ с главными мыслями: "],
  ["🌍", "Переведи", "Переведи на английский (и дай 2 альтернативы для сложных мест):\n\n"],
  ["🎤", "Рэп / стих", "Напиши рэп-куплет (или стих) с крутыми рифмами на тему: "],
  ["😂", "Шутки", "Придумай 10 смешных шуток (без пошлости) на тему: "],
  ["🔮", "Гороскоп-прикол", "Составь шуточный, но позитивный гороскоп на сегодня для знака: "],
  ["🎲", "Квест-игра", "Давай сыграем в текстовый квест! Ты ведущий: опиши мир и давай мне варианты действий. Сеттинг: "],
  ["🗣", "Голосовой разговор", null, "voice"],
];
function renderTools(q = "") {
  const box = $("#toolsList"); box.innerHTML = "";
  const qq = q.toLowerCase();
  TOOLS.filter(([e, n]) => !qq || t(n).toLowerCase().includes(qq) || n.toLowerCase().includes(qq)).forEach(([e, n, p, act]) => {
    const b = document.createElement("button"); b.type = "button"; b.innerHTML = `<i>${e}</i><span>${esc(t(n))}</span>`;
    b.onclick = () => { closeTools(); if (act === "voice") return startVoice(); if (act === "plugins") return openPlugins(); input.value = t(p.trim()) + p.match(/\s*$/)[0]; input.dispatchEvent(new Event("input")); input.focus(); input.setSelectionRange(input.value.length, input.value.length); };
    box.appendChild(b);
  });
  if (!box.children.length) box.innerHTML = `<p class="empty">${esc(t("Ничего не нашлось"))}</p>`;
}
const closeTools = () => { $("#toolsPop").hidden = true; };
$("#toolsBtn").onclick = e => { e.stopPropagation(); const h = $("#toolsPop").hidden; $("#toolsPop").hidden = !h; if (h) { $("#toolsSearch").value = ""; renderTools(); $("#toolsSearch").focus(); } };
$("#toolsSearch").oninput = e => renderTools(e.target.value);
document.addEventListener("click", e => { if (!e.target.closest("#toolsPop, #toolsBtn")) closeTools(); });
input.addEventListener("input", () => { const m = input.value.match(/^\/(\S*)$/); if (m) { $("#toolsPop").hidden = false; renderTools(m[1]); } else if (input.value.startsWith("/") === false && !$("#toolsPop").hidden && document.activeElement === input) closeTools(); });

/* ---------- 📝 итог чата ---------- */
$("#sumChat").onclick = () => { const c = current(); closeSide(); if (!c || c.messages.length < 2) return toast("Сначала пообщайся с зайчиком 🐰"); ask(t("Сделай краткий итог всего нашего разговора: о чём говорили, главные выводы и решения, что осталось сделать.")); };

/* ---------- 🗣 голосовой разговор ---------- */
let voiceOn = false, voiceRec = null;
function voiceListen() {
  if (!voiceOn) return;
  $("#voiceState").textContent = t("Слушаю… говори");
  voiceRec = new SR(); voiceRec.lang = I18N.lang === "ru" ? "ru-RU" : I18N.lang; voiceRec.interimResults = true; voiceRec.continuous = false;
  let said = "";
  voiceRec.onresult = e => { said = [...e.results].map(r => r[0].transcript).join(""); $("#voiceState").textContent = "🎙 " + said; };
  voiceRec.onerror = e => { if (e.error === "not-allowed") { toast("Разреши доступ к микрофону"); stopVoice(); } };
  voiceRec.onend = async () => {
    voiceRec = null; if (!voiceOn) return;
    if (!said.trim()) return setTimeout(voiceListen, 300);
    $("#voiceState").textContent = t("Думаю…");
    await ask(said);
    const last = [...chatEl.querySelectorAll(".msg.bot .bubble")].pop();
    if (!voiceOn || !last) return;
    $("#voiceState").textContent = t("Говорю… 🔊");
    const u = new SpeechSynthesisUtterance(last.innerText.slice(0, 3000)); u.rate = +prefs.rate || 1; u.lang = I18N.lang === "ru" ? "ru-RU" : I18N.lang;
    const v = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith(I18N.lang.split("-")[0])); if (v) u.voice = v;
    u.onend = () => setTimeout(voiceListen, 250); speechSynthesis.cancel(); speechSynthesis.speak(u);
  };
  try { voiceRec.start(); } catch { setTimeout(voiceListen, 500); }
}
function startVoice() {
  if (!SR || !("speechSynthesis" in window)) return toast("Голосовой разговор работает в Chrome, Edge и Safari");
  voiceOn = true; $("#voiceBar").hidden = false; toast(isDark() ? "Йо, говори — я слушаю 🎙" : "Говори со мной голосом 🎙🐰"); voiceListen();
}
function stopVoice() { voiceOn = false; $("#voiceBar").hidden = true; try { voiceRec?.abort(); } catch {} speechSynthesis.cancel(); }
$("#voiceStop").onclick = stopVoice;
document.addEventListener("keydown", e => { if (e.key === "Escape") closeTools(); });

/* ---------- 🧩 плагины ---------- */
function openPlugins() {
  const box = $("#plugList"); box.innerHTML = "";
  const off = new Set(prefs.pluginsOff || []);
  (cfg.plugins || []).forEach(p => {
    const el = document.createElement("label"); el.className = "plug-item" + (off.has(p.id) ? "" : " on");
    el.innerHTML = `<i>${p.e}</i><span><b>${esc(t(p.name))}</b><small>${esc(t(p.desc))}</small></span><input type="checkbox" ${off.has(p.id) ? "" : "checked"}/><em class="sw"></em>`;
    el.querySelector("input").onchange = e => { const s = new Set(prefs.pluginsOff || []); e.target.checked ? s.delete(p.id) : s.add(p.id); prefs.pluginsOff = [...s]; savePrefs(); el.classList.toggle("on", e.target.checked); };
    box.appendChild(el);
  });
  if (!box.children.length) box.innerHTML = `<p class="empty">${esc(t("Плагины загружаются… попробуй через секунду"))}</p>`;
  renderMine(); plugTab("built");
  $("#plugModal").hidden = false; closeSide();
}
const plugTab = k => { document.querySelectorAll("#plugTabs button").forEach(b => b.classList.toggle("on", b.dataset.t === k)); document.querySelectorAll(".plug-pane").forEach(p => p.hidden = p.dataset.p !== k); if (k === "store") loadStore(); if (k !== "mine") $("#plugForm").hidden = true; };
document.querySelectorAll("#plugTabs button").forEach(b => b.onclick = () => plugTab(b.dataset.t));
const MAXCUSTOM = () => isPro() ? 20 : 3;
let editId = null;
function renderMine() {
  const box = $("#myPlugList"); box.innerHTML = "";
  (prefs.custom || []).forEach(p => {
    const el = document.createElement("div"); el.className = "plug-item mine" + (p.off ? "" : " on");
    el.innerHTML = `<i>${esc(p.e || "🧩")}</i><span><b>${esc(p.name)} ${p.type === "api" ? "🌐" : ""}</b><small>${esc(p.desc || "")}</small><small class="ptag">@${esc(p.name.replace(/\s+/g, ""))}${p.always ? " · " + esc(t("всегда")) : ""}</small><span class="pm-act"><button data-a="edit">✏️</button><button data-a="del">🗑</button></span></span><label class="pm-sw"><input type="checkbox" ${p.off ? "" : "checked"}/><em class="sw"></em></label>`;
    el.querySelector("input").onchange = e => { p.off = !e.target.checked; savePrefs(); el.classList.toggle("on", e.target.checked); };
    el.querySelector('[data-a="edit"]').onclick = () => editPlugin(p);
    el.querySelector('[data-a="del"]').onclick = () => { if (!confirm(t("Удалить плагин?"))) return; prefs.custom = prefs.custom.filter(x => x !== p); savePrefs(); renderMine(); };
    box.appendChild(el);
  });
  if (!box.children.length) box.innerHTML = `<p class="empty">${esc(t("Пока нет своих плагинов. Создай первый или установи из магазина 🛍"))}</p>`;
}
const pfType = () => document.querySelector('[name="pfType"]:checked').value;
document.querySelectorAll('[name="pfType"]').forEach(r => r.onchange = () => { if (pfType() === "api" && !isPro()) { toast(t("API-плагины — с тарифа Plus 💎")); document.querySelector('[name="pfType"][value="prompt"]').checked = true; openPro(); } $("#pfApi").hidden = pfType() !== "api"; });
function editPlugin(p) {
  if (!p && (prefs.custom || []).length >= MAXCUSTOM()) { toast(t("Лимит своих плагинов: {n}", { n: MAXCUSTOM() })); if (!isPro()) openPro(); return; }
  editId = p?.id || null; const f = $("#plugForm"); f.hidden = false;
  $("#pfE").value = p?.e || "🧩"; $("#pfName").value = p?.name || ""; $("#pfDesc").value = p?.desc || ""; $("#pfPrompt").value = p?.prompt || "";
  $("#pfUrl").value = p?.api?.url || ""; $("#pfHname").value = p?.api?.hname || ""; $("#pfHval").value = p?.api?.hval || "";
  $("#pfTrig").value = p?.triggers || ""; $("#pfAlways").checked = !!p?.always; $("#pfTestOut").hidden = true;
  document.querySelector(`[name="pfType"][value="${p?.type === "api" ? "api" : "prompt"}"]`).checked = true; $("#pfApi").hidden = p?.type !== "api";
  f.scrollIntoView({ behavior: "smooth", block: "nearest" }); $("#pfName").focus();
}
function formPlugin() {
  const p = { id: editId || "p" + Date.now().toString(36), e: $("#pfE").value.trim() || "🧩", name: $("#pfName").value.trim(), desc: $("#pfDesc").value.trim(), prompt: $("#pfPrompt").value.trim(), triggers: $("#pfTrig").value.trim(), always: $("#pfAlways").checked, type: pfType() };
  if (p.type === "api") p.api = { url: $("#pfUrl").value.trim(), hname: $("#pfHname").value.trim(), hval: $("#pfHval").value };
  if (!p.name) { toast(t("Дай плагину название")); return null; }
  if (p.type === "api" ? !/^https?:\/\//.test(p.api.url) : !p.prompt) { toast(t(p.type === "api" ? "Укажите адрес API (https://…)" : "Напиши инструкции для плагина")); return null; }
  return p;
}
$("#plugNew").onclick = () => editPlugin(null);
$("#pfCancel").onclick = () => { $("#plugForm").hidden = true; editId = null; };
$("#plugForm").onsubmit = e => {
  e.preventDefault(); const p = formPlugin(); if (!p) return;
  const list = prefs.custom || [], i = list.findIndex(x => x.id === p.id);
  if (i >= 0) list[i] = { ...list[i], ...p }; else list.push(p);
  prefs.custom = list; savePrefs(); $("#plugForm").hidden = true; editId = null; renderMine(); toast(t("Плагин сохранён ✅ Вызывай: @{n}", { n: p.name.replace(/\s+/g, "") }));
};
$("#pfTest").onclick = async () => {
  const p = formPlugin(); if (!p) return; const out = $("#pfTestOut"); out.hidden = false; out.textContent = "⏳";
  const r = await fetch("/api/plugin/test", { method: "POST", headers: headers(), body: JSON.stringify({ plugin: p, q: p.triggers.split(",")[0] || "test" }) }).then(r => r.json()).catch(e => ({ error: e.message }));
  if (r.needPro) openPro();
  out.textContent = r.error ? "❌ " + r.error : `✅ HTTP ${r.status}\n${r.body}`;
};
$("#pfPublish").onclick = async () => {
  const p = formPlugin(); if (!p) return;
  const author = prompt(t("Твоё имя или ник для магазина:"), localStorage.getItem("rabbit-author") || ""); if (author === null) return;
  localStorage.setItem("rabbit-author", author);
  const { api, ...rest } = p, plugin = api ? { ...rest, api: { url: api.url } } : rest;
  const r = await fetch("/api/store/publish", { method: "POST", headers: headers(), body: JSON.stringify({ plugin, author }) }).then(r => r.json()).catch(e => ({ error: e.message }));
  toast(r.error ? "😿 " + r.error : r.status === "ok" ? t("Опубликовано в магазине 🎉") : t("Отправлено на проверку модератору 🕵️"));
};
let storeCache = [];
async function loadStore() {
  const box = $("#storeList"); box.innerHTML = `<p class="empty">⏳</p>`;
  const r = await fetch("/api/store", { headers: headers() }).then(r => r.json()).catch(() => ({ items: [] }));
  storeCache = r.items || []; renderStore();
}
function renderStore() {
  const box = $("#storeList"), q = $("#storeSearch").value.trim().toLowerCase(); box.innerHTML = "";
  const have = new Set((prefs.custom || []).map(p => p.src).filter(Boolean));
  storeCache.filter(p => !q || (p.name + " " + p.desc + " " + t(p.name) + " " + t(p.desc)).toLowerCase().includes(q)).forEach(p => {
    const el = document.createElement("div"); el.className = "plug-item store";
    el.innerHTML = `<i>${esc(p.e || "🧩")}</i><span><b>${esc(p.official ? t(p.name) : p.name)} ${p.official ? "✔️" : ""}${p.type === "api" ? " 🌐" : ""}</b><small>${esc(p.official ? t(p.desc) : p.desc || "")}</small><small class="ptag">${esc(p.author || "")} · ⬇️ ${p.installs || 0}</small></span><button class="st-btn" ${have.has(p.id) ? "disabled" : ""}>${have.has(p.id) ? "✓" : esc(t("Установить"))}</button>`;
    el.querySelector("button").onclick = e => {
      if ((prefs.custom || []).length >= MAXCUSTOM()) { toast(t("Лимит своих плагинов: {n}", { n: MAXCUSTOM() })); if (!isPro()) openPro(); return; }
      if (p.type === "api" && !isPro()) toast(t("API-плагины — с тарифа Plus 💎"));
      const { installs, official, author, status, ...rest } = p;
      prefs.custom = [...(prefs.custom || []), { ...rest, name: official ? t(p.name) : p.name, desc: official ? t(p.desc) : p.desc, prompt: p.prompt, id: "i" + Date.now().toString(36), src: p.id }];
      savePrefs(); renderMine(); e.target.disabled = true; e.target.textContent = "✓";
      fetch("/api/store/install", { method: "POST", headers: headers(), body: JSON.stringify({ id: p.id }) }).catch(() => {});
      toast(t("Установлено! Вызывай: @{n}", { n: (official ? t(p.name) : p.name).replace(/\s+/g, "") }));
    };
    box.appendChild(el);
  });
  if (!box.children.length) box.innerHTML = `<p class="empty">${esc(t("Ничего не найдено"))}</p>`;
}
$("#storeSearch").oninput = renderStore;
$("#openPlugins").onclick = openPlugins;
$("#plugClose").onclick = $("#plugSave").onclick = () => $("#plugModal").hidden = true;
$("#plugModal").onclick = e => { if (e.target.id === "plugModal") $("#plugModal").hidden = true; };
TOOLS.unshift(["🧩", "Плагины", null, "plugins"]);
