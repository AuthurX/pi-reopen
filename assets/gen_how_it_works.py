#!/usr/bin/env python3
"""Generate assets/how-it-works.png (EN) and how-it-works.zh.png (ZH) for the README."""
import os, subprocess
from PIL import Image, ImageDraw, ImageFilter, ImageFont

S = 2
W, H = 1600, 640
base = __file__.rsplit("/", 1)[0] + "/"

NOTO = "/usr/share/fonts/noto-cjk/NotoSansCJK-{w}.ttc"

def noto_index():
    for i in range(8):
        try:
            f = ImageFont.truetype(NOTO.format(w="Regular"), 20, index=i)
            if "SC" in f.getname()[0]:
                return i
        except Exception:
            break
    return 0

SC_IDX = noto_index()

def sc(weight, size):
    return ImageFont.truetype(NOTO.format(w=weight), size * S, index=SC_IDX)

def find_font(filename, pattern):
    cands = [os.path.expanduser(f"~/.local/share/fonts/{filename}"), f"{base}fonts/{filename}"]
    for c in cands:
        if os.path.exists(c):
            return c
    try:
        p = subprocess.run(["fc-match", "-f", "%{file}", pattern],
                           capture_output=True, text=True, timeout=10)
        if p.returncode == 0 and p.stdout.strip() and os.path.exists(p.stdout.strip()):
            return p.stdout.strip()
    except Exception:
        pass
    return None

SG_PATH = find_font("SpaceGrotesk-Variable.ttf", "Space Grotesk")
SM_PATH = find_font("SpaceMono-Regular.ttf", "Space Mono")
SM_B_PATH = find_font("SpaceMono-Bold.ttf", "Space Mono:style=Bold")

def sg(weight, size):
    f = ImageFont.truetype(SG_PATH, size * S)
    try:
        f.set_variation_by_axes([weight])
    except Exception:
        pass
    return f

def sm(bold, size):
    return ImageFont.truetype(SM_B_PATH if bold else SM_PATH, size * S)

# palette (sampled from reference)
BG      = (246, 240, 229)
GRID    = (234, 227, 211)
BORDER  = (224, 217, 200)
INK     = (17, 24, 39)
CREAM   = (246, 240, 229)
EYEBROW = (152, 157, 167)
CORAL   = (255, 114, 94)
SLATE   = (90, 100, 120)

DARK    = (17, 24, 39)
DARK_IN = (30, 41, 59)
MINT    = (97, 210, 180)
TEAL_D  = (31, 92, 78)
LAV     = (220, 213, 255)
PURPLE  = (115, 100, 213)
VIOLET  = (108, 92, 231)
LAV_INK = (23, 20, 49)
LAV_SUB = (95, 88, 135)
AMBER   = (255, 209, 102)
GOLD_D  = (154, 118, 33)
CREAM_I = (248, 231, 193)
GOLD_SUB= (122, 106, 58)
BLUE    = (185, 210, 238)
BLUE_D  = (44, 74, 115)
MUTED_D = (147, 161, 181)

def s(v):
    return int(round(v * S))

def text_ls(d, x, y, text, font, fill, ls):
    cx = x
    for ch in text:
        d.text((s(cx), s(y)), ch, font=font, fill=fill)
        cx += d.textlength(ch, font=font) / S + ls

def wrap(d, text, font, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=font) / S <= maxw or not cur:
            cur = t
        else:
            lines.append(cur); cur = w
    lines.append(cur)
    return lines[:2]

