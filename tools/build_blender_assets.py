import os
import math
import bpy
import bmesh
from mathutils import Vector, Matrix

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)

def create_material(name, base_color, roughness=0.5, metallic=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    return mat

def add_bevel_and_subsurf(obj, bevel_width=0.008, bevel_segments=2, subsurf_levels=1):
    if bevel_width > 0:
        bev = obj.modifiers.new(name="Bevel", type='BEVEL')
        bev.width = bevel_width
        bev.segments = bevel_segments
        bev.limit_method = 'ANGLE'
        bev.angle_limit = math.radians(30)
    if subsurf_levels > 0:
        sub = obj.modifiers.new(name="Subsurf", type='SUBSURF')
        sub.levels = subsurf_levels
        sub.render_levels = subsurf_levels

def build_mannequin():
    clear_scene()

    # Materials
    mat_rubber = create_material("mannequin_rubber_base", (0.09, 0.11, 0.14), roughness=0.88, metallic=0.05)
    mat_steel = create_material("mannequin_steel_posts", (0.76, 0.80, 0.85), roughness=0.22, metallic=0.92)
    mat_collar = create_material("mannequin_spring_collar", (0.15, 0.18, 0.22), roughness=0.45, metallic=0.75)
    mat_body = create_material("mannequin_hi_vis_body", (0.85, 0.96, 0.08), roughness=0.34, metallic=0.06)
    mat_chest = create_material("mannequin_chest_plate", (0.06, 0.09, 0.15), roughness=0.42, metallic=0.15)

    parts = []

    # 1. Grounded Weighted Rubber Base Plate (z = 0.0 to z = 0.055)
    # Rounded stadium / pill footprint: width 0.56m (X), depth 0.34m (Y), height 0.055m (Z)
    bpy.ops.mesh.primitive_cylinder_add(vertices=36, radius=1.0, depth=1.0, location=(0, 0, 0))
    base_obj = bpy.context.active_object
    base_obj.name = "RubberBasePlate"
    bm = bmesh.new()
    bm.from_mesh(base_obj.data)
    for v in bm.verts:
        # map z from [-0.5, 0.5] to [0.0, 0.055]
        zn = v.co.z + 0.5
        # slightly tapered top for heavy moulded rubber stability look
        taper = 1.0 - 0.08 * zn
        # stretch X to 0.28m radius (0.56m wide), Y to 0.17m radius (0.34m deep)
        # flatten front/back slightly for stadium shape
        angle = math.atan2(v.co.y, v.co.x)
        rx = 0.28 * taper * (1.0 + 0.08 * math.cos(2 * angle))
        ry = 0.165 * taper
        r_orig = math.hypot(v.co.x, v.co.y)
        if r_orig > 0.001:
            v.co.x = math.cos(angle) * rx * r_orig
            v.co.y = math.sin(angle) * ry * r_orig
        v.co.z = zn * 0.055
    bm.to_mesh(base_obj.data)
    bm.free()
    base_obj.data.materials.append(mat_rubber)
    add_bevel_and_subsurf(base_obj, bevel_width=0.006, bevel_segments=2, subsurf_levels=0)
    parts.append(base_obj)

    # Raised rubber reinforcement ribs on base plate
    for rib_x in (-0.15, 0.0, 0.15):
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(rib_x, 0.0, 0.055))
        rib = bpy.context.active_object
        rib.scale = (0.045, 0.24, 0.016)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        rib.data.materials.append(mat_rubber)
        add_bevel_and_subsurf(rib, bevel_width=0.004, bevel_segments=2, subsurf_levels=0)
        parts.append(rib)

    # 2. Twin Steel Turf Spikes / Posts & Spring Collars at the base
    # Spaced at X = -0.145 and X = +0.145, running from z = 0.002 up into torso at z = 0.48
    for sx in (-0.145, 0.145):
        # Chromed steel post
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.019, depth=0.46, location=(sx, 0.0, 0.232))
        post = bpy.context.active_object
        post.name = f"SteelPost_{sx}"
        post.data.materials.append(mat_steel)
        parts.append(post)

        # Grounded steel turf spike flange / foot at z = 0.00 to 0.075
        bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=0.042, radius2=0.026, depth=0.075, location=(sx, 0.0, 0.0375))
        spike_base = bpy.context.active_object
        spike_base.data.materials.append(mat_steel)
        parts.append(spike_base)

        # Heavy-duty shock-absorption spring collar (z = 0.075 to 0.19)
        for ring_i in range(4):
            rz = 0.085 + ring_i * 0.026
            bpy.ops.mesh.primitive_torus_add(
                major_radius=0.028, minor_radius=0.009,
                major_segments=20, minor_segments=10,
                location=(sx, 0.0, rz)
            )
            coil = bpy.context.active_object
            coil.data.materials.append(mat_collar)
            parts.append(coil)

        # Upper receiver sleeve entering bottom of mannequin legs
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.032, depth=0.06, location=(sx, 0.0, 0.34))
        sleeve = bpy.context.active_object
        sleeve.data.materials.append(mat_collar)
        parts.append(sleeve)

    # 3. Moulded Athletic Free-Kick Training Mannequin Body (z = 0.34m to 1.82m)
    # Build sculpted torso + lower leg shield + head silhouette with perforated wind-slots
    # Instead of destructive boolean which can create messy n-gons in wireframe, let's build a clean quad-grid sculpted body with genuine bridged wind-slot openings!
    body_obj = build_sculpted_slotted_torso(mat_body, mat_chest)
    parts.append(body_obj)

    # Apply all modifiers and join into a single clean mesh named TrainingMannequin
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:
        bpy.context.view_layer.objects.active = obj
        for mod in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
        obj.select_set(True)

    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    mannequin = bpy.context.active_object
    mannequin.name = "TrainingMannequin"

    # Shade smooth with auto-smooth / sharp edge split normals
    bpy.ops.object.shade_smooth()

    # Verify exact bounding box and ground flush at z = 0.0 and top at z = 1.82
    bm = bmesh.new()
    bm.from_mesh(mannequin.data)
    min_z = min(v.co.z for v in bm.verts)
    max_z = max(v.co.z for v in bm.verts)
    for v in bm.verts:
        v.co.z -= min_z
    # Scale Z slightly if needed so height is strictly 1.820m
    cur_h = max_z - min_z
    if cur_h > 0:
        scale_z = 1.820 / cur_h
        for v in bm.verts:
            v.co.z *= scale_z
    bm.normal_update()
    bm.to_mesh(mannequin.data)
    bm.free()

    mannequin.location = (0.0, 0.0, 0.0)
    mannequin.rotation_euler = (0.0, 0.0, 0.0)
    mannequin.scale = (1.0, 1.0, 1.0)

    # Generate UV map
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
    bpy.ops.object.mode_set(mode='OBJECT')

    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets", "models"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "training_mannequin.glb")

    bpy.ops.object.select_all(action='DESELECT')
    mannequin.select_set(True)
    bpy.context.view_layer.objects.active = mannequin

    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT'
    )
    print(f"[build_blender_assets] Exported {out_path} ({os.path.getsize(out_path)} bytes)")

