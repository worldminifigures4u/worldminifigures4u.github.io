"""Rebuild FP favicon: perfect uniform ring, transparent outside, no white fringe."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy import ndimage

SRC = Path(
    r"C:\Users\ruima\.cursor\projects\c-WorldMinifigures4U\assets"
    r"\c__Users_ruima_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images"
    r"_image-de33c1eb-45ec-4c30-880a-12902f81ce9d.png"
)
ROOT = Path(r"C:\WorldMinifigures4U")
GOLD = (248, 192, 8)
CREAM = (248, 232, 192)
S = 1024
MARGIN = 12
RING_W = 92


def extract_letters(src: Image.Image) -> Image.Image:
    """Pull F/P glyphs from source, return RGBA letter layer cropped to circle bbox."""
    a = np.array(src.convert("RGBA"))
    r = a[:, :, 0].astype(np.int16)
    g = a[:, :, 1].astype(np.int16)
    b = a[:, :, 2].astype(np.int16)
    H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]

    black = (r < 50) & (g < 50) & (b < 50)
    lab, n = ndimage.label(black)
    sizes = ndimage.sum(black, lab, range(1, n + 1))
    bi = int(np.argmax(sizes)) + 1
    bys, bxs = np.where(lab == bi)
    cx, cy = float(bxs.mean()), float(bys.mean())
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)

    gold = (r > 170) & (g > 120) & (b < 130) & (r > b + 35)
    gd = dist[gold]
    r_out = float(np.percentile(gd, 99.5))
    ring = gold & (dist > r_out * 0.58)
    r_in = float(np.percentile(dist[ring], 4)) if ring.any() else r_out * 0.78

    interior = dist < (r_in - 4)
    f_mask = interior & (r > 160) & (g > 110) & (b < 110) & (r > b + 40)
    p_mask = (
        interior
        & (r > 175)
        & (g > 165)
        & (b > 130)
        & (b < 230)
        & ((r - b) > 8)
        & ~f_mask
    )
    f2 = ndimage.binary_dilation(f_mask, iterations=1) & (dist < r_in - 3)
    p2 = ndimage.binary_dilation(p_mask, iterations=1) & (dist < r_in - 3) & ~f2
    print(f"letters F={int(f2.sum())} P={int(p2.sum())} r_in={r_in:.1f}")

    letter = np.zeros((H, W, 4), np.uint8)
    letter[f2, :3] = GOLD
    letter[f2, 3] = 255
    letter[p2, :3] = CREAM
    letter[p2, 3] = 255

    # Square crop centered on circle (use outer gold max for framing letters)
    rad = r_out
    pad = 2
    x0 = max(0, int(cx - rad) - pad)
    y0 = max(0, int(cy - rad) - pad)
    x1 = min(W, int(cx + rad) + pad + 1)
    y1 = min(H, int(cy + rad) + pad + 1)
    return Image.fromarray(letter, "RGBA").crop((x0, y0, x1, y1))


def draw_letters_fallback(badge: Image.Image) -> Image.Image:
    """Rounded italic-ish FP if extraction fails."""
    d = ImageDraw.Draw(badge)
    font = None
    for path, size in [
        (r"C:\Windows\Fonts\arialbd.ttf", 420),
        (r"C:\Windows\Fonts\seguisb.ttf", 420),
        (r"C:\Windows\Fonts\arial.ttf", 420),
    ]:
        try:
            font = ImageFont.truetype(path, size)
            break
        except OSError:
            continue
    assert font is not None
    # Draw on temp then shear slightly for italic look
    tmp = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    td = ImageDraw.Draw(tmp)
    fb = td.textbbox((0, 0), "F", font=font)
    pb = td.textbbox((0, 0), "P", font=font)
    fw, fh = fb[2] - fb[0], fb[3] - fb[1]
    pw = pb[2] - pb[0]
    gap = 18
    tot = fw + gap + pw
    x = (S - tot) / 2 - fb[0]
    y = (S - fh) / 2 - fb[1] - 18
    td.text((x, y), "F", fill=(*GOLD, 255), font=font)
    td.text((x + fw + gap, y), "P", fill=(*CREAM, 255), font=font)
    # mild italic shear
    shear = 0.18
    tmp = tmp.transform(
        (S, S),
        Image.Transform.AFFINE,
        (1, shear, -shear * S * 0.35, 0, 1, 0),
        resample=Image.Resampling.BICUBIC,
    )
    return Image.alpha_composite(badge, tmp)


def main() -> None:
    # Perfect ring + black disc
    badge = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(badge)
    outer = [MARGIN, MARGIN, S - 1 - MARGIN, S - 1 - MARGIN]
    d.ellipse(outer, fill=(0, 0, 0, 255))
    for t in range(RING_W):
        d.ellipse(
            [MARGIN + t, MARGIN + t, S - 1 - MARGIN - t, S - 1 - MARGIN - t],
            outline=(*GOLD, 255),
        )

    if SRC.exists():
        lett = extract_letters(Image.open(SRC))
        lett = lett.resize((S, S), Image.Resampling.LANCZOS)
        la = np.array(lett)
        c = (S - 1) / 2.0
        yy, xx = np.mgrid[0:S, 0:S]
        d2 = np.sqrt((xx - c) ** 2 + (yy - c) ** 2)
        inner_lim = (S / 2 - MARGIN) - RING_W - 6
        la[d2 > inner_lim, 3] = 0
        if int((la[:, :, 3] > 0).sum()) > 500:
            badge = Image.alpha_composite(badge, Image.fromarray(la, "RGBA"))
            print("used extracted letters")
        else:
            badge = draw_letters_fallback(badge)
            print("fallback letters (extraction weak)")
    else:
        badge = draw_letters_fallback(badge)
        print("fallback letters (no source)")

    # Soft AA outer edge only — keep ring fully opaque inside
    ba = np.array(badge).astype(np.float32)
    c = (S - 1) / 2.0
    yy, xx = np.mgrid[0:S, 0:S]
    d2 = np.sqrt((xx - c) ** 2 + (yy - c) ** 2)
    rad = S / 2 - MARGIN
    soft = np.clip((rad + 0.6 - d2) / 1.3, 0, 1)
    ba[:, :, 3] *= soft
    # Remove any light-grey/white fringe outside inner ring
    near_white = (
        (ba[:, :, 0] > 190)
        & (ba[:, :, 1] > 190)
        & (ba[:, :, 2] > 185)
        & (np.abs(ba[:, :, 0] - ba[:, :, 1]) < 30)
        & (np.abs(ba[:, :, 1] - ba[:, :, 2]) < 30)
    )
    ba[near_white & (d2 > rad - 6), 3] = 0
    ba[soft < 0.02] = 0
    badge = Image.fromarray(np.clip(ba, 0, 255).astype(np.uint8), "RGBA")
    # Tiny blur on alpha edge only for cleaner circle
    rgb = badge.convert("RGB")
    alpha = badge.getchannel("A").filter(ImageFilter.GaussianBlur(0.4))
    badge = Image.merge("RGBA", (*rgb.split(), alpha))
    # Re-zero outside
    ba = np.array(badge)
    ba[np.array(alpha) < 5] = 0
    badge = Image.fromarray(ba, "RGBA")

    badge.save(ROOT / "favicon-fp.png", "PNG")
    badge.resize((32, 32), Image.Resampling.LANCZOS).save(
        ROOT / "favicon-32.webp", "WEBP", quality=95, method=6
    )
    badge.resize((192, 192), Image.Resampling.LANCZOS).save(ROOT / "favicon-192.png", "PNG")
    badge.resize((64, 64), Image.Resampling.LANCZOS).save(ROOT / "favicon.png", "PNG")

    prev = Image.new("RGB", (420, 200), (90, 90, 95))
    small = badge.resize((180, 180), Image.Resampling.LANCZOS)
    for bgcol, xoff in [((20, 20, 24), 10), ((240, 240, 240), 220)]:
        tile = Image.new("RGB", (180, 180), bgcol)
        tile.paste(small, (0, 0), small)
        prev.paste(tile, (xoff, 10))
    (ROOT / "tmp-astro-previews").mkdir(exist_ok=True)
    prev.save(ROOT / "tmp-astro-previews" / "favicon-preview.png")
    print("saved")


if __name__ == "__main__":
    main()
