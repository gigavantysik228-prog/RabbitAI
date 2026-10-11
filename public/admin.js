const $ = id => document.getElementById(id);
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let tok = localStorage.getItem("rabbit-admin-t") || sessionStorage.getItem("rabbit-admin-t") || "";
const toast = t => { $("toast").textContent = t; $("toast").classList.add("show"); clearTimeout(toast.h); toast.h = setTimeout(() => $("toast").classList.remove("show"), 2400); };
async function api(action, body = {}, pw) {
  const r = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json", ...(tok ? { "X-Admin": tok } : {}) }, body: JSON.stringify({ action, ...(pw ? { password: pw } : {}), ...body }) });
  const d = await r.json().catch(() => ({}));
  if (r.status === 403 && !pw) { logout(true); }
  if (!r.ok) throw new Error(d.error || "Ошибка " + r.status);
  return d;
}
const busy = async (btn, fn) => { const t = btn.textContent; btn.disabled = true; btn.textContent = "⏳ " + t; try { return await fn(); } catch (e) { toast("😿 " + e.message); } finally { btn.disabled = false; btn.textContent = t; } };
function logout(silent) { tok = ""; localStorage.removeItem("rabbit-admin-t"); sessionStorage.removeItem("rabbit-admin-t"); localStorage.removeItem("rabbit-admin"); if (!silent) location.reload(); else { $("panel").hidden = true; $("login").hidden = false; } }
function showPanel() { $("login").hidden = true; $("panel").hidden = false; loadStats(); }
$("login").onsubmit = async e => {
  e.preventDefault(); $("loginErr").textContent = "";
  try { const d = await api("login", {}, $("pw").value); tok = d.token; ($("remember").checked ? localStorage : sessionStorage).setItem("rabbit-admin-t", tok); $("pw").value = ""; showPanel(); }
  catch (err) { $("loginErr").textContent = err.message; }
};
$("logout").onclick = () => logout();

/* ---------- вкладки ---------- */
document.querySelectorAll("#tabs button").forEach(b => b.onclick = () => {
  document.querySelectorAll("#tabs button").forEach(x => x.classList.toggle("on", x === b));
  document.querySelectorAll("[data-pane]").forEach(p => p.hidden = p.dataset.pane !== b.dataset.tab);
  ({ stats: loadStats, memory: loadKb, codes: loadStats, settings: loadSettings, users: loadUsers, limits: loadLimits, store: loadStoreAdm, fb: loadFb, server: loadServer })[b.dataset.tab]?.();
});

