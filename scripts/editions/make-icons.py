"""Builds each single-role app's launcher icons (assets/images/editions/<edition>/) from the Vivah rings.

Each edition keeps the gold rings and adds a gold badge with its user type's glyph, on its own
background colour, so the four apps are easy to tell apart on a phone. Run from the repo root:
    python scripts/editions/make-icons.py
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
IMAGES = ROOT / 'assets' / 'images'
ICONS = ROOT / 'node_modules' / '@expo' / 'vector-icons' / 'build' / 'vendor' / 'react-native-vector-icons'
GOLD = (200, 164, 107, 255)

EDITIONS = {
    'vendor': {'background': '#173F38', 'glyph': 'storefront'},
    'freelancer': {'background': '#1C2B4A', 'glyph': 'camera'},
    'staff': {'background': '#4A1020', 'glyph': 'id-card'},
    'admin': {'background': '#231A16', 'glyph': 'shield-checkmark'},
}

glyphs = json.loads((ICONS / 'glyphmaps' / 'Ionicons.json').read_text(encoding='utf-8'))


def hex_rgba(value):
    value = value.lstrip('#')
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def badge(layer, glyph, ring, fill, center=(712, 676), radius=118):
    """A filled circle with the glyph knocked out in `fill` (the background colour, or clear)."""
    draw = ImageDraw.Draw(layer)
    x, y = center
    draw.ellipse((x - radius - 14, y - radius - 14, x + radius + 14, y + radius + 14), fill=fill)
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=ring)
    font = ImageFont.truetype(str(ICONS / 'Fonts' / 'Ionicons.ttf'), 132)
    draw.text((x, y), chr(glyphs[glyph]), font=font, fill=fill, anchor='mm')


for edition, spec in EDITIONS.items():
    out = IMAGES / 'editions' / edition
    out.mkdir(parents=True, exist_ok=True)
    bg = hex_rgba(spec['background'])

    background = Image.new('RGBA', (1024, 1024), bg)
    background.save(out / 'android-icon-background.png', optimize=True)

    # Foreground: rings plus a badge whose outline is cut in the background colour.
    foreground = Image.open(IMAGES / 'android-icon-foreground.png').convert('RGBA')
    mark = Image.new('RGBA', foreground.size, (0, 0, 0, 0))
    badge(mark, spec['glyph'], GOLD, bg)
    foreground.alpha_composite(mark)
    foreground.save(out / 'android-icon-foreground.png', optimize=True)

    # Monochrome (Android 13 themed icons): the same shapes as a single-colour silhouette.
    mono = Image.open(IMAGES / 'android-icon-monochrome.png').convert('RGBA')
    cut = Image.new('L', mono.size, 0)
    shape = Image.new('RGBA', mono.size, (0, 0, 0, 0))
    badge(shape, spec['glyph'], (255, 255, 255, 255), (0, 0, 0, 0))
    ImageDraw.Draw(cut).ellipse((712 - 132, 676 - 132, 712 + 132, 676 + 132), fill=255)
    mono.paste((0, 0, 0, 0), mask=cut)
    mono.alpha_composite(shape)
    mono.save(out / 'android-icon-monochrome.png', optimize=True)

    # Full-bleed icon (iOS, web, the Play listing at 512 px). The adaptive layers are drawn at 1.4x
    # scale here so the mark fills the square the way the launcher's mask shows it.
    icon = Image.new('RGBA', (1024, 1024), bg)
    big = foreground.resize((1434, 1434), Image.LANCZOS).crop((205, 205, 1229, 1229))
    icon.alpha_composite(big)
    icon.convert('RGB').save(out / 'icon.png', optimize=True)
    icon.convert('RGB').resize((512, 512), Image.LANCZOS).save(out / 'play-store-icon-512.png', optimize=True)
    print(edition, 'ok')
