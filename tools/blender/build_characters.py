"""
Football Strike — realistic character build pipeline (Blender 4.2 + MPFB2, fully headless).

  blender -b --python tools/blender/build_characters.py -- <role> <out.glb> [--preview out.png] [--blend out.blend]

role: player | goalkeeper

Pipeline
  1. MPFB2 generates a CC0 realistic human (macro sliders, skin, eyes, brows, lashes, hair).
  2. Adds MPFB's 'cmu_mb' rig (bone-for-bone match with CMU mocap BVH).
  3. Paints a football kit as material slots chosen by dominant bone weight per face
     (kit_shirt / kit_shorts / kit_socks / kit_boots / gk_gloves). Three.js tints these per team.
  4. Retargets CMU BVH clips with a rest-delta solver (roll-independent, rest-pose-independent):
         R_tgt(t) = [R_src(t) * R_srcRest^-1] * Align * R_tgtRest
     where Align rotates the target rest bone direction onto the source rest bone direction.
  5. Trims each clip with motion heuristics (kick = window around peak foot speed, etc.).
  6. Exports one GLB with every clip as a named glTF animation.

Mocap: CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), NSF EIA-0196217.
Human: MakeHuman / MPFB2 system assets, CC0.
"""
import bpy, sys, os, math, glob
from mathutils import Matrix, Vector, Quaternion

from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.locationservice import LocationService

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MOCAP = os.path.join(ROOT, "assets", "source", "mocap")
DATA = LocationService.get_user_data()
FPS = 30

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ROLE = argv[0] if argv else "player"
OUT = os.path.abspath(argv[1]) if len(argv) > 1 else os.path.join(ROOT, "assets", ROLE + ".glb")
PREVIEW = argv[argv.index("--preview") + 1] if "--preview" in argv else None
BLEND = argv[argv.index("--blend") + 1] if "--blend" in argv else None

# ----------------------------------------------------------------------------- clip specs
# (clip name, bvh id, trim mode, params)
#   full            -> whole take
#   head:S          -> first S seconds
#   peak_foot:B:A   -> B s before / A s after peak foot speed (kicks)
#   peak_up:B:A     -> around highest hip point (jumps)
#   peak_side:B:A   -> around peak lateral hip speed (keeper dives)
CLIPS = {
    "player": [
        ("idle", "77_02", "head:3.0"),
        ("run", "16_35", "full"),
        ("kick_instep", "10_02", "peak_foot:1.4:0.9"),
        ("kick_power", "10_01", "peak_foot:1.4:0.9"),
        ("kick_curl", "11_01", "peak_foot:1.4:0.9"),
        ("wall_jump", "16_01", "peak_up:0.8:0.8", "lockz"),
        ("celebrate", "143_36", "head:4.0"),
        ("celebrate_jump", "49_02", "head:3.0"),
        ("dejected", "111_28", "head:3.0"),
    ],
    "goalkeeper": [
        ("idle", "111_28", "head:3.0"),
        ("shuffle_left", "127_13", "full"),
        ("shuffle_right", "127_14", "full"),
        ("dive", "127_23", "full", "lockz"),
        ("side_jump", "143_07", "peak_side:0.7:0.9", "lockz"),
        ("catch", "143_20", "head:2.5"),
    ],
}

BODY = {
    "player":     {"gender": 1.0, "age": 0.5, "muscle": 0.78, "weight": 0.42, "proportions": 0.75, "height": 0.58},
    "goalkeeper": {"gender": 1.0, "age": 0.55, "muscle": 0.72, "weight": 0.48, "proportions": 0.72, "height": 0.72},
}
SKIN = {"player": "young_caucasian_male", "goalkeeper": "young_caucasian_male2"}
HAIR = {"player": "short02", "goalkeeper": "short04"}


def log(*a):
    print("[build]", *a, flush=True)


# ----------------------------------------------------------------------------- scene
def clear_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.actions, bpy.data.materials):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.render.fps_base = 1.0