/* ---------- 📊 статистика ---------- */
const NAMES = { chat: "💬 Чат", auto: "💬 Чат", search: "🌐 Поиск", deep: "🧠 Глубоко", code: "👨‍💻 Код", codex: "⚡ CodeX", meme: "🤪 Мем", draw: "🎨 Картинки", video: "🎬 Видео", tutor: "🎓 Репетитор", writer: "✍️ Писатель", translate: "🌍 Перевод", free: "🐰 Бесплатно", plus: "⭐ Plus", pro: "💎 Pro", max: "👑 Max", owner: "VIP" };
const kv = (o, empty = "Пока пусто") => { const e = Object.entries(o || {}).sort((a, b) => b[1] - a[1]); return e.length ? e.map(([k, v]) => `<div><span>${esc(NAMES[k] || k)}</span><b>${esc(v)}</b></div>`).join("") : `<p class="hint">${empty}</p>`; };
let stats = null;
async function loadStats() {
  try { stats = await api("stats"); } catch (e) { return toast(e.message); }
  const s = stats;
  $("sMsgs").textContent = s.today.msgs; $("sUsers").textContent = s.today.users; $("sKb").textContent = s.kb; $("sErr").textContent = s.today.errors;
  const max = Math.max(1, ...s.history.map(h => h.msgs));
  $("chart").innerHTML = s.history.slice(-14).map(h => `<div class="bar" title="${h.day}: ${h.msgs} сообщ., ${h.users} польз."><i style="height:${Math.max(3, h.msgs / max * 100)}%"></i><span>${h.day.slice(8)}</span><em>${h.msgs}</em></div>`).join("");
  $("sModes").innerHTML = kv(s.today.modes); $("sPlans").innerHTML = kv(s.today.plans); $("sModels").innerHTML = kv(s.today.models);
  const h = s.health, yes = v => v ? "✅" : "❌";
  $("sHealth").innerHTML = [
    ["Groq (основной ИИ)", yes(h.groq) + (h.groqModels ? ` · ${h.groqModels.length} моделей` : h.groq ? " · список моделей не получен" : "")],
    ["Pollinations (топ-модели, картинки, видео)", yes(h.pollinations)],
    ["Премиум-модели Max (MAX_*)", yes(h.premium)],
    ["Видео", yes(h.video)],
    ["Модели в меню ⚙️", h.menu.length],
    ["Хранение памяти", s.storage === "github" ? "✅ GitHub (" + esc(s.ghRepo) + ") — не теряется" : "⚠️ Только сервер — может стереться при перезапуске"],
    ["Сервер работает", Math.round(s.uptime / 60) + " мин"],
  ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("");
  $("sErrors").innerHTML = s.lastErrors.length ? s.lastErrors.map(e => `<p><i>${new Date(e.t).toLocaleTimeString()}</i> ${esc(e.msg)}</p>`).join("") : '<p class="hint">Ошибок нет 🎉</p>';
  $("codeLog").innerHTML = s.codes.length ? s.codes.map(c => `<p><i>${new Date(c.t).toLocaleString()}</i> ${esc(NAMES[c.plan] || c.plan)} × ${c.count} · ${c.forever ? "навсегда" : c.days + " дн."}${c.note ? " · " + esc(c.note) : ""}</p>`).join("") : '<p class="hint">Пока не выдавали</p>';
  $("storageInfo").innerHTML = s.storage === "github" ? `✅ Память сохраняется в GitHub (${esc(s.ghRepo)}, ветка rabbit-data) — не пропадёт.` : "⚠️ Память хранится на сервере Render и может стереться при перезапуске. Чтобы не терять — добавьте в Render GITHUB_TOKEN и GITHUB_REPO, или скачивайте резервную копию.";
}
$("refresh").onclick = loadStats;

/* ---------- 🎓 обучение ---------- */
document.querySelectorAll(".way").forEach(b => b.onclick = () => {
  document.querySelectorAll(".way").forEach(x => x.classList.toggle("on", x === b));
  document.querySelectorAll("[data-wpane]").forEach(p => p.hidden = p.dataset.wpane !== b.dataset.way);
});
// 1) ИИ спрашивает
let ivHist = [], ivQ = "";
async function ivNext() {
  $("ivQ").textContent = "🤔 Думаю над вопросом…"; $("ivA").value = "";
  try { const d = await api("train.ask", { topic: $("ivTopic").value, history: ivHist }); ivQ = d.question; $("ivQ").textContent = "🐰 " + ivQ; $("ivA").focus(); }
  catch (e) { $("ivQ").textContent = "😿 " + e.message; }
}
$("ivStart").onclick = () => { ivHist = []; $("ivLog").innerHTML = ""; $("ivBox").hidden = false; ivNext(); };
$("ivSkip").onclick = () => { if (ivQ) ivHist.push({ q: ivQ, a: "(пропущено — не спрашивать)" }); ivNext(); };
$("ivStop").onclick = () => { $("ivBox").hidden = true; toast(`Готово! Запомнено ответов: ${ivHist.filter(x => !x.a.startsWith("(")).length} 🧠`); };
$("ivSave").onclick = () => busy($("ivSave"), async () => {
  const a = $("ivA").value.trim(); if (!a || !ivQ) return toast("Напишите ответ");
  await api("kb.add", { item: { kind: "qa", q: ivQ, a, topic: $("ivTopic").value } });
  ivHist.push({ q: ivQ, a });
  $("ivLog").insertAdjacentHTML("afterbegin", `<p><b>В:</b> ${esc(ivQ)}<br><b>О:</b> ${esc(a)}</p>`);
  toast("💾 Запомнил"); await ivNext();
});
$("ivA").addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) $("ivSave").click(); });
// 2) вопрос → ответ
$("mSave").onclick = () => busy($("mSave"), async () => {
  const q = $("mQ").value.trim(), a = $("mA").value.trim(), always = $("mAlways").checked;
  if (!a) return toast("Напишите ответ или промт");
  if (!q && !always) return toast("Напишите вопрос или отметьте «Правило»");
  await api("kb.add", { item: { kind: always ? "rule" : "qa", q, a, topic: $("mTopic").value, always } });
  $("mQ").value = $("mA").value = ""; toast("💾 Запомнил! 🧠");
});
$("mBulkSave").onclick = () => busy($("mBulkSave"), async () => {
  const items = [];
  for (const block of $("mBulk").value.split(/\n\s*\n/)) {
    let q = "", a = "", cur = null;
    for (const line of block.split("\n")) {
      const m = line.match(/^\s*(В|Q|Вопрос|О|A|Ответ)\s*[:：]\s*(.*)$/i);
      if (m) { cur = /^(В|Q|Вопрос)$/i.test(m[1]) ? "q" : "a"; if (cur === "q") q = m[2]; else a = m[2]; }
      else if (cur === "q") q += "\n" + line; else if (cur === "a") a += "\n" + line;
    }
    if (q.trim() && a.trim()) items.push({ kind: "qa", q: q.trim(), a: a.trim(), topic: $("mTopic").value });
  }
  if (!items.length) return toast("Не нашёл пар «В: … / О: …»");
  const d = await api("kb.bulk", { items }); $("mBulk").value = ""; toast(`💾 Запомнил: ${d.added} 🧠`);
});
// 3) демонстрация экрана
let dStream = null, dMicStream = null, dTimer = null, dClock = null, dRecog = null, dRecorder = null, dChunks = [], dLog = [], dSpeech = "", dLastSmall = null, dStartAt = 0, dSending = false;
const fmt = s => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
function addLog(note, speech) {
  const time = fmt((Date.now() - dStartAt) / 1000);
  dLog.push({ time, note, speech });
  if (dLog.length === 1) $("dLog").innerHTML = "";
  $("dLog").insertAdjacentHTML("beforeend", `<p><i>${time}</i> ${esc(note)}${speech ? `<br><small>🎙 «${esc(speech)}»</small>` : ""}</p>`);
  $("dLog").scrollTop = 1e9;
}
function smallDiff(video) {
  const c = document.createElement("canvas"); c.width = 32; c.height = 18; const x = c.getContext("2d"); x.drawImage(video, 0, 0, 32, 18);
  const px = x.getImageData(0, 0, 32, 18).data; let d = 0;
  if (dLastSmall) for (let i = 0; i < px.length; i += 4) d += Math.abs(px[i] - dLastSmall[i]) + Math.abs(px[i + 1] - dLastSmall[i + 1]);
  dLastSmall = px; return dLastSmall && d / (32 * 18);
}
async function grab(force) {
  const v = $("dVideo"); if (!v.videoWidth || dSending) return;
  const diff = smallDiff(v), speech = dSpeech.trim();
  if (!force && diff < 3 && !speech) return; // экран не изменился и ничего не сказано
  const w = Math.min(1280, v.videoWidth), h = Math.round(v.videoHeight * w / v.videoWidth);
  const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(v, 0, 0, w, h);
  const image = c.toDataURL("image/jpeg", 0.6); dSpeech = "";
  dSending = true;
  try {
    const d = await api("train.frame", { image, speech, title: $("dTitle").value, log: dLog.slice(-4).map(x => x.note) });
    const note = (d.note || "").trim();
    if (note && note !== "—" && note !== "-") addLog(note, speech); else if (speech) addLog("(экран без изменений)", speech);
  } catch (e) { if (speech) addLog("(кадр не распознан)", speech); console.warn(e); }
  dSending = false;
}
$("dStart").onclick = async () => {
  if (!navigator.mediaDevices?.getDisplayMedia) return toast("Этот браузер не умеет показывать экран — откройте админку на компьютере в Chrome или Edge");
  try { dStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 10 }, audio: false }); } catch { return toast("Демонстрация отменена"); }
  dLog = []; dSpeech = ""; dLastSmall = null; dChunks = []; dStartAt = Date.now();
  $("dLog").innerHTML = '<p class="hint">ИИ смотрит… первая заметка появится через несколько секунд.</p>'; $("dResult").hidden = true; $("dDownload").hidden = true;
  $("dVideo").srcObject = dStream; $("dLive").hidden = false; $("dStart").disabled = true; $("dStop").disabled = false;
  dStream.getVideoTracks()[0].onended = () => $("dStop").click();
  if ($("dMic").value === "1") {
    try { dMicStream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { toast("Микрофон не разрешён — пишите комментарии текстом"); }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      dRecog = new SR(); dRecog.lang = "ru-RU"; dRecog.continuous = true; dRecog.interimResults = true;
      dRecog.onresult = e => { let fin = "", interim = ""; for (let i = e.resultIndex; i < e.results.length; i++) (e.results[i].isFinal ? (fin += e.results[i][0].transcript + " ") : (interim += e.results[i][0].transcript)); if (fin) dSpeech += fin; $("dSpeech").textContent = "🎙 " + (dSpeech + interim).slice(-200); };
      dRecog.onend = () => { if (dStream) try { dRecog.start(); } catch {} };
      try { dRecog.start(); } catch {}
    } else toast("Распознавание голоса работает в Chrome/Edge. Пишите комментарии текстом 💬");
  }
  if ($("dRec").checked && window.MediaRecorder) {
    const tracks = [...dStream.getVideoTracks(), ...(dMicStream ? dMicStream.getAudioTracks() : [])];
    try { dRecorder = new MediaRecorder(new MediaStream(tracks), { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm" }); dRecorder.ondataavailable = e => e.data.size && dChunks.push(e.data); dRecorder.start(1000); } catch (e) { console.warn(e); }
  }
  setTimeout(() => grab(true), 1500);
  dTimer = setInterval(() => grab(false), +$("dEvery").value * 1000);
  dClock = setInterval(() => $("dTime").textContent = fmt((Date.now() - dStartAt) / 1000), 1000);
};
$("dNote").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.value.trim()) { e.preventDefault(); dSpeech += " " + e.target.value.trim(); e.target.value = ""; grab(true); toast("💬 Отправлено ИИ"); } });
$("dStop").onclick = async () => {
  if (!dStream) return;
  clearInterval(dTimer); clearInterval(dClock);
  if (dSpeech.trim()) await grab(true);
  const s = dStream; dStream = null;
  try { dRecog?.stop(); } catch {} dRecog = null;
  if (dRecorder && dRecorder.state !== "inactive") { dRecorder.onstop = () => { const url = URL.createObjectURL(new Blob(dChunks, { type: "video/webm" })); $("dDownload").href = url; $("dDownload").hidden = false; }; dRecorder.stop(); }
  s.getTracks().forEach(t => t.stop()); dMicStream?.getTracks().forEach(t => t.stop()); dMicStream = null;
  $("dLive").hidden = true; $("dStart").disabled = false; $("dStop").disabled = true;
  if (!dLog.length) return toast("Запись пустая — ИИ ничего не успел увидеть");
  $("dMemo").textContent = "🧠 Превращаю запись в память…"; $("dResult").hidden = false;
  try { const d = await api("train.finish", { title: $("dTitle").value || "Демонстрация", log: dLog }); $("dMemo").innerHTML = esc(d.item?.a || "").replace(/\n/g, "<br>"); toast("🧠 Демонстрация запомнена!"); }
  catch (e) { $("dMemo").textContent = "😿 " + e.message; }
};

