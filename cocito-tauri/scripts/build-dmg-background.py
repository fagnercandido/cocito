#!/usr/bin/env python3
"""Cocito · gera o background do .dmg em @1x e @2x.

Paleta cocito (themes.html): bg #050a18, surface #0e1828, accent #4d9eff,
text #e8f0ff, text-dim #6b85b0. Tipografia: serif italic (assinatura).
Layout: título italic em cima · espaço para .app à esquerda e Aplicações à
direita · seta subtil entre os dois.
"""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src-tauri" / "dmg"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 540, 380

BG_TOP = (5, 10, 24)
BG_BOTTOM = (14, 24, 40)
TEXT = (232, 240, 255)
TEXT_DIM = (107, 133, 176)
ACCENT = (77, 158, 255)

SERIF_ITALIC = "/System/Library/Fonts/NewYorkItalic.ttf"
SF = "/System/Library/Fonts/SFNS.ttf"


def render(scale: int, path: Path) -> None:
    w, h = W * scale, H * scale
    img = Image.new("RGB", (w, h), BG_TOP)
    draw = ImageDraw.Draw(img)

    for y in range(h):
        t = y / (h - 1)
        r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
        g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
        b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    title = "Cocito"
    title_font = ImageFont.truetype(SERIF_ITALIC, 56 * scale)
    bbox = draw.textbbox((0, 0), title, font=title_font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (w - tw) // 2 - bbox[0]
    ty = 36 * scale - bbox[1]
    draw.text((tx, ty), title, font=title_font, fill=TEXT)

    arrow_y = (H // 2 + 20) * scale
    arrow_start_x = int(W * 0.40) * scale
    arrow_end_x = int(W * 0.60) * scale
    line_w = max(1, scale)
    draw.line(
        [(arrow_start_x, arrow_y), (arrow_end_x, arrow_y)],
        fill=ACCENT,
        width=line_w,
    )
    head = 7 * scale
    draw.polygon(
        [
            (arrow_end_x, arrow_y),
            (arrow_end_x - head, arrow_y - head // 2),
            (arrow_end_x - head, arrow_y + head // 2),
        ],
        fill=ACCENT,
    )

    hint = "Arrasta para Aplicações"
    hint_font = ImageFont.truetype(SF, 11 * scale)
    bbox = draw.textbbox((0, 0), hint, font=hint_font)
    hw = bbox[2] - bbox[0]
    hx = (w - hw) // 2 - bbox[0]
    hy = arrow_y + 18 * scale
    draw.text((hx, hy), hint, font=hint_font, fill=TEXT_DIM)

    img.save(path, "PNG", optimize=True)
    print(f"  → {path}  ({w}×{h})")


if __name__ == "__main__":
    print("Cocito · DMG background")
    render(1, OUT / "background.png")
    render(2, OUT / "background@2x.png")
