const $ = id => document.getElementById(id);
let pw = localStorage.getItem("rabbit-admin") || sessionStorage.getItem("rabbit-admin") || "";
const toast = t => { $("toast").textContent = t; $("toast").classList.add("show"); setTimeout(() => $("toast").classList.remove("show"), 2000); };
async function api(body) {
  const r = await fetch("/api/admin/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw, ...body }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Ошибка");
  return d;
}
function showPanel() { $("login").hidden = true; $("panel").hidden = false; }
$("login").onsubmit = async e => {
  e.preventDefault(); pw = $("pw").value; $("loginErr").textContent = "";
  try { await api({ check: true }); (($("remember").checked) ? localStorage : sessionStorage).setItem("rabbit-admin", pw); showPanel(); }
  catch (err) { $("loginErr").textContent = err.message; pw = ""; }
};
$("vipBtn").onclick = async () => {
  try {
    const d = await api({ owner: true, forever: true, note: "owner" });
    $("vipCode").value = d.codes[0]; $("vipBox").hidden = false;
    $("vipGo").href = "/#vip=" + encodeURIComponent(d.codes[0]);
    toast("👑 Вечный VIP-код создан");
  } catch (err) { toast(err.message); }
};
$("vipCopy").onclick = () => { navigator.clipboard.writeText($("vipCode").value); toast("Скопировано"); };
$("makeBtn").onclick = async () => {
  try {
    const v = $("days").value;
    const d = await api({ days: v === "forever" ? 0 : +v, forever: v === "forever", count: $("count").value, note: $("note").value, plan: $("plan").value });
    $("out").value = d.codes.join("\n\n"); toast(d.planName + " — готово: " + d.codes.length);
  } catch (err) { toast(err.message); }
};
$("logout").onclick = () => { localStorage.removeItem("rabbit-admin"); sessionStorage.removeItem("rabbit-admin"); location.reload(); };
if (pw) api({ check: true }).then(showPanel).catch(() => { pw = ""; });
