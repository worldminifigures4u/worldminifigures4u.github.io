"""Perfect FP favicon: keep uniform ring, redraw smooth FP letters."""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.ndimage import binary_closing, binary_opening, distance_transform_edt, gaussian_filter

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


def soft_mask(m: np.ndarray, soft: float = 1.2) -> np.ndarray:
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
    # Prefer ring gold for color (exclude letter zone roughly)
    h, w = r.shape
    yy, xx = np.mgrid[0:h, 0:w]
    dist = np.sqrt((xx - float(cx)) ** 2 + (yy - float(cy)) ** 2)
    ring = goldish & (dist > float(r_out) - 50)
    sample = ring if ring.sum() > 500 else goldish
    gold_rgb = np.array(
        [r[sample].mean(), g[sample].mean(), b[sample].mean()], np.float32
    )
    return float(cx), float(cy), float(r_out), gold_rgb


def measure_ring_width(src: np.ndarray, cx: float, cy: float, r_out: float) -> float:
    r, g, b, a = [src[:, :, i] for i in range(4)]
    goldish = (r > 150) & (g > 90) & (b < 80) & (r > b + 40) & (r > g + 20) & (a > 40)
    black = (r < 40) & (g < 40) & (b < 40)
    widths = []
    for ang in np.linspace(0, 2 * np.pi, 360, endpoint=False):
        outer = None
        for rad in np.linspace(r_out + 2, r_out - 55, 160):
            x = int(round(cx + rad * np.cos(ang)))
            y = int(round(cy + rad * np.sin(ang)))
            if not (0 <= x < src.shape[1] and 0 <= y < src.shape[0]):
                continue
            if goldish[y, x] and outer is None:
                outer = rad
            if outer is not None and black[y, x]:
                w = outer - rad
                if 14 <= w <= 30:
                    widths.append(w)
                break
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


def largest(mask: np.ndarray) -> np.ndarray:
    mask = binary_opening(binary_closing(mask, iterations=1), iterations=1)
    lab, n = ndimage.label(mask)
    if not n:
        return mask
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    return lab == (int(np.argmax(sizes)) + 1)


