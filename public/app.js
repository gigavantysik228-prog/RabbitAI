const $ = s => document.querySelector(s);
const chatEl = $("#chat"), welcome = $("#welcome"), input = $("#input"), send = $("#send"), main = $("#main"), list = $("#chatList");
let chats = JSON.parse(localStorage.getItem("rabbit-chats") || "[]");
let currentId = null, controller = null, pending = [];
let cfg = { plan: "free", remaining: null, limit: 20, plans: { free: { chars: 25000, images: 0, deep: 0 } } };
let mode = "chat";
let prefs = { about: "", length: "normal", rate: 1, auto: false, enter: true, ...JSON.parse(localStorage.getItem("rabbit-prefs") || "{}") };
const myPlan = () => cfg.plans?.[cfg.plan] || cfg.plans.free;
let proToken = localStorage.getItem("rabbit-pro") || "";
const isDark = () => document.documentElement.classList.contains("dark");
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
  renderPlan();
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
      t("Файлы и PDF до {n} символов", { n: n(p.chars) }),
      t("🌐 Поиск в интернете: {n}/день", { n: n(p.search) }),
      t("🎨 Рисование картинок: {n}/день", { n: n(p.draw) }),
    ];
    const no = [];
    p.deep ? li.push(t("🧠 Глубокое мышление: {n}/день", { n: n(p.deep) })) : no.push(t("Глубокое мышление"));
    p.images ? li.push(t("📷 Анализ фото: до {n} за раз", { n: p.images })) : no.push(t("Анализ фото и картинок"));
    const el = document.createElement("div");
    el.className = "plan" + (k === "pro" ? " best" : "") + (k === "max" ? " max" : "") + (cur ? " cur" : "");
    el.innerHTML = `${ui.tag ? `<span class="tag">${t(ui.tag)}</span>` : ""}<h3>${ui.e} ${esc(t(p.name))}</h3><div class="price">${esc(cfg.prices?.[k] ? cfg.prices[k].text + (k === "free" ? "" : " " + t("/ месяц")) : p.price)}</div><ul>${li.map(x => `<li>✓ ${x}</li>`).join("")}${no.map(x => `<li class="no">× ${x}</li>`).join("")}</ul>` +
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
  const shown = q ? chats.filter(c => c.title.toLowerCase().includes(q) || c.messages.some(m => (m.display ?? m.content).toLowerCase().includes(q))) : chats;
  list.innerHTML = shown.length ? "" : q ? '<p class="empty">Ничего не нашлось 🔍</p>' : '<p class="empty">Тут пока пусто. Задай зайчику первый вопрос 🐰</p>';
  shown.forEach(c => {
    const b = document.createElement("button");
    b.className = "chat-item" + (c.id === currentId ? " active" : "");
    b.innerHTML = `<span><b class="ci"></b>${esc(c.title)}</span><i class="del" title="Удалить">×</i>`;
    b.onclick = e => {
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
  welcome.style.display = "none";
  const el = document.createElement("div");
  el.className = "msg " + (role === "user" ? "user" : "bot");
  const ava = isDark() ? "/bunny-swag.svg" : "/bunny.svg";
  el.innerHTML = role === "user"
    ? '<div class="body"><div class="att"></div><div class="bubble"></div><div class="actions u"><button data-a="edit">✏️ Изменить</button><button data-a="ucopy">📋</button></div></div>'
    : `<img class="avatar" src="${ava}" alt=""><div class="body"><div class="bubble"></div><div class="actions"><button data-a="copy">📋 Копировать</button><button data-a="speak">🔊 Озвучить</button><button data-a="word">📘 В Word</button>${navigator.share ? '<button data-a="share">📤</button>' : ""}<button data-a="retry">🔄 Ещё раз</button></div></div>`;
  const b = el.querySelector(".bubble");
  if (role === "user") {
    b.textContent = msg.display ?? msg.content;
    if (!b.textContent) b.remove();
    const att = el.querySelector(".att");
    (msg.files || []).forEach(f => { const s = document.createElement("span"); s.className = "chip"; s.textContent = (f.icon || "📄") + " " + f.name; att.appendChild(s); });
    (opts.images || []).forEach(src => { const i = document.createElement("img"); i.src = src; i.className = "thumb"; att.appendChild(i); });
    if (msg.mode && msg.mode !== "chat") { const s = document.createElement("span"); s.className = "chip mode-chip"; s.textContent = MODE_NAME[msg.mode] || msg.mode; att.prepend(s); }
    el.querySelectorAll(".actions button").forEach(btn => btn.onclick = () => {
      if (btn.dataset.a === "ucopy") { navigator.clipboard.writeText(msg.display ?? msg.content); return toast("Скопировано 🐾"); }
      editMsg(el);
    });
  } else {
    const lbl = { search: "Ищу в интернете…", deep: "Думаю очень глубоко… 🧠", draw: "Рисую… 🎨", translate: "Перевожу…", code: "Пишу код…" }[opts.mode];
    if (opts.loading) b.innerHTML = `<div class="typing"><i></i><i></i><i></i><em class="l-only">${t(lbl || "Зайчик думает…")}</em><em class="d-only">${t(lbl || "Думаю…")}</em></div>`;
    else { b.innerHTML = md(msg.content); finish(b); }
    el.querySelectorAll(".actions button").forEach(btn => btn.onclick = () => {
      const a = btn.dataset.a, raw = el.dataset.raw || msg.content || "";
      if (a === "copy") { navigator.clipboard.writeText(raw); toast("Скопировано 🐾"); }
      else if (a === "speak") speak(b.innerText, btn);
      else if (a === "word") RabbitFiles.download("rabbit-ai-otvet.doc", raw);
      else if (a === "share") navigator.share({ title: "Rabbit AI", text: raw.slice(0, 5000) }).catch(() => {});
      else retry();
    });
    el.dataset.raw = msg.content || "";
  }
  chatEl.appendChild(el); toBottom();
  return b;
}
const MODE_NAME = { search: "🌐 Интернет", deep: "🧠 Глубоко", draw: "🎨 Рисунок", code: "👨‍💻 Код", tutor: "🎓 Репетитор", writer: "✍️ Писатель", translate: "🌍 Перевод" };
function finish(b) {
  RabbitFiles.enhance(b, true);
  b.querySelectorAll("a[href^='http']").forEach(a => { a.target = "_blank"; a.rel = "noopener"; });
  if (window.hljs) b.querySelectorAll("pre > code").forEach(c => { if (!/language-file:/.test(c.className) && !c.dataset.highlighted) try { hljs.highlightElement(c); } catch {} });
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
  if (!c || !c.messages.length) welcome.style.display = "";
  else c.messages.forEach(m => addMsg(m.role, m));
  renderList();
}
function newChat() { currentId = null; chatEl.innerHTML = ""; welcome.style.display = ""; clearPending(); renderList(); input.focus(); }

async function stream(c, images = []) {
  const m = c.messages.at(-1)?.mode || "chat";
  const bubble = addMsg("assistant", { content: "" }, { loading: true, mode: m });
  const msgEl = bubble.closest(".msg");
  send.classList.add("busy");
  controller = new AbortController();
  let answer = "";
  try {
    const r = await fetch("/api/chat", { method: "POST", headers: headers(), body: JSON.stringify({ messages: c.messages.map(m => ({ role: m.role, content: m.content })), images, mode: m, prefs: { about: prefs.about, length: prefs.length, lang: I18N.lang } }), signal: controller.signal });
    if (r.headers.get("X-Remaining")) { const n = h => { const v = r.headers.get(h); return v === "∞" ? v : +v; }; cfg.remaining = n("X-Remaining"); cfg.limit = n("X-Limit"); renderPlan(); }
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
    if (prefs.auto && m !== "draw") speak(bubble.innerText);
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
  const max = myPlan().chars === "∞" ? Infinity : +myPlan().chars || 25000;
  if (content.length > max) { toast(t("Файл слишком большой для тарифа {plan} 💎", { plan: cfg.planName || "" })); if (!isOwner()) openPro(); return; }
  let c = current();
  if (!c) { c = { id: Date.now().toString(36), title: (text || files[0]?.name || "Файл").slice(0, 40), messages: [] }; chats.unshift(c); currentId = c.id; }
  const msg = { role: "user", content, display: text, mode: images.length ? "chat" : mode, files: [...files.map(f => ({ name: f.name, icon: f.icon })), ...pending.filter(p => p.kind === "image").map(p => ({ name: p.name, icon: "🖼" }))] };
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
document.querySelectorAll(".card").forEach(c => c.addEventListener("click", () => { setMode(c.dataset.mode || "chat", true); ask(t(c.dataset.q)); }));

/* ---------- режимы ---------- */
const PH = { search: "Что найти в интернете?", deep: "Сложная задача? Зайчик подумает очень глубоко…", draw: "Опиши картинку, которую нарисовать…", code: "Какой код написать или исправить?", tutor: "Какую тему объяснить?", writer: "Что написать: сочинение, пост, письмо, стих…", translate: "Вставь текст для перевода (можно указать язык)…" };
function setMode(m, silent) {
  if (m === "deep" && !+myPlan().deep && myPlan().deep !== "∞") { toast("🧠 Глубокое мышление — в тарифах Plus, Pro и Max 💎"); openPro(); return; }
  mode = m;
  document.querySelectorAll("#modes button").forEach(b => b.classList.toggle("on", b.dataset.mode === m));
  input.placeholder = t(PH[m] || (isDark() ? input.dataset.dark : ph));
  if (!silent && m !== "chat") toast(t(MODE_NAME[m]) + " — " + t("включено"));
}
document.querySelectorAll("#modes button").forEach(b => b.onclick = () => setMode(b.dataset.mode === mode ? "chat" : b.dataset.mode));

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
function resize() { const d = devicePixelRatio; cv.width = innerWidth * d; cv.height = innerHeight * d; fl = Array.from({ length: 45 }, () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: (Math.random() * 3 + 1.5) * d, vx: (Math.random() - .5) * .3, vy: (Math.random() * .3 + .1) * d, t: Math.random() * 6, c: ["255,255,255", "255,198,221", "214,200,255"][Math.floor(Math.random() * 3)] })); }
function tick() {
  ctx.clearRect(0, 0, cv.width, cv.height);
  const dk = isDark();
  for (const p of fl) {
    p.t += .015; p.x += p.vx + Math.sin(p.t) * .4; p.y += p.vy;
    if (p.y > cv.height + 10) { p.y = -10; p.x = Math.random() * cv.width; }
    const col = dk ? `hsla(${(p.t * 60 + p.x / 4) % 360},100%,60%,` : `rgba(${p.c},`;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.2);
    g.addColorStop(0, col + (dk ? ".9)" : ".95)")); g.addColorStop(1, col + "0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.2, 0, 7); ctx.fill();
  }
  requestAnimationFrame(tick);
}
addEventListener("resize", resize); resize(); tick();

/* ---------- зайчик и тема ---------- */
const hb = $("#heroBunny");
hb.onclick = () => { hb.classList.remove("boing"); void hb.offsetWidth; hb.classList.add("boing"); const l = isDark() ? ["Не трогай очки.", "Чё надо?", "Я занят. Спрашивай.", "Свэг не продаётся 😎"] : ["Пип! 🐰", "Щекотно! 🌸", "Спроси меня что-нибудь ✨", "Я тут! 🐾"]; toast(l[Math.floor(Math.random() * 4)]); };
hb.addEventListener("animationend", e => e.animationName.match(/boing|shrug/) && hb.classList.remove("boing"));
const ph = input.placeholder;
const swapBunnies = () => { const d = isDark(); input.placeholder = t(PH[mode] || (d ? input.dataset.dark : ph)); document.querySelectorAll('img.bunny, img.avatar, img.mini-bunny').forEach(i => i.src = d ? "/bunny-swag.svg" : "/bunny.svg"); };
$("#themeBtn").onclick = () => {
  const d = document.documentElement.classList.toggle("dark");
  localStorage.setItem("rabbit-theme", d ? "dark" : "light"); swapBunnies();
  if (window.RabbitAndroid) RabbitAndroid.theme(d);
  toast(d ? "FLIP SWAG 😎" : "Пушистый режим ☁️🐰");
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
  loadConfig();
})();
