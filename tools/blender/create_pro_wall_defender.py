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

def generate_wall_defender_mesh():
    mesh = trimesh.load('assets/football_player.obj')
    tex = Image.open('assets/wall_3d_pbr_tex.jpg')
    mesh.visual.material.image = tex
    v = mesh.vertices.copy()

    # 1. Torso athletic forward tense anticipation tilt
    for i in range(len(v)):
        y = v[i, 1]
        if y > 0.70:
            v[i, 2] += (y - 0.70) * 0.08
        if y > 0.45 and y < 0.85:
            # Slight knee bend / lower center of gravity
            v[i, 1] -= 0.02

    # 2. Left Arm: rotate inward across lower abdomen/groin (wall protection stance)
    l_shoulder = np.array([0.18, 1.18, 0.0])
    l_arm_mask = (v[:, 0] > 0.14) & (v[:, 1] > 0.50) & (v[:, 1] < 1.35)
    w_l_arm = smoothstep(1.22, 1.10, v[l_arm_mask, 1])

    pts_l = v[l_arm_mask].copy()
    # Swing forward slightly (+15 deg around X)
    rot_fwd_l = rotate_about_pivot(pts_l, l_shoulder, np.array([1, 0, 0]), np.radians(-18))
    # Swing inward across chest/groin (-40 deg around Z)
    rot_in_l = rotate_about_pivot(rot_fwd_l, l_shoulder, np.array([0, 0, 1]), np.radians(-42))
    # Twist forearm slightly inward (-25 deg around Y)
    rot_yaw_l = rotate_about_pivot(rot_in_l, l_shoulder, np.array([0, 1, 0]), np.radians(25))
    v[l_arm_mask] = v[l_arm_mask] * (1.0 - w_l_arm[:, None]) + rot_yaw_l * w_l_arm[:, None]

    # 3. Right Arm: rotate inward across lower abdomen/groin
    r_shoulder = np.array([-0.18, 1.18, 0.0])
    r_arm_mask = (v[:, 0] < -0.14) & (v[:, 1] > 0.50) & (v[:, 1] < 1.35)
    w_r_arm = smoothstep(1.22, 1.10, v[r_arm_mask, 1])

    pts_r = v[r_arm_mask].copy()
    rot_fwd_r = rotate_about_pivot(pts_r, r_shoulder, np.array([1, 0, 0]), np.radians(-18))
    rot_in_r = rotate_about_pivot(rot_fwd_r, r_shoulder, np.array([0, 0, 1]), np.radians(42))
    rot_yaw_r = rotate_about_pivot(rot_in_r, r_shoulder, np.array([0, 1, 0]), np.radians(-25))
    v[r_arm_mask] = v[r_arm_mask] * (1.0 - w_r_arm[:, None]) + rot_yaw_r * w_r_arm[:, None]

    mesh.vertices = v

    # Recalculate smooth normals in pure numpy
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

    mesh.export('assets/wall_defender_pro_3d.glb')
    print("Successfully exported authentic wall stance model: assets/wall_defender_pro_3d.glb")

if __name__ == '__main__':
    generate_wall_defender_mesh()
