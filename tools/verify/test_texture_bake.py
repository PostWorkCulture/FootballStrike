import trimesh
import numpy as np
from PIL import Image, ImageDraw, ImageFont

mesh = trimesh.load('assets/football_player.obj')
v = mesh.vertices
uv = mesh.visual.uv
faces = mesh.faces

TEX_SIZE = 2048
img = Image.new('RGB', (TEX_SIZE, TEX_SIZE), color=(210, 165, 130)) # base skin
draw = ImageDraw.Draw(img)

# Body colors for Goalkeeper (Real Madrid Volt Green)
jersey_main = (16, 185, 129) # Volt emerald
jersey_trim = (6, 78, 59)
shorts_main = (5, 150, 105)
gloves_palm = (250, 250, 252)
gloves_back = (255, 255, 255) # Always white gloves
socks_color = (16, 185, 129)
boots_color = (25, 25, 30)
hair_color = (35, 25, 20)
skin_color = (215, 168, 135)

# Calculate face centroids in 3D
face_centroids = np.mean(v[faces], axis=1)

print(f"Baking texture for {len(faces)} faces...")

for i, face in enumerate(faces):
    cx, cy, cz = face_centroids[i]
    
    # Determine color by body part
    if cy > 1.30: # Head
        if cy > 1.38 and (cz < 0.04 or np.abs(cx) > 0.08):
            col = hair_color
        else:
            col = skin_color
    elif cy > 0.82 and np.abs(cx) < 0.22: # Torso
        col = jersey_main
    elif cy > 0.82 and np.abs(cx) >= 0.22: # Arms
        if cy > 1.05:
            col = jersey_main
        elif cy > 0.88:
            col = skin_color
        else:
            col = gloves_back if cz > 0 else gloves_palm
    elif 0.50 < cy <= 0.82 and np.abs(cx) < 0.25: # Shorts
        col = shorts_main
    elif cy <= 0.50: # Legs
        if cy > 0.44:
            col = skin_color
        elif cy > 0.10:
            col = socks_color
        else:
            col = boots_color

    pts = [(int(uv[idx, 0] * (TEX_SIZE - 1)), int((1.0 - uv[idx, 1]) * (TEX_SIZE - 1))) for idx in face]
    draw.polygon(pts, fill=col)

img.save('assets/gk_tex_baked.png')
print("Saved assets/gk_tex_baked.png")

# Assign to mesh and export GLB
mesh.visual.material.image = img
mesh.export('assets/goalkeeper_3d.glb')
print("Exported assets/goalkeeper_3d.glb")
