#!/usr/bin/env python3
"""Generate Ariyoo app icon, adaptive icon, and splash assets."""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
BG = (15, 23, 42)  # slate-900
ACCENT = (56, 189, 248)  # sky-400
WHITE = (248, 250, 252)


def draw_mark(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), BG + (255,))
    draw = ImageDraw.Draw(img)
    margin = size * 0.18
    draw.rounded_rectangle(
        (margin, margin, size - margin, size - margin),
        radius=size * 0.22,
        fill=ACCENT + (255,),
    )
    inner = size * 0.34
    draw.ellipse(
        (size / 2 - inner / 2, size / 2 - inner / 2, size / 2 + inner / 2, size / 2 + inner / 2),
        fill=WHITE + (255,),
    )
    return img


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    icon = draw_mark(1024)
    icon.save(ASSETS / "icon.png")
    icon.save(ASSETS / "adaptive-icon.png")
    splash = Image.new("RGBA", (1284, 2778), BG + (255,))
    mark = draw_mark(420)
    splash.paste(mark, ((1284 - 420) // 2, (2778 - 420) // 2), mark)
    splash.save(ASSETS / "splash.png")
    favicon = draw_mark(48)
    favicon.save(ASSETS / "favicon.png")
    print(f"Wrote assets to {ASSETS}")


if __name__ == "__main__":
    main()
