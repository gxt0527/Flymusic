"""从 Android 自适应图标的前景层生成 Windows 桌面图标。

输出 resources/icon.png(256) 与 resources/icon.ico(16~256 多尺寸)。
electron-builder.yml 里 buildResources 指向 resources/，会自动取用。

注意不能输出到 build/ —— 那是 Android 产物目录，已被 .gitignore 的 `build/` 整段忽略。
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.webp")
OUT_DIR = os.path.join(ROOT, "resources")
SIZE = 256
BG_COLOR = (0x1F, 0x21, 0x22, 255)  # 与设计稿 bg.content 一致
CONTENT_RATIO = 0.68  # 图形占画布比例，留出安全区

os.makedirs(OUT_DIR, exist_ok=True)

fg = Image.open(SRC).convert("RGBA")
bbox = fg.getbbox()
if bbox:
    fg = fg.crop(bbox)

target = int(SIZE * CONTENT_RATIO)
scale = target / max(fg.width, fg.height)
fg = fg.resize(
    (max(1, round(fg.width * scale)), max(1, round(fg.height * scale))),
    Image.LANCZOS,
)

canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(canvas)
radius = int(SIZE * 0.22)
draw.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=radius, fill=BG_COLOR)

pos = ((SIZE - fg.width) // 2, (SIZE - fg.height) // 2)
canvas.alpha_composite(fg, pos)

png_path = os.path.join(OUT_DIR, "icon.png")
canvas.save(png_path, "PNG")

ico_path = os.path.join(OUT_DIR, "icon.ico")
sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
canvas.save(ico_path, "ICO", sizes=sizes)

print("png", png_path, os.path.getsize(png_path))
print("ico", ico_path, os.path.getsize(ico_path))
