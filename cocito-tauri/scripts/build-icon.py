#!/usr/bin/env python3
# Gera o ícone-fonte do Cocito (1024x1024) — placa de gelo num lago.
# Invariante #7 do CLAUDE.md: Dante invisível, sem chamas/demónios; lago gelado.
# Inferno XXXII: "vidi un lago che per gelo / avea di vetro e non d'acqua sembiante".
# Estilo: iconográfico (não fotorealista) — placa de gelo central com fissuras
# sobre fundo de água profunda. Paleta do tema cocito (dark default).
#
# Uso:  python3 scripts/build-icon.py
# Saída: scripts/icon-source.png  (alimenta `pnpm tauri icon`)

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
OUT = Path(__file__).parent / "icon-source.png"


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


# Paleta — coerente com o tema cocito.
WATER_DEEP = hex_rgb("#050a18")
WATER_MID = hex_rgb("#0e1828")
WATER_RIM = hex_rgb("#16243c")
ICE_BASE = hex_rgb("#7ea4d4")
ICE_LIGHT = hex_rgb("#cde0f5")
ICE_HIGHLIGHT = hex_rgb("#f0f6ff")
CRACK_DARK = hex_rgb("#2a3a5c")  # fissura: escura sobre o gelo (água por baixo)


def squircle_mask(size: int, radius_ratio: float = 0.224) -> Image.Image:
    """Máscara alpha do squircle macOS Big Sur."""
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    r = int(size * radius_ratio)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=255)
    return mask


def water_background(size: int) -> Image.Image:
    """Fundo: água profunda — gradient muito subtil top→bottom."""
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    t = (y / size) ** 1.1

    def lerp(a, b, t):
        return a[None, None, :] + (b[None, None, :] - a[None, None, :]) * t[..., None]

    arr = lerp(np.array(WATER_RIM, dtype=np.float32),
               np.array(WATER_DEEP, dtype=np.float32), t)
    arr = arr.astype(np.uint8)
    rgba = np.dstack([arr, np.full((size, size), 255, dtype=np.uint8)])
    return Image.fromarray(rgba, "RGBA")


def ice_disk(size: int) -> Image.Image:
    """Placa de gelo central — forma orgânica com gradient interno."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Forma da placa: polígono com 14 vértices, raio variável (orgânico mas estável).
    rng = np.random.default_rng(42)
    cx = cy = size / 2
    n_verts = 14
    base_r = size * 0.36
    pts = []
    for i in range(n_verts):
        ang = 2 * math.pi * i / n_verts
        r = base_r * rng.uniform(0.92, 1.06)
        pts.append((cx + math.cos(ang) * r, cy + math.sin(ang) * r))

    # Máscara da placa.
    plate_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(plate_mask).polygon(pts, fill=255)
    # Suavizar bordas (não vidro afiado).
    plate_mask = plate_mask.filter(ImageFilter.GaussianBlur(size * 0.012))

    # Gelo: gradient radial dentro da placa — claro descentrado (luz top-left).
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    light_cx, light_cy = size * 0.42, size * 0.40
    dist = np.sqrt((x - light_cx) ** 2 + (y - light_cy) ** 2) / (size * 0.45)
    dist = np.clip(dist, 0, 1)
    t1 = dist ** 1.3

    def lerp(a, b, t):
        return a[None, None, :] + (b[None, None, :] - a[None, None, :]) * t[..., None]

    ice = lerp(np.array(ICE_HIGHLIGHT, dtype=np.float32),
               np.array(ICE_BASE, dtype=np.float32), t1)
    ice = np.clip(ice, 0, 255).astype(np.uint8)
    ice_rgba = np.dstack([ice, np.full((size, size), 255, dtype=np.uint8)])
    ice_img = Image.fromarray(ice_rgba, "RGBA")

    # Aplica máscara da placa.
    img.paste(ice_img, (0, 0), plate_mask)

    # Halo subtil ao redor (gelo a refletir na água).
    halo_mask = plate_mask.filter(ImageFilter.GaussianBlur(size * 0.025))
    halo = Image.new("RGBA", (size, size), ICE_LIGHT + (40,))
    halo.putalpha(halo_mask.point(lambda p: int(p * 0.18)))
    composite = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    composite.alpha_composite(halo)
    composite.alpha_composite(img)
    return composite


def add_cracks(img: Image.Image, plate_polygon_size: float, seed: int = 7) -> None:
    """Fissuras — linhas escuras (água por baixo) sobre o gelo claro.
    Saem de perto do centro com bifurcações; param dentro da placa."""
    rng = np.random.default_rng(seed)
    cx = cy = SIZE / 2
    overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")

    def crack_path(start, angle, length, n_segs=5):
        pts = [start]
        a = angle
        x, y = start
        seg = length / n_segs
        for _ in range(n_segs):
            a += rng.uniform(-0.12, 0.12)
            x += math.cos(a) * seg
            y += math.sin(a) * seg
            pts.append((x, y))
        return pts

    def draw_path(pts, base_alpha, base_width):
        for i in range(len(pts) - 1):
            t = i / max(1, len(pts) - 2)
            w = max(1, base_width * (1.0 - t * 0.5))
            a = int(base_alpha * (1.0 - t * 0.35))
            draw.line(
                (pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]),
                fill=CRACK_DARK + (a,),
                width=int(w),
            )

    # 4 fissuras principais — ângulos com jitter para não parecer cruz/asterisco.
    n_main = 4
    base_angles = np.linspace(0, 2 * math.pi, n_main, endpoint=False)
    base_angles += rng.uniform(-0.5, 0.5, n_main)
    for ang in base_angles:
        ox = cx + math.cos(ang + math.pi) * SIZE * 0.025
        oy = cy + math.sin(ang + math.pi) * SIZE * 0.025
        length = plate_polygon_size * rng.uniform(0.78, 0.92)
        pts = crack_path((ox, oy), ang, length)
        draw_path(pts, base_alpha=190, base_width=4)

        # Bifurcação a meio.
        mid_idx = len(pts) // 2
        mid = pts[mid_idx]
        bang = ang + rng.choice([-1, 1]) * rng.uniform(0.55, 1.0)
        bpts = crack_path(mid, bang, plate_polygon_size * rng.uniform(0.18, 0.30))
        draw_path(bpts, base_alpha=130, base_width=2)

    overlay = overlay.filter(ImageFilter.GaussianBlur(0.6))
    img.alpha_composite(overlay)


def add_top_sheen(img: Image.Image) -> None:
    """Brilho subtil na borda superior da placa — luz direccional natural."""
    overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    cx = SIZE * 0.42
    cy = SIZE * 0.34
    rx = SIZE * 0.20
    ry = SIZE * 0.06
    for k in range(5):
        a = 22 - k * 4
        if a <= 0:
            break
        draw.ellipse(
            (cx - rx - k * 4, cy - ry - k * 2, cx + rx + k * 4, cy + ry + k * 2),
            fill=(255, 255, 255, a),
        )
    overlay = overlay.filter(ImageFilter.GaussianBlur(SIZE * 0.025))
    img.alpha_composite(overlay)


def main() -> None:
    base = water_background(SIZE)
    plate = ice_disk(SIZE)
    base.alpha_composite(plate)
    add_cracks(base, plate_polygon_size=SIZE * 0.36, seed=9)
    add_top_sheen(base)

    # Recorta no squircle.
    mask = squircle_mask(SIZE)
    final = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    final.paste(base, (0, 0), mask)

    final.save(OUT, "PNG", optimize=True)
    print(f"escrito {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
