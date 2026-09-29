import bpy
import os
import sys

def setup_gltf_export(output_path):
    """Configures production glTF/GLB export parameters for Three.js."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_colors=True,
        export_cameras=False,
        export_lights=False,
        export_animations=True,
        export_skins=True,
        export_morph=True,
        export_def_bones=True,
        export_optimize_animation_size=True
    )
    print(f"[BLENDER-EXPORT] Successfully generated glTF asset: {output_path}")

if __name__ == "__main__":
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets"))
    target_file = os.path.join(out_dir, "stadium_rig.glb")
    setup_gltf_export(target_file)
