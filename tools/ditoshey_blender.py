import bpy
import math
from mathutils import Vector

ROOT = r"D:\[RGG-LAND]\Crossy Road Clone"
GLB = ROOT + r"\src\assets\models\ditoshey.glb"
PREVIEW = ROOT + r"\preview-ditoshey-blender.png"
CARD = ROOT + r"\src\assets\portraits\ditoshey-blender.png"

# ---------------------------------------------------------------------------
# Scene helpers
# ---------------------------------------------------------------------------

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for block in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
    for item in list(block):
        if item.users == 0:
            block.remove(item)

def mat(name, color, roughness=0.55, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return m

def assign(obj, material):
    obj.data.materials.append(material)
    for poly in obj.data.polygons:
        poly.use_smooth = True

def sphere(name, loc, scale, material, segments=28, rings=14):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1.0, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, material)
    return obj

def cone(name, loc, radius, depth, material, rotation=(0, 0, 0), vertices=24):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=0.015, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    assign(obj, material)
    return obj

def cylinder(name, loc, radius, depth, material, rotation=(0, 0, 0), vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    assign(obj, material)
    return obj

def torus(name, loc, major, minor, material, rotation=(math.pi / 2, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=40, minor_segments=8, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    assign(obj, material)
    return obj

def heart(name, loc, material, scale=1.0):
    a = sphere(name + "_a", (loc[0] - 0.045 * scale, loc[1], loc[2] + 0.03 * scale), (0.07 * scale, 0.035 * scale, 0.07 * scale), material, 24, 12)
    b = sphere(name + "_b", (loc[0] + 0.045 * scale, loc[1], loc[2] + 0.03 * scale), (0.07 * scale, 0.035 * scale, 0.07 * scale), material, 24, 12)
    bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.12 * scale, radius2=0.0, depth=0.18 * scale, location=(loc[0], loc[1], loc[2] - 0.06 * scale))
    c = bpy.context.object
    c.name = name + "_tip"
    c.rotation_euler = (math.pi, 0, math.pi / 2)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    assign(c, material)
    return a, b, c

pink = mat("Ditoshey pink", (0.91, 0.43, 0.46), 0.62)
pink_light = mat("Ditoshey pink light", (0.97, 0.60, 0.60), 0.62)
pink_dark = mat("Ditoshey pink dark", (0.70, 0.28, 0.34), 0.65)
lavender = mat("Ditoshey lavender", (0.58, 0.48, 0.82), 0.6)
lavender_dark = mat("Ditoshey lavender dark", (0.42, 0.31, 0.58), 0.62)
blue = mat("Ditoshey blue streak", (0.42, 0.60, 0.84), 0.6)
cream = mat("Ditoshey cream", (1.0, 0.94, 0.85), 0.62)
skin = mat("Ditoshey skin", (0.99, 0.81, 0.76), 0.64)
onesie = mat("Ditoshey onesie", (0.63, 0.53, 0.82), 0.64)
bone = mat("Ditoshey bone", (1.0, 0.99, 0.95), 0.48)
green = mat("Ditoshey green eyes", (0.60, 0.82, 0.36), 0.28)
black = mat("Ditoshey pupil", (0.055, 0.045, 0.05), 0.3)
dark = mat("Ditoshey dark", (0.09, 0.07, 0.09), 0.35)
gold = mat("Ditoshey gold", (0.91, 0.70, 0.30), 0.3, 0.55)
red = mat("Ditoshey heart", (0.83, 0.12, 0.18), 0.4)

# ---------------------------------------------------------------------------
# Body: skeleton onesie
# ---------------------------------------------------------------------------

# Feet and legs.
for side in (-1, 1):
    sphere("foot", (side * 0.18, -0.02, 0.16), (0.17, 0.19, 0.12), onesie)
    sphere("foot_toe", (side * 0.18, -0.18, 0.16), (0.14, 0.12, 0.09), cream)
    sphere("leg", (side * 0.17, 0.0, 0.45), (0.15, 0.16, 0.28), onesie)
    # Bone stripe on each leg.
    cylinder("leg_bone", (side * 0.17, -0.145, 0.44), 0.014, 0.22, bone, (math.pi / 2, 0, 0))
    sphere("pant_cuff", (side * 0.17, 0.0, 0.65), (0.17, 0.17, 0.06), lavender_dark)

# Torso and hood.
sphere("torso", (0, 0, 0.82), (0.37, 0.27, 0.42), onesie)
sphere("hips", (0, 0, 0.62), (0.38, 0.26, 0.18), onesie)
torus("neck_hood", (0, 0, 1.03), 0.28, 0.055, cream, (math.pi / 2, 0, 0))
# Belly / skeleton panel.
sphere("belly", (0, -0.255, 0.82), (0.22, 0.018, 0.3), cream)
cylinder("sternum", (0, -0.28, 0.82), 0.016, 0.3, bone, (0, 0, 0))
for i, z in enumerate((0.68, 0.76, 0.84, 0.92)):
    cylinder("rib", (0, -0.285, z), 0.014, 0.34 - i * 0.03, bone, (0, math.pi / 2, 0))
# Pelvis and bone arms.
for side in (-1, 1):
    cylinder("pelvis_bone", (side * 0.1, -0.275, 0.58), 0.014, 0.16, bone, (0.25, math.pi / 2, 0))
heart("heart", (0, -0.305, 0.98), red, 1.0)

# Arms, sleeves and paws.
for side in (-1, 1):
    sphere("upper_arm", (side * 0.34, 0.0, 0.8), (0.14, 0.16, 0.28), onesie)
    sphere("lower_arm", (side * 0.43, -0.04, 0.56), (0.13, 0.14, 0.22), onesie)
    sphere("paw", (side * 0.46, -0.12, 0.4), (0.14, 0.11, 0.13), cream)
    cylinder("arm_bone", (side * 0.42, -0.15, 0.55), 0.013, 0.2, bone, (0.2, 0, 0.1))

# Fluffy tail, pink to lavender with a cream tip.
tail = [
    ((0.0, 0.27, 0.57), (0.16, 0.17, 0.17), pink),
    ((0.12, 0.38, 0.54), (0.16, 0.18, 0.17), pink_light),
    ((0.25, 0.45, 0.54), (0.17, 0.18, 0.17), lavender),
    ((0.38, 0.48, 0.56), (0.16, 0.17, 0.16), lavender),
    ((0.5, 0.46, 0.6), (0.13, 0.14, 0.14), cream),
    ((0.58, 0.41, 0.64), (0.08, 0.09, 0.1), cream),
]
for p, s, m in tail:
    sphere("tail", p, s, m)

# ---------------------------------------------------------------------------
# Head, face and hair
# ---------------------------------------------------------------------------

sphere("head", (0, 0.0, 1.45), (0.47, 0.4, 0.48), skin)
sphere("hair_back", (0, 0.13, 1.42), (0.56, 0.44, 0.46), pink)
# Side bob masses.
sphere("side_hair_l", (-0.4, 0.02, 1.28), (0.18, 0.2, 0.37), pink)
sphere("side_hair_r", (0.4, 0.02, 1.28), (0.18, 0.2, 0.37), pink)
sphere("side_hair_l2", (-0.44, 0.02, 1.03), (0.12, 0.14, 0.25), pink_dark)
sphere("side_hair_r2", (0.44, 0.02, 1.03), (0.12, 0.14, 0.25), pink_dark)
# Fringe and colored streaks.
sphere("fringe_l", (-0.2, -0.34, 1.61), (0.19, 0.06, 0.12), pink_light)
sphere("fringe_c", (0.0, -0.37, 1.67), (0.16, 0.055, 0.1), pink)
sphere("fringe_r", (0.2, -0.34, 1.61), (0.17, 0.06, 0.12), lavender)
sphere("blue_streak", (-0.28, -0.36, 1.47), (0.055, 0.035, 0.2), blue)
sphere("side_lock_l", (-0.34, -0.35, 1.36), (0.12, 0.05, 0.24), pink)
sphere("side_lock_r", (0.34, -0.35, 1.36), (0.12, 0.05, 0.24), pink)
sphere("bang_l", (-0.27, -0.4, 1.55), (0.1, 0.055, 0.22), pink)
sphere("bang_r", (0.27, -0.4, 1.55), (0.1, 0.055, 0.22), pink)
sphere("bang_c", (0.0, -0.43, 1.62), (0.16, 0.045, 0.1), pink_light)
sphere("bang_lav", (-0.1, -0.43, 1.58), (0.12, 0.04, 0.14), lavender)
sphere("brow_l", (-0.16, -0.425, 1.55), (0.085, 0.012, 0.018), pink_dark)
sphere("brow_r", (0.16, -0.425, 1.55), (0.085, 0.012, 0.018), pink_dark)
sphere("lav_streak", (0.27, -0.36, 1.46), (0.065, 0.035, 0.19), lavender)

# Long braids: alternating soft beads.
for side in (-1, 1):
    for i in range(6):
        x = side * (0.4 + i * 0.01)
        z = 1.12 - i * 0.11
        m = pink_light if i % 2 == 0 else lavender
        sphere("braid", (x, -0.12, z), (0.09, 0.085, 0.1), m)
        sphere("braid_dark", (x + side * 0.012, -0.12, z - 0.05), (0.05, 0.05, 0.055), pink_dark if i % 2 == 0 else lavender_dark)
    sphere("braid_tie", (side * 0.42, -0.1, 0.42), (0.07, 0.06, 0.06), cream)

# Four fox ears.
for side in (-1, 1):
    # Main ears.
    sphere("ear_base", (side * 0.24, -0.12, 1.76), (0.17, 0.15, 0.22), pink)
    cone("ear_outer", (side * 0.24, -0.14, 1.9), 0.18, 0.5, pink, (0.08, side * 0.18, 0))
    cone("ear_inner", (side * 0.24, -0.22, 1.88), 0.105, 0.34, lavender, (0.08, side * 0.18, 0))
    sphere("ear_tip", (side * 0.22, -0.14, 2.12), (0.09, 0.08, 0.075), cream)
    # Smaller rear ears.
    sphere("ear_back_base", (side * 0.43, -0.04, 1.63), (0.12, 0.1, 0.16), pink_dark)
    cone("ear_back_outer", (side * 0.43, -0.06, 1.74), 0.12, 0.34, pink_dark, (0.02, side * 0.3, 0))
    cone("ear_back_inner", (side * 0.43, -0.14, 1.73), 0.065, 0.23, pink_light, (0.02, side * 0.3, 0))
    sphere("ear_back_tip", (side * 0.42, -0.07, 1.91), (0.06, 0.055, 0.05), cream)

# Eyes: dark liner, cream sclera, green iris, pupil, highlight.
for side in (-1, 1):
    ex = side * 0.155
    sphere("eye_liner", (ex, -0.405, 1.42), (0.12, 0.025, 0.135), dark)
    sphere("eye_white", (ex, -0.423, 1.42), (0.105, 0.015, 0.118), cream)
    sphere("eye_iris", (ex, -0.436, 1.415), (0.075, 0.012, 0.092), green)
    sphere("eye_pupil", (ex, -0.447, 1.41), (0.033, 0.007, 0.057), black)
    sphere("eye_glint", (ex - 0.022, -0.454, 1.452), (0.02, 0.005, 0.023), cream)
    # Eyelash / upper lid.
    sphere("lash", (ex, -0.432, 1.49), (0.12, 0.012, 0.022), pink_dark)
    # Big round gold glasses.
    torus("glasses", (ex, -0.455, 1.42), 0.145, 0.012, gold, (math.pi / 2, 0, 0))
    # Temple arm.
    cylinder("temple", (side * 0.28, -0.39, 1.43), 0.009, 0.2, gold, (0, 0, math.pi / 2))
cylinder("glasses_bridge", (0, -0.455, 1.42), 0.009, 0.08, gold, (0, math.pi / 2, 0))
# Nose and small smile.
sphere("nose", (0, -0.425, 1.32), (0.035, 0.025, 0.03), pink_dark)
sphere("mouth", (0, -0.438, 1.27), (0.045, 0.009, 0.008), dark)
for side in (-1, 1):
    sphere("mouth_corner", (side * 0.035, -0.434, 1.277), (0.014, 0.007, 0.007), dark)
for side in (-1, 1):
    sphere("blush", (side * 0.25, -0.39, 1.3), (0.08, 0.015, 0.035), pink_light)
    for j in range(3):
        sphere("freckle", (side * (0.2 + j * 0.035), -0.415, 1.27 + (j % 2) * 0.015), (0.008, 0.005, 0.008), pink_dark)

# ---------------------------------------------------------------------------
# Render setup
# ---------------------------------------------------------------------------

bpy.ops.object.camera_add(location=(0, -4.0, 1.55))
cam = bpy.context.object
cam.data.type = "ORTHO"
cam.rotation_euler = (math.radians(90), 0, 0)
bpy.context.scene.camera = cam

def area(name, loc, energy, size, color):
    bpy.ops.object.light_add(type="AREA", location=loc)
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.shape = "SQUARE"
    light.data.size = size
    light.data.color = color
    direction = Vector((0, 0, 1.25)) - light.location
    light.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

area("key", (-2.4, -3.2, 3.2), 180, 3.0, (1.0, 0.82, 0.76))
area("fill", (2.6, -1.8, 2.0), 80, 2.5, (0.72, 0.8, 1.0))
area("rim", (0.5, 2.0, 3.0), 120, 2.2, (1.0, 0.75, 0.85))

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.eevee.taa_render_samples = 64
scene.render.resolution_x = 768
scene.render.resolution_y = 480
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.world.color = (0.35, 0.3, 0.38)
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0.0

# Export all mesh objects as a game-ready GLB.
bpy.ops.object.select_all(action="DESELECT")
for obj in bpy.context.scene.objects:
    if obj.type == "MESH":
        obj.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=GLB,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
)
# Card portrait: wide head-and-shoulders crop.
cam.location.z = 1.55
cam.data.ortho_scale = 2.0
scene.render.resolution_x = 768
scene.render.resolution_y = 480
scene.render.filepath = CARD
bpy.ops.render.render(write_still=True)

# Full-body preview for the model card.
cam.location.z = 1.08
cam.data.ortho_scale = 2.25
scene.render.resolution_x = 640
scene.render.resolution_y = 800
scene.render.filepath = PREVIEW
bpy.ops.render.render(write_still=True)
print("DONE", GLB, CARD, PREVIEW)