/* ---------- 🧠 память ---------- */
let kb = [];
const KIND = { qa: "💬", rule: "📌", demo: "🖥" };
async function loadKb() { try { kb = (await api("kb.list")).items; renderKb(); } catch (e) { toast(e.message); } if (!stats) loadStats(); }
function renderKb() {
  const q = $("kbSearch").value.toLowerCase(), k = $("kbKind").value;
  const items = kb.filter(x => (!k || x.kind === k || (k === "rule" && x.always)) && (!q || (x.q + " " + x.a + " " + x.topic + " " + x.title).toLowerCase().includes(q)));
  $("kbList").innerHTML = items.length ? "" : '<p class="hint">Память пустая — научите ИИ во вкладке «Обучение» 🎓</p>';
  items.slice(0, 300).forEach(x => {
    const el = document.createElement("div"); el.className = "kb-item" + (x.on === false ? " off" : "");
    el.innerHTML = `<div class="kb-top"><span>${KIND[x.always ? "rule" : x.kind] || "💬"} ${x.topic ? `<em>${esc(x.topic)}</em>` : ""}</span><i>${new Date(x.t).toLocaleDateString()}</i></div>
      <textarea class="kq" placeholder="${x.always ? "Когда применять (необязательно)" : "Вопрос"}">${esc(x.kind === "demo" ? x.title || x.q : x.q)}</textarea>
      <textarea class="ka">${esc(x.a)}</textarea>
      <div class="row small"><button data-a="save">💾</button><button data-a="toggle" class="ghost">${x.on === false ? "▶ Включить" : "⏸ Выключить"}</button><button data-a="del" class="ghost danger">🗑</button></div>`;
    el.querySelector("[data-a=save]").onclick = async () => { try { await api("kb.update", { id: x.id, item: x.kind === "demo" ? { title: el.querySelector(".kq").value, q: el.querySelector(".kq").value, a: el.querySelector(".ka").value } : { q: el.querySelector(".kq").value, a: el.querySelector(".ka").value } }); toast("Сохранено"); } catch (e) { toast(e.message); } };
    el.querySelector("[data-a=toggle]").onclick = async () => { await api("kb.update", { id: x.id, item: { on: x.on === false } }); loadKb(); };
    el.querySelector("[data-a=del]").onclick = async () => { if (!confirm("Удалить эту запись?")) return; await api("kb.delete", { id: x.id }); loadKb(); };
    $("kbList").appendChild(el);
  });
}
$("kbSearch").oninput = renderKb; $("kbKind").onchange = renderKb;
$("kbExport").onclick = async () => { const d = await api("kb.export"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 1)], { type: "application/json" })); a.download = "rabbit-ai-memory-" + new Date().toISOString().slice(0, 10) + ".json"; a.click(); };
$("kbImport").onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const data = JSON.parse(await f.text()); const merge = confirm("ОК — добавить к текущей памяти\nОтмена — заменить память полностью"); const d = await api("kb.import", { data, merge }); toast("Загружено. Записей: " + d.count); loadKb(); } catch (err) { toast("Файл не подходит: " + err.message); } e.target.value = ""; };
$("kbClear").onclick = async () => { if (!confirm("Стереть ВСЮ память ИИ? Сначала лучше скачать копию.")) return; await api("kb.clear"); loadKb(); };

