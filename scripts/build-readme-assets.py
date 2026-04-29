#!/usr/bin/env python3
"""Cocito · gera os assets visuais do README (hero, mock da janela, palette de temas).

Sem dependências externas além da Pillow. As fontes vêm do macOS para o título
serif italic — coerente com o brand."""

from PIL import Image, ImageDraw, ImageFilter
from PIL import ImageFont
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / ".github" / "assets"
OUT.mkdir(parents=True, exist_ok=True)

# ─── Paleta cocito ───────────────────────────────────────────────────────────
BG_TOP = (5, 10, 24)        # #050a18
BG_BOTTOM = (14, 24, 40)    # #0e1828
SURFACE = (14, 24, 40)
SURFACE_2 = (26, 42, 68)
TEXT = (232, 240, 255)
TEXT_DIM = (107, 133, 176)
ACCENT = (77, 158, 255)
BORDER = (40, 56, 88)

SERIF_ITALIC = "/System/Library/Fonts/NewYorkItalic.ttf"
SERIF = "/System/Library/Fonts/NewYork.ttf"
SF = "/System/Library/Fonts/SFNS.ttf"
SF_BOLD = "/System/Library/Fonts/SFNS.ttf"


def gradient(w: int, h: int, top, bottom) -> Image.Image:
    img = Image.new("RGB", (w, h), top)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (w, y)], fill=c)
    return img


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def text_centered(d: ImageDraw.ImageDraw, xy, text, fnt, fill):
    bbox = d.textbbox((0, 0), text, font=fnt)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    cx, cy = xy
    d.text((cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1]), text, font=fnt, fill=fill)


