"""Render the twelve generated official levels as an isometric contact sheet.

Reads the exported level files (the exact data the game loads) and draws every
card as a filled quad, so the geometry produced by the level factory can be
eyeballed without launching the game.

    python scripts/level-factory/render_preview.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
LEVEL_DIR = ROOT / "public" / "levels"
OUTPUT = ROOT / "docs" / "screenshots" / "official-levels.png"

LEVEL_ORDER = [
    "a-frame", "roof-house", "tripod", "gate",
    "weight-drop", "two-story-wind", "wind-corridor", "three-story",
    "twin-bridge", "palace", "storm", "finale",
]

BACKGROUND = (14, 18, 26)
TILE = (20, 26, 36)
GRID = (34, 44, 58)
INK = (232, 238, 246)
MUTED = (124, 140, 162)
FACE = (226, 232, 240)
FACE_SIDE = (188, 199, 214)
EDGE = (64, 78, 98)
ACCENT = (94, 234, 212)

YAW = math.radians(36)
PITCH = math.radians(21)

STAGE_LABEL = {"STABILITY": "稳定", "WIND": "风", "WEIGHT_DROP": "落物"}


def rotation_matrix(quaternion):
    x, y, z, w = quaternion
    return [
        [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
        [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
        [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
    ]


def transform(matrix, vector):
    return [sum(matrix[row][col] * vector[col] for col in range(3)) for row in range(3)]


def card_corners(card, dimensions):
    half = (dimensions["width"] / 2, dimensions["thickness"] / 2, dimensions["height"] / 2)
    matrix = rotation_matrix(card["quaternion"])
    corners = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                rotated = transform(matrix, (sx * half[0], sy * half[1], sz * half[2]))
                corners.append(tuple(
                    rotated[axis] + card["position"][axis] for axis in range(3)
                ))
    return corners


def to_view(point):
    x, y, z = point
    cos_yaw, sin_yaw = math.cos(YAW), math.sin(YAW)
    rx = x * cos_yaw - z * sin_yaw
    rz = x * sin_yaw + z * cos_yaw
    cos_pitch, sin_pitch = math.cos(PITCH), math.sin(PITCH)
    return (rx, y * cos_pitch - rz * sin_pitch, y * sin_pitch + rz * cos_pitch)


FACES = [
    ([0, 1, 3, 2], "face"),
    ([4, 5, 7, 6], "face"),
    ([0, 1, 5, 4], "side"),
    ([2, 3, 7, 6], "side"),
    ([0, 2, 6, 4], "side"),
    ([1, 3, 7, 5], "side"),
]


def draw_structure(draw, level, box, fonts):
    font_title, font_meta, font_tiny = fonts
    x0, y0, x1, y1 = box
    blueprint = level["embeddedBlueprint"]
    dimensions = blueprint["cardDimensions"]
    cards = blueprint["snapshot"]["cards"]

    draw.rounded_rectangle(box, radius=10, fill=TILE, outline=(32, 42, 56))

    corners_per_card = [card_corners(card, dimensions) for card in cards]
    view = [[to_view(point) for point in corners] for corners in corners_per_card]
    flat = [point for card in view for point in card]
    min_x = min(point[0] for point in flat)
    max_x = max(point[0] for point in flat)
    min_y = min(point[1] for point in flat)
    max_y = max(point[1] for point in flat)
    content_w = max(1e-3, max_x - min_x)
    content_h = max(1e-3, max_y - min_y)
    scale = min((x1 - x0 - 56) / content_w, (y1 - y0 - 96) / content_h)
    offset_x = x0 + 28 + ((x1 - x0 - 56) - content_w * scale) / 2 - min_x * scale
    offset_y = y0 + 52 + ((y1 - y0 - 96) - content_h * scale) / 2 + max_y * scale

    def screen(point):
        return (offset_x + point[0] * scale, offset_y - point[1] * scale)

    # floor grid at y = 0
    bounds = blueprint["snapshot"]["bounds"]
    extent = max(bounds["size"][0], bounds["size"][2]) * 0.9 + 0.6
    for step in range(-2, 3):
        value = step * extent / 2
        for a, b in (
            ((value, 0, -extent), (value, 0, extent)),
            ((-extent, 0, value), (extent, 0, value)),
        ):
            draw.line([screen(to_view(a)), screen(to_view(b))], fill=GRID, width=1)

    faces = []
    for card in view:
        for indices, kind in FACES:
            polygon = [screen(card[index]) for index in indices]
            depth = sum(card[index][2] for index in indices) / 4
            faces.append((depth, polygon, kind))
    faces.sort(key=lambda face: -face[0])
    for _, polygon, kind in faces:
        draw.polygon(polygon, fill=FACE if kind == "face" else FACE_SIDE, outline=EDGE)

    stages = " + ".join(STAGE_LABEL.get(stage["testType"], stage["testType"]) for stage in level["testStages"])
    target = math.floor(dimensions["width"] * math.cos(math.radians(10)) * level["heightMultiplier"] * 10) / 10
    draw.text((x0 + 18, y0 + 12), level["name"]["zh"], font=font_title, fill=INK)
    draw.text(
        (x0 + 18, y0 + 36),
        f"{len(cards)} 张牌 · 高 {bounds['size'][1]:.1f} m · 目标 {target} m · {stages}",
        font=font_meta,
        fill=MUTED,
    )
    draw.text((x1 - 16, y1 - 22), level["id"], font=font_tiny, fill=ACCENT, anchor="ra")


def main():
    levels = [json.loads((LEVEL_DIR / f"{level_id}.paker-level.json").read_text(encoding="utf-8"))
              for level_id in LEVEL_ORDER]

    columns, rows = 3, 4
    tile_w, tile_h = 540, 420
    pad = 18
    header = 86
    width = columns * tile_w + (columns + 1) * pad
    height = header + rows * tile_h + (rows + 1) * pad

    image = Image.new("RGB", (width, height), BACKGROUND)
    draw = ImageDraw.Draw(image)

    cjk = Path("C:/Windows/Fonts/msyh.ttc")
    latin = Path("C:/Windows/Fonts/segoeui.ttf")
    cjk_path = str(cjk if cjk.exists() else latin)

    title_font = ImageFont.truetype(cjk_path, 22)
    meta_font = ImageFont.truetype(cjk_path, 14)
    tiny_font = ImageFont.truetype(str(latin), 13)
    header_font = ImageFont.truetype(cjk_path, 30)
    sub_font = ImageFont.truetype(cjk_path, 15)

    draw.text((pad + 8, 18), "PaKer 官方关卡 · 参考结构（全部通过物理验证）", font=header_font, fill=INK)
    draw.text(
        (pad + 8, 56),
        "npm run level:build 生成 · Rapier 离线模拟过关 · 再按 ±12 cm 摆放误差复验",
        font=sub_font,
        fill=MUTED,
    )

    for index, level in enumerate(levels):
        row, column = divmod(index, columns)
        x0 = pad + column * (tile_w + pad)
        y0 = header + pad + row * (tile_h + pad)
        draw_structure(draw, level, (x0, y0, x0 + tile_w, y0 + tile_h),
                       (title_font, meta_font, tiny_font))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT)
    print(f"wrote {OUTPUT} ({image.width}x{image.height})")


if __name__ == "__main__":
    main()