# card: (eyebrow, title, body)
# body: ("box", [lines]) | ("lines", [(label, value)]) | ("pills", [(text, bg, fg)]) | ("check", title, sub)
CARDS_EN = [
    ("01 / START",   "Pi starts",      ("box",   ["extension registers", "each session live"])),
    ("02 / RECORD",  "members/",       ("lines", [("file", "one per session"), ("write", "atomic replacement")])),
    ("03 / CLOSE",   "WezTerm closes", ("pills", [("exit · keeps record", CREAM, INK), ("/quit · removes", INK, CREAM)])),
    ("04 / REOPEN",  "pi-reopen",      ("pills", [("preflight", CREAM, INK), ("dedupe", INK, CREAM), ("launch tabs", VIOLET, CREAM)])),
    ("05 / TABS",    "WezTerm tabs",   ("check", "RESTORED", "cwd + conversation")),
]
CARDS_ZH = [
    ("01 / 启动",   "Pi 启动",        ("box",   ["扩展实时登记", "每会话一个文件"])),
    ("02 / 记录",   "members/",       ("lines", [("文件", "每会话一个"), ("写入", "原子替换")])),
    ("03 / 关闭",   "WezTerm 关闭",   ("pills", [("退出 · 保留记录", CREAM, INK), ("/quit · 删除", INK, CREAM)])),
    ("04 / 重开",   "pi-reopen",      ("pills", [("预检", CREAM, INK), ("去重", INK, CREAM), ("启动标签页", VIOLET, CREAM)])),
    ("05 / 标签页", "WezTerm 标签页", ("check", "已恢复", "原目录 + 原对话")),
]
CARD_BG   = [DARK, LAV, MINT, BLUE, AMBER]
CARD_EYEB = [MINT, PURPLE, TEAL_D, BLUE_D, GOLD_D]
CARD_TITLE= [CREAM, LAV_INK, INK, INK, INK]

NW, NH, GAP = 256, 318, 40
X0 = (W - (5 * NW + 4 * GAP)) // 2
Y0 = 235

