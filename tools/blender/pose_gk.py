import trimesh
import numpy as np

def smoothstep(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)

def rotate_about_pivot(points, pivot, axis, angle_rad):
    # Axis-angle rotation using Rodrigues formula
    axis = axis / np.linalg.norm(axis)
    p = points - pivot
    cos_a = np.cos(angle_rad)
    sin_a = np.sin(angle_rad)
    
    # p * cos_a + (axis x p) * sin_a + axis * (axis . p) * (1 - cos_a)
    cross_prod = np.cross(axis, p)
    dot_prod = np.dot(p, axis)
    
    rotated = p * cos_a + cross_prod * sin_a + np.outer(dot_prod, axis) * (1.0 - cos_a)
    return rotated + pivot

def pose_goalkeeper():
    from PIL import Image
    mesh = trimesh.load('assets/football_player.obj')
    tex = Image.open('assets/gk_tex_baked.png')
    mesh.visual.material.image = tex
    v = mesh.vertices.copy()
    
    # Goalkeeper Pose:
    # 1. Bend knees and lower stance slightly
    # Knees bend backward, torso lowers by 0.08m
    for i in range(len(v)):
        y = v[i, 1]
        if y > 0.45:
            # Lower upper body
            v[i, 1] -= 0.06
            # Tilt torso slightly forward
            if y > 0.75:
                v[i, 2] += (y - 0.75) * 0.15

    # 2. Left Arm: raise forward and inward (ready to save)
    # Left shoulder around (0.18, 1.16, 0)
    l_shoulder = np.array([0.18, 1.16, 0.0])
    l_arm_mask = (v[:, 0] > 0.16) & (v[:, 1] > 0.65)
    
    # Weight blend from shoulder down
    w_l_arm = smoothstep(1.22, 1.12, v[l_arm_mask, 1])
    
    # Rotate left upper arm forward around X axis by +40 deg and inward around Y by -20 deg
    pts_l = v[l_arm_mask].copy()
    rot_fwd = rotate_about_pivot(pts_l, l_shoulder, np.array([1, 0, 0]), np.radians(-45)) # swing forward
    rot_in = rotate_about_pivot(rot_fwd, l_shoulder, np.array([0, 0, 1]), np.radians(20)) # lift up
    v[l_arm_mask] = v[l_arm_mask] * (1.0 - w_l_arm[:, None]) + rot_in * w_l_arm[:, None]

    # 3. Right Arm: raise forward and inward
    r_shoulder = np.array([-0.18, 1.16, 0.0])
    r_arm_mask = (v[:, 0] < -0.16) & (v[:, 1] > 0.65)
    w_r_arm = smoothstep(1.22, 1.12, v[r_arm_mask, 1])
    
    pts_r = v[r_arm_mask].copy()
    rot_fwd_r = rotate_about_pivot(pts_r, r_shoulder, np.array([1, 0, 0]), np.radians(-45))
    rot_in_r = rotate_about_pivot(rot_fwd_r, r_shoulder, np.array([0, 0, 1]), np.radians(-20))
    v[r_arm_mask] = v[r_arm_mask] * (1.0 - w_r_arm[:, None]) + rot_in_r * w_r_arm[:, None]

    mesh.vertices = v
    # Compute vertex normals in pure numpy without scipy
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
    mesh.vertex_normals = (normals / lens).astype(np.float32)

    mesh.export('assets/goalkeeper_3d_posed.glb')
    print("Exported assets/goalkeeper_3d_posed.glb")

pose_goalkeeper()
