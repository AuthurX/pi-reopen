#!/usr/bin/env python3
"""Generate assets/how-it-works.png (EN) and how-it-works.zh.png (ZH) for the README."""
from PIL import Image, ImageDraw, ImageFilter, ImageFont

S = 2
W, H = 1600, 640

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

F_MAIN = sc("Medium", 30)
F_SUB  = sc("Regular", 21)
F_NUM  = sc("Regular", 20)

BG_TOP    = (13, 19, 27)
BG_BOT    = (5, 8, 12)
NODE      = (21, 31, 45)
NODE_EDGE = (34, 48, 65)
GRID      = (255, 255, 255, 7)
TXT       = (218, 231, 242)
TXT_DIM   = (122, 140, 160)
GREEN     = (91, 228, 155)
CYAN      = (107, 213, 225)
AMBER     = (232, 196, 104)
ARROW     = (90, 110, 130)

def s(v):
    return int(round(v * S))

NODES_EN = [
    ("Pi starts",      ["extension registers it", "in real time"],                    CYAN),
    ("members/",       ["one file per session,", "written atomically"],              GREEN),
    ("WezTerm closes", ["signal exit keeps record", "/quit removes it"],             AMBER),
    ("pi-reopen",      ["preflight, dedupe,", "launches tabs"],                      GREEN),
    ("WezTerm tabs",   ["cwd + conversation,", "waits for input"],                  GREEN),
]
NODES_ZH = [
    ("Pi 启动",        ["扩展实时登记"],                                            CYAN),
    ("members/",       ["每会话一文件", "原子落盘"],                                GREEN),
    ("WezTerm 关闭",   ["信号退出保留记录", "/quit 删除"],                          AMBER),
    ("pi-reopen",      ["预检 → 去重 → 启动"],                                      GREEN),
    ("新标签页",       ["原目录 + 原对话", "等待输入"],                              GREEN),
]

NW, NH, GAP = 272, 240, 48
X0 = (W - (5 * NW + 4 * GAP)) // 2
Y0 = (H - NH) // 2 + 10
MID = Y0 + NH / 2

def render(nodes, out):
    img = Image.new("RGB", (W * S, H * S), BG_TOP)
    px = img.load()
    for y in range(H * S):
        t = y / (H * S)
        r = int(BG_TOP[0] + (BG_BOT[0] - BG_TOP[0]) * t)
        g = int(BG_TOP[1] + (BG_BOT[1] - BG_TOP[1]) * t)
        b = int(BG_TOP[2] + (BG_BOT[2] - BG_TOP[2]) * t)
        for x in range(W * S):
            px[x, y] = (r, g, b)

    # faint grid
    grid = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    step = 44
    for x in range(0, W + 1, step):
        gd.line([s(x), 0, s(x), s(H)], fill=GRID, width=1)
    for y in range(0, H + 1, step):
        gd.line([s(0), s(y), s(W), s(y)], fill=GRID, width=1)
    img = Image.alpha_composite(img.convert("RGBA"), grid).convert("RGB")
    d = ImageDraw.Draw(img)

    for i, (main, subs, color) in enumerate(nodes):
        x0, x1 = X0 + i * (NW + GAP), X0 + i * (NW + GAP) + NW
        # node shadow
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh)
        sd.rounded_rectangle([s(x0), s(Y0 + 10), s(x1), s(Y0 + NH + 16)], radius=s(14), fill=(0, 0, 0, 90))
        sh = sh.filter(ImageFilter.GaussianBlur(s(18)))
        img = Image.alpha_composite(img.convert("RGBA"), sh).convert("RGB")
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([s(x0), s(Y0), s(x1), s(Y0 + NH)], radius=s(14), fill=NODE + (255,), outline=color + (255,), width=s(1.5))

        # step number
        num = f"{i + 1}"
        d.text((s(x1 - 18 - d.textlength(num, font=F_NUM) / S), s(Y0 + 14)), num, font=F_NUM, fill=TXT_DIM + (255,))

        # main label
        mw = d.textlength(main, font=F_MAIN) / S
        d.text((s(x0 + (NW - mw) / 2), s(Y0 + 56)), main, font=F_MAIN, fill=TXT + (255,))

        # accent underline
        uw = min(mw, NW - 40)
        d.line([s(x0 + (NW - uw) / 2), s(Y0 + 104), s(x0 + (NW + uw) / 2), s(Y0 + 104)], fill=color + (255,), width=s(1.5))

        # sub lines (vertically centered below underline)
        lh = 32
        sy = Y0 + 126
        for line in subs:
            lw = d.textlength(line, font=F_SUB) / S
            d.text((s(x0 + (NW - lw) / 2), s(sy)), line, font=F_SUB, fill=TXT_DIM + (255,))
            sy += lh

        # arrow to next node
        if i < 4:
            ax0, ax1 = x1 + 7, x1 + GAP - 7
            d.line([s(ax0), s(MID), s(ax1 - 10), s(MID)], fill=ARROW + (255,), width=s(2.5))
            d.polygon([(s(ax1), s(MID)), (s(ax1 - 11), s(MID - 7)), (s(ax1 - 11), s(MID + 7))], fill=ARROW + (255,))

    img = img.convert("RGB").resize((W, H), Image.LANCZOS)
    img.save(out, optimize=True)
    print("saved", out, img.size)

base = __file__.rsplit("/", 1)[0] + "/"
render(NODES_EN, base + "how-it-works.png")
render(NODES_ZH, base + "how-it-works.zh.png")
