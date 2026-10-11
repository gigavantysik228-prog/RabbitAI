# Собирает все русские строки интерфейса в public/i18n-keys.json (запускать после изменения текстов)
import re, json
from bs4 import BeautifulSoup, Comment
CYR = re.compile(r"[А-Яа-яЁё]")
keys = []
def add(s):
    s = re.sub(r"\s+", " ", s).strip()
    if s and CYR.search(s) and len(s) < 400 and s not in keys: keys.append(s)
for f in ["public/index.html", "public/download.html"]:
    soup = BeautifulSoup(open(f, encoding="utf8").read(), "html.parser")
    for el in soup(["script", "style"]): el.decompose()
    for s in soup.find_all(string=True):
        if not isinstance(s, Comment): add(str(s))
    for el in soup.find_all(True):
        for a in ["placeholder", "title", "aria-label", "data-dark", "data-q"]:
            if el.get(a): add(el[a])
for f in ["public/app.js", "public/files.js"]:
    src = open(f, encoding="utf8").read()
    src = re.sub(r"^\s*//.*$|/\*.*?\*/", "", src, flags=re.M | re.S)
    for m in re.finditer(r'\bt\("((?:[^"\\]|\\.)*)"', src): add(m.group(1))
    for m in re.finditer(r'"((?:[^"\\\n]|\\.)*)"|\'((?:[^\'\\\n]|\\.)*)\'|`((?:[^`\\]|\\.)*)`', src):
        lit = next(g for g in m.groups() if g is not None)
        if not CYR.search(lit): continue
        for piece in re.split(r"\$\{[^}]*\}|<[^>]+>|\\n", lit):
            add(piece.replace('\\"', '"'))
for extra in ["Зайчик думает…", "Думаю…", "Файл готов", "Зайчик пишет файл…", "👁 Показать", "🙈 Скрыть", "Копировать", "Скачать", "Готово ✓", "Бесплатно", "/ месяц", "Авто (по региону)", "навсегда ∞", "без лимитов"]: add(extra)
keys = [k for k in keys if not k.startswith(("📎 Файл", "[Прикреплено", "Изучи прикреплённый", "Что на этом изображении"))]
json.dump(keys, open("public/i18n-keys.json", "w", encoding="utf8"), ensure_ascii=False, indent=0)
print(len(keys), sum(len(k) for k in keys))
