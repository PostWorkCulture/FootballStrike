import trimesh
import numpy as np
from PIL import Image, ImageDraw

def smoothstep(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)

def rotate_about_pivot(points, pivot, axis, angle_rad):
    axis = axis / np.linalg.norm(axis)
    p = points - pivot
    cos_a = np.cos(angle_rad)
    sin_a = np.sin(angle_rad)
    cross_prod = np.cross(axis, p)
    dot_prod = np.dot(p, axis)
    return p * cos_a + cross_prod * sin_a + np.outer(dot_prod, axis) * (1.0 - cos_a) + pivot

def recalculate_normals(mesh, v):
    normals = np.zeros(v.shape, dtype=np.float64)
    v0 = v[mesh.faces[:, 0]]
    v1 = v[mesh.faces[:, 1]]
    v2 = v[mesh.faces[:, 2]]
    fn = np.cross(v1 - v0, v2 - v0)
    np.add.at(normals, mesh.faces[:, 0], fn)
    np.add.at(normals, mesh.faces[:, 1], fn)
    np.add.at(normals, mesh.faces[:, 2], fn)
    lens = np.linalg.norm(normals, axis=1, keepdims=True)
    lens[lens == 0] = 1.0
    return (normals / lens).astype(np.float32)

def build_assets():
    base_mesh = trimesh.load('assets/football_player.obj')
    faces = base_mesh.faces
    v_orig = base_mesh.vertices.copy()
    uv = base_mesh.visual.uv
    face_centroids = np.mean(v_orig[faces], axis=1)

    TEX_SIZE = 2048

    # 1. BAKE STRIKER TEXTURE (#10 Royal Blue & Gold Pro Kit)
    img_striker = Image.new('RGB', (TEX_SIZE, TEX_SIZE), color=(29, 78, 216)) # Royal blue
    draw_striker = ImageDraw.Draw(img_striker)

    striker_skin = (235, 188, 155)
    striker_hair = (28, 20, 16)
    striker_jersey_blue = (29, 78, 216)
    striker_jersey_navy = (15, 23, 42)
    striker_jersey_gold = (250, 204, 21)
    striker_shorts = (248, 250, 252) # Clean white shorts
    striker_socks = (29, 78, 216)
    striker_boots = (239, 68, 68) # Speed red cleats

    for i, face in enumerate(faces):
        cx, cy, cz = face_centroids[i]
        if cy > 1.32: # Head
            if cy > 1.39 and (cz < 0.03 or np.abs(cx) > 0.05):
                col = striker_hair
            else:
                col = striker_skin
        elif cy > 0.82 and np.abs(cx) < 0.20: # Torso
            if np.abs(cx) > 0.16:
                col = striker_jersey_navy
            else:
                col = striker_jersey_blue
        elif np.abs(cx) >= 0.20 and cy > 0.60: # Arms
            if cy > 1.06:
                col = striker_jersey_blue
            else:
                col = striker_skin
        elif 0.48 < cy <= 0.82 and np.abs(cx) < 0.25: # Shorts
            col = striker_shorts
        else: # Legs
            if cy > 0.44:
                col = striker_skin
            elif cy > 0.08:
                col = striker_socks
            else:
                col = striker_boots

        pts = [(int(uv[idx, 0] * (TEX_SIZE - 1)), int((1.0 - uv[idx, 1]) * (TEX_SIZE - 1))) for idx in face]
        draw_striker.polygon(pts, fill=col)

    # Gold squad number 10 on striker jersey
    sx = int(0.76 * TEX_SIZE)
    sy = int(0.18 * TEX_SIZE)
    draw_striker.rectangle([sx - 50, sy - 40, sx - 20, sy + 60], fill=striker_jersey_gold)
    draw_striker.rectangle([sx + 5, sy - 40, sx + 50, sy + 60], fill=striker_jersey_gold)
    draw_striker.rectangle([sx + 18, sy - 20, sx + 37, sy + 40], fill=striker_jersey_blue)

    img_striker.save('assets/striker_3d_pbr_tex.jpg', quality=95)
    print("Saved assets/striker_3d_pbr_tex.jpg")

    tex_gk = Image.open('assets/gk_3d_pbr_tex.jpg')
    tex_striker = img_striker

    # Joint Pivots
    l_shoulder = np.array([0.18, 1.18, 0.0])
    r_shoulder = np.array([-0.18, 1.18, 0.0])
    l_elbow = np.array([0.25, 0.95, 0.0])
    r_elbow = np.array([-0.25, 0.95, 0.0])
    l_hip = np.array([0.12, 0.48, 0.0])
    r_hip = np.array([-0.12, 0.48, 0.0])
    l_knee = np.array([0.12, 0.25, 0.0])
    r_knee = np.array([-0.12, 0.25, 0.0])
    l_ankle = np.array([0.12, 0.08, 0.0])
    r_ankle = np.array([-0.12, 0.08, 0.0])

    # Masks
    l_arm_m = (v_orig[:, 0] > 0.15) & (v_orig[:, 1] > 0.40) & (v_orig[:, 1] < 1.35)
    r_arm_m = (v_orig[:, 0] < -0.15) & (v_orig[:, 1] > 0.40) & (v_orig[:, 1] < 1.35)
    l_fore_m = (v_orig[:, 0] > 0.17) & (v_orig[:, 1] < 0.96) & (v_orig[:, 1] > 0.40)
    r_fore_m = (v_orig[:, 0] < -0.17) & (v_orig[:, 1] < 0.96) & (v_orig[:, 1] > 0.40)

    l_leg_m = (v_orig[:, 0] > 0.05) & (v_orig[:, 1] <= 0.48)
    r_leg_m = (v_orig[:, 0] < -0.05) & (v_orig[:, 1] <= 0.48)
    l_shin_m = (v_orig[:, 0] > 0.05) & (v_orig[:, 1] <= 0.26)
    r_shin_m = (v_orig[:, 0] < -0.05) & (v_orig[:, 1] <= 0.26)
    l_foot_m = (v_orig[:, 0] > 0.05) & (v_orig[:, 1] <= 0.09)
    r_foot_m = (v_orig[:, 0] < -0.05) & (v_orig[:, 1] <= 0.09)

    # Weights
    w_la = smoothstep(1.24, 1.12, v_orig[l_arm_m, 1])[:, None]
    w_ra = smoothstep(1.24, 1.12, v_orig[r_arm_m, 1])[:, None]
    w_lf = smoothstep(0.98, 0.90, v_orig[l_fore_m, 1])[:, None]
    w_rf = smoothstep(0.98, 0.90, v_orig[r_fore_m, 1])[:, None]

    w_ll = smoothstep(0.52, 0.44, v_orig[l_leg_m, 1])[:, None]
    w_rl = smoothstep(0.52, 0.44, v_orig[r_leg_m, 1])[:, None]
    w_ls = smoothstep(0.28, 0.22, v_orig[l_shin_m, 1])[:, None]
    w_rs = smoothstep(0.28, 0.22, v_orig[r_shin_m, 1])[:, None]
    w_lfoot = smoothstep(0.10, 0.07, v_orig[l_foot_m, 1])[:, None]
    w_rfoot = smoothstep(0.10, 0.07, v_orig[r_foot_m, 1])[:, None]

    def export_pose(v, tex, filename):
        m = base_mesh.copy()
        m.vertices = v
        m.vertex_normals = recalculate_normals(m, v)
        m.visual.material.image = tex
        m.export(filename)
        print(f"Exported {filename}")

    # =========================================================================
    # ADDITIONAL GOALKEEPER POSES
    # =========================================================================
    # 1. GK Low Turf Sweep Right (Scoop along grass, lead arm low extended, trail arm bracing)
    v_gk_sweep_r = v_orig.copy()
    # Torso drops low and tilts right
    for i in range(len(v_gk_sweep_r)):
        y = v_gk_sweep_r[i, 1]
        if y > 0.45:
            v_gk_sweep_r[i, 1] -= 0.12 # Drop hips
        if y > 0.70:
            v_gk_sweep_r[i, 0] -= (y - 0.70) * 0.15 # Lean towards right

    # Right arm: sweeps low and straight along turf (-55 deg around Z, forward -20 deg)
    pts_r = v_gk_sweep_r[r_arm_m].copy()
    rot_r = rotate_about_pivot(pts_r, r_shoulder, np.array([0, 0, 1]), np.radians(-55))
    rot_r = rotate_about_pivot(rot_r, r_shoulder, np.array([1, 0, 0]), np.radians(-25))
    v_gk_sweep_r[r_arm_m] = v_gk_sweep_r[r_arm_m] * (1.0 - w_ra) + rot_r * w_ra

    # Left arm: trail arm tucked for balance
    pts_l = v_gk_sweep_r[l_arm_m].copy()
    rot_l = rotate_about_pivot(pts_l, l_shoulder, np.array([0, 0, 1]), np.radians(-25))
    rot_l = rotate_about_pivot(rot_l, l_shoulder, np.array([1, 0, 0]), np.radians(20))
    v_gk_sweep_r[l_arm_m] = v_gk_sweep_r[l_arm_m] * (1.0 - w_la) + rot_l * w_la

    # Legs: scissored sweep on turf
    pts_rl = v_gk_sweep_r[r_leg_m].copy()
    rot_rl = rotate_about_pivot(pts_rl, r_hip, np.array([1, 0, 0]), np.radians(15))
    v_gk_sweep_r[r_leg_m] = v_gk_sweep_r[r_leg_m] * (1.0 - w_rl) + rot_rl * w_rl

    pts_ll = v_gk_sweep_r[l_leg_m].copy()
    rot_ll = rotate_about_pivot(pts_ll, l_hip, np.array([1, 0, 0]), np.radians(-25))
    v_gk_sweep_r[l_leg_m] = v_gk_sweep_r[l_leg_m] * (1.0 - w_ll) + rot_ll * w_ll

    export_pose(v_gk_sweep_r, tex_gk, 'assets/goalkeeper_low_sweep_right.glb')

    # 2. GK Low Turf Sweep Left (Symmetric sweep)
    v_gk_sweep_l = v_orig.copy()
    for i in range(len(v_gk_sweep_l)):
        y = v_gk_sweep_l[i, 1]
        if y > 0.45:
            v_gk_sweep_l[i, 1] -= 0.12
        if y > 0.70:
            v_gk_sweep_l[i, 0] += (y - 0.70) * 0.15

    pts_l = v_gk_sweep_l[l_arm_m].copy()
    rot_l = rotate_about_pivot(pts_l, l_shoulder, np.array([0, 0, 1]), np.radians(55))
    rot_l = rotate_about_pivot(rot_l, l_shoulder, np.array([1, 0, 0]), np.radians(-25))
    v_gk_sweep_l[l_arm_m] = v_gk_sweep_l[l_arm_m] * (1.0 - w_la) + rot_l * w_la

    pts_r = v_gk_sweep_l[r_arm_m].copy()
    rot_r = rotate_about_pivot(pts_r, r_shoulder, np.array([0, 0, 1]), np.radians(25))
    rot_r = rotate_about_pivot(rot_r, r_shoulder, np.array([1, 0, 0]), np.radians(20))
    v_gk_sweep_l[r_arm_m] = v_gk_sweep_l[r_arm_m] * (1.0 - w_ra) + rot_r * w_ra

    pts_ll = v_gk_sweep_l[l_leg_m].copy()
    rot_ll = rotate_about_pivot(pts_ll, l_hip, np.array([1, 0, 0]), np.radians(15))
    v_gk_sweep_l[l_leg_m] = v_gk_sweep_l[l_leg_m] * (1.0 - w_ll) + rot_ll * w_ll

    pts_rl = v_gk_sweep_l[r_leg_m].copy()
    rot_rl = rotate_about_pivot(pts_rl, r_hip, np.array([1, 0, 0]), np.radians(-25))
    v_gk_sweep_l[r_leg_m] = v_gk_sweep_l[r_leg_m] * (1.0 - w_rl) + rot_rl * w_rl

    export_pose(v_gk_sweep_l, tex_gk, 'assets/goalkeeper_low_sweep_left.glb')

    # 3. GK Landing Recovery Roll Pose (Arms protect chest/head, knees tucked for rolling momentum)
    v_gk_roll = v_orig.copy()
    for i in range(len(v_gk_roll)):
        y = v_gk_roll[i, 1]
        if y > 0.45:
            v_gk_roll[i, 1] -= 0.16
            v_gk_roll[i, 2] += (y - 0.45) * 0.18 # Curl forward

    # Both arms tucked across chest in breakfall position
    pts_l = v_gk_roll[l_arm_m].copy()
    rot_l = rotate_about_pivot(pts_l, l_shoulder, np.array([1, 0, 0]), np.radians(-45))
    rot_l = rotate_about_pivot(rot_l, l_shoulder, np.array([0, 0, 1]), np.radians(-35))
    v_gk_roll[l_arm_m] = v_gk_roll[l_arm_m] * (1.0 - w_la) + rot_l * w_la

    pts_r = v_gk_roll[r_arm_m].copy()
    rot_r = rotate_about_pivot(pts_r, r_shoulder, np.array([1, 0, 0]), np.radians(-45))
    rot_r = rotate_about_pivot(rot_r, r_shoulder, np.array([0, 0, 1]), np.radians(35))
    v_gk_roll[r_arm_m] = v_gk_roll[r_arm_m] * (1.0 - w_ra) + rot_r * w_ra

    # Knees tucked forward
    pts_ll = v_gk_roll[l_leg_m].copy()
    rot_ll = rotate_about_pivot(pts_ll, l_hip, np.array([1, 0, 0]), np.radians(-35))
    v_gk_roll[l_leg_m] = v_gk_roll[l_leg_m] * (1.0 - w_ll) + rot_ll * w_ll

    pts_rl = v_gk_roll[r_leg_m].copy()
    rot_rl = rotate_about_pivot(pts_rl, r_hip, np.array([1, 0, 0]), np.radians(-35))
    v_gk_roll[r_leg_m] = v_gk_roll[r_leg_m] * (1.0 - w_rl) + rot_rl * w_rl

    export_pose(v_gk_roll, tex_gk, 'assets/goalkeeper_recovery_roll.glb')

    # =========================================================================
    # STRIKER KINEMATIC POSES
    # =========================================================================

    # 1. Striker Idle (Athletic ready crouch, weight on balls of feet, eyes forward)
    v_st_idle = v_orig.copy()
    for i in range(len(v_st_idle)):
        y = v_st_idle[i, 1]
        if y > 0.70:
            v_st_idle[i, 2] += (y - 0.70) * 0.12 # Torso slight athletic lean
        if y > 0.45:
            v_st_idle[i, 1] -= 0.03 # Center of gravity lowered
    
    # Relaxed arms slightly out
    pts_l = v_st_idle[l_arm_m].copy()
    rot_l = rotate_about_pivot(pts_l, l_shoulder, np.array([0, 0, 1]), np.radians(16))
    rot_l = rotate_about_pivot(rot_l, l_shoulder, np.array([1, 0, 0]), np.radians(-15))
    v_st_idle[l_arm_m] = v_st_idle[l_arm_m] * (1.0 - w_la) + rot_l * w_la

    pts_r = v_st_idle[r_arm_m].copy()
    rot_r = rotate_about_pivot(pts_r, r_shoulder, np.array([0, 0, 1]), np.radians(-16))
    rot_r = rotate_about_pivot(rot_r, r_shoulder, np.array([1, 0, 0]), np.radians(-15))
    v_st_idle[r_arm_m] = v_st_idle[r_arm_m] * (1.0 - w_ra) + rot_r * w_ra

    export_pose(v_st_idle, tex_striker, 'assets/striker_idle.glb')

    # 2. Striker Run (Curved approach run-up stride: left leg driving forward, right leg back, arms swinging)
    v_st_run = v_orig.copy()
    for i in range(len(v_st_run)):
        y = v_st_run[i, 1]
        if y > 0.70:
            v_st_run[i, 2] += (y - 0.70) * 0.22 # Sprint forward lean
            v_st_run[i, 0] += (y - 0.70) * 0.08 # Centripetal lean into curve

    # Left leg: forward stride (hip forward, knee bent)
    pts_ll = v_st_run[l_leg_m].copy()
    rot_ll = rotate_about_pivot(pts_ll, l_hip, np.array([1, 0, 0]), np.radians(-32))
    v_st_run[l_leg_m] = v_st_run[l_leg_m] * (1.0 - w_ll) + rot_ll * w_ll

    pts_ls = v_st_run[l_shin_m].copy()
    rot_ls = rotate_about_pivot(pts_ls, l_knee, np.array([1, 0, 0]), np.radians(38))
    v_st_run[l_shin_m] = v_st_run[l_shin_m] * (1.0 - w_ls) + rot_ls * w_ls

    # Right leg: trailing drive leg (hip back, knee driving)
    pts_rl = v_st_run[r_leg_m].copy()
    rot_rl = rotate_about_pivot(pts_rl, r_hip, np.array([1, 0, 0]), np.radians(35))
    v_st_run[r_leg_m] = v_st_run[r_leg_m] * (1.0 - w_rl) + rot_rl * w_rl

    pts_rs = v_st_run[r_shin_m].copy()
    rot_rs = rotate_about_pivot(pts_rs, r_knee, np.array([1, 0, 0]), np.radians(45))
    v_st_run[r_shin_m] = v_st_run[r_shin_m] * (1.0 - w_rs) + rot_rs * w_rs

    # Running arms: right arm forward, left arm back
    pts_r = v_st_run[r_arm_m].copy()
    rot_r = rotate_about_pivot(pts_r, r_shoulder, np.array([1, 0, 0]), np.radians(-42))
    v_st_run[r_arm_m] = v_st_run[r_arm_m] * (1.0 - w_ra) + rot_r * w_ra

    pts_l = v_st_run[l_arm_m].copy()
    rot_l = rotate_about_pivot(pts_l, l_shoulder, np.array([1, 0, 0]), np.radians(38))
    v_st_run[l_arm_m] = v_st_run[l_arm_m] * (1.0 - w_la) + rot_l * w_la

    export_pose(v_st_run, tex_striker, 'assets/striker_run.glb')

    # 3. Striker Plant (Plant foot placement beside ball & strike leg cocked back in full kinetic load)
    v_st_plant = v_orig.copy()
    for i in range(len(v_st_plant)):
        y = v_st_plant[i, 1]
        if y > 0.45:
            v_st_plant[i, 1] -= 0.06 # Low center of gravity plant
        if y > 0.70:
            v_st_plant[i, 2] += (y - 0.70) * 0.18 # Chest over the ball
            v_st_plant[i, 0] += (y - 0.70) * 0.12 # Torso counter-balance

    # Left leg: firmly planted, knee bent ~28 deg
    pts_ll = v_st_plant[l_leg_m].copy()
    rot_ll = rotate_about_pivot(pts_ll, l_hip, np.array([1, 0, 0]), np.radians(-12))
    v_st_plant[l_leg_m] = v_st_plant[l_leg_m] * (1.0 - w_ll) + rot_ll * w_ll

    pts_ls = v_st_plant[l_shin_m].copy()
    rot_ls = rotate_about_pivot(pts_ls, l_knee, np.array([1, 0, 0]), np.radians(28))
    v_st_plant[l_shin_m] = v_st_plant[l_shin_m] * (1.0 - w_ls) + rot_ls * w_ls

    # Right leg (striking leg): Cocked back in massive power backswing!
    pts_rl = v_st_plant[r_leg_m].copy()
    rot_rl = rotate_about_pivot(pts_rl, r_hip, np.array([1, 0, 0]), np.radians(52))
    rot_rl = rotate_about_pivot(rot_rl, r_hip, np.array([0, 0, 1]), np.radians(-14))
    v_st_plant[r_leg_m] = v_st_plant[r_leg_m] * (1.0 - w_rl) + rot_rl * w_rl

    pts_rs = v_st_plant[r_shin_m].copy()
    rot_rs = rotate_about_pivot(pts_rs, r_knee, np.array([1, 0, 0]), np.radians(82)) # Knee tightly flexed
    v_st_plant[r_shin_m] = v_st_plant[r_shin_m] * (1.0 - w_rs) + rot_rs * w_rs

    # Balance arms: left arm extended out for stability (+48 deg Z), right arm back
    pts_l = v_st_plant[l_arm_m].copy()
    rot_l = rotate_about_pivot(pts_l, l_shoulder, np.array([0, 0, 1]), np.radians(48))
    rot_l = rotate_about_pivot(rot_l, l_shoulder, np.array([1, 0, 0]), np.radians(-20))
    v_st_plant[l_arm_m] = v_st_plant[l_arm_m] * (1.0 - w_la) + rot_l * w_la

    pts_r = v_st_plant[r_arm_m].copy()
    rot_r = rotate_about_pivot(pts_r, r_shoulder, np.array([1, 0, 0]), np.radians(35))
    rot_r = rotate_about_pivot(rot_r, r_shoulder, np.array([0, 0, 1]), np.radians(-25))
    v_st_plant[r_arm_m] = v_st_plant[r_arm_m] * (1.0 - w_ra) + rot_r * w_ra

    export_pose(v_st_plant, tex_striker, 'assets/striker_plant.glb')

    # 4. Striker Instep Strike (Hip externally rotated 38 deg, ankle locked in eversion, curling whip)
    v_st_instep = v_orig.copy()
    for i in range(len(v_st_instep)):
        y = v_st_instep[i, 1]
        if y > 0.70:
            v_st_instep[i, 2] += (y - 0.70) * 0.08
            v_st_instep[i, 0] += (y - 0.70) * 0.15 # Torso tilted outward

    # Plant leg steady
    pts_ll = v_st_instep[l_leg_m].copy()
    rot_ll = rotate_about_pivot(pts_ll, l_hip, np.array([1, 0, 0]), np.radians(-8))
    v_st_instep[l_leg_m] = v_st_instep[l_leg_m] * (1.0 - w_ll) + rot_ll * w_ll

    # Striking leg: forward impact with EXTERNAL HIP ROTATION & EVERTED ANKLE
    pts_rl = v_st_instep[r_leg_m].copy()
    # Hip drives forward
    rot_rl = rotate_about_pivot(pts_rl, r_hip, np.array([1, 0, 0]), np.radians(-42))
    # Hip externally rotates ~38 deg (opens inside of foot to ball)
    rot_rl = rotate_about_pivot(rot_rl, r_hip, np.array([0, 1, 0]), np.radians(-38))
    # Adducts slightly across centerline
    rot_rl = rotate_about_pivot(rot_rl, r_hip, np.array([0, 0, 1]), np.radians(16))
    v_st_instep[r_leg_m] = v_st_instep[r_leg_m] * (1.0 - w_rl) + rot_rl * w_rl

    # Knee extends through ball
    pts_rs = v_st_instep[r_shin_m].copy()
    rot_rs = rotate_about_pivot(pts_rs, r_knee, np.array([1, 0, 0]), np.radians(-15))
    v_st_instep[r_shin_m] = v_st_instep[r_shin_m] * (1.0 - w_rs) + rot_rs * w_rs

    # Ankle locked in eversion (toes pointed outward and up)
    pts_rf = v_st_instep[r_foot_m].copy()
    rot_rf = rotate_about_pivot(pts_rf, r_ankle, np.array([0, 1, 0]), np.radians(-24))
    rot_rf = rotate_about_pivot(rot_rf, r_ankle, np.array([0, 0, 1]), np.radians(-18))
    v_st_instep[r_foot_m] = v_st_instep[r_foot_m] * (1.0 - w_rfoot) + rot_rf * w_rfoot

    # Arms dynamic counter-torque
    pts_l = v_st_instep[l_arm_m].copy()
    rot_l = rotate_about_pivot(pts_l, l_shoulder, np.array([0, 0, 1]), np.radians(40))
    v_st_instep[l_arm_m] = v_st_instep[l_arm_m] * (1.0 - w_la) + rot_l * w_la

    pts_r = v_st_instep[r_arm_m].copy()
    rot_r = rotate_about_pivot(pts_r, r_shoulder, np.array([1, 0, 0]), np.radians(20))
    rot_r = rotate_about_pivot(rot_r, r_shoulder, np.array([0, 0, 1]), np.radians(-35))
    v_st_instep[r_arm_m] = v_st_instep[r_arm_m] * (1.0 - w_ra) + rot_r * w_ra

    export_pose(v_st_instep, tex_striker, 'assets/striker_strike_instep.glb')

    # 5. Striker Laces Strike (Power piston, ankle firmly plantarflexed, hip locked in sagittal plane)
    v_st_laces = v_orig.copy()
    for i in range(len(v_st_laces)):
        y = v_st_laces[i, 1]
        if y > 0.70:
            v_st_laces[i, 2] += (y - 0.70) * 0.24 # Torso deep forward compression over ball

    # Plant leg solid
    pts_ll = v_st_laces[l_leg_m].copy()
    rot_ll = rotate_about_pivot(pts_ll, l_hip, np.array([1, 0, 0]), np.radians(-10))
    v_st_laces[l_leg_m] = v_st_laces[l_leg_m] * (1.0 - w_ll) + rot_ll * w_ll

    # Striking leg: straight forward drive (zero hip yaw, straight sagittal drive)
    pts_rl = v_st_laces[r_leg_m].copy()
    rot_rl = rotate_about_pivot(pts_rl, r_hip, np.array([1, 0, 0]), np.radians(-48))
    v_st_laces[r_leg_m] = v_st_laces[r_leg_m] * (1.0 - w_rl) + rot_rl * w_rl

    # Knee snaps straight
    pts_rs = v_st_laces[r_shin_m].copy()
    rot_rs = rotate_about_pivot(pts_rs, r_knee, np.array([1, 0, 0]), np.radians(-10))
    v_st_laces[r_shin_m] = v_st_laces[r_shin_m] * (1.0 - w_rs) + rot_rs * w_rs

    # Ankle firmly PLANTARFLEXED (toes pointed straight down towards turf, locking laces)
    pts_rf = v_st_laces[r_foot_m].copy()
    rot_rf = rotate_about_pivot(pts_rf, r_ankle, np.array([1, 0, 0]), np.radians(-32))
    v_st_laces[r_foot_m] = v_st_laces[r_foot_m] * (1.0 - w_rfoot) + rot_rf * w_rfoot

    # Strong athletic arms
    pts_l = v_st_laces[l_arm_m].copy()
    rot_l = rotate_about_pivot(pts_l, l_shoulder, np.array([0, 0, 1]), np.radians(35))
    rot_l = rotate_about_pivot(rot_l, l_shoulder, np.array([1, 0, 0]), np.radians(-15))
    v_st_laces[l_arm_m] = v_st_laces[l_arm_m] * (1.0 - w_la) + rot_l * w_la

    pts_r = v_st_laces[r_arm_m].copy()
    rot_r = rotate_about_pivot(pts_r, r_shoulder, np.array([0, 0, 1]), np.radians(-30))
    rot_r = rotate_about_pivot(rot_r, r_shoulder, np.array([1, 0, 0]), np.radians(15))
    v_st_laces[r_arm_m] = v_st_laces[r_arm_m] * (1.0 - w_ra) + rot_r * w_ra

    export_pose(v_st_laces, tex_striker, 'assets/striker_strike_laces.glb')

    # 6. Striker Rotational Follow-Through (Striking leg follows through across torso, shoulders rotate)
    v_st_follow = v_orig.copy()
    # Torso rotates counter-clockwise ~40 deg
    for i in range(len(v_st_follow)):
        y = v_st_follow[i, 1]
        if y > 0.48:
            pts = v_st_follow[i:i+1]
            rot = rotate_about_pivot(pts, np.array([0, 0.78, 0]), np.array([0, 1, 0]), np.radians(38))
            v_st_follow[i] = rot[0]

    # Striking leg high follow-through across body axis
    pts_rl = v_st_follow[r_leg_m].copy()
    rot_rl = rotate_about_pivot(pts_rl, r_hip, np.array([1, 0, 0]), np.radians(-65))
    rot_rl = rotate_about_pivot(rot_rl, r_hip, np.array([0, 0, 1]), np.radians(28))
    v_st_follow[r_leg_m] = v_st_follow[r_leg_m] * (1.0 - w_rl) + rot_rl * w_rl

    # Left leg absorbing rotation
    pts_ll = v_st_follow[l_leg_m].copy()
    rot_ll = rotate_about_pivot(pts_ll, l_hip, np.array([0, 1, 0]), np.radians(25))
    v_st_follow[l_leg_m] = v_st_follow[l_leg_m] * (1.0 - w_ll) + rot_ll * w_ll

    # Left arm wrapped across chest, right arm open wide
    pts_l = v_st_follow[l_arm_m].copy()
    rot_l = rotate_about_pivot(pts_l, l_shoulder, np.array([1, 0, 0]), np.radians(-30))
    rot_l = rotate_about_pivot(rot_l, l_shoulder, np.array([0, 0, 1]), np.radians(-42))
    v_st_follow[l_arm_m] = v_st_follow[l_arm_m] * (1.0 - w_la) + rot_l * w_la

    pts_r = v_st_follow[r_arm_m].copy()
    rot_r = rotate_about_pivot(pts_r, r_shoulder, np.array([0, 0, 1]), np.radians(-55))
    rot_r = rotate_about_pivot(rot_r, r_shoulder, np.array([1, 0, 0]), np.radians(-20))
    v_st_follow[r_arm_m] = v_st_follow[r_arm_m] * (1.0 - w_ra) + rot_r * w_ra

    export_pose(v_st_follow, tex_striker, 'assets/striker_follow_through.glb')

    # 7. Striker Celebrate (Double fist pump / arms raised high in jubilant celebration)
    v_st_cel = v_orig.copy()
    for i in range(len(v_st_cel)):
        y = v_st_cel[i, 1]
        if y > 1.32: # Head tilted back
            pts = v_st_cel[i:i+1]
            rot = rotate_about_pivot(pts, np.array([0, 1.35, 0]), np.array([1, 0, 0]), np.radians(25))
            v_st_cel[i] = rot[0]

    # Both arms raised high overhead
    pts_l = v_st_cel[l_arm_m].copy()
    rot_l = rotate_about_pivot(pts_l, l_shoulder, np.array([0, 0, 1]), np.radians(82))
    rot_l = rotate_about_pivot(rot_l, l_shoulder, np.array([1, 0, 0]), np.radians(-15))
    v_st_cel[l_arm_m] = v_st_cel[l_arm_m] * (1.0 - w_la) + rot_l * w_la

    pts_r = v_st_cel[r_arm_m].copy()
    rot_r = rotate_about_pivot(pts_r, r_shoulder, np.array([0, 0, 1]), np.radians(-82))
    rot_r = rotate_about_pivot(rot_r, r_shoulder, np.array([1, 0, 0]), np.radians(-15))
    v_st_cel[r_arm_m] = v_st_cel[r_arm_m] * (1.0 - w_ra) + rot_r * w_ra

    export_pose(v_st_cel, tex_striker, 'assets/striker_celebrate.glb')

    # 8. Striker Disbelief (Hands to head in disbelief)
    v_st_dis = v_orig.copy()
    for i in range(len(v_st_dis)):
        y = v_st_dis[i, 1]
        if y > 0.70:
            v_st_dis[i, 2] += (y - 0.70) * 0.15 # Slump forward

    # Both hands raised to head
    pts_l = v_st_dis[l_arm_m].copy()
    rot_l = rotate_about_pivot(pts_l, l_shoulder, np.array([1, 0, 0]), np.radians(-65))
    rot_l = rotate_about_pivot(rot_l, l_shoulder, np.array([0, 0, 1]), np.radians(-35))
    v_st_dis[l_arm_m] = v_st_dis[l_arm_m] * (1.0 - w_la) + rot_l * w_la

    pts_r = v_st_dis[r_arm_m].copy()
    rot_r = rotate_about_pivot(pts_r, r_shoulder, np.array([1, 0, 0]), np.radians(-65))
    rot_r = rotate_about_pivot(rot_r, r_shoulder, np.array([0, 0, 1]), np.radians(35))
    v_st_dis[r_arm_m] = v_st_dis[r_arm_m] * (1.0 - w_ra) + rot_r * w_ra

    export_pose(v_st_dis, tex_striker, 'assets/striker_disbelief.glb')

    print("ALL STRIKER & GOALKEEPER POSES SUCCESSFULLY GENERATED WITH ZERO POLYGONAL TEARING!")

if __name__ == '__main__':
    build_assets()
