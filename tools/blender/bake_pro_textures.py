import trimesh
import numpy as np
from PIL import Image, ImageDraw, ImageFont

def bake_clean_pbr_characters():
    mesh = trimesh.load('assets/football_player.obj')
    v = mesh.vertices
    uv = mesh.visual.uv
    faces = mesh.faces
    face_centroids = np.mean(v[faces], axis=1)

    TEX_SIZE = 2048

    # =========================================================================
    # 1. BAKE GOALKEEPER (Thibaut Courtois #1 High-Vis Fluorescent Volt Kit)
    # =========================================================================
    img_gk = Image.new('RGB', (TEX_SIZE, TEX_SIZE), color=(228, 255, 26))
    draw_gk = ImageDraw.Draw(img_gk)

    gk_skin = (238, 192, 162) # Bright natural skin tone
    gk_hair = (45, 32, 24)
    gk_stubble = (175, 138, 112)
    gk_jersey = (228, 255, 26) # Radiant High-Vis Volt Neon Yellow
    gk_jersey_dark = (24, 24, 27) # Sleek athletic side panels
    gk_jersey_accent = (245, 255, 120) # Luminous volt highlight
    gk_shorts = (24, 24, 27) # Professional obsidian athletic shorts
    gk_glove_back = (255, 255, 255) # Always white gloves backhand
    gk_glove_palm = (250, 250, 252) # Always white German contact latex foam palm
    gk_socks = (228, 255, 26) # High-vis volt socks
    gk_boots = (245, 158, 11)

    for i, face in enumerate(faces):
        cx, cy, cz = face_centroids[i]
        
        if cy > 1.32: # Head & Neck
            if cy > 1.39 and (cz < 0.03 or np.abs(cx) > 0.05): # Hair
                col = gk_hair
            elif cz > 0.04 and cy < 1.36 and np.abs(cx) < 0.04: # Stubble / chin
                col = gk_stubble
            else:
                col = gk_skin
        elif cy > 0.82 and np.abs(cx) < 0.20: # Torso (Jersey)
            if cz > 0.02 and np.abs(cx) < 0.16: # Front Chest
                # Subtle athletic diagonal weave
                stripe = int((cx + cy) * 40) % 2
                col = gk_jersey if stripe == 0 else gk_jersey_accent
            elif np.abs(cx) >= 0.16: # Side panels
                col = gk_jersey_dark
            else: # Back of jersey
                col = gk_jersey
        elif np.abs(cx) >= 0.20 and cy > 0.60: # Arms & Hands
            if cy > 1.06: # Sleeves
                col = gk_jersey
            elif cy > 0.85: # Forearms
                col = gk_skin
            else: # Goalkeeper Gloves
                col = gk_glove_back if cz > 0 else gk_glove_palm
        elif 0.48 < cy <= 0.82 and np.abs(cx) < 0.25: # Shorts
            col = gk_shorts
        else: # Legs & Boots
            if cy > 0.44:
                col = gk_skin # Thigh
            elif cy > 0.08:
                col = gk_socks # Sock
            else:
                col = gk_boots # Boot

        pts = [(int(uv[idx, 0] * (TEX_SIZE - 1)), int((1.0 - uv[idx, 1]) * (TEX_SIZE - 1))) for idx in face]
        draw_gk.polygon(pts, fill=col)

    # Add crisp chest graphic onto Goalkeeper jersey UV island:
    # In UV map, torso island is roughly: U in [0.55, 0.98], V in [0.65, 0.98]
    # Center of front torso in UV space is approx (U=0.76, 1-V=0.18)
    gx = int(0.76 * TEX_SIZE)
    gy = int(0.18 * TEX_SIZE)

    # Club crest shield
    draw_gk.polygon([(gx - 80, gy - 120), (gx + 80, gy - 120), (gx + 70, gy - 40), (gx, gy + 10), (gx - 70, gy - 40)], fill=(251, 191, 36))
    # Number 1 on chest
    draw_gk.rectangle([gx - 18, gy - 30, gx + 18, gy + 90], fill=(255, 255, 255))
    # Sponsor bar
    draw_gk.rectangle([gx - 140, gy + 110, gx + 140, gy + 150], fill=(255, 255, 255))

    img_gk.save('assets/gk_3d_pbr_tex.jpg', quality=95)
    mesh.visual.material.image = img_gk
    mesh.export('assets/goalkeeper_pro_3d.glb')
    print("Exported clean assets/goalkeeper_pro_3d.glb")

    # =========================================================================
    # 2. BAKE DEFENSIVE WALL (Davies #15, Kowalski #23, Moretti #19)
    # =========================================================================
    img_wall = Image.new('RGB', (TEX_SIZE, TEX_SIZE), color=(185, 28, 28)) # Crimson
    draw_wall = ImageDraw.Draw(img_wall)

    wall_skin = (212, 163, 128)
    wall_hair = (38, 28, 22)
    wall_jersey_red = (185, 28, 28) # Crimson
    wall_jersey_navy = (30, 41, 59) # Deep Navy stripe
    wall_shorts = (153, 27, 27)
    wall_socks = (30, 41, 59)
    wall_boots = (20, 20, 25)

    for i, face in enumerate(faces):
        cx, cy, cz = face_centroids[i]
        
        if cy > 1.32: # Head
            if cy > 1.39 and (cz < 0.03 or np.abs(cx) > 0.05):
                col = wall_hair
            else:
                col = wall_skin
        elif cy > 0.82 and np.abs(cx) < 0.20: # Torso (Striped Kit)
            stripe_phase = int((cx + 0.20) * 20) % 2
            col = wall_jersey_navy if stripe_phase == 0 else wall_jersey_red
        elif np.abs(cx) >= 0.20 and cy > 0.60: # Arms & Hands
            if cy > 1.06: # Sleeves
                col = wall_jersey_navy
            else: # Forearms & Hands
                col = wall_skin
        elif 0.48 < cy <= 0.82 and np.abs(cx) < 0.25: # Shorts
            col = wall_shorts
        else: # Legs
            if cy > 0.44:
                col = wall_skin
            elif cy > 0.08:
                col = wall_socks
            else:
                col = wall_boots

        pts = [(int(uv[idx, 0] * (TEX_SIZE - 1)), int((1.0 - uv[idx, 1]) * (TEX_SIZE - 1))) for idx in face]
        draw_wall.polygon(pts, fill=col)

    # Gold squad number on wall jersey
    wx = int(0.76 * TEX_SIZE)
    wy = int(0.18 * TEX_SIZE)
    draw_wall.rectangle([wx - 60, wy + 10, wx + 60, wy + 70], fill=(251, 191, 36))

    img_wall.save('assets/wall_3d_pbr_tex.jpg', quality=95)
    mesh_wall = trimesh.load('assets/football_player.obj')
    mesh_wall.visual.material.image = img_wall
    mesh_wall.export('assets/wall_defender_pro_3d.glb')
    print("Exported clean assets/wall_defender_pro_3d.glb")

bake_clean_pbr_characters()
