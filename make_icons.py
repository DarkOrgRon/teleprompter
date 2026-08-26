"""
Erzeugt die App-Icons fuer die Teleprompter-PWA.
Einmalig ausfuehren:  python make_icons.py
Design: dunkelblauer Grund (#0a1b3d), gruene Textzeilen (#95C11F) mit Lesemarke.
"""

from PIL import Image, ImageDraw
import os

NAVY = (10, 27, 61, 255)
GREEN = (149, 193, 31, 255)
WHITE = (242, 244, 248, 255)

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")


def rounded_rect(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def draw_icon(size, safe_ratio=1.0):
    """safe_ratio < 1 laesst Rand frei (fuer maskable Icons)."""
    img = Image.new("RGBA", (size, size), NAVY)
    draw = ImageDraw.Draw(img)

    # Zeichenflaeche innerhalb der Sicherheitszone
    inner = size * safe_ratio
    offset = (size - inner) / 2.0

    # Bildschirmflaeche
    pad = inner * 0.14
    screen_box = (
        offset + pad,
        offset + pad,
        offset + inner - pad,
        offset + inner - pad,
    )
    rounded_rect(draw, screen_box, radius=int(inner * 0.09), fill=(0, 0, 0, 255))

    # Textzeilen
    left = screen_box[0] + inner * 0.09
    right = screen_box[2] - inner * 0.09
    width = right - left
    line_h = max(2, int(inner * 0.055))
    gap = inner * 0.048
    y = screen_box[1] + inner * 0.11

    # Zeilenlaengen: wirkt wie ein Textblock
    factors = [1.0, 0.82, 0.93, 0.7]
    for index, factor in enumerate(factors):
        color = WHITE if index != 1 else GREEN
        draw.rounded_rectangle(
            (left, y, left + width * factor, y + line_h),
            radius=line_h / 2,
            fill=color,
        )
        y += line_h + gap

    # Lesemarke: gruener Balken quer
    marker_y = screen_box[1] + inner * 0.085
    draw.rectangle(
        (screen_box[0], marker_y, screen_box[2], marker_y + max(2, int(inner * 0.014))),
        fill=GREEN,
    )

    return img


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    targets = [
        ("icon-192.png", 192, 1.0),
        ("icon-512.png", 512, 1.0),
        ("icon-maskable-512.png", 512, 0.78),
    ]

    for name, size, safe in targets:
        img = draw_icon(size, safe)
        path = os.path.join(OUT_DIR, name)
        img.save(path, "PNG", optimize=True)
        print("erstellt:", path, os.path.getsize(path), "Bytes")


if __name__ == "__main__":
    main()
