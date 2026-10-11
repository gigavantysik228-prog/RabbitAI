# Генерирует public/dog.css (тема Dog) из style.css: розовые/фиолетовые цвета → оранжевые/коричневые
import re, colorsys, os
D = os.path.dirname(os.path.abspath(__file__))
css = open(os.path.join(D, "public/style.css")).read()
css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
COL = re.compile(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)")
def parse(c):
    if c.startswith("#"):
        h = c[1:]; h = "".join(x * 2 for x in h) if len(h) == 3 else h
        return [int(h[i:i + 2], 16) for i in (0, 2, 4)], None
    n = [x.strip() for x in c[c.index("(") + 1:-1].split(",")]
    return [float(x) for x in n[:3]], (n[3] if len(n) > 3 else None)
def warm(c):
    (r, g, b), a = parse(c)
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    deg = h * 360
    if s < .12 or not (190 <= deg or deg < 12): return c
    if l > .9: h2, s2 = 32 / 360, min(s, .9)            # нежно-розовое → кремовое
    elif l < .3: h2, s2 = 24 / 360, min(s, .5)          # тёмно-фиолетовое → тёмно-коричневое
    elif deg >= 300 or deg < 12: h2, s2 = 26 / 360, max(s, .85)   # розовое → оранжевое
    else: h2, s2, l = 22 / 360, min(s, .55), min(l, .45)          # фиолетовое → коричневое
    r, g, b = [round(x * 255) for x in colorsys.hls_to_rgb(h2, l, s2)]
    return f"rgba({r},{g},{b},{a})" if a is not None else f"#{r:02x}{g:02x}{b:02x}"
out = []
def walk(text, wrap=None):
    i = 0
    while i < len(text):
        j = text.find("{", i)
        if j < 0: break
        sel = text[i:j].strip(); depth, k = 1, j + 1
        while depth: depth += {"{": 1, "}": -1}.get(text[k], 0); k += 1
        body = text[j + 1:k - 1]; i = k
        if sel.startswith("@media"): walk(body, sel); continue
        if sel.startswith("@"): continue
        sels = [x.strip() for x in sel.split(",") if x.strip() and not x.strip().startswith(("html.dark", ":root", "html", "body.dark"))]
        sels = [x for x in sels if not re.search(r"\b(dark|dog)\b", x)]
        if not sels: continue
        decls = []
        for d in body.split(";"):
            if ":" not in d or d.strip().startswith("--"): continue
            prop, val = d.split(":", 1)
            nv = COL.sub(lambda m: warm(m.group(0)), val)
            if nv != val: decls.append(prop.strip() + ":" + nv.strip())
        if decls and "background-clip:text" in body and any(x.startswith("background:") for x in decls): decls += ["-webkit-background-clip:text", "background-clip:text"]
        if decls:
            rule = ",".join(":where(html.dog) " + x for x in sels) + "{" + ";".join(decls) + "}"
            out.append(wrap + "{" + rule + "}" if wrap else rule)
walk(css)
manual = open(os.path.join(D, "public/dog.manual.css")).read()
open(os.path.join(D, "public/dog.css"), "w").write("/* сгенерировано tools-dog-css.py — правьте dog.manual.css */\n" + "\n".join(out) + "\n" + manual)
print(len(out), "правил")
