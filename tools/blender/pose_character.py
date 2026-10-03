import trimesh
import numpy as np
from scipy.spatial.transform import Rotation as R

mesh = trimesh.load('assets/football_player.obj')
v = mesh.vertices.copy()
print("Loaded mesh with vertices:", len(v))
