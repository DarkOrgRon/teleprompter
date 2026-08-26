"""
Erzeugt die App-Icons fuer die Teleprompter-PWA.
Einmalig ausfuehren:  python make_icons.py

Design: Flaeche in Conversion-Junkies-Gruen (#95C11F) – damit das Icon auf dem
Startbildschirm sofort auffindbar ist und dunkle Hintergruende es nicht
verschlucken. Darauf eine weisse Lesemarke, drei dunkelblaue Textzeilen
(#0a1b3d) und ein Aufnahmering als Hinweis auf die Kamerafunktion.

Gezeichnet wird immer in 1024 px und danach verkleinert – das ergibt glatte
Kanten, weil beim direkten Zeichnen in Zielgroesse keine Kantenglaettung
stattfindet.
"""

from PIL import Image, ImageDraw
import os

GREEN = (149, 193, 31, 255)
NAVY = (10, 27, 61, 255)
WHITE = (247, 249, 252, 255)

CANVAS = 1024
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")


def bar(draw, x0, y0, x1, y1, color):
    draw.rounded_rectangle((x0, y0, x1, y1), radius=(y1 - y0) / 2, fill=color)


def draw_icon(content_scale=1.0):
    """content_scale < 1 haelt Rand frei – noetig fuer maskable Icons,
    weil Android das Icon zu einem Kreis oder Squircle beschneidet."""
    img = Image.new("RGBA", (CANVAS, CANVAS), GREEN)
    draw = ImageDraw.Draw(img)

    c = CANVAS / 2.0

    def sx(rel):
        """Relative Koordinate (0..1) auf die Zeichenflaeche abbilden,
        zur Mitte hin skaliert."""
        return c + (rel - 0.5) * CANVAS * content_scale

    left, right = sx(0.155), sx(0.845)
    unit = CANVAS * content_scale

    # Weisse Lesemarke
    marker_h = unit * 0.034
    bar(draw, left, sx(0.225), right, sx(0.225) + marker_h, WHITE)

    # Drei Textzeilen, unterschiedlich lang
    y = sx(0.315)
    h = unit * 0.082
    gap = unit * 0.058
    for factor in (1.0, 0.72, 0.88):
        bar(draw, left, y, left + (right - left) * factor, y + h, NAVY)
        y += h + gap

    # Aufnahmering mittig unter dem Text
    r = unit * 0.082
    cy = sx(0.785)
    draw.ellipse((c - r, cy - r, c + r, cy + r), fill=NAVY)
    ri = unit * 0.038
    draw.ellipse((c - ri, cy - ri, c + ri, cy + ri), fill=GREEN)

    return img


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    targets = [
        ("icon-192.png", 192, 1.0),
        ("icon-512.png", 512, 1.0),
        # Maskable: Inhalt in der Sicherheitszone, damit beim Beschneiden
        # nichts Wichtiges verloren geht.
        ("icon-maskable-512.png", 512, 0.76),
    ]

    for name, size, scale in targets:
        img = draw_icon(scale).resize((size, size), Image.LANCZOS)
        path = os.path.join(OUT_DIR, name)
        img.save(path, "PNG", optimize=True)
        print("erstellt:", name, os.path.getsize(path), "Bytes")


if __name__ == "__main__":
    main()
