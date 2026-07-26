"""Rebuild FP favicon: perfect ring, full uncut letters, transparent outside."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(r"C:\WorldMinifigures4U")
GOLD = (248, 192, 8)
CREAM = (248, 232, 192)
S = 1024
MARGIN = 16
RING_W = 86


def make_badge(size: int, ring_w: int | None = None, margin: int | None = None) -> Image.Image:
    margin = MARGIN if margin is None else margin
    ring_w = RING_W if ring_w is None else ring_w
    if size != S:
        scale = size / S
        margin = max(1, int(round(MARGIN * scale)))
        ring_w = max(2, int(round(RING_W * scale)))

    badge = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(badge)
    box = [margin, margin, size - 1 - margin, size - 1 - margin]
    d.ellipse(box, fill=(0, 0, 0, 255))
    for t in range(ring_w):
        d.ellipse(
            [margin + t, margin + t, size - 1 - margin - t, size - 1 - margin - t],
            outline=(*GOLD, 255),
        )

    # Inner disc radius available for letters
    inner_r = size / 2 - margin - ring_w
    # Leave breathing room so glyphs aren't clipped by the ring
    max_text_w = inner_r * 2 * 0.78
    max_text_h = inner_r * 2 * 0.62

    font_path = r"C:\Windows\Fonts\arialbd.ttf"
    for path in (
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\seguisb.ttf",
        r"C:\Windows\Fonts\arial.ttf",
    ):
        try:
            ImageFont.truetype(path, 20)
            font_path = path
            break
        except OSError:
            continue

    font_size = int(size * 0.42)
    font = ImageFont.truetype(font_path, font_size)

    # Fit font so "FP" fits inside target box
    for _ in range(40):
        fb = d.textbbox((0, 0), "F", font=font)
        pb = d.textbbox((0, 0), "P", font=font)
        fw, fh = fb[2] - fb[0], fb[3] - fb[1]
        pw = pb[2] - pb[0]
        gap = max(4, int(size * 0.02))
        tot_w = fw + gap + pw
        tot_h = max(fh, pb[3] - pb[1])
        if tot_w <= max_text_w and tot_h <= max_text_h:
            break
        font_size = max(8, int(font_size * 0.94))
        font = ImageFont.truetype(font_path, font_size)

    tmp = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    td = ImageDraw.Draw(tmp)
    fb = td.textbbox((0, 0), "F", font=font)
    pb = td.textbbox((0, 0), "P", font=font)
    fw, fh = fb[2] - fb[0], fb[3] - fb[1]
    pw = pb[2] - pb[0]
    gap = max(4, int(size * 0.02))
    tot = fw + gap + pw
    x = (size - tot) / 2 - fb[0]
    y = (size - fh) / 2 - fb[1] - size * 0.02
    td.text((x, y), "F", fill=(*GOLD, 255), font=font)
    td.text((x + fw + gap, y), "P", fill=(*CREAM, 255), font=font)

    # Mild italic — keep fully inside canvas
    shear = 0.12
    tmp = tmp.transform(
        (size, size),
        Image.Transform.AFFINE,
        (1, shear, -shear * size * 0.28, 0, 1, 0),
        resample=Image.Resampling.BICUBIC,
    )

    # Ensure letters don't spill into ring: mask to inner disc with padding
    ta = np.array(tmp)
    c = (size - 1) / 2.0
    yy, xx = np.mgrid[0:size, 0:size]
    dist = np.sqrt((xx - c) ** 2 + (yy - c) ** 2)
    keep = dist <= (inner_r - max(1, size * 0.01))
    # If letters would be clipped, scale them down around center instead of hard-cropping
    ys, xs = np.where(ta[:, :, 3] > 20)
    if len(xs):
        # Check if any letter pixels fall outside keep
        outside = (ta[:, :, 3] > 20) & ~keep
        if outside.any():
            # Scale letter layer down to fit
            ly0, ly1 = int(ys.min()), int(ys.max()) + 1
            lx0, lx1 = int(xs.min()), int(xs.max()) + 1
            crop = tmp.crop((lx0, ly0, lx1, ly1))
            # Target size: fit in diameter 2*(inner_r - pad)
            target = int((inner_r - max(1, size * 0.02)) * 2 * 0.92)
            cw, ch = crop.size
            sc = min(target / cw, target / ch)
            nw, nh = max(1, int(cw * sc)), max(1, int(ch * sc))
            crop = crop.resize((nw, nh), Image.Resampling.LANCZOS)
            tmp = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            tmp.paste(crop, ((size - nw) // 2, (size - nh) // 2 - int(size * 0.01)), crop)
            ta = np.array(tmp)
            ta[~keep, 3] = 0
            tmp = Image.fromarray(ta, "RGBA")
        else:
            ta[~keep, 3] = 0
            tmp = Image.fromarray(ta, "RGBA")

    badge = Image.alpha_composite(badge, tmp)

    # Soft outer AA only
    ba = np.array(badge).astype(np.float32)
    rad = size / 2 - margin
    soft = np.clip((rad + 0.5 - dist) / 1.2, 0, 1)
    ba[:, :, 3] *= soft
    ba[soft < 0.02] = 0
    return Image.fromarray(np.clip(ba, 0, 255).astype(np.uint8), "RGBA")


def main() -> None:
    master = make_badge(S)
    master.save(ROOT / "favicon-fp.png", "PNG")

    for size, name, fmt in [
        (32, "favicon-32.webp", "WEBP"),
        (64, "favicon.png", "PNG"),
        (192, "favicon-192.png", "PNG"),
    ]:
        # Render natively at target size for crisp glyphs (not downscale-from-1024 crop)
        img = make_badge(size)
        if fmt == "WEBP":
            img.save(ROOT / name, "WEBP", quality=95, method=6)
        else:
            img.save(ROOT / name, "PNG")
        print(name, "ok")

    prev = Image.new("RGB", (420, 200), (90, 90, 95))
    small = master.resize((180, 180), Image.Resampling.LANCZOS)
    for bg, x in [((20, 20, 24), 10), ((240, 240, 240), 220)]:
        tile = Image.new("RGB", (180, 180), bg)
        tile.paste(small, (0, 0), small)
        prev.paste(tile, (x, 10))
    (ROOT / "tmp-astro-previews").mkdir(exist_ok=True)
    prev.save(ROOT / "tmp-astro-previews" / "favicon-preview.png")
    print("saved master + sizes")


if __name__ == "__main__":
    main()
