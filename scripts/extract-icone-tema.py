"""Extract theme icon silhouette from a reference PNG (yellow on black + label)."""
from pathlib import Path
import sys
import numpy as np
from PIL import Image

src = Path(sys.argv[1])
slug = sys.argv[2]
out = Path(r'C:\WorldMinifigures4U\img') / f'icone-{slug}.png'

im = Image.open(src).convert('RGBA')
arr = np.array(im)
r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]

# Yellow/gold icon pixels (exclude white text)
yellow = (r > 110) & (g > 70) & (b < 150) & (a > 50) & ~((r > 200) & (g > 200) & (b > 200))
white = (r > 200) & (g > 200) & (b > 200) & (a > 180)
text_rows = [y for y in range(arr.shape[0]) if white[y].sum() > 3]
text_y = text_rows[0] if text_rows else arr.shape[0]

# Cut icon above the label (ignore anti-aliased yellow near text)
ys, xs = np.where(yellow & (np.arange(arr.shape[0])[:, None] < max(1, text_y - 4)))
if len(ys) == 0:
    raise SystemExit('No yellow icon pixels found')

y0, y1 = max(0, int(ys.min()) - 2), min(arr.shape[0], int(ys.max()) + 3)
x0, x1 = max(0, int(xs.min()) - 2), min(arr.shape[1], int(xs.max()) + 3)
mask = yellow[y0:y1, x0:x1]

rgba = np.zeros((mask.shape[0], mask.shape[1], 4), dtype=np.uint8)
rgba[mask] = (255, 255, 255, 255)
img = Image.fromarray(rgba)

side = max(img.size) + 4
canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
canvas = canvas.resize((128, 128), Image.Resampling.NEAREST)
out.parent.mkdir(exist_ok=True)
canvas.save(out)
print(f'saved {out} from bbox=({x0},{y0})-({x1},{y1}) pixels={int(mask.sum())}')