def smooth_mask_hires(mask400: np.ndarray) -> np.ndarray:
    """Upscale letter mask to SS, smooth curves, return soft alpha at SxS."""
    # Upscale binary via distance field for smooth curves
    m = mask400.astype(np.float32)
    # Grow slightly before upscale so strokes stay bold
    m = binary_closing(m, iterations=1).astype(np.float32)
    up = np.array(
        Image.fromarray((m * 255).astype(np.uint8)).resize(
            (S, S), Image.Resampling.LANCZOS
        ),
        dtype=np.float32,
    ) / 255.0
    # Mild blur then hard threshold → smooth silhouette at high res
    up = gaussian_filter(up, sigma=SS * 0.55)
    hard = up >= 0.45
    # Light close to heal pinholes without bloating
    hard = binary_closing(hard, iterations=max(1, SS // 4))
    hard = binary_opening(hard, iterations=max(1, SS // 6))
    # Contour rebuild for cleaner curves
    hard_u8 = (hard.astype(np.uint8) * 255)
    contours, _ = cv2.findContours(hard_u8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    rebuilt = np.zeros((S, S), np.uint8)
    if contours:
        # Keep largest contour(s) — F may have one blob; P one blob
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        for cnt in contours[:1]:
            # Smooth contour with approx + redraw
            peri = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, 0.0008 * peri, True)
            # Prefer original dense contour for organic rounded look
            cv2.drawContours(rebuilt, [cnt], -1, 255, thickness=-1)
    else:
        rebuilt = hard_u8
    # Final soft AA from distance field at SS (soft ~1 final px)
    return soft_mask(rebuilt > 127, soft=0.9 * SS)


def extract_letter_alphas(
    warped: np.ndarray, c: float, r_in: float
) -> tuple[np.ndarray, np.ndarray]:
    r, g, b = [warped[:, :, i] for i in range(3)]
    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    dist = np.sqrt((xx - c) ** 2 + (yy - c) ** 2)
    zone = dist < (r_in - 8)

    goldish = (r > 150) & (g > 90) & (b < 90) & (r > b + 40) & (r > g + 15) & zone
    creamish = (
        (r > 190)
        & (g > 180)
        & (b > 150)
        & (r < 245)
        & (g > r - 35)
        & zone
        & ~((r > 215) & (g > 210) & (b > 205) & (np.abs(r - g) < 12))
    )
    f_mask = largest(goldish)
    p_mask = largest(creamish)
    return smooth_mask_hires(f_mask), smooth_mask_hires(p_mask)


def place_letters_ss(
    fa: np.ndarray, pa: np.ndarray, gold_rgb: np.ndarray, r_in: float
) -> np.ndarray:
    """Build letter RGBA at supersample, fitted inside inner disc."""
    combined = np.clip(fa + pa, 0, 1)
    ys, xs = np.where(combined > 0.05)
    if len(xs) == 0:
        return np.zeros((S, S, 4), np.float32)

    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    fa_c = fa[y0:y1, x0:x1]
    pa_c = pa[y0:y1, x0:x1]
    ch, cw = fa_c.shape

    # Fit inside inner disc with comfortable padding (keep letters bold/large)
    avail = (r_in - 12) * 2 * SS
    sc = min(avail / cw, avail / ch) * 0.96
    nw, nh = max(1, int(round(cw * sc))), max(1, int(round(ch * sc)))

    def resize_a(a):
        img = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8), "L")
        return np.array(img.resize((nw, nh), Image.Resampling.LANCZOS), np.float32) / 255.0

    fa_r, pa_r = resize_a(fa_c), resize_a(pa_c)
    layer = np.zeros((S, S, 4), np.float32)
    ox = (S - nw) // 2
    oy = (S - nh) // 2 - 2 * SS  # slight optical lift
    # Clip paste bounds
    x_end, y_end = min(S, ox + nw), min(S, oy + nh)
    x0p, y0p = max(0, ox), max(0, oy)
    fx0, fy0 = x0p - ox, y0p - oy
    fa_p = fa_r[fy0 : fy0 + (y_end - y0p), fx0 : fx0 + (x_end - x0p)]
    pa_p = pa_r[fy0 : fy0 + (y_end - y0p), fx0 : fx0 + (x_end - x0p)]
    alpha = np.clip(fa_p + pa_p, 0, 1)
    tot = np.maximum(fa_p + pa_p, 1e-6)
    for i in range(3):
        layer[y0p:y_end, x0p:x_end, i] = (
            gold_rgb[i] * (fa_p / tot) + CREAM[i] * (pa_p / tot)
        )
    layer[y0p:y_end, x0p:x_end, 3] = alpha * 255

    # Keep clear of ring
    c_s = (S - 1) / 2.0
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float64)
    dist = np.sqrt((xx - c_s) ** 2 + (yy - c_s) ** 2)
    clip = np.clip(((r_in - 8) * SS - dist) / (0.8 * SS) + 0.5, 0, 1)
    layer[:, :, 3] *= clip
    return layer


def make_badge(src_path: Path) -> Image.Image:
    src_img = Image.open(src_path).convert("RGBA")
    src_img = src_img.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    src = np.array(src_img).astype(np.float32)
    cx, cy, r_out, gold_rgb = fit_outer_circle(src)
    ring_w_src = measure_ring_width(src, cx, cy, r_out)

    warped, target_r_out, scale = warp_center(src, cx, cy, r_out)
    ring_w = ring_w_src * scale * 0.92
    r_in = target_r_out - ring_w
    c = (SIZE - 1) / 2.0

    fa, pa = extract_letter_alphas(warped, c, r_in)
    letters_ss = place_letters_ss(fa, pa, gold_rgb, r_in)

    # Perfect concentric geometry at SS (unchanged approach — ring is good)
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

    badge = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGBA")
    letters = Image.fromarray(np.clip(letters_ss, 0, 255).astype(np.uint8), "RGBA")
    out_ss = Image.alpha_composite(badge, letters)
    out = out_ss.resize((SIZE, SIZE), Image.Resampling.BOX)

    arr = np.array(out).astype(np.float32)
    c2 = (SIZE - 1) / 2.0
    yy2, xx2 = np.mgrid[0:SIZE, 0:SIZE].astype(np.float64)
    d2 = np.sqrt((xx2 - c2) ** 2 + (yy2 - c2) ** 2)
    aa2 = 1.15
    outside_t = np.clip((d2 - (target_r_out - aa2 / 2)) / aa2, 0, 1)
    for i in range(3):
        arr[:, :, i] = arr[:, :, i] * (1.0 - outside_t) + WHITE[i] * outside_t
    arr[:, :, 3] = 255
    print(f"ring_w={ring_w:.2f} r_in={r_in:.2f} gold={gold_rgb}")
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

    prev = Image.new("RGB", (860, 420), (90, 90, 94))
    src_img = Image.open(src).convert("RGBA").resize((400, 400), Image.Resampling.LANCZOS)
    for img, x in [(src_img, 10), (final, 440)]:
        tile = Image.new("RGB", (400, 400), (255, 255, 255))
        tile.paste(img, (0, 0), img)
        prev.paste(tile, (x, 10))
    (ROOT / "tmp-astro-previews").mkdir(exist_ok=True)
    prev.save(ROOT / "tmp-astro-previews" / "favicon-before-after.png")

    # Letter zoom compare
    fa = np.array(final)
    zoom = Image.fromarray(fa[70:310, 70:330]).resize((520, 480), Image.Resampling.NEAREST)
    zoom.save(ROOT / "tmp-astro-previews" / "favicon-letters-zoom.png")
    print("saved")


if __name__ == "__main__":
    main()