def first_file(folder, ext):
    hits = sorted(glob.glob(os.path.join(DATA, folder, "**", "*" + ext), recursive=True))
    if not hits:
        raise FileNotFoundError(f"No {ext} in {folder}")
    return hits[0]


def build_human(role):
    macro = {"cupsize": 0.5, "firmness": 0.5,
             "race": {"asian": 0.1, "caucasian": 0.7, "african": 0.2}}
    macro.update(BODY[role])
    basemesh = HumanService.create_human(macro_detail_dict=macro, scale=0.1, feet_on_ground=True)
    log("basemesh", basemesh.name, len(basemesh.data.vertices), "verts")

    HumanService.set_character_skin(os.path.join(DATA, "skins", SKIN[role], SKIN[role] + ".mhmat"),
                                    basemesh, skin_type="GAMEENGINE")
    # Rig FIRST so every proxy asset inherits interpolated skin weights and follows the body.
    rig = HumanService.add_builtin_rig(basemesh, "cmu_mb", import_weights=True)
    rig.name = role + "_rig"
    for kind, folder in (("Eyes", "eyes/low-poly"), ("Eyebrows", "eyebrows/eyebrow001"),
                         ("Eyelashes", "eyelashes/eyelashes01"), ("Hair", "hair/" + HAIR[role]),
                         ("Clothes", "clothes/shoes06")):
        try:
            obj = HumanService.add_mhclo_asset(first_file(folder, ".mhclo"), basemesh, asset_type=kind,
                                               subdiv_levels=0, material_type="MAKESKIN")
            if kind == "Clothes" and obj is not None:
                obj.name = "boots"
                obj.data.materials.clear()
                obj.data.materials.append(kit_material("kit_boots"))
        except Exception as e:
            log("asset skipped", kind, e)
    log("rig", rig.name, len(rig.data.bones), "bones")
    return basemesh, rig


# ----------------------------------------------------------------------------- kit
KIT_COLORS = {
    "kit_shirt": (0.85, 0.10, 0.10, 1), "kit_shorts": (0.95, 0.95, 0.95, 1),
    "kit_socks": (0.85, 0.10, 0.10, 1), "kit_boots": (0.05, 0.05, 0.06, 1),
    "gk_gloves": (0.92, 0.92, 0.88, 1),
}


