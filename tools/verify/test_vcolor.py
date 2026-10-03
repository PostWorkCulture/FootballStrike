import trimesh
import numpy as np

mesh = trimesh.load('assets/football_player.obj')
v = mesh.vertices.copy()
n = len(v)

# Initialize RGBA vertex colors: default white
colors = np.ones((n, 4), dtype=np.uint8) * 255

# Head & Neck (Skin: realistic warm athletic skin)
skin_color = [215, 160, 125, 255]
hair_color = [30, 22, 18, 255]
boot_color = [20, 20, 25, 255]
gk_jersey_color = [22, 195, 110, 255] # Volt green
gk_shorts_color = [18, 160, 90, 255]
gk_gloves_color = [240, 240, 245, 255]
sock_color = [22, 195, 110, 255]

for i in range(n):
    x, y, z = v[i]
    if y > 1.30: # Head
        if y > 1.38 and (z < 0.05 or np.abs(x) > 0.08):
            colors[i] = hair_color
        else:
            colors[i] = skin_color
    elif y > 0.82 and np.abs(x) < 0.22: # Torso / Jersey
        colors[i] = gk_jersey_color
    elif y > 0.82 and np.abs(x) >= 0.22: # Arms
        if y > 1.05: # Upper sleeve
            colors[i] = gk_jersey_color
        elif y > 0.88: # Forearm skin
            colors[i] = skin_color
        else: # Gloves
            colors[i] = gk_gloves_color
    elif 0.50 < y <= 0.82 and np.abs(x) < 0.25: # Shorts
        colors[i] = gk_shorts_color
    elif y <= 0.50: # Legs
        if y > 0.44: # Thigh skin under shorts
            colors[i] = skin_color
        elif y > 0.10: # Socks
            colors[i] = sock_color
        else: # Cleats
            colors[i] = boot_color

mesh.visual.vertex_colors = colors
mesh.export('assets/gk_vcolor_test.glb')
print("Exported assets/gk_vcolor_test.glb")
