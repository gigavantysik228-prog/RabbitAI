// Работа с файлами: чтение (txt, код, PDF, Word, картинки) и создание файлов для скачивания.
const RabbitFiles = (() => {
  const TEXT_EXT = /\.(txt|md|csv|json|html?|xml|py|js|ts|jsx|tsx|java|c|cpp|h|cs|go|rb|php|sql|css|scss|ya?ml|log|ini|sh|bat|kt|swift|rs)$/i;
  const loaded = {};
  const loadScript = src => loaded[src] || (loaded[src] = new Promise((ok, err) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => err(new Error("Не удалось загрузить модуль")); document.head.appendChild(s); }));

  async function readPdf(file) {
    await loadScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    let out = "";
    for (let i = 1; i <= Math.min(pdf.numPages, 300); i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      out += `\n[Страница ${i}]\n` + tc.items.map(t => t.str).join(" ");
    }
    if (!out.replace(/\[Страница \d+\]/g, "").trim()) throw new Error("В PDF нет текста (возможно, это скан)");
    return out.trim();
  }
  async function readDocx(file) {
    await loadScript("https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js");
    return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value.trim();
  }
  function readImage(file) {
    return new Promise((ok, err) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1600, k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); ok(c.toDataURL("image/jpeg", .85));
      };
      img.onerror = () => err(new Error("Не удалось открыть картинку"));
      img.src = url;
    });
  }
  async function read(file) {
    const name = file.name || "файл";
    if (file.size > 25e6) throw new Error(`«${name}» больше 25 МБ`);
    if (file.type.startsWith("image/")) return { name, kind: "image", dataUrl: await readImage(file) };
    if (/\.pdf$/i.test(name) || file.type === "application/pdf") return { name, kind: "text", icon: "📕", text: await readPdf(file) };
    if (/\.docx$/i.test(name)) return { name, kind: "text", icon: "📘", text: await readDocx(file) };
    if (TEXT_EXT.test(name) || file.type.startsWith("text/") || file.type === "application/json") return { name, kind: "text", icon: "📄", text: (await file.text()).trim() };
    throw new Error(`Формат «${name}» пока не поддерживается`);
  }

  // --- создание файлов ---
  const MIME = { md: "text/markdown", txt: "text/plain", csv: "text/csv", json: "application/json", html: "text/html", htm: "text/html", xml: "application/xml", doc: "application/msword", svg: "image/svg+xml" };
  const EXT = { python: "py", py: "py", javascript: "js", js: "js", typescript: "ts", ts: "ts", html: "html", css: "css", json: "json", java: "java", c: "c", cpp: "cpp", "c++": "cpp", csharp: "cs", cs: "cs", go: "go", ruby: "rb", php: "php", sql: "sql", bash: "sh", sh: "sh", shell: "sh", yaml: "yml", yml: "yml", xml: "xml", markdown: "md", md: "md", csv: "csv", kotlin: "kt", swift: "swift", rust: "rs", text: "txt", txt: "txt" };
  const extOf = n => (n.match(/\.([a-z0-9]+)$/i) || [, "txt"])[1].toLowerCase();
  const ICONS = { doc: "📘", docx: "📘", md: "📝", txt: "📄", csv: "📊", json: "🧩", html: "🌐", py: "🐍", js: "⚡" };

  function wordDoc(title, markdown) {
    const body = window.marked ? DOMPurify.sanitize(marked.parse(markdown)) : `<pre>${markdown.replace(/[&<]/g, c => c === "&" ? "&amp;" : "&lt;")}</pre>`;
    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Calibri,Arial,sans-serif;font-size:12pt;line-height:1.5}h1,h2,h3{color:#5b3a8c}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 8px}th{background:#f0e8ff}code{font-family:Consolas,monospace}</style></head><body>${body}</body></html>`;
  }
  function download(name, content) {
    let ext = extOf(name), data = content, type = MIME[ext] || "text/plain";
    if (ext === "docx" || ext === "doc") { name = name.replace(/\.docx?$/i, ".doc"); data = "\ufeff" + wordDoc(name, content); type = MIME.doc; }
    else if (ext === "csv") data = "\ufeff" + content;
    const blob = new Blob([data], { type: type + ";charset=utf-8" });
    if (window.RabbitAndroid) { const fr = new FileReader(); fr.onload = () => RabbitAndroid.save(name, fr.result.split(",")[1], type); fr.readAsDataURL(blob); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  // превращает блоки кода в карточки файлов / добавляет кнопки
  function enhance(bubble, done) {
    bubble.querySelectorAll("pre > code").forEach((code, i) => {
      const pre = code.parentElement;
      if (pre.dataset.enh) return;
      const lang = ([...code.classList].find(c => c.startsWith("language-")) || "").slice(9);
      const isFile = lang.startsWith("file:");
      if (!done && !isFile) return;
      pre.dataset.enh = done ? "1" : "";
      const name = isFile ? lang.slice(5) || "file.txt" : "code-" + (i + 1) + "." + (EXT[lang.toLowerCase()] || "txt");
      let bar = pre.previousElementSibling;
      if (!bar || !bar.classList.contains("code-bar")) { bar = document.createElement("div"); pre.before(bar); }
      bar.className = "code-bar" + (isFile ? " file-card" : "");
      const shown = extOf(name) === "docx" ? name.replace(/\.docx$/i, ".doc") : name;
      bar.innerHTML = isFile
        ? `<span class="f-ic">${ICONS[extOf(name)] || "📄"}</span><span class="f-name"><b></b><small>${done ? "Файл готов" : "Зайчик пишет файл…"}</small></span>${done ? '<button class="f-view">👁 Показать</button><button class="f-dl">⬇ Скачать</button>' : ""}`
        : `<span class="f-lang">${lang || "код"}</span><button class="f-copy">Копировать</button><button class="f-dl">Скачать</button>`;
      bar.querySelector("b") && (bar.querySelector("b").textContent = shown);
      if (isFile) pre.classList.add("collapsed");
      if (!done) return;
      bar.querySelector(".f-dl").onclick = () => download(name, code.textContent);
      const v = bar.querySelector(".f-view"); if (v) v.onclick = () => { pre.classList.toggle("collapsed"); v.textContent = pre.classList.contains("collapsed") ? "👁 Показать" : "🙈 Скрыть"; };
      const c = bar.querySelector(".f-copy"); if (c) c.onclick = () => { navigator.clipboard.writeText(code.textContent); c.textContent = "Готово ✓"; setTimeout(() => c.textContent = "Копировать", 1200); };
    });
  }
  return { read, download, enhance };
})();
