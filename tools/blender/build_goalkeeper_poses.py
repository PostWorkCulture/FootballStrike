import trimesh
import numpy as np
from PIL import Image

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

def generate_poses():
    base_mesh = trimesh.load('assets/football_player.obj')
    tex = Image.open('assets/gk_3d_pbr_tex.jpg')
    base_v = base_mesh.vertices.copy()

    # Shoulder and elbow pivot coordinates
    l_shoulder = np.array([0.18, 1.18, 0.0])
    l_elbow = np.array([0.25, 0.95, 0.0])
    r_shoulder = np.array([-0.18, 1.18, 0.0])
    r_elbow = np.array([-0.25, 0.95, 0.0])

    # Masks
    l_arm_mask = (base_v[:, 0] > 0.15) & (base_v[:, 1] > 0.40) & (base_v[:, 1] < 1.35)
    r_arm_mask = (base_v[:, 0] < -0.15) & (base_v[:, 1] > 0.40) & (base_v[:, 1] < 1.35)
    l_forearm_mask = (base_v[:, 0] > 0.17) & (base_v[:, 1] < 0.96) & (base_v[:, 1] > 0.40)
    r_forearm_mask = (base_v[:, 0] < -0.17) & (base_v[:, 1] < 0.96) & (base_v[:, 1] > 0.40)

    # Weights
    w_l_arm = smoothstep(1.24, 1.12, base_v[l_arm_mask, 1])
    w_r_arm = smoothstep(1.24, 1.12, base_v[r_arm_mask, 1])
    w_l_fore = smoothstep(0.98, 0.90, base_v[l_forearm_mask, 1])
    w_r_fore = smoothstep(0.98, 0.90, base_v[r_forearm_mask, 1])

    # -------------------------------------------------------------------------
    # 1. IDLE READY STANCE
    # -------------------------------------------------------------------------
    v_idle = base_v.copy()
    # Torso tilt forward, lower hips
    for i in range(len(v_idle)):
        y = v_idle[i, 1]
        if y > 0.70:
            v_idle[i, 2] += (y - 0.70) * 0.10
        if y > 0.45:
            v_idle[i, 1] -= 0.04

    # Left arm: swing forward +38 deg, bend elbow forward/up +55 deg
    pts = v_idle[l_arm_mask].copy()
    rot = rotate_about_pivot(pts, l_shoulder, np.array([1, 0, 0]), np.radians(-38))
    rot = rotate_about_pivot(rot, l_shoulder, np.array([0, 0, 1]), np.radians(18))
    v_idle[l_arm_mask] = v_idle[l_arm_mask] * (1.0 - w_l_arm[:, None]) + rot * w_l_arm[:, None]

    pts_f = v_idle[l_forearm_mask].copy()
    rot_f = rotate_about_pivot(pts_f, l_elbow, np.array([1, 0, 0]), np.radians(-50))
    rot_f = rotate_about_pivot(rot_f, l_elbow, np.array([0, 1, 0]), np.radians(20))
    v_idle[l_forearm_mask] = v_idle[l_forearm_mask] * (1.0 - w_l_fore[:, None]) + rot_f * w_l_fore[:, None]

    # Right arm: swing forward +38 deg, bend elbow forward/up +55 deg
    pts = v_idle[r_arm_mask].copy()
    rot = rotate_about_pivot(pts, r_shoulder, np.array([1, 0, 0]), np.radians(-38))
    rot = rotate_about_pivot(rot, r_shoulder, np.array([0, 0, 1]), np.radians(-18))
    v_idle[r_arm_mask] = v_idle[r_arm_mask] * (1.0 - w_r_arm[:, None]) + rot * w_r_arm[:, None]

    pts_f = v_idle[r_forearm_mask].copy()
    rot_f = rotate_about_pivot(pts_f, r_elbow, np.array([1, 0, 0]), np.radians(-50))
    rot_f = rotate_about_pivot(rot_f, r_elbow, np.array([0, 1, 0]), np.radians(-20))
    v_idle[r_forearm_mask] = v_idle[r_forearm_mask] * (1.0 - w_r_fore[:, None]) + rot_f * w_r_fore[:, None]

    m_idle = base_mesh.copy()
    m_idle.vertices = v_idle
    m_idle.vertex_normals = recalculate_normals(m_idle, v_idle)
    m_idle.visual.material.image = tex
    m_idle.export('assets/goalkeeper_pro_3d.glb') # Replace default with athletic idle ready crouch
    print("Saved assets/goalkeeper_pro_3d.glb (Athletic Ready Stance)")

    # -------------------------------------------------------------------------
    # 2. DIVE RIGHT REACH (High / Top Corner Stretch)
    # -------------------------------------------------------------------------
    v_dive_r = base_v.copy()
    # Right arm: Lead arm elevates overhead (+75 deg around Z) and extends straight
    pts_r = v_dive_r[r_arm_mask].copy()
    # Rotate around Z by +75 deg (raising right arm up overhead towards right)
    rot_r = rotate_about_pivot(pts_r, r_shoulder, np.array([0, 0, 1]), np.radians(75))
    # Push slightly forward around X (-15 deg)
    rot_r = rotate_about_pivot(rot_r, r_shoulder, np.array([1, 0, 0]), np.radians(-15))
    v_dive_r[r_arm_mask] = v_dive_r[r_arm_mask] * (1.0 - w_r_arm[:, None]) + rot_r * w_r_arm[:, None]

    # Left arm: Trail arm across torso for aerodynamic flight balance
    pts_l = v_dive_r[l_arm_mask].copy()
    rot_l = rotate_about_pivot(pts_l, l_shoulder, np.array([0, 0, 1]), np.radians(-35))
    rot_l = rotate_about_pivot(rot_l, l_shoulder, np.array([1, 0, 0]), np.radians(-25))
    v_dive_r[l_arm_mask] = v_dive_r[l_arm_mask] * (1.0 - w_l_arm[:, None]) + rot_l * w_l_arm[:, None]

    m_dive_r = base_mesh.copy()
    m_dive_r.vertices = v_dive_r
    m_dive_r.vertex_normals = recalculate_normals(m_dive_r, v_dive_r)
    m_dive_r.visual.material.image = tex
    m_dive_r.export('assets/goalkeeper_dive_right.glb')
    print("Saved assets/goalkeeper_dive_right.glb (Full Extension Reach Right)")

    # -------------------------------------------------------------------------
    # 3. DIVE LEFT REACH (High / Top Corner Stretch)
    # -------------------------------------------------------------------------
    v_dive_l = base_v.copy()
    # Left arm: Lead arm elevates overhead (-75 deg around Z) and extends straight
    pts_l = v_dive_l[l_arm_mask].copy()
    rot_l = rotate_about_pivot(pts_l, l_shoulder, np.array([0, 0, 1]), np.radians(-75))
    rot_l = rotate_about_pivot(rot_l, l_shoulder, np.array([1, 0, 0]), np.radians(-15))
    v_dive_l[l_arm_mask] = v_dive_l[l_arm_mask] * (1.0 - w_l_arm[:, None]) + rot_l * w_l_arm[:, None]

    # Right arm: Trail arm across torso
    pts_r = v_dive_l[r_arm_mask].copy()
    rot_r = rotate_about_pivot(pts_r, r_shoulder, np.array([0, 0, 1]), np.radians(35))
    rot_r = rotate_about_pivot(rot_r, r_shoulder, np.array([1, 0, 0]), np.radians(-25))
    v_dive_l[r_arm_mask] = v_dive_l[r_arm_mask] * (1.0 - w_r_arm[:, None]) + rot_r * w_r_arm[:, None]

    m_dive_l = base_mesh.copy()
    m_dive_l.vertices = v_dive_l
    m_dive_l.vertex_normals = recalculate_normals(m_dive_l, v_dive_l)
    m_dive_l.visual.material.image = tex
    m_dive_l.export('assets/goalkeeper_dive_left.glb')
    print("Saved assets/goalkeeper_dive_left.glb (Full Extension Reach Left)")

    # -------------------------------------------------------------------------
    # 4. PARRY (Two-Handed Forward Push / Block)
    # -------------------------------------------------------------------------
    v_parry = base_v.copy()
    # Left arm forward & spread
    pts_l = v_parry[l_arm_mask].copy()
    rot_l = rotate_about_pivot(pts_l, l_shoulder, np.array([1, 0, 0]), np.radians(-65))
    rot_l = rotate_about_pivot(rot_l, l_shoulder, np.array([0, 0, 1]), np.radians(28))
    v_parry[l_arm_mask] = v_parry[l_arm_mask] * (1.0 - w_l_arm[:, None]) + rot_l * w_l_arm[:, None]

    # Right arm forward & spread
    pts_r = v_parry[r_arm_mask].copy()
    rot_r = rotate_about_pivot(pts_r, r_shoulder, np.array([1, 0, 0]), np.radians(-65))
    rot_r = rotate_about_pivot(rot_r, r_shoulder, np.array([0, 0, 1]), np.radians(-28))
    v_parry[r_arm_mask] = v_parry[r_arm_mask] * (1.0 - w_r_arm[:, None]) + rot_r * w_r_arm[:, None]

    m_parry = base_mesh.copy()
    m_parry.vertices = v_parry
    m_parry.vertex_normals = recalculate_normals(m_parry, v_parry)
    m_parry.visual.material.image = tex
    m_parry.export('assets/goalkeeper_parry.glb')
    print("Saved assets/goalkeeper_parry.glb (Double-Handed Parry Block)")

if __name__ == '__main__':
    generate_poses()