/* ---------- 🧪 тест ---------- */
$("tAsk").onclick = () => busy($("tAsk"), async () => {
  const q = $("tQ").value.trim(); if (!q) return;
  const d = await api("test", { prompt: q, theme: $("tSwag").checked ? "swag" : "bunny" });
  $("tA").hidden = false; $("tA").innerHTML = esc(d.text).replace(/\n/g, "<br>");
  $("tMeta").textContent = `Модель: ${d.model || "—"} · ${d.usedKb ? "🧠 использовал память" : "память не понадобилась"}`;
});

/* ---------- 💎 коды ---------- */
$("vipBtn").onclick = () => busy($("vipBtn"), async () => {
  const d = await api("code", { owner: true, forever: true, note: "owner" });
  $("vipCode").value = d.codes[0]; $("vipBox").hidden = false; $("vipGo").href = "/#vip=" + encodeURIComponent(d.codes[0]); toast("👑 Вечный VIP-код создан");
});
$("vipCopy").onclick = () => { navigator.clipboard.writeText($("vipCode").value); toast("Скопировано"); };
let lastPlan = "";
$("makeBtn").onclick = () => busy($("makeBtn"), async () => {
  const v = $("days").value;
  const d = await api("code", { days: v === "forever" ? 0 : +v, forever: v === "forever", count: $("count").value, note: $("note").value, plan: $("plan").value });
  lastPlan = d.planName + " — " + (d.forever ? "навсегда" : d.days + " дн.");
  $("out").value = d.codes.join("\n\n"); toast(d.planName + " — готово: " + d.codes.length); loadStats();
});
$("outCopy").onclick = () => { navigator.clipboard.writeText($("out").value); toast("Скопировано"); };
$("outMsg").onclick = () => { if (!$("out").value) return toast("Сначала создайте код"); navigator.clipboard.writeText(`Спасибо за покупку! 🐰💎\nТариф: ${lastPlan}\n\nВаш код:\n${$("out").value}\n\nКак включить: откройте ${location.origin} → «Тарифы» → вставьте код → «Активировать».`); toast("Скопировано с инструкцией"); };

