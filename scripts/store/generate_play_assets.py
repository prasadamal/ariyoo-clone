#!/usr/bin/env python3
"""Generate Google Play listing assets from app icon (512 + 1024x500 feature graphic)."""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]


def feature_graphic(icon: Image.Image, accent: tuple[int, int, int], title: str, out: Path) -> None:
    w, h = 1024, 500
    canvas = Image.new("RGB", (w, h), accent)
    draw = ImageDraw.Draw(canvas)
    mark = icon.resize((280, 280), Image.Resampling.LANCZOS)
    canvas.paste(mark, (80, (h - 280) // 2), mark if mark.mode == "RGBA" else None)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 56)
    except OSError:
        font = ImageFont.load_default()
    draw.text((400, h // 2 - 40), title, fill=(255, 255, 255), font=font)
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out)


def main() -> None:
    apps = [
        ("apps/mobile", "Ariyoo", (15, 23, 42)),
        ("apps/wayfare-mobile", "Wayfare", (28, 25, 23)),
    ]
    for rel, title, accent in apps:
        app = ROOT / rel
        icon_path = app / "assets" / "icon.png"
        store = app / "store"
        if not icon_path.exists():
            print(f"skip {rel}: no icon")
            continue
        icon = Image.open(icon_path).convert("RGBA")
        play512 = icon.resize((512, 512), Image.Resampling.LANCZOS)
        play512.save(store / "play-icon-512.png")
        feature_graphic(icon, accent, title, store / "feature-graphic.png")
        print(f"ok {rel}/store")


if __name__ == "__main__":
    main()
