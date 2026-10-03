"""
Procedural PBR Texture Map Generator for Football Strike 3D
Generates high-resolution 2048x2048 normal maps and PBR textures:
1. assets/ball_normal_pbr.png: 14-panel aerodynamic thermally-bonded seam pattern with micro-dimples
2. assets/turf_normal_pbr.png: Authentic lawn grass normal map with blade displacement & mowing stripes
3. assets/gloves_normal_pbr.png: Hexagonal latex palm foam grip with embossed wrist strap normals
4. assets/jersey_normal_pbr.png: Micro-knit polyester weave normal map
5. assets/ball_texture_pbr.png: Regulation FIFA tournament match ball diffuse texture
6. assets/turf_roughness_pbr.png: Mowing stripe & penalty spot wear roughness map
"""

import os
import time
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ASSETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')
os.makedirs(ASSETS_DIR, exist_ok=True)


def compute_tangent_normal(H, strength=3.0, wrap_x=True, wrap_y=True):
    """
    Computes an OpenGL standard tangent space normal map from heightmap H.
    Nx = -dHx * strength
    Ny = +dHy * strength (OpenGL format: Green is UP)
    Nz = 1.0
    """
    if wrap_x:
        dHx = (np.roll(H, -1, axis=1) - np.roll(H, 1, axis=1)) * 0.5
    else:
        dHx = np.zeros_like(H)
        dHx[:, 1:-1] = (H[:, 2:] - H[:, :-2]) * 0.5
        dHx[:, 0] = H[:, 1] - H[:, 0]
        dHx[:, -1] = H[:, -1] - H[:, -2]

    if wrap_y:
        dHy = (np.roll(H, -1, axis=0) - np.roll(H, 1, axis=0)) * 0.5
    else:
        dHy = np.zeros_like(H)
        dHy[1:-1, :] = (H[2:, :] - H[:-2, :]) * 0.5
        dHy[0, :] = H[1, :] - H[0, :]
        dHy[-1, :] = H[-1, :] - H[-2, :]

    nx = -dHx * strength
    ny = dHy * strength
    nz = np.ones_like(H)

    length = np.sqrt(nx**2 + ny**2 + nz**2)
    nx /= length
    ny /= length
    nz /= length

    r = np.clip((nx * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)
    g = np.clip((ny * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)
    b = np.clip((nz * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)

    return np.stack([r, g, b], axis=-1)


def generate_ball_textures(size=2048):
    """
    14-panel aerodynamic thermally-bonded seam pattern with micro-dimples.
    Produces:
    - assets/ball_normal_pbr.png
    - assets/ball_texture_pbr.png
    """
    print(f"Generating Ball PBR Textures ({size}x{size})...")
    t0 = time.time()

    u = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)
    v = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)
    uu, vv = np.meshgrid(u, v)

    phi = uu * (2.0 * np.pi)
    theta = vv * np.pi

    x = np.sin(theta) * np.cos(phi)
    y = np.cos(theta)
    z = np.sin(theta) * np.sin(phi)
    p = np.stack([x, y, z], axis=-1)

    # 14 panel seed centers: 6 octahedral faces + 8 cubic diagonal faces
    c_oct = np.array([
        [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
    ], dtype=np.float32)
    s3 = 1.0 / np.sqrt(3.0)
    c_cub = np.array([
        [ s3,  s3,  s3], [ s3,  s3, -s3], [ s3, -s3,  s3], [ s3, -s3, -s3],
        [-s3,  s3,  s3], [-s3,  s3, -s3], [-s3, -s3,  s3], [-s3, -s3, -s3]
    ], dtype=np.float32)
    centers = np.vstack([c_oct, c_cub])

    # Aerodynamic flowing harmonic warp for modern tournament ball curve seams
    warp = 0.10 * (np.sin(3.0 * phi) * np.cos(3.0 * theta))
    pw = p.copy()
    pw[..., 0] += warp * y
    pw[..., 1] += warp * z
    pw[..., 2] += warp * x
    norm = np.linalg.norm(pw, axis=-1, keepdims=True)
    pw /= np.maximum(norm, 1e-6)

    dots = np.tensordot(pw, centers, axes=([2], [1]))
    part = np.partition(dots, -2, axis=-1)
    diff = part[..., -1] - part[..., -2]

    # Thermally-bonded seam profiles
    seam_w = 0.024
    h_seam = -1.35 * np.exp(-(diff / seam_w)**2)
    # Raised thermal bond weld bead
    h_bead = 0.38 * np.exp(-((diff - 0.033) / 0.012)**2)
    # Synthetic polyurethane panel pillowing
    h_pillow = 0.22 * (1.0 - np.exp(-diff / 0.065))

    # Aerodynamic micro-dimples (frequency f = 60)
    # Isotropic 3D spherical lattice intersection eliminates polar distortion
    f = 60.0
    qx, qy, qz = f * x, f * y, f * z
    rx = qx - np.round(qx)
    ry = qy - np.round(qy)
    rz = qz - np.round(qz)
    d_dimple = np.sqrt(rx**2 + ry**2 + rz**2)
    h_dimple = -0.42 * np.maximum(0.0, 1.0 - (d_dimple / 0.32)**2)**2

    # High frequency micro-grain leather texture
    micro_grain = 0.04 * np.sin(phi * 180.0) * np.cos(theta * 180.0)

    H_ball = h_seam + h_bead + h_pillow + h_dimple + micro_grain

    # Normal map calculation (periodic in longitude/wrap_x, clamped at poles)
    normal_rgb = compute_tangent_normal(H_ball, strength=3.4, wrap_x=True, wrap_y=False)

    normal_path = os.path.join(ASSETS_DIR, 'ball_normal_pbr.png')
    Image.fromarray(normal_rgb).save(normal_path, 'PNG')
    print(f"Saved: {normal_path} ({os.path.getsize(normal_path):,} bytes)")

    # -------------------------------------------------------------------------
    # Also generate matching FIFA Regulation Match Ball Albedo Texture
    # -------------------------------------------------------------------------
    albedo = np.full((size, size, 3), 248, dtype=np.float32)

    # Dark seam shadows where thermally bonded grooves sit
    seam_mask = np.clip(np.exp(-(diff / (seam_w * 1.2))**2), 0.0, 1.0)[..., None]
    seam_color = np.array([28.0, 32.0, 42.0], dtype=np.float32)
    albedo = albedo * (1.0 - seam_mask * 0.78) + seam_color * (seam_mask * 0.78)

    # Dynamic tournament aerodynamic speed ribbons (Volt Neon & Cyan)
    # Flow ribbons follow panel curves
    ribbon_field1 = np.sin(phi * 2.0 + warp * 5.0) * np.cos(theta * 3.0)
    ribbon_field2 = np.cos(phi * 3.0 - theta * 2.0 + warp * 4.0)

    ribbon_mask1 = np.clip((ribbon_field1 - 0.45) / 0.15, 0.0, 1.0)[..., None]
    ribbon_col1 = np.array([210.0, 255.0, 15.0], dtype=np.float32) # Volt neon

    ribbon_mask2 = np.clip((ribbon_field2 - 0.50) / 0.15, 0.0, 1.0)[..., None]
    ribbon_col2 = np.array([14.0, 165.0, 233.0], dtype=np.float32) # Electric Cyan

    ribbon_mask3 = np.clip((-ribbon_field1 - 0.55) / 0.12, 0.0, 1.0)[..., None]
    ribbon_col3 = np.array([15.0, 23.0, 42.0], dtype=np.float32) # Obsidian Navy

    albedo = albedo * (1.0 - ribbon_mask3) + ribbon_col3 * ribbon_mask3
    albedo = albedo * (1.0 - ribbon_mask2) + ribbon_col2 * ribbon_mask2
    albedo = albedo * (1.0 - ribbon_mask1) + ribbon_col1 * ribbon_mask1

    # Subtle ambient occlusion inside micro-dimples
    dimple_ao = np.maximum(0.0, 1.0 - (d_dimple / 0.32)**2)**2
    albedo *= (1.0 - dimple_ao[..., None] * 0.14)

    albedo_img = Image.fromarray(np.clip(albedo, 0, 255).astype(np.uint8))
    draw = ImageDraw.Draw(albedo_img)

    # Stamp FIFA Quality Pro & STRIKE MATCH BALL emblem on equator panels
    badge_u = int(0.50 * size)
    badge_v = int(0.50 * size)
    bw, bh = 140, 70
    draw.rectangle([badge_u - bw, badge_v - bh, badge_u + bw, badge_v + bh], outline=(15, 23, 42), width=5)
    draw.rectangle([badge_u - bw + 6, badge_v - bh + 6, badge_u + bw - 6, badge_v + bh - 6], fill=(255, 255, 255))
    draw.text((badge_u - 110, badge_v - 22), "FIFA QUALITY PRO", fill=(15, 23, 42))
    draw.text((badge_u - 95, badge_v + 5), "OFFICIAL MATCH BALL", fill=(51, 65, 85))

    diffuse_path = os.path.join(ASSETS_DIR, 'ball_texture_pbr.png')
    albedo_img.save(diffuse_path, 'PNG')
    print(f"Saved: {diffuse_path} ({os.path.getsize(diffuse_path):,} bytes) [Elapsed: {time.time()-t0:.2f}s]")


def generate_turf_textures(size=2048):
    """
    Authentic lawn grass normal map with fine blade displacement and mowing stripe micro-relief.
    Produces:
    - assets/turf_normal_pbr.png
    - assets/turf_roughness_pbr.png
    """
    print(f"Generating Turf PBR Textures ({size}x{size})...")
    t0 = time.time()

    y, x = np.meshgrid(np.arange(size, dtype=np.float32), np.arange(size, dtype=np.float32), indexing='ij')

    # 1. Authentic mowing stripes micro-relief (8 alternating mower passes)
    stripe_freq = 8.0
    stripe_phase = (y / size) * (stripe_freq * 2.0 * np.pi)
    stripe_relief = 0.45 * np.sin(stripe_phase)

    # Depressed roller edge boundary grooves
    roller_edge = -0.28 * np.exp(-(np.sin(stripe_phase) / 0.10)**2)

    # 2. Multiscale organic grass blades (anisotropic high-frequency ridges)
    H_blades = np.zeros((size, size), dtype=np.float32)
    octaves = [
        (32.0, 16.0, 0.38, 0.40),
        (64.0, 32.0, 0.28, 0.50),
        (128.0, 64.0, 0.18, 0.60),
        (256.0, 128.0, 0.12, 0.70)
    ]
    for fx, fy, weight, pow_val in octaves:
        kx = fx * 2.0 * np.pi / size
        ky = fy * 2.0 * np.pi / size
        wobble = 0.75 * np.sin(y * ky * 0.5)
        phase = (x * kx + wobble)
        ridge = (1.0 - np.abs(np.sin(phase)))**pow_val
        H_blades += weight * ridge * (0.8 + 0.4 * np.cos(y * ky))

    # 3. Micro-thatch soil roughness and blade tip displacement
    micro_thatch = 0.09 * np.sin(x * 512.0 * 2.0 * np.pi / size) * np.cos(y * 512.0 * 2.0 * np.pi / size)

    H_total = stripe_relief + roller_edge + H_blades + micro_thatch

    # 100% seamless 2D periodic wrapping
    normal_rgb = compute_tangent_normal(H_total, strength=3.0, wrap_x=True, wrap_y=True)

    normal_path = os.path.join(ASSETS_DIR, 'turf_normal_pbr.png')
    Image.fromarray(normal_rgb).save(normal_path, 'PNG')
    print(f"Saved: {normal_path} ({os.path.getsize(normal_path):,} bytes)")

    # -------------------------------------------------------------------------
    # Also generate authentic Turf Roughness Map (Mowing Stripes & Contact Wear)
    # -------------------------------------------------------------------------
    # Flat roller-pressed stripes have higher specular sheen (lower roughness ~0.62)
    # Upright mower passes have more diffuse scattering (roughness ~0.88)
    roughness = 0.75 + 0.12 * np.sin(stripe_phase)
    # Blade tips add high frequency roughness micro-sparkle
    roughness += 0.08 * (H_blades / (np.max(H_blades) + 1e-5))
    roughness = np.clip(roughness * 255.0, 0, 255).astype(np.uint8)

    roughness_path = os.path.join(ASSETS_DIR, 'turf_roughness_pbr.png')
    Image.fromarray(roughness).save(roughness_path, 'PNG')
    print(f"Saved: {roughness_path} ({os.path.getsize(roughness_path):,} bytes) [Elapsed: {time.time()-t0:.2f}s]")


def generate_gloves_normal(size=2048):
    """
    Hexagonal latex palm foam grip with embossed wrist strap normals.
    Produces:
    - assets/gloves_normal_pbr.png
    """
    print(f"Generating Goalkeeper Gloves Normal Map ({size}x{size})...")
    t0 = time.time()

    y, x = np.meshgrid(np.arange(size, dtype=np.float32), np.arange(size, dtype=np.float32), indexing='ij')

    # Top 72% is contact palm and fingers; Bottom 28% is embossed wrist strap
    strap_y_start = int(size * 0.72)

    # 1. Hexagonal Latex Palm Foam Grip
    R_hex = 18.0
    w = R_hex * np.sqrt(3.0)
    h = 3.0 * R_hex

    # Hexagonal lattice 1
    x1 = np.mod(x, w) - w * 0.5
    y1 = np.mod(y, h) - h * 0.5
    d1 = np.maximum(np.abs(y1), np.abs(x1) * 0.5 * np.sqrt(3.0) + np.abs(y1) * 0.5)

    # Hexagonal lattice 2 (staggered)
    x2 = np.mod(x - w * 0.5, w) - w * 0.5
    y2 = np.mod(y - h * 0.5, h) - h * 0.5
    d2 = np.maximum(np.abs(y2), np.abs(x2) * 0.5 * np.sqrt(3.0) + np.abs(y2) * 0.5)

    d_hex = np.minimum(d1, d2) / R_hex
    # Raised hex cell walls (d_hex near 1.0) and dished suction cup center
    hex_height = 0.58 * np.exp(-((1.0 - d_hex) / 0.12)**2) - 0.28 * (1.0 - d_hex)**1.5

    # High-specular latex micro-pores (open-cell foam porosity)
    pore_freq = 6.0 * np.pi / R_hex
    micro_pores = -0.38 * (np.sin(x * pore_freq) * np.sin(y * pore_freq))**8
    palm_H = hex_height + micro_pores * (d_hex < 0.82)

    # 2. Embossed Wrist Strap Normals (Bottom 28%)
    strap_v = (y - strap_y_start) / (size - strap_y_start)
    strap_v_clamped = np.clip(strap_v, 0.0, 1.0)

    # Heavy rubberized elastic compression ribs
    rib_phase = strap_v_clamped * 16.0 * np.pi
    ribs = 0.72 * (np.cos(rib_phase)**6)

    # Hook-and-loop Velcro closure micro-hook grain
    velcro = 0.18 * (np.sin(x * 0.45) * np.cos(y * 0.45) + np.sin(x * 0.95 + y * 0.85))

    # Embossed 3D brand logo relief badge on center of strap
    bx_min, bx_max = size * 0.20, size * 0.80
    by_min, by_max = size * 0.78, size * 0.92
    in_badge = (x >= bx_min) & (x <= bx_max) & (y >= by_min) & (y <= by_max)

    badge_rim = np.zeros((size, size), dtype=np.float32)
    dist_edge_x = np.minimum(x - bx_min, bx_max - x)
    dist_edge_y = np.minimum(y - by_min, by_max - y)
    dist_edge = np.minimum(dist_edge_x, dist_edge_y)
    badge_rim[in_badge] = np.clip(dist_edge[in_badge] / 14.0, 0.0, 1.0) * 0.60

    # Embossed chevron relief ribs inside badge
    badge_relief = 0.38 * np.sin((x - bx_min) * 0.07 + np.abs(y - (by_min + by_max) * 0.5) * 0.05) * in_badge

    strap_H = ribs + velcro + badge_rim + badge_relief

    # Smooth transition blend between latex palm and elastic strap
    exp_arg = np.clip(-(y - strap_y_start) / 12.0, -30.0, 30.0)
    blend = 1.0 / (1.0 + np.exp(exp_arg))
    H_gloves = (1.0 - blend) * palm_H + blend * strap_H

    # Tangent normal map calculation
    normal_rgb = compute_tangent_normal(H_gloves, strength=3.4, wrap_x=True, wrap_y=False)

    normal_path = os.path.join(ASSETS_DIR, 'gloves_normal_pbr.png')
    Image.fromarray(normal_rgb).save(normal_path, 'PNG')
    print(f"Saved: {normal_path} ({os.path.getsize(normal_path):,} bytes) [Elapsed: {time.time()-t0:.2f}s]")


def generate_jersey_normal(size=2048):
    """
    Micro-knit polyester weave normal map.
    Produces:
    - assets/jersey_normal_pbr.png
    """
    print(f"Generating Player Jersey Normal Map ({size}x{size})...")
    t0 = time.time()

    y, x = np.meshgrid(np.arange(size, dtype=np.float32), np.arange(size, dtype=np.float32), indexing='ij')

    px = 16.0 # Wale stitch period (vertical rib)
    py = 16.0 # Course stitch period (horizontal loop)

    # Staggered interlocking knit loops (offset every alternate row)
    row_idx = np.floor(y / py)
    x_shifted = x + (row_idx % 2.0) * (px * 0.5)

    u = (x_shifted % px) / px * (2.0 * np.pi)
    v = (y % py) / py * (2.0 * np.pi)

    # Authentic 3D knit stitch loops (rounded stitch crowns and crossing yarn legs)
    H_loop = 0.62 * np.cos(u) * np.sin(v) + 0.28 * np.cos(2.0 * u) * np.cos(v)

    # Spun micro-filament yarn twist striations
    H_twist = 0.14 * np.sin(6.0 * u + 3.0 * v)

    # Breathable micro-ventilation eyelets (athletic mesh cooling perforations)
    eyelet_grid = 64.0
    ex = (x % eyelet_grid) - eyelet_grid * 0.5
    ey = (y % eyelet_grid) - eyelet_grid * 0.5
    edist = np.sqrt(ex**2 + ey**2)
    H_eyelet = -0.48 * np.exp(-(edist / 7.5)**2)

    H_total = H_loop + H_twist + H_eyelet

    # 100% seamless 2D periodic wrapping
    normal_rgb = compute_tangent_normal(H_total, strength=3.2, wrap_x=True, wrap_y=True)

    normal_path = os.path.join(ASSETS_DIR, 'jersey_normal_pbr.png')
    Image.fromarray(normal_rgb).save(normal_path, 'PNG')
    print(f"Saved: {normal_path} ({os.path.getsize(normal_path):,} bytes) [Elapsed: {time.time()-t0:.2f}s]")


def verify_textures():
    """
    Verifies that all 4 required textures exist, have valid PNG headers, and non-zero sizes.
    """
    print("\n--- Verifying Generated PBR Textures ---")
    required = [
        'ball_normal_pbr.png',
        'turf_normal_pbr.png',
        'gloves_normal_pbr.png',
        'jersey_normal_pbr.png'
    ]

    png_magic = b'\x89PNG\r\n\x1a\n'
    all_valid = True

    for name in required:
        path = os.path.join(ASSETS_DIR, name)
        if not os.path.exists(path):
            print(f"[FAIL] Missing file: {path}")
            all_valid = False
            continue

        size = os.path.getsize(path)
        if size == 0:
            print(f"[FAIL] Empty file (0 bytes): {path}")
            all_valid = False
            continue

        with open(path, 'rb') as f:
            header = f.read(8)
            if header != png_magic:
                print(f"[FAIL] Invalid PNG header for {name}: {header}")
                all_valid = False
                continue

        im = Image.open(path)
        print(f"[PASS] {name}: {im.size[0]}x{im.size[1]} {im.mode}, Size: {size:,} bytes, Valid PNG Header")

    return all_valid


if __name__ == '__main__':
    t_start = time.time()
    print("=" * 60)
    print("Football Strike 3D: High-Resolution PBR Texture Generator")
    print("=" * 60)

    generate_ball_textures(2048)
    generate_turf_textures(2048)
    generate_gloves_normal(2048)
    generate_jersey_normal(2048)

    ok = verify_textures()
    total_time = time.time() - t_start
    print(f"\nAll PBR textures generated & verified in {total_time:.2f}s (Success: {ok})")