/* ---------- ⚙️ сайт ---------- */
async function loadSettings() { try { const { settings: s, plugins } = await api("settings"); const off = new Set(s.pluginsOff || []); $("setPlugins").innerHTML = (plugins || []).map(p => `<label class="chk"><input type="checkbox" data-plug="${p.id}" ${off.has(p.id) ? "" : "checked"}/> ${p.e} ${esc(p.name)} <small class="hint">— ${esc(p.desc)}</small></label>`).join(""); $("setAnn").value = s.announce || ""; $("setExtra").value = s.extraPrompt || ""; $("setMaint").checked = !!s.maintenance; $("setTheme").value = s.defaultTheme || ""; $("setSupport").value = s.support || ""; $("setWelcome").value = s.welcome || ""; $("setBad").value = (s.badWords || []).join("\n"); const mo = new Set(s.modesOff || []); $("setModes").innerHTML = MODELIST.map(([k, n]) => `<label class="chk"><input type="checkbox" data-mode="${k}" ${mo.has(k) ? "" : "checked"}/> ${n}</label>`).join(""); } catch (e) { toast(e.message); } }
$("setSave").onclick = () => busy($("setSave"), async () => { await api("settings", { set: { announce: $("setAnn").value, extraPrompt: $("setExtra").value, maintenance: $("setMaint").checked, pluginsOff: [...document.querySelectorAll("[data-plug]")].filter(i => !i.checked).map(i => i.dataset.plug), modesOff: [...document.querySelectorAll("#setModes [data-mode]")].filter(i => !i.checked).map(i => i.dataset.mode), defaultTheme: $("setTheme").value, support: $("setSupport").value.trim(), welcome: $("setWelcome").value.trim(), badWords: $("setBad").value } }); toast("💾 Сохранено"); });


