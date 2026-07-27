"""Build favicon-400: perfect gold ring + original FP letter shapes."""
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
    r"_favicon-400-2137b232-a032-49ee-8f66-43b91ad1dea2.png"
)

GOLD = np.array([248, 192, 8], np.float32)
CREAM = np.array([248, 232, 192], np.float32)
SIZE = 400
SS = 8
S = SIZE * SS
RING_SRC = 23.0  # px at 400


def soft_mask(m: np.ndarray, soft: float = 1.15) -> np.ndarray:
    inside = distance_transform_edt(m)
    outside = distance_transform_edt(~m)
    alpha = np.zeros(m.shape, np.float32)
    alpha[m] = np.clip(inside[m] / soft, 0, 1)
    fringe = (~m) & (outside <= soft)
    alpha[fringe] = np.clip(1.0 - outside[fringe] / soft, 0, 1)
    return alpha


def extract_letters(src_path: Path) -> Image.Image:
    src = np.array(Image.open(src_path).convert("RGBA")).astype(np.float32)
    r, g, b, a = [src[:, :, i] for i in range(4)]
    h, w = r.shape
    yy, xx = np.mgrid[0:h, 0:w]

    goldish = (r > 165) & (g > 115) & (b < 150) & (r > b + 20) & (a > 40)
    creamish = (r > 200) & (g > 190) & (b > 140) & (a > 40) & (g > r - 40)

    pts = np.column_stack(np.where(goldish)[::-1]).astype(np.float32)
    (cx0, cy0), r_out0 = cv2.minEnclosingCircle(pts)
    cx0, cy0, r_out0 = float(cx0), float(cy0), float(r_out0)
    dist0 = np.sqrt((xx - cx0) ** 2 + (yy - cy0) ** 2)
    letter_zone = dist0 < (r_out0 - RING_SRC - 4)

    f_mask = binary_opening(
        binary_closing(goldish & letter_zone, iterations=1), iterations=1
    )
    p_mask = binary_opening(
        binary_closing(creamish & letter_zone, iterations=1), iterations=1
    )
    for name, mask in (("F", f_mask), ("P", p_mask)):
        lab, n = ndimage.label(mask)
        if n:
            sizes = ndimage.sum(mask, lab, range(1, n + 1))
            keep = lab == (int(np.argmax(sizes)) + 1)
            if name == "F":
                f_mask = keep
            else:
                p_mask = keep

    fa, pa = soft_mask(f_mask), soft_mask(p_mask)
    letters = np.zeros((h, w, 4), np.float32)
    for i in range(3):
        letters[:, :, i] = GOLD[i] * fa + CREAM[i] * pa
    letters[:, :, 3] = np.clip(fa + pa, 0, 1) * 255

    ys, xs = np.where((fa + pa) > 0.05)
    crop = letters[int(ys.min()) : int(ys.max()) + 1, int(xs.min()) : int(xs.max()) + 1]
    return Image.fromarray(np.clip(crop, 0, 255).astype(np.uint8), "RGBA")


def make_badge(letter_crop: Image.Image) -> Image.Image:
    c = (S - 1) / 2.0
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float64)
    dist = np.sqrt((xx - c) ** 2 + (yy - c) ** 2)

    margin = float(SS)  # ~1 px final
    r_out = S / 2.0 - margin
    ring_w = RING_SRC * SS
    r_in = r_out - ring_w
    aa = 0.85 * SS

    outer = np.clip((r_out + aa / 2 - dist) / aa, 0, 1)
    ring = np.clip((dist - (r_in - aa / 2)) / aa, 0, 1) * np.clip(
        ((r_out + aa / 2) - dist) / aa, 0, 1
    )

    ba = np.zeros((S, S, 4), np.float32)
    ba[:, :, 0] = GOLD[0] * ring
    ba[:, :, 1] = GOLD[1] * ring
    ba[:, :, 2] = GOLD[2] * ring
    ba[:, :, 3] = outer * 255

    gap = 10.0 * SS
    avail = (r_in - gap) * 2
    cw, ch = letter_crop.size
    crop_ss = letter_crop.resize((cw * SS, ch * SS), Image.Resampling.LANCZOS)
    cw2, ch2 = crop_ss.size
    sc = min(avail / cw2, avail / ch2) * 0.90
    nw, nh = max(1, int(round(cw2 * sc))), max(1, int(round(ch2 * sc)))
    crop_fit = crop_ss.resize((nw, nh), Image.Resampling.LANCZOS)

    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    layer.paste(crop_fit, ((S - nw) // 2, (S - nh) // 2 - SS), crop_fit)
    la = np.array(layer).astype(np.float32)
    la[:, :, 3] *= np.clip((r_in - gap * 0.4 - dist) / (0.5 * SS), 0, 1)

    badge = Image.fromarray(np.clip(ba, 0, 255).astype(np.uint8), "RGBA")
    badge = Image.alpha_composite(
        badge, Image.fromarray(np.clip(la, 0, 255).astype(np.uint8), "RGBA")
    )
    return badge.resize((SIZE, SIZE), Image.Resampling.BOX)


def main() -> None:
    src = SRC if SRC.exists() else ROOT / "favicon-400.png"
    letters = extract_letters(src)
    final = make_badge(letters)
    final.save(ROOT / "favicon-400.png")
    final.save(ROOT / "favicon-fp.png")
    final.resize((192, 192), Image.Resampling.LANCZOS).save(ROOT / "favicon-192.png")
    final.resize((64, 64), Image.Resampling.LANCZOS).save(ROOT / "favicon.png")
    final.resize((32, 32), Image.Resampling.LANCZOS).save(
        ROOT / "favicon-32.webp", "WEBP", quality=95, method=6
    )

    prev = Image.new("RGB", (860, 420), (90, 90, 94))
    for bg, x in [((20, 20, 22), 10), ((250, 250, 250), 440)]:
        tile = Image.new("RGB", (400, 400), bg)
        tile.paste(final, (0, 0), final)
        prev.paste(tile, (x, 10))
    (ROOT / "tmp-astro-previews").mkdir(exist_ok=True)
    prev.save(ROOT / "tmp-astro-previews" / "favicon-400-preview.png")

    fa = np.array(final)
    faa = fa[:, :, 3]
    cc = (SIZE - 1) / 2.0
    edge = []
    for ang in np.linspace(0, 2 * np.pi, 720, endpoint=False):
        for rad in range(199, 0, -1):
            x = int(round(cc + rad * np.cos(ang)))
            y = int(round(cc + rad * np.sin(ang)))
            if 0 <= x < SIZE and 0 <= y < SIZE and faa[y, x] > 128:
                edge.append(rad)
                break
    er = np.array(edge)
    print(f"saved favicon-400.png  outerR={er.mean():.2f} std={er.std():.3f}")


if __name__ == "__main__":
    main()
