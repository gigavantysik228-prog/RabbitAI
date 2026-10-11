# Генератор мордочек собак для темы Dog: python3 tools-dogs.py
import os
OUT = os.path.join(os.path.dirname(__file__), "public", "dogs")
EYE = "#24160c"
def ears(kind, c, inner):
    L, R = [], []
    if kind == "pointed":
        L = [f'<path d="M30 50 L30 10 Q34 8 56 34 Z" fill="{c}"/>', f'<path d="M35 42 L35 20 L49 35 Z" fill="{inner}"/>']
    elif kind == "huge":
        L = [f'<path d="M34 50 L4 8 Q10 4 56 36 Z" fill="{c}"/>', f'<path d="M36 42 L14 16 L48 36 Z" fill="{inner}"/>']
    elif kind == "bat":
        L = [f'<path d="M26 46 Q18 16 30 12 Q44 12 50 38 Z" fill="{c}"/>', f'<path d="M31 40 Q26 22 32 19 Q40 20 44 37 Z" fill="{inner}"/>']
    elif kind == "folded":
        L = [f'<path d="M28 34 Q26 54 42 50 Q46 36 40 30 Z" fill="{c}"/>']
    elif kind == "floppy":
        L = [f'<ellipse cx="25" cy="66" rx="12" ry="27" transform="rotate(18 25 66)" fill="{c}"/>']
    elif kind == "fluffy":
        L = [f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}"/>' for x, y, r in [(22, 58, 12), (20, 74, 12), (26, 88, 10)]]
    mirror = lambda e: e.replace("<", '<g transform="translate(120 0) scale(-1 1)"><', 1) + "</g>"
    return L, [mirror(e) for e in L]
def dog(name, head, ear, earc=None, inner="#f6c9a8", muzzle=None, extra="", top="", eyes=EYE, tongue=True, cheeks="#ff9a8a"):
    el, er = ears(ear, earc or head, inner)
    behind = ear in ("pointed", "huge", "bat", "fluffy")
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">']
    if behind: parts += el + er
    parts.append(f'<ellipse cx="60" cy="66" rx="38" ry="35" fill="{head}"/>')
    parts.append(extra)
    if muzzle: parts.append(f'<ellipse cx="60" cy="84" rx="21" ry="15" fill="{muzzle}"/>')
    parts.append(top)
    if not behind: parts += el + er
    for x in (45, 75):
        parts.append(f'<circle cx="{x}" cy="62" r="5.4" fill="{eyes}"/>' + (f'<circle cx="{x}" cy="62" r="2.6" fill="{EYE}"/>' if eyes != EYE else "") + f'<circle cx="{x+1.8}" cy="60.2" r="1.7" fill="#fff"/>')
    parts.append(f'<ellipse cx="38" cy="76" rx="5" ry="3" fill="{cheeks}" opacity=".35"/><ellipse cx="82" cy="76" rx="5" ry="3" fill="{cheeks}" opacity=".35"/>')
    if tongue: parts.append('<path d="M55 87 Q55 98 60 98 Q65 98 65 87 Z" fill="#ff7a8a"/>')
    parts.append('<ellipse cx="60" cy="77" rx="7.5" ry="5.2" fill="#1a110a"/><ellipse cx="58" cy="75.5" rx="2.2" ry="1.2" fill="#fff" opacity=".6"/>')
    parts.append(f'<path d="M60 82 Q55 89 49 85 M60 82 Q65 89 71 85" fill="none" stroke="#1a110a" stroke-width="2.4" stroke-linecap="round"/>')
    parts.append("</svg>")
    open(os.path.join(OUT, name + ".svg"), "w").write("".join(parts))
W = "#fffaf3"
dog("shiba", "#e8892f", "pointed", inner="#fde3c4", extra=f'<path d="M24 74 Q30 102 60 102 Q90 102 96 74 Q84 66 72 70 Q60 76 48 70 Q36 66 24 74 Z" fill="{W}"/><ellipse cx="45" cy="52" rx="4" ry="2.5" fill="{W}"/><ellipse cx="75" cy="52" rx="4" ry="2.5" fill="{W}"/>')
dog("husky", "#6f7782", "pointed", inner="#e9e4e0", eyes="#4aa8ff", extra=f'<path d="M54 30 Q60 26 66 30 L66 60 Q76 58 92 70 Q92 100 60 101 Q28 100 28 70 Q44 58 54 60 Z" fill="{W}"/><ellipse cx="44" cy="50" rx="5" ry="3" fill="{W}"/><ellipse cx="76" cy="50" rx="5" ry="3" fill="{W}"/>')
dog("labrador", "#7a4a26", "floppy", earc="#5e3519", muzzle="#94603a")
dog("golden", "#e3a857", "floppy", earc="#c98a3b", muzzle="#f0c483")
dog("pug", "#e7cfa4", "folded", earc="#2a1d14", muzzle="#3a2a20", top='<path d="M48 42 Q60 38 72 42 M50 48 Q60 45 70 48" fill="none" stroke="#c9a876" stroke-width="2.4" stroke-linecap="round"/>')
dog("dalmatian", "#fbfbfb", "floppy", earc="#1d1d1d", extra="".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#1d1d1d"/>' for x, y, r in [(40, 42, 4), (70, 38, 3), (84, 56, 4.5), (34, 66, 3), (88, 80, 3), (52, 96, 2.6), (66, 46, 2.2)]))
dog("corgi", "#e2843a", "huge", inner="#fde3c4", extra=f'<path d="M55 30 Q60 27 65 30 L68 64 Q86 66 94 76 Q88 102 60 102 Q32 102 26 76 Q34 66 52 64 Z" fill="{W}"/>')
dog("doberman", "#1f1a17", "pointed", inner="#5a3a28", muzzle="#a8642e", extra='<circle cx="45" cy="52" r="3.6" fill="#a8642e"/><circle cx="75" cy="52" r="3.6" fill="#a8642e"/>', cheeks="#a8642e")
dog("beagle", "#9a5a2c", "floppy", earc="#5e3519", extra=f'<path d="M55 30 Q60 27 65 30 L68 64 Q84 68 84 84 Q78 102 60 102 Q42 102 36 84 Q36 68 52 64 Z" fill="{W}"/><path d="M34 34 Q60 22 86 34 Q78 44 60 42 Q42 44 34 34 Z" fill="#2a1d14"/>')
dog("poodle", "#d9d4cf", "fluffy", earc="#c6c0ba", top="".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#c6c0ba"/>' for x, y, r in [(46, 34, 11), (60, 28, 13), (74, 34, 11)]), muzzle="#e8e4df")
dog("chihuahua", "#e9c48f", "huge", inner="#f9b8a8", extra=f'<path d="M48 70 Q60 64 72 70 Q80 92 60 98 Q40 92 48 70 Z" fill="{W}"/>')
dog("frenchie", "#8e9196", "bat", inner="#e9b6ad", muzzle="#c9cbce", tongue=False)
print("ok", len(os.listdir(OUT)))