def render(cards, header_eyebrow, header_title, out, zh):
    F_EYEB = sc("Regular", 15) if zh else sm(False, 14)
    F_HEAD = sc("Bold", 40) if zh else sg(700, 44)
    F_TITLE = sc("Bold", 27) if zh else sg(700, 27)
    F_BOX  = sc("Regular", 17) if zh else sg(400, 17)
    F_LBL  = sc("Bold", 18) if zh else sg(700, 18)
    F_VAL  = sc("Regular", 17) if zh else sg(400, 17)
    F_PILL = sc("Regular", 16) if zh else sm(False, 16)
    F_CHK  = sc("Bold", 17) if zh else sg(700, 17)
    F_SUBS = sc("Regular", 12) if zh else sm(False, 12)

    img = Image.new("RGB", (W * S, H * S), BG)
    d = ImageDraw.Draw(img)
    step = 44
    for x in range(step, W, step):
        d.line([s(x), 0, s(x), s(H)], fill=GRID, width=1)
    for y in range(step, H, step):
        d.line([s(0), s(y), s(W), s(y)], fill=GRID, width=1)
    d.rounded_rectangle([s(8), s(8), s(W - 8), s(H - 8)], radius=s(16), outline=BORDER, width=2)

    # header
    text_ls(d, 80, 62, header_eyebrow, F_EYEB, EYEBROW + (255,), 3.5 if not zh else 2)
    d.rounded_rectangle([s(80), s(100), s(136), s(105)], radius=s(2.5), fill=CORAL)
    d.text((s(80), s(124)), header_title, font=F_HEAD, fill=INK + (255,))

    MID = Y0 + NH / 2
    for i, (eyebrow, title, body) in enumerate(cards):
        x0 = X0 + i * (NW + GAP)
        x1 = x0 + NW
        bg, c_eyeb, c_title = CARD_BG[i], CARD_EYEB[i], CARD_TITLE[i]

        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh)
        sd.rounded_rectangle([s(x0), s(Y0 + 10), s(x1), s(Y0 + NH + 14)], radius=s(22), fill=(120, 108, 88, 70))
        sh = sh.filter(ImageFilter.GaussianBlur(s(16)))
        img = Image.alpha_composite(img.convert("RGBA"), sh).convert("RGB")
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([s(x0), s(Y0), s(x1), s(Y0 + NH)], radius=s(22), fill=bg + (255,))

        text_ls(d, x0 + 24, Y0 + 26, eyebrow, F_EYEB, c_eyeb + (255,), 2.5 if not zh else 1.5)
        lines = wrap(d, title, F_TITLE, NW - 48)
        ty = Y0 + 58
        for ln in lines:
            d.text((s(x0 + 24), s(ty)), ln, font=F_TITLE, fill=c_title + (255,))
            ty += 36

        # content area
        top, bot = Y0 + 58 + len(lines) * 36 + 18, Y0 + NH - 26
        kind = body[0]
        if kind == "box":
            bh = 104
            by = top + (bot - top - bh) / 2
            d.rounded_rectangle([s(x0 + 20), s(by), s(x1 - 20), s(by + bh)], radius=s(12),
                                fill=(DARK_IN if bg == DARK else CREAM_I) + (255,))
            fy = MUTED_D if bg == DARK else (GOLD_SUB)
            a, de = F_BOX.getmetrics()
            lh = (a + de) / S
            lh_total = lh * len(body[1]) + 13 * (len(body[1]) - 1)
            sy = by + (bh - lh_total) / 2
            for ln in body[1]:
                lw = d.textlength(ln, font=F_BOX) / S
                d.text((s(x0 + 20 + (NW - 40 - lw) / 2), s(sy)), ln, font=F_BOX, fill=fy + (255,))
                sy += lh + 13
            if bg == DARK:
                d.ellipse([s(x1 - 32), s(Y0 + NH - 30), s(x1 - 23), s(Y0 + NH - 21)], fill=MINT + (255,))
        elif kind == "lines":
            lh = 40
            sy = top + (bot - top - lh * len(body[1]) + 16) / 2
            for label, val in body[1]:
                d.text((s(x0 + 24), s(sy)), label, font=F_LBL, fill=PURPLE + (255,))
                d.text((s(x0 + (78 if zh else 80)), s(sy)), val, font=F_VAL, fill=LAV_SUB + (255,))
                sy += lh
        elif kind == "pills":
            ph, pgap = 42, 12
            py = top + (bot - top - (ph * len(body[1]) + pgap * (len(body[1]) - 1))) / 2
            a, de = F_PILL.getmetrics()
            for txt, pbg, pfg in body[1]:
                d.rounded_rectangle([s(x0 + 20), s(py), s(x1 - 20), s(py + ph)], radius=s(10), fill=pbg + (255,))
                tw = d.textlength(txt, font=F_PILL) / S
                ty = py + (ph - (a + de) / S) / 2
                d.text((s(x0 + 20 + (NW - 40 - tw) / 2), s(ty)), txt, font=F_PILL, fill=pfg + (255,))
                py += ph + pgap
        elif kind == "check":
            bh = 108
            by = top + (bot - top - bh) / 2
            d.rounded_rectangle([s(x0 + 20), s(by), s(x1 - 20), s(by + bh)], radius=s(12), fill=CREAM_I + (255,))
            cx, cy = x0 + 62, by + bh / 2
            d.ellipse([s(cx - 22), s(cy - 22), s(cx + 22), s(cy + 22)], fill=INK + (255,))
            c0, c1, c2 = (cx - 10.5, cy + 0.5), (cx - 3, cy + 8), (cx + 11, cy - 7.5)
            d.line([s(c0[0]), s(c0[1]), s(c1[0]), s(c1[1])], fill=MINT + (255,), width=s(5))
            d.line([s(c1[0]), s(c1[1]), s(c2[0]), s(c2[1])], fill=MINT + (255,), width=s(5))
            for (px, py2) in (c0, c1, c2):
                d.ellipse([s(px - 2.5), s(py2 - 2.5), s(px + 2.5), s(py2 + 2.5)], fill=MINT + (255,))
            a1, d1 = F_CHK.getmetrics()
            a2, d2 = F_SUBS.getmetrics()
            lh1, lh2 = (a1 + d1) / S, (a2 + d2) / S
            t1 = by + (bh - (lh1 + 8 + lh2)) / 2
            d.text((s(x0 + 96), s(t1)), body[1], font=F_CHK, fill=INK + (255,))
            d.text((s(x0 + 96), s(t1 + lh1 + 8)), body[2], font=F_SUBS, fill=GOLD_SUB + (255,))

        if i < 4:
            d.rounded_rectangle([s(x1 + 12), s(MID - 1.5), s(x1 + GAP - 12), s(MID + 1.5)], radius=s(1.5), fill=SLATE + (255,))

    img = img.convert("RGB").resize((W, H), Image.LANCZOS)
    img.save(out, optimize=True)
    print("saved", out, img.size)

render(CARDS_EN, "A SAFE PATH BACK TO EVERY OPEN SESSION",
       "One command. Every tab back where it left off.", base + "how-it-works.png", zh=False)
render(CARDS_ZH, "关闭终端，工作不中断",
       "一条命令，所有标签页原样恢复", base + "how-it-works.zh.png", zh=True)