def build_sculpted_slotted_torso(mat_body, mat_chest):
    """
    Constructs a clean, quad-dominant moulded athletic mannequin body from z = 0.34m to z = 1.82m
    with anatomical shoulder/chest/waist contours, bevelled edge rim, and 6 aerodynamic wind-slots
    bridged front-to-back for authentic AAA wireframe topology.
    """
    mesh = bpy.data.meshes.new("MannequinBodyMesh")
    obj = bpy.data.objects.new("MannequinBody", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat_body)
    obj.data.materials.append(mat_chest)

    bm = bmesh.new()

    # Define vertical profile stations z in [0.34, 1.82]
    # Along X we have 7 columns on each side, creating 2 columns for left/right wind-slots:
    # X fractions of half-width W(z):
    # u in [-1.0, -0.78, -0.58, -0.28, -0.10, 0.10, 0.28, 0.58, 0.78, 1.0]
    # Wind-slots live in u-intervals [-0.58, -0.28] and [0.28, 0.58] at three vertical bands:
    # Band 1 (lower thigh/hip): z in [0.52, 0.74]
    # Band 2 (abdomen/ribs):    z in [0.86, 1.10]
    # Band 3 (upper chest):     z in [1.20, 1.44]
    z_levels = [
        0.34, 0.42, 0.52, 0.63, 0.74,
        0.80, 0.86, 0.98, 1.10,
        1.15, 1.20, 1.32, 1.44,
        1.50, 1.55, 1.60, 1.68, 1.76, 1.82
    ]
    u_cols = [-1.0, -0.82, -0.58, -0.26, -0.08, 0.08, 0.26, 0.58, 0.82, 1.0]

    def half_width_at_z(z):
        # Lower leg shield (0.34..0.74): ~0.23m half-width
        # Waist taper (0.80..0.98): ~0.21m -> flares to 0.285m athletic shoulders (1.32..1.44)
        # Neck taper (1.50..1.56): ~0.095m
        # Head contour (1.60..1.76): ~0.115m, dome top (1.82): 0.045m
        if z <= 0.42:
            return 0.22 + (z - 0.34) * 0.20
        elif z <= 0.74:
            return 0.236
        elif z <= 0.92:
            t = (z - 0.74) / 0.18
            return 0.236 * (1 - t) + 0.215 * t
        elif z <= 1.36:
            t = (z - 0.92) / 0.44
            # smooth athletic V-taper up to broad shoulders
            s = t * t * (3 - 2 * t)
            return 0.215 + 0.075 * s
        elif z <= 1.48:
            t = (z - 1.36) / 0.12
            return 0.290 * (1 - t) + 0.240 * t
        elif z <= 1.55:
            t = (z - 1.48) / 0.07
            return 0.240 * (1 - t) + 0.092 * t
        elif z <= 1.68:
            t = (z - 1.55) / 0.13
            return 0.092 * (1 - t) + 0.114 * t
        elif z <= 1.76:
            t = (z - 1.68) / 0.08
            return 0.114 * (1 - t) + 0.096 * t
        else:
            t = (z - 1.76) / 0.06
            return 0.096 * (1 - t) + 0.038 * t

    def half_thickness_at(z, u):
        # Base thickness profile
        au = abs(u)
        # Rim bevel: outer edge u=1.0 is thin (0.018m), inner torso is thicker (0.048m..0.065m)
        edge_factor = math.sqrt(max(0.0, 1.0 - au * au * 0.72))
        if z > 1.55:
            # 3D sculpted head depth
            head_t = math.sin(min(1.0, max(0.0, (z - 1.54) / 0.28)) * math.pi)
            return (0.032 + 0.055 * head_t) * edge_factor
        # Pectoral / shoulder contour bulge around z in [1.15, 1.44]
        pec_bulge = 0.0
        if 1.12 <= z <= 1.46 and au < 0.75:
            pz = math.sin((z - 1.12) / 0.34 * math.pi)
            pu = math.sin(min(1.0, au / 0.75) * math.pi)
            pec_bulge = 0.022 * pz * pu
        # Perimeter reinforce rib at au in [0.80, 0.95]
        rib_bulge = 0.008 if (0.78 <= au <= 0.96 and z <= 1.48) else 0.0
        return (0.036 * edge_factor) + pec_bulge + rib_bulge

    nz = len(z_levels)
    nu = len(u_cols)

    front_grid = [[None] * nu for _ in range(nz)]
    back_grid = [[None] * nu for _ in range(nz)]

    for iz, z in enumerate(z_levels):
        w = half_width_at_z(z)
        for iu, u in enumerate(u_cols):
            x = u * w
            hy = half_thickness_at(z, u)
            # Subtle athletic chest forward arch
            arch_y = -0.012 * math.sin((z - 0.34) / 1.48 * math.pi) if z <= 1.50 else -0.010
            front_grid[iz][iu] = bm.verts.new((x, arch_y - hy, z))
            back_grid[iz][iu] = bm.verts.new((x, arch_y + hy, z))

    # Slot cells in (iz, iu) space:
    # z_levels indices:
    # Band 1: 0.52 (iz=2) to 0.74 (iz=4) -> rows iz=2, 3
    # Band 2: 0.86 (iz=6) to 1.10 (iz=8) -> rows iz=6, 7
    # Band 3: 1.20 (iz=10) to 1.44 (iz=12) -> rows iz=10, 11
    # u_cols indices:
    # Left slot: u=-0.58 (iu=2) to u=-0.26 (iu=3) -> col iu=2
    # Right slot: u=0.26 (iu=6) to u=0.58 (iu=7) -> col iu=6
    slot_rows = {(2, 3), (6, 7), (10, 11)}
    slot_cols = {2, 6}

    def is_slot_cell(iz, iu):
        if iu not in slot_cols:
            return False
        for r0, r1 in slot_rows:
            if r0 <= iz <= r1:
                return True
        return False

    # Create front and back faces, skipping wind-slot cells
    for iz in range(nz - 1):
        for iu in range(nu - 1):
            if is_slot_cell(iz, iu):
                continue
            # Determine material: dark chest logo / plate region on middle chest
            mat_idx = 0
            if 9 <= iz <= 12 and 3 <= iu <= 5:
                mat_idx = 1

            # Front face (facing -Y in Blender -> +Z in Three.js after export_yup)
            f_front = bm.faces.new((
                front_grid[iz][iu],
                front_grid[iz + 1][iu],
                front_grid[iz + 1][iu + 1],
                front_grid[iz][iu + 1]
            ))
            f_front.material_index = mat_idx

            # Back face (facing +Y in Blender)
            f_back = bm.faces.new((
                back_grid[iz][iu + 1],
                back_grid[iz + 1][iu + 1],
                back_grid[iz + 1][iu],
                back_grid[iz][iu]
            ))
            f_back.material_index = mat_idx

    # Bridge inner tunnel walls for each of the 6 perforated wind-slots
    for (r0, r1) in slot_rows:
        for c in slot_cols:
            # Left wall of slot (iu = c)
            for iz in range(r0, r1 + 1):
                f = bm.faces.new((
                    front_grid[iz][c],
                     back_grid[iz][c],
                    back_grid[iz + 1][c],
                    front_grid[iz + 1][c]
                ))
                f.material_index = 1
                # Right wall of slot (iu = c + 1)
                f2 = bm.faces.new((
                    front_grid[iz + 1][c + 1],
                    back_grid[iz + 1][c + 1],
                    back_grid[iz][c + 1],
                    front_grid[iz][c + 1]
                ))
                f2.material_index = 1
            # Bottom wall of slot (iz = r0)
            fb = bm.faces.new((
                front_grid[r0][c + 1],
                back_grid[r0][c + 1],
                back_grid[r0][c],
                front_grid[r0][c]
            ))
            fb.material_index = 1
            # Top wall of slot (iz = r1 + 1)
            ft = bm.faces.new((
                front_grid[r1 + 1][c],
                back_grid[r1 + 1][c],
                back_grid[r1 + 1][c + 1],
                front_grid[r1 + 1][c + 1]
            ))
            ft.material_index = 1

    # Stitch outer perimeter border (left edge iu=0, right edge iu=nu-1, bottom iz=0, top iz=nz-1)
    for iz in range(nz - 1):
        # Left outer rim (iu = 0)
        bm.faces.new((
            back_grid[iz][0],
            front_grid[iz][0],
            front_grid[iz + 1][0],
            back_grid[iz + 1][0]
        ))
        # Right outer rim (iu = nu - 1)
        bm.faces.new((
            front_grid[iz][nu - 1],
            back_grid[iz][nu - 1],
            back_grid[iz + 1][nu - 1],
            front_grid[iz + 1][nu - 1]
        ))

    for iu in range(nu - 1):
        # Bottom edge (iz = 0)
        bm.faces.new((
            front_grid[0][iu],
            back_grid[0][iu],
            back_grid[0][iu + 1],
            front_grid[0][iu + 1]
        ))
        # Top of head crown (iz = nz - 1)
        bm.faces.new((
            back_grid[nz - 1][iu],
            front_grid[nz - 1][iu],
            front_grid[nz - 1][iu + 1],
            back_grid[nz - 1][iu + 1]
        ))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    # Add 1 level of Catmull-Clark Subdivision + Bevel for smooth sculpted contours
    add_bevel_and_subsurf(obj, bevel_width=0.005, bevel_segments=2, subsurf_levels=1)
    return obj

if __name__ == "__main__":
    build_mannequin()