/* ---------- 🩺 проверка моделей ---------- */
$("pingBtn").onclick = () => busy($("pingBtn"), async () => {
  $("pingOut").innerHTML = '<p class="hint">Проверяю… (до минуты)</p>';
  const d = await api("ping");
  $("pingOut").innerHTML = d.models.length ? d.models.map(m => `<div><span>${esc(m.name)} <small class="hint">${esc(m.min)}</small></span><b title="${esc(m.err)}">${m.ok ? "✅ " + (m.ms / 1000).toFixed(1) + " с" : "❌ " + esc(m.err.slice(0, 60))}</b></div>`).join("") : '<p class="hint">В меню нет моделей для проверки</p>';
});

/* ---------- 👥 пользователи ---------- */
let usersData = null;
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "только что" : m < 60 ? m + " мин назад" : Math.round(m / 60) + " ч назад"; };
async function loadUsers() { try { usersData = await api("users"); renderUsers(); } catch (e) { toast(e.message); } }
function renderUsers() {
  const d = usersData; if (!d) return;
  const q = $("rqSearch").value.toLowerCase();
  const rec = d.recent.filter(r => !q || r.q.toLowerCase().includes(q));
  $("recent").innerHTML = rec.length ? "" : '<p class="hint">Пока никто ничего не спросил (список сбрасывается при перезапуске сервера)</p>';
  rec.forEach(r => {
    const p = document.createElement("p");
    p.innerHTML = `<i>${new Date(r.t).toLocaleTimeString()}</i> <small class="hint">${esc(NAMES[r.plan] || r.plan)} · ${esc(NAMES[r.mode] || r.mode)}</small><br>${esc(r.q)} <button class="mini">🎓 Научить</button>`;
    p.querySelector("button").onclick = () => { document.querySelector('#tabs button[data-tab="train"]').click(); document.querySelector('.way[data-way="manual"]').click(); $("mQ").value = r.q; $("mA").focus(); toast("Напишите правильный ответ и нажмите «Запомнить»"); };
    $("recent").appendChild(p);
  });
  $("users").innerHTML = d.users.length ? "" : '<p class="hint">Сегодня пока никого</p>';
  d.users.forEach(u => {
    const el = document.createElement("div"); el.className = "user" + (u.ban ? " banned" : "");
    el.innerHTML = `<span><b>${esc(NAMES[u.plan] || u.plan)}</b> ${u.note ? "· " + esc(u.note) : ""}<br><small class="hint">${esc(u.key.startsWith("ip:") ? "IP " + u.ip : "код " + u.key.slice(4))} · ${u.n} сообщ. · ${ago(u.last)}</small></span>`;
    const b = document.createElement("button"); b.className = "mini " + (u.ban ? "" : "danger"); b.textContent = u.ban ? "✅ Разблокировать" : "⛔ Блок";
    b.onclick = async () => { if (u.ban) await api("unban", { key: u.key }); else { const note = prompt("Причина блокировки (необязательно)") ?? null; if (note === null) return; await api("ban", { key: u.key, note }); } toast("Готово"); loadUsers(); };
    const m = document.createElement("button"); m.className = "mini"; m.textContent = "✉️"; m.title = "Написать сообщение";
    m.onclick = () => { document.querySelector('#tabs button[data-tab="server"]').click(); $("msgKey").value = u.key; $("msgText").focus(); };
    el.appendChild(m); el.appendChild(b); $("users").appendChild(el);
  });
  $("bans").innerHTML = d.bans.length ? "" : '<p class="hint">Никто не заблокирован</p>';
  d.bans.forEach(x => { const p = document.createElement("p"); p.innerHTML = `<i>${new Date(x.t).toLocaleDateString()}</i> ${esc(x.key)} ${x.note ? "— " + esc(x.note) : ""} <button class="mini">Разблокировать</button>`; p.querySelector("button").onclick = async () => { await api("unban", { key: x.key }); loadUsers(); }; $("bans").appendChild(p); });
}
$("rqSearch").oninput = renderUsers; $("usersRefresh").onclick = loadUsers;
$("banBtn").onclick = () => busy($("banBtn"), async () => { const k = $("banKey").value.trim(); if (!k) return toast("Введите IP или ключ"); await api("ban", { key: k, note: $("banNote").value }); $("banKey").value = $("banNote").value = ""; toast("⛔ Заблокирован"); loadUsers(); });