# ─── 1. Hero banner (1280×640 — para o topo do README) ──────────────────────
def render_hero():
    W, H = 1280, 640
    img = gradient(W, H, BG_TOP, BG_BOTTOM)
    d = ImageDraw.Draw(img)

    # Halo accent atrás do título — cria com gaussian blur de um círculo accent
    halo = Image.new("RGB", (W, H), BG_TOP)
    hd = ImageDraw.Draw(halo)
    hd.ellipse((W // 2 - 280, H // 2 - 200, W // 2 + 280, H // 2 + 200), fill=(20, 50, 110))
    halo = halo.filter(ImageFilter.GaussianBlur(radius=80))
    img = Image.blend(img, halo, 0.55)
    d = ImageDraw.Draw(img)

    # Título "Cocito"
    title_font = font(SERIF_ITALIC, 168)
    text_centered(d, (W // 2, H // 2 - 70), "Cocito", title_font, TEXT)

    # Tagline em PT
    tagline_font = font(SF, 28)
    text_centered(
        d, (W // 2, H // 2 + 60),
        "Hub de comunicação desktop. Local-first. Zero backend.",
        tagline_font, TEXT_DIM,
    )

    # Sub-tagline IT (assinatura literária)
    sub_font = font(SERIF_ITALIC, 22)
    text_centered(d, (W // 2, H // 2 + 100), "il nono cerchio", sub_font, ACCENT)

    # Ícones dos serviços empilhados (linha discreta no fundo)
    icon_y = H - 80
    icon_size = 36
    services = [
        ("Gmail",    (234, 67, 53)),
        ("Outlook",  (0, 120, 212)),
        ("Slack",    (97, 31, 105)),
        ("Teams",    (80, 89, 201)),
        ("Meet",     (0, 137, 123)),
        ("Chat",     (0, 172, 71)),
        ("WhatsApp", (37, 211, 102)),
        ("Telegram", (0, 136, 204)),
        ("Discord",  (88, 101, 242)),
        ("LinkedIn", (10, 102, 194)),
        ("X",        (40, 40, 40)),
    ]
    total_w = len(services) * icon_size + (len(services) - 1) * 14
    start_x = (W - total_w) // 2
    for i, (_, color) in enumerate(services):
        x = start_x + i * (icon_size + 14)
        d.rounded_rectangle(
            (x, icon_y - icon_size // 2, x + icon_size, icon_y + icon_size // 2),
            radius=8, fill=color,
        )

    # Caption sob a linha de ícones
    caption_font = font(SF, 14)
    text_centered(d, (W // 2, icon_y + 42),
                  "Email · Mensageria · Reuniões · DMs — cada um na sua bolgia.",
                  caption_font, TEXT_DIM)

    img.save(OUT / "hero.png", "PNG", optimize=True)
    print(f"  → {OUT / 'hero.png'}  ({W}×{H})")


# ─── 2. Mock da janela com sidebar (1100×680) ──────────────────────────────
def render_window_mock():
    W, H = 1100, 680
    canvas = gradient(W, H, BG_TOP, BG_BOTTOM)
    d = ImageDraw.Draw(canvas)

    pad = 20
    win_x, win_y = pad, pad
    win_w, win_h = W - pad * 2, H - pad * 2

    # Sombra da janela
    shadow = Image.new("RGBA", (win_w + 80, win_h + 80), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((40, 40, win_w + 40, win_h + 40),
                         radius=14, fill=(0, 0, 0, 180))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=24))
    canvas.paste(shadow, (win_x - 40, win_y - 40), shadow)
    d = ImageDraw.Draw(canvas)

    # Janela base
    d.rounded_rectangle((win_x, win_y, win_x + win_w, win_y + win_h),
                        radius=14, fill=SURFACE, outline=BORDER, width=1)

    # ─── Title bar com traffic lights ─────────────────────────────────────
    tb_h = 36
    d.rounded_rectangle((win_x, win_y, win_x + win_w, win_y + tb_h),
                        radius=14, fill=(8, 16, 30))
    # Pinta a parte de baixo da titlebar como retângulo (para esconder o radius bottom)
    d.rectangle((win_x, win_y + tb_h - 14, win_x + win_w, win_y + tb_h),
                fill=(8, 16, 30))
    # Traffic lights
    for i, color in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        cx = win_x + 22 + i * 20
        cy = win_y + tb_h // 2
        d.ellipse((cx - 6, cy - 6, cx + 6, cy + 6), fill=color)

    # ─── Sidebar ─────────────────────────────────────────────────────────
    sb_w = 72
    sb_x = win_x
    sb_y = win_y + tb_h
    sb_h = win_h - tb_h
    d.rectangle((sb_x, sb_y, sb_x + sb_w, sb_y + sb_h), fill=(10, 18, 32))
    # Linha divisória sidebar/main
    d.line([(sb_x + sb_w, sb_y), (sb_x + sb_w, sb_y + sb_h)], fill=BORDER, width=1)

    # Ícones na sidebar (5 serviços fictícios)
    sidebar_services = [
        ("Gmail",   (234, 67, 53),  None,   True),  # active
        ("Slack-W", (97, 31, 105),  3,      False),
        ("Slack-P", (97, 31, 105),  None,   False),
        ("WhatsApp",(37, 211, 102), 12,     False),
        ("Meet",    (0, 137, 123),  None,   False),
        ("LinkedIn",(10, 102, 194), None,   False),
    ]
    icon_size = 40
    gap = 14
    start_y = sb_y + 18
    for i, (_, color, badge, active) in enumerate(sidebar_services):
        ix = sb_x + (sb_w - icon_size) // 2
        iy = start_y + i * (icon_size + gap)
        # Indicador de active (barra à esquerda)
        if active:
            d.rounded_rectangle((sb_x + 2, iy + 6, sb_x + 5, iy + icon_size - 6),
                                radius=2, fill=ACCENT)
        d.rounded_rectangle((ix, iy, ix + icon_size, iy + icon_size),
                            radius=10, fill=color)
        # Badge
        if badge:
            bs = 18
            bx = ix + icon_size - bs + 4
            by = iy - 4
            d.ellipse((bx, by, bx + bs, by + bs), fill=ACCENT)
            f = font(SF, 10)
            text_centered(d, (bx + bs // 2, by + bs // 2 + 1),
                          str(badge), f, (255, 255, 255))

    # ─── Main: pseudo-WebView (gmail-like) ────────────────────────────────
    main_x = sb_x + sb_w + 1
    main_y = sb_y
    main_w = win_w - sb_w - 1
    d.rectangle((main_x, main_y, main_x + main_w, main_y + win_h - tb_h),
                fill=(248, 248, 252))

    # Header da pseudo-app (faixa vermelha Gmail)
    d.rectangle((main_x, main_y, main_x + main_w, main_y + 56),
                fill=(248, 232, 230))
    d.rounded_rectangle((main_x + 24, main_y + 14, main_x + 60, main_y + 50),
                        radius=8, fill=(234, 67, 53))
    f_brand = font(SF, 16)
    d.text((main_x + 76, main_y + 22), "Inbox · 24 unread",
           font=f_brand, fill=(60, 60, 80))

    # Lista de emails (linhas alternadas)
    list_x = main_x + 24
    list_y = main_y + 80
    row_h = 56
    rows = [
        ("Sample Newsletter",    "Weekly digest · 12 highlights",          True),
        ("Acme HR",              "Reminder: timesheet due Friday",        True),
        ("GitHub",               "[fagnercandido/cocito] PR #42 merged",   False),
        ("Ollama Updates",       "qwen3:32b now supports tool use",       False),
        ("Calendar",             "Standup · today 10:00 — tomorrow",      False),
        ("LinkedIn Notifs",      "3 connections viewed your profile",     False),
        ("Stripe",               "Receipt for your subscription",         False),
        ("Apple",                "Your invoice from the App Store",       False),
    ]
    f_subj = font(SF, 13)
    f_body = font(SF, 11)
    for i, (subj, body, unread) in enumerate(rows):
        ry = list_y + i * row_h
        if unread:
            d.rectangle((list_x - 8, ry, list_x - 4, ry + row_h - 12),
                        fill=ACCENT)
        # Avatar circle
        avatar_color = (200, 200, 220) if not unread else (60, 80, 120)
        d.ellipse((list_x, ry, list_x + 32, ry + 32), fill=avatar_color)
        # Texto
        d.text((list_x + 48, ry),
               subj, font=f_subj,
               fill=(30, 30, 50) if unread else (90, 90, 120))
        d.text((list_x + 48, ry + 20),
               body, font=f_body,
               fill=(80, 80, 100) if unread else (140, 140, 160))
        # Hora
        d.text((main_x + main_w - 80, ry + 4),
               ["12:34", "11:08", "9:42", "Yest.", "Yest.", "Wed", "Mon", "Mon"][i],
               font=f_body, fill=(160, 160, 180))

    canvas.save(OUT / "window-mock.png", "PNG", optimize=True)
    print(f"  → {OUT / 'window-mock.png'}  ({W}×{H})")


# ─── 3. Palette dos 9 temas (1280×220) ──────────────────────────────────────
def render_themes():
    THEMES = [
        ("Cocito",      (5, 10, 24),    (77, 158, 255)),
        ("Crepuscolo",  (238, 244, 255),(0, 102, 238)),
        ("Bufera",      (243, 230, 204),(200, 84, 30)),
        ("Autunno",     (26, 18, 8),    (255, 138, 58)),
        ("Stige",       (26, 6, 18),    (255, 42, 92)),
        ("Oro",         (24, 18, 10),   (238, 140, 32)),
        ("Ferro",       (238, 232, 238),(200, 0, 58)),
        ("Flegetonte",  (24, 6, 6),     (255, 80, 60)),
        ("Malebolge",   (10, 10, 10),   (140, 100, 220)),
    ]
    W, H = 1280, 220
    canvas = Image.new("RGB", (W, H), (12, 14, 22))
    d = ImageDraw.Draw(canvas)

    margin = 24
    gap = 12
    swatch_w = (W - margin * 2 - gap * (len(THEMES) - 1)) // len(THEMES)
    swatch_h = H - margin * 2 - 30

    for i, (name, bg, accent) in enumerate(THEMES):
        x = margin + i * (swatch_w + gap)
        y = margin
        # Fundo
        d.rounded_rectangle((x, y, x + swatch_w, y + swatch_h),
                            radius=12, fill=bg, outline=BORDER, width=1)
        # Accent stripe no fundo do swatch
        d.rounded_rectangle((x, y + swatch_h - 8, x + swatch_w, y + swatch_h),
                            radius=4, fill=accent)
        # Pequeno glyph "C" no swatch
        text_color = TEXT if sum(bg) < 380 else (10, 10, 30)
        f_glyph = font(SERIF_ITALIC, 56)
        text_centered(d, (x + swatch_w // 2, y + swatch_h // 2 - 4),
                      "C", f_glyph, text_color)
        # Label
        f_label = font(SF, 12)
        text_centered(d, (x + swatch_w // 2, swatch_h + margin + 14),
                      name, f_label, TEXT_DIM)

    canvas.save(OUT / "themes.png", "PNG", optimize=True)
    print(f"  → {OUT / 'themes.png'}  ({W}×{H})")


if __name__ == "__main__":
    print("Cocito · README assets")
    render_hero()
    render_window_mock()
    render_themes()
