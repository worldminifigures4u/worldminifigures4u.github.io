"""Perfect FP favicon: keep original FP artwork, clean ring, solid white outside."""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(r"C:\WorldMinifigures4U")
SRC = Path(
    r"C:\Users\ruima\.cursor\projects\c-WorldMinifigures4U\assets"
    r"\c__Users_ruima_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images"
    r"_favicon-cdb8920e-7b76-424c-895d-6d8620a4322f.png"
)

WHITE = np.array([255, 255, 255], np.float32)
SIZE = 400


def fit_circle(src: np.ndarray) -> tuple[float, float, float, float, np.ndarray]:
    r, g, b, a = [src[:, :, i] for i in range(4)]
    goldish = (r > 150) & (g > 90) & (b < 80) & (r > b + 40) & (r > g + 20) & (a > 40)
    pts = np.column_stack(np.where(goldish)[::-1]).astype(np.float32)
    (cx, cy), r_out = cv2.minEnclosingCircle(pts)
    cx, cy, r_out = float(cx), float(cy), float(r_out)
    h, w = r.shape
    yy, xx = np.mgrid[0:h, 0:w]
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    ring = goldish & (dist > r_out - 55)
    r_in = float(np.percentile(dist[ring], 5)) if ring.any() else r_out - 40
    gold_rgb = np.array(
        [r[goldish].mean(), g[goldish].mean(), b[goldish].mean()], np.float32
    )
    return cx, cy, r_out, r_in, gold_rgb


def make_badge(src_path: Path) -> Image.Image:
    src_img = Image.open(src_path).convert("RGBA")
    src_img = src_img.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    src = np.array(src_img).astype(np.float32)
    cx, cy, r_out, r_in, gold_rgb = fit_circle(src)

    # Recenter: warp so fitted circle center → canvas center
    c = (SIZE - 1) / 2.0
    # Slightly expand so ring nearly fills canvas (1px margin)
    target_r_out = SIZE / 2.0 - 1.0
    scale = target_r_out / r_out

    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    # Map output pixel → source pixel
    xs = (xx - c) / scale + cx
    ys = (yy - c) / scale + cy

    # Bilinear sample source
    x0 = np.floor(xs).astype(np.int32)
    y0 = np.floor(ys).astype(np.int32)
    x1 = np.clip(x0 + 1, 0, SIZE - 1)
    y1 = np.clip(y0 + 1, 0, SIZE - 1)
    x0 = np.clip(x0, 0, SIZE - 1)
    y0 = np.clip(y0, 0, SIZE - 1)
    wx = xs - np.floor(xs)
    wy = ys - np.floor(ys)
    out = np.zeros_like(src)
    for i in range(4):
        Ia = src[:, :, i]
        out[:, :, i] = (
            Ia[y0, x0] * (1 - wx) * (1 - wy)
            + Ia[y0, x1] * wx * (1 - wy)
            + Ia[y1, x0] * (1 - wx) * wy
            + Ia[y1, x1] * wx * wy
        )

    # Geometry on centered canvas
    dist = np.sqrt((xx - c) ** 2 + (yy - c) ** 2)
    r_out_n = target_r_out
    r_in_n = r_out_n - (r_out - r_in) * scale
    aa = 1.25

    outer = np.clip((r_out_n + aa / 2 - dist) / aa, 0, 1)  # 1 inside circle
    ring_band = np.clip((dist - (r_in_n - aa / 2)) / aa, 0, 1) * np.clip(
        ((r_out_n + aa / 2) - dist) / aa, 0, 1
    )

    # 1) Keep original artwork (letters + black + ring)
    # 2) White exterior
    # 3) Overpaint ring with clean gold (removes speck / uneven grain, no gaps)
    final = out.copy()
    for i in range(3):
        final[:, :, i] = out[:, :, i] * outer + WHITE[i] * (1.0 - outer)
        final[:, :, i] = final[:, :, i] * (1.0 - ring_band) + gold_rgb[i] * ring_band
    final[:, :, 3] = 255

    # Hard-guarantee pure white beyond AA fringe
    far = dist > (r_out_n + aa / 2)
    final[far, 0:3] = WHITE
    return Image.fromarray(np.clip(final, 0, 255).astype(np.uint8), "RGBA")


def main() -> None:
    src = SRC if SRC.exists() else ROOT / "favicon-400.png"
    final = make_badge(src)

    final.save(ROOT / "favicon-400.png")
    final.save(ROOT / "favicon-fp.png")
    final.resize((192, 192), Image.Resampling.LANCZOS).save(ROOT / "favicon-192.png")
    final.resize((64, 64), Image.Resampling.LANCZOS).save(ROOT / "favicon.png")
    final.resize((32, 32), Image.Resampling.LANCZOS).save(
        ROOT / "favicon-32.webp", "WEBP", quality=95, method=6
    )

    prev = Image.new("RGB", (860, 420), (90, 90, 94))
    src_img = Image.open(src).convert("RGBA").resize((400, 400), Image.Resampling.LANCZOS)
    for img, x in [(src_img, 10), (final, 440)]:
        tile = Image.new("RGB", (400, 400), (255, 255, 255))
        tile.paste(img, (0, 0), img)
        prev.paste(tile, (x, 10))
    (ROOT / "tmp-astro-previews").mkdir(exist_ok=True)
    prev.save(ROOT / "tmp-astro-previews" / "favicon-before-after.png")
    prev.save(ROOT / "tmp-astro-previews" / "favicon-400-preview.png")

    fa = np.array(final)
    c = (SIZE - 1) / 2.0
    yy, xx = np.mgrid[0:SIZE, 0:SIZE]
    dist = np.sqrt((xx - c) ** 2 + (yy - c) ** 2)
    print("corners", fa[0, 0, :3], "outside white%", float((fa[dist > 200][:, :3] == 255).all(1).mean() * 100))
    print("saved")


if __name__ == "__main__":
    main()