/* ---------- 🎚 лимиты ---------- */
const LF = { day: "💬 Сообщений в день", chars: "📄 Символов в файле", images: "📷 Фото за раз", tokens: "📏 Длина ответа (токены)", draw: "🎨 Картинок в день", search: "🌐 Поисков в день", video: "🎬 Видео в день", deep: "🧠 Глубоких ответов в день" };
const PL = ["free", "plus", "pro", "max"];
async function loadLimits() {
  try {
    const d = await api("limits");
    $("limTable").innerHTML = `<tr><th></th>${PL.map(p => `<th>${NAMES[p]}</th>`).join("")}</tr>` + d.fields.map(f => `<tr><td>${LF[f] || f}</td>${PL.map(p => `<td><input data-p="${p}" data-f="${f}" value="${esc(d.limits[p][f])}" title="По умолчанию: ${esc(d.defaults[p][f])}"/></td>`).join("")}</tr>`).join("");
  } catch (e) { toast(e.message); }
}
$("limSave").onclick = () => busy($("limSave"), async () => {
  const set = {}; document.querySelectorAll("#limTable input").forEach(i => { (set[i.dataset.p] ||= {})[i.dataset.f] = i.value.trim() === "∞" ? "∞" : i.value.trim(); });
  await api("limits", { set }); toast("💾 Лимиты сохранены"); loadLimits();
});
$("limReset").onclick = () => busy($("limReset"), async () => { if (!confirm("Вернуть все лимиты по умолчанию?")) return; await api("limits", { set: {}, reset: true }); toast("↩ Лимиты по умолчанию"); loadLimits(); });

/* ---------- 🔍 коды ---------- */
$("ckBtn").onclick = () => busy($("ckBtn"), async () => { const d = await api("checkcode", { code: $("rvCode").value }); $("rvOut").innerHTML = `${d.valid ? "✅ Работает" : d.revoked ? "⛔ Отключён" : "❌ Недействителен / истёк"} · ${esc(d.plan || "")} · до: ${esc(d.exp)}${d.note ? " · " + esc(d.note) : ""}`; });
$("rvBtn").onclick = () => busy($("rvBtn"), async () => { if (!confirm("Отключить этот код навсегда?")) return; const d = await api("revoke", { code: $("rvCode").value }); $("rvOut").textContent = `⛔ Код отключён (${d.plan || ""}${d.note ? ", " + d.note : ""})`; toast("Код отключён"); });

if (tok) showPanel();

/* ---------- 🛍 магазин ---------- */
const ST = { pending: "⏳ На проверке", ok: "✅ Одобрен", rejected: "⛔ Отклонён" };
async function loadStoreAdm() {
  let d; try { d = await api("store.list"); } catch (e) { return toast(e.message); }
  $("storeAuto").checked = d.auto;
  const f = $("storeFilter").value, items = d.items.filter(p => !f || p.status === f);
  $("storeAdmin").innerHTML = items.length ? items.map(p => `<div class="st-item" data-id="${esc(p.id)}"><div class="st-h"><b>${esc(p.e)} ${esc(p.name)}</b> <span class="pill">${ST[p.status] || esc(p.status)}</span> <span class="hint">${p.type === "api" ? "🌐 API" : "💬 Инструкции"} · автор: ${esc(p.author)} · ⬇️ ${p.installs} · ${new Date(p.t).toLocaleString("ru")}</span></div><p>${esc(p.desc)}</p>${p.prompt ? `<pre>${esc(p.prompt)}</pre>` : ""}${p.api ? `<p class="hint">API: ${esc(p.api.url)}</p>` : ""}${p.triggers ? `<p class="hint">Триггеры: ${esc(p.triggers)}</p>` : ""}<div class="row">${p.status !== "ok" ? '<button data-a="ok">✅ Одобрить</button>' : ""}${p.status !== "rejected" ? '<button data-a="no" class="ghost">⛔ Отклонить</button>' : ""}<button data-a="del" class="ghost">🗑 Удалить</button></div></div>`).join("") : '<p class="hint">Здесь пока пусто</p>';
  $("storeAdmin").querySelectorAll("button").forEach(b => b.onclick = () => busy(b, async () => {
    const id = b.closest(".st-item").dataset.id, a = b.dataset.a;
    if (a === "del") { if (!confirm("Удалить плагин из магазина?")) return; await api("store.delete", { id }); }
    else await api("store.approve", { id, reject: a === "no" });
    toast(a === "ok" ? "✅ Опубликован" : a === "no" ? "⛔ Отклонён" : "🗑 Удалён"); loadStoreAdm();
  }));
}
$("storeFilter").onchange = loadStoreAdm;
$("storeReload").onclick = loadStoreAdm;
$("storeAuto").onchange = async e => { try { await api("store.auto", { on: e.target.checked }); toast(e.target.checked ? "Публикация без проверки включена" : "Теперь всё через проверку"); } catch (er) { toast(er.message); } };

