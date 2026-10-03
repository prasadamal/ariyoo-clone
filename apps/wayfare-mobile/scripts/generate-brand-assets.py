#!/usr/bin/env python3
"""Generates Wayfare's icon set.

  icon.png                 1024x1024 RGB, opaque (App Store rejects icons with an alpha channel)
  adaptive-icon.png        Android adaptive foreground: transparent, mark inside the 66% safe zone
  splash-icon.png          Transparent logo shown centred on the splash background
  notification-icon.png    96x96 white-on-transparent glyph (Android status bar / foreground service)
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
BG = (28, 25, 23)
PRIMARY = (194, 65, 12)
SAND = (250, 250, 249)


def draw_mark(size: int, bg=None, scale: float = 1.0, mono=None) -> Image.Image:
    """Mountain-over-trail mark. `scale` shrinks it inside the canvas; `mono` forces one colour."""
    img = Image.new("RGBA", (size, size), (bg + (255,)) if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = size / 2

    def p(x: float, y: float):
        return (c + (x - 0.5) * size * scale, c + (y - 0.5) * size * scale)

    trail = (mono or PRIMARY) + (255,)
    peak = (mono or SAND) + (255,)
    w = 0.12
    r = int(w * size * scale / 2)
    d.rounded_rectangle((*p(0.2, 0.55), *p(0.8, 0.55 + w)), radius=r, fill=trail)
    d.polygon([p(0.35, 0.55), p(0.5, 0.28), p(0.65, 0.55)], fill=peak)
    return img


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    draw_mark(1024, bg=BG).convert("RGB").save(ASSETS / "icon.png")
    draw_mark(1024, scale=0.82).save(ASSETS / "adaptive-icon.png")
    draw_mark(1024).save(ASSETS / "splash-icon.png")
    draw_mark(96, mono=(255, 255, 255), scale=1.15).save(ASSETS / "notification-icon.png")
    print("Wrote", ASSETS)


if __name__ == "__main__":
    main()