def kit_material(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = KIT_COLORS[name]
    bsdf.inputs["Roughness"].default_value = 0.35 if name == "kit_boots" else 0.72
    if "Sheen Weight" in bsdf.inputs:
        bsdf.inputs["Sheen Weight"].default_value = 0.0 if name == "kit_boots" else 0.25
    return m


def paint_kit(basemesh, role):
    groups = {
        "kit_shirt": {"LowerBack", "Spine", "Spine1", "LeftShoulder", "RightShoulder", "LeftArm", "RightArm"},
        "kit_shorts": {"Hips", "LHipJoint", "RHipJoint", "LeftUpLeg", "RightUpLeg"},
        "kit_socks": {"LeftLeg", "RightLeg"},
        "kit_boots": {"LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase"},
    }
    if role == "goalkeeper":
        groups["kit_shirt"] |= {"LeftForeArm", "RightForeArm"}
        groups["gk_gloves"] = {"LeftHand", "RightHand", "LeftFingerBase", "RightFingerBase",
                               "LeftHandFinger1", "RightHandFinger1", "LThumb", "RThumb"}
    me = basemesh.data
    vg_index = {vg.index: vg.name for vg in basemesh.vertex_groups}
    bone_of = {}
    for name, bones in groups.items():
        for b in bones:
            bone_of[b] = name
    slot = {}
    for name in groups:
        me.materials.append(kit_material(name))
        slot[name] = len(me.materials) - 1
    # dominant rig-bone weight per vertex (ignore MPFB helper/mask groups)
    rig_bones = {b.name for b in basemesh.parent.data.bones} if basemesh.parent and basemesh.parent.type == 'ARMATURE' else set(bone_of)
    vert_kit = [None] * len(me.vertices)
    for v in me.vertices:
        best, bw = None, 0.0
        for g in v.groups:
            n = vg_index.get(g.group)
            if n in rig_bones and g.weight > bw:
                best, bw = n, g.weight
        vert_kit[v.index] = bone_of.get(best)
    # Football shorts stop mid-thigh: thigh vertices below 30% hip->knee become skin.
    rig = basemesh.parent
    if rig is not None:
        hip_z = (rig.matrix_world @ rig.data.bones["LeftUpLeg"].head_local).z
        knee_z = (rig.matrix_world @ rig.data.bones["LeftLeg"].head_local).z
        cut = knee_z + 0.30 * (hip_z - knee_z)
        mw = basemesh.matrix_world
        for v in me.vertices:
            if vert_kit[v.index] == "kit_shorts" and (mw @ v.co).z < cut:
                vert_kit[v.index] = None
    counts = {k: 0 for k in groups}
    for p in me.polygons:
        tally = {}
        for vi in p.vertices:
            k = vert_kit[vi]
            if k:
                tally[k] = tally.get(k, 0) + 1
        if tally:
            k = max(tally, key=tally.get)
            if tally[k] * 2 >= len(p.vertices):
                p.material_index = slot[k]
                counts[k] += 1
    log("kit faces", counts)


# ----------------------------------------------------------------------------- retarget
def import_bvh(bvh_id):
    path = os.path.join(MOCAP, bvh_id + ".bvh")
    before = set(bpy.data.objects)
    bpy.ops.import_anim.bvh(filepath=path, global_scale=1.0, frame_start=1, use_fps_scale=True,
                            update_scene_fps=False, update_scene_duration=False, rotate_mode='NATIVE',
                            axis_forward='-Z', axis_up='Y')
    src = [o for o in bpy.data.objects if o not in before][0]
    return src


def world_rest(arm, name):
    return arm.matrix_world @ arm.data.bones[name].matrix_local


def leg_length(arm, world_fn):
    hip = world_fn(arm, "LeftUpLeg").translation
    foot = world_fn(arm, "LeftFoot").translation
    return (hip - foot).length


def ordered_bones(arm):
    out = []
    def rec(b):
        out.append(b.name)
        for c in b.children:
            rec(c)
    for b in arm.data.bones:
        if b.parent is None:
            rec(b)
    return out


def trim_range(src, mode, f0, f1):
    sc = bpy.context.scene
    if mode == "full":
        return f0, f1
    kind, *p = mode.split(":")
    if kind == "head":
        return f0, min(f1, f0 + int(float(p[0]) * FPS))
    before, after = float(p[0]), float(p[1])
    best_f, best_v, prev = f0, -1e9, None
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        if kind == "peak_foot":
            pos = [(src.matrix_world @ src.pose.bones[n].head) for n in ("RightFoot", "LeftFoot")]
            if prev is not None:
                v = max((pos[i] - prev[i]).length for i in range(2))
                if v > best_v:
                    best_v, best_f = v, f
            prev = pos
        elif kind == "peak_up":
            z = (src.matrix_world @ src.pose.bones["Hips"].head).z
            if z > best_v:
                best_v, best_f = z, f
        elif kind == "peak_side":
            x = (src.matrix_world @ src.pose.bones["Hips"].head).x
            if prev is not None and abs(x - prev) > best_v:
                best_v, best_f = abs(x - prev), f
            prev = x
    return max(f0, best_f - int(before * FPS)), min(f1, best_f + int(after * FPS))


def retarget(rig, src, clip_name, mode, lock_vertical=False):
    sc = bpy.context.scene
    act_src = src.animation_data.action
    f0, f1 = int(act_src.frame_range[0]), int(act_src.frame_range[1])
    a, b = trim_range(src, mode, f0, f1)
    bones = [n for n in ordered_bones(rig) if n in src.data.bones]
    tgt_inv = rig.matrix_world.inverted()

    # Rest data
    scale = leg_length(rig, world_rest) / max(1e-6, leg_length(src, world_rest))
    src_rest_q = {n: world_rest(src, n).to_quaternion() for n in bones}
    tgt_rest_q = {n: world_rest(rig, n).to_quaternion() for n in bones}
    align = {}
    for n in bones:
        sd = (world_rest(src, n).to_3x3() @ Vector((0, 1, 0))).normalized()
        td = (world_rest(rig, n).to_3x3() @ Vector((0, 1, 0))).normalized()
        align[n] = td.rotation_difference(sd)
    src_hip_rest = world_rest(src, "Hips").translation.copy()
    tgt_hip_rest = world_rest(rig, "Hips").translation.copy()

    # Sample source at first trimmed frame for root offset (clip starts at character origin in XY)
    # Ground reference: lowest source ankle over the clip maps onto the target's rest ankle height.
    src_ground = 1e9
    for f in range(a, b + 1, 2):
        sc.frame_set(f)
        for fb in ("LeftFoot", "RightFoot"):
            src_ground = min(src_ground, (src.matrix_world @ src.pose.bones[fb].head).z)
    tgt_ankle = world_rest(rig, "LeftFoot").translation.z
    sc.frame_set(a)
    start_hip = (src.matrix_world @ src.pose.bones["Hips"].head)

    action = bpy.data.actions.new(clip_name)
    action.use_fake_user = True
    rig.animation_data_create()
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'

    n_frames = b - a + 1
    rot_keys = {n: [[], [], [], []] for n in bones}
    loc_keys = [[], [], []]
    bone_data = rig.data.bones
    for i, f in enumerate(range(a, b + 1)):
        sc.frame_set(f)
        arm_pose = {}  # armature-space pose rotation (3x3) per target bone
        for n in bones:
            src_world_q = (src.matrix_world @ src.pose.bones[n].matrix).to_quaternion()
            delta = src_world_q @ src_rest_q[n].inverted()
            want_world = delta @ align[n] @ tgt_rest_q[n]
            want_arm = (tgt_inv.to_quaternion() @ want_world).to_matrix()
            arm_pose[n] = want_arm
            bd = bone_data[n]
            rest_local = bd.matrix_local.to_3x3()
            if bd.parent:
                parent_rest = bd.parent.matrix_local.to_3x3()
                rel = parent_rest.inverted() @ rest_local
                basis = rel.inverted() @ arm_pose[bd.parent.name].inverted() @ want_arm
            else:
                basis = rest_local.inverted() @ want_arm
            q = basis.to_quaternion()
            if rot_keys[n][0] and (Quaternion([rot_keys[n][k][-1] for k in range(4)]).dot(q) < 0):
                q.negate()  # keep hemisphere continuity
            for k in range(4):
                rot_keys[n][k].append(q[k])
        # Root translation (armature space delta from rest), XY relative to clip start
        hip_now = (src.matrix_world @ src.pose.bones["Hips"].head)
        # In-place clip: horizontal travel is driven by PlayerKinematics in-game.
        z = tgt_hip_rest.z if lock_vertical else tgt_ankle + (hip_now.z - src_ground) * scale
        want_hip_world = Vector((tgt_hip_rest.x, tgt_hip_rest.y, z))
        want_hip_arm = tgt_inv @ want_hip_world
        rest_hip = bone_data["Hips"].matrix_local
        rest_rot = rest_hip.to_3x3()
        loc = rest_rot.inverted() @ (want_hip_arm - rest_hip.translation)
        for k in range(3):
            loc_keys[k].append(loc[k])

    def put(path, idx, values, group):
        fc = action.fcurves.new(path, index=idx, action_group=group)
        fc.keyframe_points.add(len(values))
        co = []
        for j, v in enumerate(values):
            co += [j + 1, v]
        fc.keyframe_points.foreach_set("co", co)
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
        fc.update()

    for n in bones:
        for k in range(4):
            put(f'pose.bones["{n}"].rotation_quaternion', k, rot_keys[n][k], n)
    for k in range(3):
        put('pose.bones["Hips"].location', k, loc_keys[k], "Hips")
    log(f"clip {clip_name}: frames {a}-{b} ({n_frames / FPS:.2f}s) scale {scale:.3f}")
    return action


def remove_object_tree(obj):
    act = obj.animation_data.action if obj.animation_data else None
    data = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    if act and act.users == 0:
        bpy.data.actions.remove(act)
    if data and data.users == 0:
        bpy.data.armatures.remove(data)


# ----------------------------------------------------------------------------- preview
def render_preview(rig, path, action_name=None, frame=1):
    sc = bpy.context.scene
    if action_name:
        rig.animation_data.action = bpy.data.actions[action_name]
        sc.frame_set(frame)
    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    sc.collection.objects.link(cam)
    hips = rig.matrix_world @ rig.pose.bones["Hips"].head
    cam.location = (hips.x, hips.y - 4.2, 1.05)
    cam.rotation_euler = (math.radians(88), 0, 0)
    cam_data.lens = 45
    sc.camera = cam
    for loc, energy in (((2, -3, 3), 800), ((-3, -2, 2.5), 400), ((0, 3, 3), 500)):
        ld = bpy.data.lights.new("l", "AREA"); ld.energy = energy; ld.size = 3
        lo = bpy.data.objects.new("l", ld); lo.location = loc
        lo.rotation_euler = (Vector((0, 0, 1)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        sc.collection.objects.link(lo)
    sc.world = sc.world or bpy.data.worlds.new("w")
    sc.world.use_nodes = True
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.18, 0.2, 0.24, 1)
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.render.resolution_x, sc.render.resolution_y = 720, 900
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for o in (cam,):
        bpy.data.objects.remove(o, do_unlink=True)


# ----------------------------------------------------------------------------- export
def export_glb(rig, path):
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    for o in rig.children_recursive:
        if o.type == 'MESH':
            o.select_set(True)
    bpy.context.view_layer.objects.active = rig
    rig.animation_data.action = None
    # One muted NLA track per clip -> one named glTF animation per clip
    for tr in list(rig.animation_data.nla_tracks):
        rig.animation_data.nla_tracks.remove(tr)
    for act in bpy.data.actions:
        if act.users == 0 and not act.use_fake_user:
            continue
        if not any(fc.data_path.startswith("pose.bones") for fc in act.fcurves):
            continue
        tr = rig.animation_data.nla_tracks.new()
        tr.name = act.name
        strip = tr.strips.new(act.name, int(act.frame_range[0]), act)
        strip.name = act.name
        tr.mute = True
    # Skin must be opaque in-engine (MakeSkin uses alpha blending for its preview)
    for m in bpy.data.materials:
        if m.name.endswith(".body") or m.name.startswith("kit_") or m.name.startswith("gk_"):
            m.blend_method = "OPAQUE"
    for pb in rig.pose.bones:
        pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.scale = (1, 1, 1)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_texcoords=True, export_normals=True,
        export_materials='EXPORT', export_image_format='JPEG', export_jpeg_quality=88,
        export_skins=True, export_morph=False, export_def_bones=True,
        export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True,
        export_frame_step=1, export_optimize_animation_size=True, export_anim_single_armature=True,
        export_reset_pose_bones=True, export_cameras=False, export_lights=False)
    log("exported", path, f"{os.path.getsize(path) / 1048576:.2f} MB")


def main():
    clear_scene()
    basemesh, rig = build_human(ROLE)
    paint_kit(basemesh, ROLE)
    for clip_name, bvh, mode, *flags in CLIPS[ROLE]:
        src = import_bvh(bvh)
        try:
            retarget(rig, src, clip_name, mode, lock_vertical="lockz" in flags)
        finally:
            remove_object_tree(src)
    if PREVIEW:
        render_preview(rig, PREVIEW)
        base, ext = os.path.splitext(PREVIEW)
        key = "kick_power" if ROLE == "player" else "dive"
        act = bpy.data.actions[key]
        f0, f1 = act.frame_range
        for frac in (0.25, 0.5, 0.6, 0.7):
            render_preview(rig, f"{base}_{key}_{int(frac * 100)}{ext}", key, int(f0 + (f1 - f0) * frac))
    if BLEND:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(BLEND))
    export_glb(rig, OUT)


main()