const MODELIST = [["search", "🌐 Поиск"], ["deep", "🧠 Глубокое мышление"], ["code", "👨‍💻 Код"], ["codex", "⚡ CodeX"], ["meme", "🤪 Мем-чат"], ["draw", "🎨 Картинки"], ["video", "🎬 Видео"], ["tutor", "🎓 Репетитор"], ["writer", "✍️ Писатель"], ["translate", "🌍 Перевод"]];

/* ---------- 💬 отзывы ---------- */
async function loadFb() {
  let d; try { d = await api("fb.list"); } catch (e) { return toast(e.message); }
  $("fbUp").textContent = d.up; $("fbDown").textContent = d.down; $("fbRate").textContent = d.up + d.down ? Math.round(d.up / (d.up + d.down) * 100) + "%" : "—";
  const f = +$("fbFilter").value, items = d.items.filter(x => !f || x.v === f);
  $("fbList").innerHTML = items.length ? "" : '<p class="hint">Пока отзывов нет</p>';
  items.forEach(x => {
    const el = document.createElement("div"); el.className = "st-item";
    el.innerHTML = `<div class="st-h"><b>${x.v > 0 ? "👍" : "👎"}</b> <span class="hint">${new Date(x.t).toLocaleString("ru")} · ${esc(NAMES[x.plan] || x.plan)}${x.mode ? " · " + esc(NAMES[x.mode] || x.mode) : ""}</span></div>${x.note ? `<p>💬 <b>${esc(x.note)}</b></p>` : ""}<p class="hint">Вопрос:</p><p>${esc(x.q || "—")}</p><p class="hint">Ответ ИИ:</p><pre>${esc(x.a)}</pre><div class="row">${x.v < 0 ? '<button data-a="train">🎓 Научить правильному ответу</button>' : ""}<button data-a="del" class="ghost">🗑 Удалить</button></div>`;
    el.querySelector('[data-a="del"]').onclick = async () => { await api("fb.delete", { id: x.id }); el.remove(); };
    el.querySelector('[data-a="train"]')?.addEventListener("click", () => { document.querySelector('#tabs button[data-tab="train"]').click(); document.querySelector('.way[data-way="manual"]').click(); $("mQ").value = x.q; $("mA").focus(); toast("Напишите правильный ответ и нажмите «Запомнить»"); });
    $("fbList").appendChild(el);
  });
}
$("fbFilter").onchange = loadFb; $("fbReload").onclick = loadFb;
$("fbClear").onclick = async () => { if (!confirm("Удалить все отзывы?")) return; await api("fb.clear"); loadFb(); };

/* ---------- 🖥 сервер ---------- */
const mb = n => (n / 1048576).toFixed(0) + " МБ";
const dur = s => { const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return (d ? d + " д " : "") + h + " ч " + m + " мин"; };
async function loadServer() {
  let d; try { d = await api("server"); } catch (e) { return toast(e.message); }
  const c = d.counts;
  $("srvInfo").innerHTML = [["🟢 Онлайн сейчас (5 мин)", c.online], ["⏱ Работает без перезапуска", dur(d.uptime)], ["🧠 Память сервера (RAM)", mb(d.rss) + " (JS: " + mb(d.heap) + ")"], ["⚙️ Node.js", d.node], ["💾 Хранилище данных", d.storage + (d.ghRepo ? " · " + d.ghRepo : "")], ["📦 Размер данных", (d.brainSize / 1024).toFixed(1) + " КБ"], ["🎓 Знаний в памяти ИИ", c.kb], ["🛍 Плагинов в магазине", c.store], ["💬 Отзывов", c.feedback], ["⛔ Блокировок", c.bans], ["✉️ Непрочитанных сообщений", c.inbox], ["💎 Выдач кодов", c.codes]].map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join("");
  $("auditLog").innerHTML = d.audit.length ? d.audit.map(a => `<p><i>${new Date(a.t).toLocaleString("ru")}</i> ${esc(a.what)}</p>`).join("") : '<p class="hint">Журнал пуст</p>';
}
$("srvReload").onclick = loadServer;
$("srvSave").onclick = () => busy($("srvSave"), async () => { await api("save.now"); toast("💾 Данные сохранены"); });
$("srvReset").onclick = () => busy($("srvReset"), async () => { if (!confirm("Обнулить статистику за сегодня?")) return; await api("stats.reset"); toast("🧹 Статистика сброшена"); loadServer(); });
$("msgSend").onclick = () => busy($("msgSend"), async () => { await api("msg.send", { key: $("msgKey").value.trim(), text: $("msgText").value }); $("msgText").value = ""; toast("✉️ Сообщение отправлено"); loadServer(); });
$("auditClear").onclick = async () => { if (!confirm("Очистить журнал?")) return; await api("audit.clear"); loadServer(); };
