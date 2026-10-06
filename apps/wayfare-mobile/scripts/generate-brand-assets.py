#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
BG = (28, 25, 23)
PRIMARY = (194, 65, 12)
SAND = (250, 250, 249)


def draw_mark(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), BG + (255,))
    draw = ImageDraw.Draw(img)
    w = size * 0.12
    draw.rounded_rectangle((size * 0.2, size * 0.55, size * 0.8, size * 0.55 + w), radius=int(w / 2), fill=PRIMARY + (255,))
    draw.polygon(
        [
            (size * 0.35, size * 0.55),
            (size * 0.5, size * 0.28),
            (size * 0.65, size * 0.55),
        ],
        fill=SAND + (255,),
    )
    return img


def draw_notification_mark(size: int) -> Image.Image:
    """Android status-bar icon: white shapes on transparency (the system tints it)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    white = (255, 255, 255, 255)
    w = size * 0.14
    draw.rounded_rectangle((size * 0.12, size * 0.66, size * 0.88, size * 0.66 + w), radius=int(w / 2), fill=white)
    draw.polygon([(size * 0.28, size * 0.66), (size * 0.5, size * 0.18), (size * 0.72, size * 0.66)], fill=white)
    return img


def write_notification_icon() -> None:
    draw_notification_mark(96).save(ASSETS / "notification-icon.png")


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    write_notification_icon()
    icon = draw_mark(1024)
    icon.save(ASSETS / "icon.png")
    icon.save(ASSETS / "adaptive-icon.png")
    splash = Image.new("RGBA", (1284, 2778), BG + (255,))
    mark = draw_mark(400)
    splash.paste(mark, ((1284 - 400) // 2, 900), mark)
    splash.save(ASSETS / "splash.png")
    print("Wrote", ASSETS)


if __name__ == "__main__":
    main()
