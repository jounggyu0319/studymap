#!/usr/bin/env python3
"""Generate PWA icons: #111827 background, white 한글 '스'."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
FG = "#ffffff"
BG = "#111827"
TEXT = "스"

# macOS common paths for Korean-capable fonts
_FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Apple SD Gothic Neo.ttc",
    "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
    "/System/Library/Fonts/AppleSDGothicNeo.ttc",
    "/Library/Fonts/AppleGothic.ttf",
]


def pick_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in _FONT_CANDIDATES:
        p = Path(path)
        if p.is_file():
            try:
                return ImageFont.truetype(str(p), size)
            except OSError:
                continue
    return ImageFont.load_default()


def render(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), BG)
    draw = ImageDraw.Draw(img)
    font_size = int(size * 0.52)
    font = pick_font(font_size)
    cx, cy = size // 2, size // 2
    draw.text((cx, cy), TEXT, fill=FG, font=font, anchor="mm")
    return img


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    img512 = render(512)
    img512.save(PUBLIC / "icon-512.png", "PNG")
    img192 = img512.resize((192, 192), Image.Resampling.LANCZOS)
    img192.save(PUBLIC / "icon-192.png", "PNG")
    print("Wrote public/icon-512.png and public/icon-192.png")


if __name__ == "__main__":
    main()
