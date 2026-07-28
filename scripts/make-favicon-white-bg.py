"""Perfect FP favicon: uniform gold ring, clean letters, solid white outside."""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.ndimage import binary_closing, binary_opening, distance_transform_edt

ROOT = Path(r"C:\WorldMinifigures4U")
SRC = Path(
    r"C:\Users\ruima\.cursor\projects\c-WorldMinifigures4U\assets"
    r"\c__Users_ruima_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images"
    r"_favicon-cdb8920e-7b76-424c-895d-6d8620a4322f.png"
)

WHITE = np.array([255, 255, 255], np.float32)
BLACK = np.array([5, 5, 5], np.float32)
CREAM = np.array([226, 216, 205], np.float32)
SIZE = 400
SS = 8
S = SIZE * SS


def soft_mask(m: np.ndarray, soft: float = 1.4) -> np.ndarray:
    inside = distance_transform_edt(m)
    outside = distance_transform_edt(~m)
    alpha = np.zeros(m.shape, np.float32)
    alpha[m] = np.clip(inside[m] / soft, 0, 1)
    fringe = (~m) & (outside <= soft)
    alpha[fringe] = np.clip(1.0 - outside[fringe] / soft, 0, 1)
    return alpha


def fit_outer_circle(src: np.ndarray) -> tuple[float, float, float, np.ndarray]:
    r, g, b, a = [src[:, :, i] for i in range(4)]
    goldish = (r > 150) & (g > 90) & (b < 80) & (r > b + 40) & (r > g + 20) & (a > 40)
    pts = np.column_stack(np.where(goldish)[::-1]).astype(np.float32)
    (cx, cy), r_out = cv2.minEnclosingCircle(pts)
    gold_rgb = np.array(
        [r[goldish].mean(), g[goldish].mean(), b[goldish].mean()], np.float32
    )
    return float(cx), float(cy), float(r_out), gold_rgb


def measure_ring_width(src: np.ndarray, cx: float, cy: float, r_out: float) -> float:
    r, g, b, a = [src[:, :, i] for i in range(4)]
    goldish = (r > 150) & (g > 90) & (b < 80) & (r > b + 40) & (r > g + 20) & (a > 40)
    black = (r < 40) & (g < 40) & (b < 40)
    widths = []
    for ang in np.linspace(0, 2 * np.pi, 360, endpoint=False):
        outer = inner = None
        for rad in np.linspace(r_out + 2, r_out - 55, 160):
            x = int(round(cx + rad * np.cos(ang)))
            y = int(round(cy + rad * np.sin(ang)))
            if not (0 <= x < src.shape[1] and 0 <= y < src.shape[0]):
                continue
            if goldish[y, x] and outer is None:
                outer = rad
            if outer is not None and black[y, x]:
                inner = rad
                break
            if outer is not None and goldish[y, x]:
                inner = rad
        if outer is not None and inner is not None:
            w = outer - inner
            if 14 <= w <= 30:
                widths.append(w)
    return float(np.median(widths)) if widths else 21.0


def warp_center(
    src: np.ndarray, cx: float, cy: float, r_out: float
) -> tuple[np.ndarray, float, float]:
    c = (SIZE - 1) / 2.0
    target_r_out = SIZE / 2.0 - 1.0
    scale = target_r_out / r_out
    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    xs = (xx - c) / scale + cx
    ys = (yy - c) / scale + cy
    x0 = np.floor(xs).astype(np.int32)
    y0 = np.floor(ys).astype(np.int32)
    x1 = np.clip(x0 + 1, 0, SIZE - 1)
    y1 = np.clip(y0 + 1, 0, SIZE - 1)
    x0 = np.clip(x0, 0, SIZE - 1)
    y0 = np.clip(y0, 0, SIZE - 1)
    wx = (xs - np.floor(xs))[:, :, None]
    wy = (ys - np.floor(ys))[:, :, None]
    out = (
        src[y0, x0] * (1 - wx) * (1 - wy)
        + src[y0, x1] * wx * (1 - wy)
        + src[y1, x0] * (1 - wx) * wy
        + src[y1, x1] * wx * wy
    )
    return out, target_r_out, scale


def extract_letters(
    warped: np.ndarray, c: float, r_in: float, gold_rgb: np.ndarray
) -> Image.Image:
    r, g, b = [warped[:, :, i] for i in range(3)]
    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    dist = np.sqrt((xx - c) ** 2 + (yy - c) ** 2)
    zone = dist < (r_in - 12)

    goldish = (
        (r > 150) & (g > 90) & (b < 90) & (r > b + 40) & (r > g + 15) & zone
    )
    creamish = (
        (r > 190)
        & (g > 180)
        & (b > 150)
        & (r < 245)
        & (g > r - 35)
        & zone
        & ~((r > 215) & (g > 210) & (b > 205) & (np.abs(r - g) < 12))
    )

    def largest(mask: np.ndarray) -> np.ndarray:
        mask = binary_opening(binary_closing(mask, iterations=1), iterations=1)
        lab, n = ndimage.label(mask)
        if not n:
            return mask
        sizes = ndimage.sum(mask, lab, range(1, n + 1))
        return lab == (int(np.argmax(sizes)) + 1)

    f_mask = largest(goldish)
    p_mask = largest(creamish)
    fa = soft_mask(f_mask, soft=1.5)
    pa = soft_mask(p_mask, soft=1.5)

    letters = np.zeros((SIZE, SIZE, 4), np.float32)
    for i in range(3):
        letters[:, :, i] = gold_rgb[i] * fa + CREAM[i] * pa
    letters[:, :, 3] = np.clip(fa + pa, 0, 1) * 255
    return Image.fromarray(np.clip(letters, 0, 255).astype(np.uint8), "RGBA")


