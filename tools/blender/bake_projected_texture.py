import trimesh
import numpy as np
from PIL import Image, ImageDraw

mesh = trimesh.load('assets/football_player.obj')
v = mesh.vertices
uv = mesh.visual.uv
faces = mesh.faces

# Load high-res player art
src_gk = Image.open('assets/goalkeeper_clean.png').convert('RGBA')
src_w = src_gk.width
src_h = src_gk.height

x_min, y_min, z_min = v.min(axis=0)
x_max, y_max, z_max = v.max(axis=0)

TEX_SIZE = 2048
img = Image.new('RGBA', (TEX_SIZE, TEX_SIZE), color=(20, 20, 25, 255))
draw = ImageDraw.Draw(img)

# Project front texture onto UV triangles
face_centroids = np.mean(v[faces], axis=1)

print(f"Projecting texture onto {len(faces)} faces...")

for i, face in enumerate(faces):
    cx, cy, cz = face_centroids[i]
    
    # Normalized coordinates
    u_norm = np.clip((cx - x_min) / (x_max - x_min), 0.0, 1.0)
    v_norm = np.clip((cy - y_min) / (y_max - y_min), 0.0, 1.0)
    
    # Invert V for image space
    px = int(u_norm * (src_w - 1))
    py = int((1.0 - v_norm) * (src_h - 1))
    
    r, g, b, a = src_gk.getpixel((px, py))
    if a < 30: # If background transparent, fallback to kit/skin
        if cy > 1.30:
            col = (215, 168, 135)
        elif cy > 0.82:
            col = (16, 185, 129)
        elif cy > 0.50:
            col = (5, 150, 105)
        else:
            col = (16, 185, 129)
    else:
        # Darken back of player slightly for natural depth
        factor = 1.0 if cz >= 0 else 0.82
        col = (int(r * factor), int(g * factor), int(b * factor))

    pts = [(int(uv[idx, 0] * (TEX_SIZE - 1)), int((1.0 - uv[idx, 1]) * (TEX_SIZE - 1))) for idx in face]
    draw.polygon(pts, fill=col)

img_rgb = img.convert('RGB')
img_rgb.save('assets/goalkeeper_3d_projected_tex.jpg', quality=95)
print("Saved assets/goalkeeper_3d_projected_tex.jpg")

mesh.visual.material.image = img_rgb
mesh.export('assets/goalkeeper_3d_model.glb')
print("Exported assets/goalkeeper_3d_model.glb")
