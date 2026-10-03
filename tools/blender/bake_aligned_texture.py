import trimesh
import numpy as np
from PIL import Image, ImageDraw

mesh = trimesh.load('assets/football_player.obj')
v = mesh.vertices
uv = mesh.visual.uv
faces = mesh.faces

src_gk = Image.open('assets/goalkeeper_clean.png').convert('RGBA')
src_w = src_gk.width
src_h = src_gk.height

TEX_SIZE = 2048
img = Image.new('RGBA', (TEX_SIZE, TEX_SIZE), color=(20, 20, 25, 255))
draw = ImageDraw.Draw(img)

face_centroids = np.mean(v[faces], axis=1)

print(f"Aligning body parts and baking texture onto {len(faces)} faces...")

for i, face in enumerate(faces):
    cx, cy, cz = face_centroids[i]
    
    # Map 3D body height and width to photo regions
    # In photo:
    # Head: y in [0.03, 0.23], x in [0.35, 0.65]
    # Torso: y in [0.22, 0.57], x in [0.25, 0.75]
    # Arms: y in [0.28, 0.52], x in [0.15, 0.85]
    # Shorts: y in [0.55, 0.75], x in [0.32, 0.68]
    # Legs: y in [0.73, 0.98], x in [0.30, 0.70]
    
    if cy > 1.30: # Head
        rel_y = np.clip((cy - 1.30) / 0.20, 0.0, 1.0)
        rel_x = np.clip((cx - (-0.10)) / 0.20, 0.0, 1.0)
        py_norm = 0.23 - rel_y * 0.19
        px_norm = 0.38 + rel_x * 0.24
    elif cy > 0.82 and np.abs(cx) < 0.20: # Torso
        rel_y = np.clip((cy - 0.82) / 0.48, 0.0, 1.0)
        rel_x = np.clip((cx - (-0.20)) / 0.40, 0.0, 1.0)
        py_norm = 0.56 - rel_y * 0.33
        px_norm = 0.32 + rel_x * 0.36
    elif cy > 0.82 and np.abs(cx) >= 0.20: # Arms
        rel_y = np.clip((cy - 0.82) / 0.48, 0.0, 1.0)
        if cx > 0: # Left arm
            rel_x = np.clip((cx - 0.20) / 0.16, 0.0, 1.0)
            px_norm = 0.68 + rel_x * 0.22
        else: # Right arm
            rel_x = np.clip((cx - (-0.36)) / 0.16, 0.0, 1.0)
            px_norm = 0.10 + rel_x * 0.22
        py_norm = 0.50 - rel_y * 0.22
    elif 0.50 < cy <= 0.82: # Shorts
        rel_y = np.clip((cy - 0.50) / 0.32, 0.0, 1.0)
        rel_x = np.clip((cx - (-0.22)) / 0.44, 0.0, 1.0)
        py_norm = 0.74 - rel_y * 0.18
        px_norm = 0.32 + rel_x * 0.36
    else: # Legs & Boots
        rel_y = np.clip(cy / 0.50, 0.0, 1.0)
        if cx > 0: # Left leg
            rel_x = np.clip((cx - 0.02) / 0.16, 0.0, 1.0)
            px_norm = 0.52 + rel_x * 0.18
        else: # Right leg
            rel_x = np.clip((cx - (-0.18)) / 0.16, 0.0, 1.0)
            px_norm = 0.30 + rel_x * 0.18
        py_norm = 0.98 - rel_y * 0.24

    px = int(np.clip(px_norm, 0.0, 1.0) * (src_w - 1))
    py = int(np.clip(py_norm, 0.0, 1.0) * (src_h - 1))
    
    r, g, b, a = src_gk.getpixel((px, py))
    factor = 1.0 if cz >= 0 else 0.85
    col = (int(r * factor), int(g * factor), int(b * factor))

    pts = [(int(uv[idx, 0] * (TEX_SIZE - 1)), int((1.0 - uv[idx, 1]) * (TEX_SIZE - 1))) for idx in face]
    draw.polygon(pts, fill=col)

img_rgb = img.convert('RGB')
img_rgb.save('assets/goalkeeper_3d_aligned_tex.jpg', quality=95)
print("Saved assets/goalkeeper_3d_aligned_tex.jpg")

mesh.visual.material.image = img_rgb
mesh.export('assets/goalkeeper_3d_aligned.glb')
print("Exported assets/goalkeeper_3d_aligned.glb")