def make_badge(src_path: Path) -> Image.Image:
    src_img = Image.open(src_path).convert("RGBA")
    src_img = src_img.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    src = np.array(src_img).astype(np.float32)
    cx, cy, r_out, gold_rgb = fit_outer_circle(src)
    ring_w_src = measure_ring_width(src, cx, cy, r_out)

    warped, target_r_out, scale = warp_center(src, cx, cy, r_out)
    ring_w = ring_w_src * scale * 0.92  # slightly thinner, clearer uniform band
    r_in = target_r_out - ring_w
    c = (SIZE - 1) / 2.0

    letters = extract_letters(warped, c, r_in, gold_rgb)

    # Scale letters down a bit so they don't optically merge with the ring at top
    la_img = letters
    la = np.array(la_img)
    ys, xs = np.where(la[:, :, 3] > 20)
    if len(xs):
        crop = la_img.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
        target = int((r_in - 14) * 2 * 0.90)
        cw, ch = crop.size
        sc = min(target / cw, target / ch)
        nw, nh = max(1, int(cw * sc)), max(1, int(ch * sc))
        crop = crop.resize((nw, nh), Image.Resampling.LANCZOS)
        letters = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        letters.paste(crop, ((SIZE - nw) // 2, (SIZE - nh) // 2 - 2), crop)

    # Perfect concentric geometry
    c_s = (S - 1) / 2.0
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float64)
    dist = np.sqrt((xx - c_s) ** 2 + (yy - c_s) ** 2)
    r_out_s = target_r_out * SS
    r_in_s = r_in * SS
    aa = 0.9 * SS

    outer = np.clip((r_out_s + aa / 2 - dist) / aa, 0, 1)
    ring = np.clip((dist - (r_in_s - aa / 2)) / aa, 0, 1) * np.clip(
        ((r_out_s + aa / 2) - dist) / aa, 0, 1
    )
    disc = np.clip((r_in_s + aa / 2 - dist) / aa, 0, 1)

    base = np.zeros((S, S, 4), np.float32)
    for i in range(3):
        base[:, :, i] = (
            WHITE[i] * (1.0 - outer)
            + BLACK[i] * disc * (1.0 - ring)
            + gold_rgb[i] * ring
        )
    base[:, :, 3] = 255
    badge = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGBA").resize(
        (SIZE, SIZE), Image.Resampling.BOX
    )

    la = np.array(letters).astype(np.float32)
    yy2, xx2 = np.mgrid[0:SIZE, 0:SIZE].astype(np.float64)
    d2 = np.sqrt((xx2 - c) ** 2 + (yy2 - c) ** 2)
    la[:, :, 3] *= np.clip((r_in - 10 - d2) / 1.5 + 0.5, 0, 1)
    out = Image.alpha_composite(
        badge, Image.fromarray(np.clip(la, 0, 255).astype(np.uint8), "RGBA")
    )

    arr = np.array(out).astype(np.float32)
    aa2 = 1.15
    outside_t = np.clip((d2 - (target_r_out - aa2 / 2)) / aa2, 0, 1)
    for i in range(3):
        arr[:, :, i] = arr[:, :, i] * (1.0 - outside_t) + WHITE[i] * outside_t
    arr[:, :, 3] = 255
    print(f"ring_w_src={ring_w_src:.2f} ring_w={ring_w:.2f} r_in={r_in:.2f}")
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")


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

    # Verification: top vs bottom ring strips + circle overlays
    fa = np.array(final)
    prev = Image.new("RGB", (900, 520), (90, 90, 94))
    src_img = Image.open(src).convert("RGBA").resize((400, 400), Image.Resampling.LANCZOS)
    for img, x in [(src_img, 10), (final, 450)]:
        tile = Image.new("RGB", (400, 400), (255, 255, 255))
        tile.paste(img, (0, 0), img)
        prev.paste(tile, (x, 10))
    # top/bottom compare strips of final
    top = Image.fromarray(fa[0:70, 100:300]).resize((400, 140), Image.Resampling.NEAREST)
    bot = Image.fromarray(fa[330:400, 100:300]).resize((400, 140), Image.Resampling.NEAREST)
    prev.paste(top, (10, 420))
    prev.paste(bot, (450, 420))
    (ROOT / "tmp-astro-previews").mkdir(exist_ok=True)
    prev.save(ROOT / "tmp-astro-previews" / "favicon-before-after.png")

    c = 199.5
    r, g, b = fa[:, :, 0], fa[:, :, 1], fa[:, :, 2]
    gold = (r > 150) & (g > 90) & (b < 80) & (r > b + 40) & (r > g + 15)
    black = (r < 40) & (g < 40) & (b < 40)

    def thick(ang):
        outer = inner = None
        for rad in np.linspace(205, 100, 500):
            x = int(round(c + rad * np.cos(ang)))
            y = int(round(c + rad * np.sin(ang)))
            if not (0 <= x < SIZE and 0 <= y < SIZE):
                continue
            if gold[y, x] and outer is None:
                outer = rad
            if outer is not None and black[y, x]:
                return outer - rad
            if outer is not None and gold[y, x]:
                inner = rad
        return None if outer is None or inner is None else outer - inner

    vals = [thick(a) for a in (-np.pi / 2, 0, np.pi / 2, np.pi)]
    print("thickness T/R/B/L", [None if v is None else round(v, 2) for v in vals])
    print("saved")


if __name__ == "__main__":
    main()
