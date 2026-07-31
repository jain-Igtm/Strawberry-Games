import bpy
import json
import math
import os
import sys
from collections import defaultdict
from mathutils import Vector


def argument_value(name, default=None):
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for index, value in enumerate(args):
        if value == name and index + 1 < len(args):
            return args[index + 1]
    return default


output_directory = os.path.abspath(argument_value('--output', 'authored-st-agnes-output'))
os.makedirs(output_directory, exist_ok=True)
source_root = os.path.dirname(os.path.abspath(bpy.data.filepath))
textures_root = os.path.join(source_root, 'textures')

texture_map = {
    'Walls_1': 'Walls_1/Walls_1_BaseColor.png',
    'Doorway_1': 'Doorway_1/Doorway_1_BaseColor.png',
    'Floors_1': 'Floors_1/Floors_1_BaseColor.png',
    'Ceiling_1': 'ceiling_1/Ceiling_1_BaseColor.png',
    'Ceiling_light': 'Ceiling_light/Ceiling_light_BaseColor.png',
    'Chairs_tables_1': 'Chairs_table_1/Chairs_tables_1_BaseColor.png',
    'Wheel_chair': 'wheel_chair/Wheel_chair_BaseColor.png',
    'Bed': 'bed/Bed_BaseColor.png',
    'Door_mat': 'Door_1/Door_1_BaseColor.png',
    'Magazine': 'Magazine/Magazine_Base_color.png',
    'Exit_sign': 'exit_sign/Exit_sign_Base_color.png',
    'IV_Pole': 'Iv_pole/IV_pole_bag_Base_color.png',
    'IV_bag': 'Iv_bag/IV_Bag_IV_pole_bag_BaseColor.png',
}

fallback_colors = {
    'Window': (0.32, 0.54, 0.62, 0.34),
    'Phone_ExitSign': (0.11, 0.14, 0.15, 1.0),
    'Plant': (0.12, 0.26, 0.14, 1.0),
}


def enable_transparency(material):
    if hasattr(material, 'surface_render_method'):
        material.surface_render_method = 'DITHERED'
    elif hasattr(material, 'blend_method'):
        material.blend_method = 'BLEND'
        material.show_transparent_back = True


def configure_material(material):
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    shader = nodes.new('ShaderNodeBsdfPrincipled')
    output.location = (420, 0)
    shader.location = (80, 0)
    links.new(shader.outputs['BSDF'], output.inputs['Surface'])
    shader.inputs['Roughness'].default_value = 0.74
    shader.inputs['Metallic'].default_value = 0.015

    relative_texture = texture_map.get(material.name)
    if relative_texture:
        texture_path = os.path.join(textures_root, relative_texture)
        if not os.path.exists(texture_path):
            raise RuntimeError(f'Missing authored texture: {texture_path}')
        image = bpy.data.images.load(texture_path, check_existing=True)
        texture = nodes.new('ShaderNodeTexImage')
        texture.image = image
        texture.location = (-420, 40)
        links.new(texture.outputs['Color'], shader.inputs['Base Color'])
        links.new(texture.outputs['Alpha'], shader.inputs['Alpha'])
    else:
        shader.inputs['Base Color'].default_value = fallback_colors.get(
            material.name,
            (0.55, 0.58, 0.56, 1.0),
        )

    if material.name == 'Window':
        shader.inputs['Roughness'].default_value = 0.2
        shader.inputs['Alpha'].default_value = 0.34
        enable_transparency(material)
    elif material.name == 'Ceiling_light':
        shader.inputs['Emission Color'].default_value = (0.78, 0.92, 1.0, 1.0)
        shader.inputs['Emission Strength'].default_value = 1.35
        shader.inputs['Roughness'].default_value = 0.28
    elif material.name == 'Exit_sign':
        shader.inputs['Emission Color'].default_value = (0.12, 0.92, 0.24, 1.0)
        shader.inputs['Emission Strength'].default_value = 0.85
    elif material.name == 'IV_bag':
        shader.inputs['Roughness'].default_value = 0.26
        shader.inputs['Alpha'].default_value = 0.72
        enable_transparency(material)


for material in bpy.data.materials:
    configure_material(material)

source_objects = list(bpy.context.scene.objects)
prototypes = {obj.name: obj for obj in source_objects if obj.type == 'MESH'}
required = [
    'Tile_Wall', 'Tile_Wall_half', 'Tile_Wall_Doorway_1',
    'Tile_Wall_Window', 'Tile_Corner', 'Floor_tile_1', 'Floor_tile_2',
    'Ceiling_Tile', 'Ceiling_Light', 'Bench', 'Chair', 'Wheel_chair',
    'Table', 'Cabinet_1', 'Cabinet_2', 'Cabinet_3', 'Bed', 'Door_1',
    'Door_swing', 'Landline_phone', 'Plant_leaves', 'Magazine',
    'Exit_sign', 'Iv_bag_holder', 'IV_bag',
]
for name in required:
    if name not in prototypes:
        raise RuntimeError(f'Missing authored prototype: {name}')

scene_collection = bpy.data.collections.new('ST_AGNES_AUTHORED')
bpy.context.scene.collection.children.link(scene_collection)
created = defaultdict(list)


def clone(name, x, y, z=None, rotation_z=0.0, bucket=None, scale=(1.0, 1.0, 1.0)):
    prototype = prototypes[name]
    obj = prototype.copy()
    obj.data = prototype.data
    scene_collection.objects.link(obj)
    obj.location = (x, y, prototype.location.z if z is None else z)
    obj.rotation_euler = prototype.rotation_euler.copy()
    obj.rotation_euler.z += rotation_z
    obj.scale = (
        prototype.scale.x * scale[0],
        prototype.scale.y * scale[1],
        prototype.scale.z * scale[2],
    )
    obj.name = f'{bucket or name}_{len(created[bucket or name]):04d}'
    created[bucket or name].append(obj)
    return obj


def join_bucket(bucket):
    objects = [obj for obj in created.get(bucket, []) if obj.name in bpy.context.scene.objects]
    if len(objects) < 2:
        if objects:
            objects[0].name = bucket
        return
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    objects[0].name = bucket
    created[bucket] = [objects[0]]


def courtyard(x, y):
    west = -16.0 < x < -10.0 and -5.0 < y < 17.0
    east = 10.0 < x < 16.0 and -5.0 < y < 17.0
    return west or east


# Floor and ceiling grid. The two open courtyards break the mass into wings.
for x in range(-37, 38, 2):
    for y in range(-22, 23, 2):
        if courtyard(x, y):
            continue
        floor_name = 'Floor_tile_2' if ((x + y) // 2) % 7 == 0 else 'Floor_tile_1'
        clone(floor_name, x, y, 0.0, bucket=f'ARCH_{floor_name}')
        if (x + y) % 18 != 0 and not (abs(x) < 5 and y in {8, 10}):
            clone('Ceiling_Tile', x, y, 2.5, bucket='ARCH_CEILING')

# Ceiling fixtures use authored geometry; missing tiles create limited damage.
for x in [-32, -24, -18, -7, 0, 7, 18, 24, 32]:
    for y in range(-20, 22, 4):
        if courtyard(x, y):
            continue
        if (x * 3 + y) % 20 == 0:
            continue
        clone('Ceiling_Light', x, y, 2.44, bucket='ARCH_LIGHTS')


def place_door(x, y, rotation_z=0.0, open_door=False, bucket='DOORS'):
    if open_door:
        clone('Door_swing', x, y, 0.0, rotation_z + math.radians(64), bucket=bucket)
    else:
        clone('Door_1', x, y, 0.0, rotation_z, bucket=bucket)


def run_x(y, centers, doors=None, windows=None, open_doors=None, bucket='ARCH_WALL_X'):
    doors = set(doors or [])
    windows = set(windows or [])
    open_doors = set(open_doors or [])
    for x in centers:
        if x in doors or x in open_doors:
            clone('Tile_Wall_Doorway_1', x, y, 0.0, bucket='ARCH_DOORWAY_X')
            place_door(x, y, 0.0, x in open_doors)
        elif x in windows:
            clone('Tile_Wall_Window', x, y, 0.0, bucket='ARCH_WINDOW_X')
        else:
            clone('Tile_Wall', x, y, 0.0, bucket=bucket)


def run_y(x, centers, doors=None, windows=None, open_doors=None, bucket='ARCH_WALL_Y'):
    doors = set(doors or [])
    windows = set(windows or [])
    open_doors = set(open_doors or [])
    for y in centers:
        if y in doors or y in open_doors:
            clone('Tile_Wall_Doorway_1', x, y, 0.0, math.pi / 2, 'ARCH_DOORWAY_Y')
            place_door(x, y, math.pi / 2, y in open_doors)
        elif y in windows:
            clone('Tile_Wall_Window', x, y, 0.0, math.pi / 2, 'ARCH_WINDOW_Y')
        else:
            clone('Tile_Wall', x, y, 0.0, math.pi / 2, bucket)


x_grid = list(range(-37, 38, 2))
y_grid = list(range(-22, 23, 2))

# Exterior first-floor envelope: a double entrance, emergency side door,
# repeated windows, and a rear service exit.
front_windows = {x for index, x in enumerate(x_grid) if index % 2 == 0 and abs(x) > 5}
run_x(-23, x_grid, open_doors={-1, 1}, doors={27}, windows=front_windows, bucket='ARCH_EXTERIOR_X')
rear_windows = {x for index, x in enumerate(x_grid) if index % 2 == 1 and abs(x) > 5}
run_x(23, x_grid, open_doors={-1, 1}, windows=rear_windows, bucket='ARCH_EXTERIOR_X')
side_windows = {y for index, y in enumerate(y_grid) if index % 2 == 0 and y not in {-8, 8}}
run_y(-38, y_grid, doors={-8}, windows=side_windows, bucket='ARCH_EXTERIOR_Y')
run_y(38, y_grid, doors={-8}, windows=side_windows, bucket='ARCH_EXTERIOR_Y')

# Front lobby, admissions, administration, and emergency department.
run_x(-13, x_grid, open_doors={-25, -1, 25}, doors={-15, 15}, bucket='ARCH_FRONT_DIVIDER')
run_y(-18, list(range(-22, -12, 2)), open_doors={-18}, bucket='ARCH_ADMIN_DIVIDER')
run_y(18, list(range(-22, -12, 2)), open_doors={-18}, bucket='ARCH_ER_DIVIDER')
run_y(-30, list(range(-22, -12, 2)), doors={-18}, bucket='ARCH_ADMIN_ROOMS')
run_y(30, list(range(-22, -12, 2)), doors={-18}, bucket='ARCH_ER_ROOMS')

# Main central transfer spine.
central_y = list(range(-12, 23, 2))
run_y(-4, central_y, open_doors={-8, 0, 8, 16}, doors={20}, bucket='ARCH_CENTRAL_Y')
run_y(4, central_y, open_doors={-8, 0, 8, 16}, doors={20}, bucket='ARCH_CENTRAL_Y')

# Ward A and Ward B corridors.
ward_y = list(range(-12, 23, 2))
for x in [-26, -22, 22, 26]:
    run_y(
        x,
        ward_y,
        open_doors={-8, 0, 8, 16},
        doors={20},
        bucket='ARCH_WARD_CORRIDOR',
    )

# Patient-room and treatment-room divisions, kept off the corridors.
for y in [-5, 3, 11, 19]:
    run_x(y, list(range(-37, -26, 2)), bucket='ARCH_ROOM_DIVIDERS')
    run_x(y, list(range(-21, -16, 2)), bucket='ARCH_ROOM_DIVIDERS')
    run_x(y, list(range(-9, -4, 2)), bucket='ARCH_ROOM_DIVIDERS')
    run_x(y, list(range(5, 10, 2)), bucket='ARCH_ROOM_DIVIDERS')
    run_x(y, list(range(17, 22, 2)), bucket='ARCH_ROOM_DIVIDERS')
    run_x(y, list(range(27, 38, 2)), bucket='ARCH_ROOM_DIVIDERS')

# Courtyard glazing and corner modules.
for x in [-16, -10, 10, 16]:
    run_y(x, list(range(-4, 17, 2)), windows=set(range(-4, 17, 2)), bucket='ARCH_COURTYARD')
for x, y, rotation in [
    (-16, -5, 0), (-10, -5, math.pi / 2), (-16, 17, -math.pi / 2), (-10, 17, math.pi),
    (10, -5, 0), (16, -5, math.pi / 2), (10, 17, -math.pi / 2), (16, 17, math.pi),
]:
    clone('Tile_Corner', x, y, 0.0, rotation, 'ARCH_CORNERS')

# Rear connection hall breaks the long wards and links all three spines.
run_x(21, list(range(-21, 22, 2)), open_doors={-17, -1, 17}, bucket='ARCH_REAR_HALL')


def place_bed(x, y, rotation_z=0.0, disturbed=False):
    rotation = rotation_z + (math.radians(8) if disturbed else 0.0)
    clone('Bed', x, y, None, rotation, 'PROP_BEDS')


def place_iv(x, y, rotation_z=0.0):
    holder = prototypes['Iv_bag_holder']
    bag = prototypes['IV_bag']
    clone('Iv_bag_holder', x, y, holder.location.z, rotation_z, 'PROP_IV_HOLDERS')
    dx = bag.location.x - holder.location.x
    dy = bag.location.y - holder.location.y
    rotated_x = dx * math.cos(rotation_z) - dy * math.sin(rotation_z)
    rotated_y = dx * math.sin(rotation_z) + dy * math.cos(rotation_z)
    clone('IV_bag', x + rotated_x, y + rotated_y, bag.location.z, rotation_z, 'PROP_IV_BAGS')


# Lobby admissions island and waiting areas.
for x in [-3.0, 0.0, 3.0]:
    clone('Table', x, -16.2, None, 0.0, 'PROP_RECEPTION_TABLES')
for x in [-5.4, 5.4]:
    clone('Cabinet_1', x, -14.7, None, 0.0, 'PROP_RECEPTION_CABINETS')
clone('Landline_phone', -2.1, -15.3, None, 0.0, 'PROP_PHONES')
for x in [-12.5, 12.5]:
    for y in [-20.0, -17.2]:
        clone('Bench', x, y, None, math.pi / 2, 'PROP_BENCHES')
clone('Wheel_chair', 15.8, -18.7, None, math.radians(-18), 'PROP_WHEELCHAIRS')
clone('Wheel_chair', -15.3, -14.8, None, math.radians(25), 'PROP_WHEELCHAIRS')

# Ward patient rooms. Beds and cabinets are authored objects, not box stand-ins.
for side in [-1, 1]:
    outer_x = 32.0 * side
    inner_x = 19.0 * side
    bed_rotation = math.pi / 2 if side < 0 else -math.pi / 2
    for index, y in enumerate([-9.0, -1.0, 7.0, 15.0]):
        place_bed(outer_x, y, bed_rotation, disturbed=(index == 2 and side > 0))
        place_iv(outer_x - 2.1 * side, y + 1.0, 0.0)
        clone('Cabinet_2', outer_x + 2.0 * side, y + 1.4, None, 0.0, 'PROP_BEDSIDE_CABINETS')
        clone('Chair', outer_x - 1.7 * side, y - 2.0, None, 0.0, 'PROP_CHAIRS')

        if y in {-1.0, 15.0}:
            place_bed(inner_x, y, -bed_rotation, disturbed=(side < 0 and y == 15.0))
            clone('Cabinet_3', inner_x + 1.3 * side, y + 1.5, None, 0.0, 'PROP_SMALL_CABINETS')

# Nurse stations use real tables, chairs, cabinets, phones, and plants.
for station_x in [-24.0, 24.0]:
    for offset_y in [4.8, 7.2]:
        clone('Table', station_x, offset_y, None, 0.0, 'PROP_NURSE_TABLES')
    for offset_x in [-1.5, 1.5]:
        clone('Chair', station_x + offset_x, 6.0, None, math.pi, 'PROP_CHAIRS')
    clone('Cabinet_1', station_x, 9.3, None, 0.0, 'PROP_NURSE_CABINETS')
    clone('Landline_phone', station_x - 0.8, 5.2, None, 0.0, 'PROP_PHONES')
    clone('Plant_leaves', station_x + 2.1, 9.0, None, 0.0, 'PROP_PLANTS')

# Emergency department and triage are visibly denser than the wards.
for index, (x, y, rotation) in enumerate([
    (23.5, -19.0, 0.0), (28.0, -19.0, 0.0), (33.0, -19.0, 0.0),
    (23.5, -15.0, math.pi), (28.0, -15.0, math.pi), (33.0, -15.0, math.pi),
]):
    place_bed(x, y, rotation, disturbed=(index == 4))
    place_iv(x + 1.2, y + 1.5, 0.0)
for x in [21.0, 26.0, 31.0, 35.0]:
    clone('Cabinet_2', x, -13.9, None, 0.0, 'PROP_ER_CABINETS')
clone('Wheel_chair', 20.5, -14.7, None, math.radians(-28), 'PROP_WHEELCHAIRS')

# Administration and consultation furniture.
for x in [-34.0, -26.0, -22.0]:
    clone('Table', x, -18.0, None, 0.0, 'PROP_ADMIN_TABLES')
    clone('Chair', x, -16.5, None, math.pi, 'PROP_CHAIRS')
    clone('Cabinet_1', x, -21.2, None, 0.0, 'PROP_ADMIN_CABINETS')

# Courtyard remnants and corridor storytelling.
for x in [-13.0, 13.0]:
    for y in [-1.0, 7.0, 15.0]:
        clone('Plant_leaves', x, y, None, 0.0, 'PROP_COURTYARD_PLANTS', scale=(1.3, 1.3, 1.3))
for x, y, rotation in [
    (2.0, -9.5, 0.4), (-2.0, 12.0, -0.7), (-25.0, 13.0, 0.2), (25.5, 1.0, -0.4),
]:
    clone('Magazine', x, y, 0.035, rotation, 'PROP_MAGAZINES', scale=(1.5, 1.5, 1.5))

# Exit signage at all major circulation endpoints.
for x, y, rotation in [
    (0.0, -21.8, 0.0), (0.0, 21.8, math.pi),
    (-24.0, -11.8, 0.0), (-24.0, 21.8, math.pi),
    (24.0, -11.8, 0.0), (24.0, 21.8, math.pi),
]:
    clone('Exit_sign', x, y, 2.12, rotation, 'PROP_EXIT_SIGNS')

# Damage is restrained: a few displaced objects and missing ceiling tiles,
# rather than smearing one dirty texture across every surface.
clone('Wheel_chair', 1.8, 17.2, None, math.radians(68), 'PROP_WHEELCHAIRS')
clone('Bench', -6.8, -9.2, None, math.radians(13), 'PROP_BENCHES')
clone('Cabinet_3', 6.2, 12.3, None, math.radians(-22), 'PROP_SMALL_CABINETS')

# Remove the creator's catalog arrangement while retaining shared mesh data.
for obj in source_objects:
    bpy.data.objects.remove(obj, do_unlink=True)

# Bake repeated static instances by category. This keeps the final hospital to
# a small draw-call budget on mobile instead of thousands of tile meshes.
for bucket in list(created.keys()):
    join_bucket(bucket)

# Render-only lights. They are not exported to the game GLB.
world = bpy.context.scene.world or bpy.data.worlds.new('St Agnes World')
bpy.context.scene.world = world
world.use_nodes = True
background = world.node_tree.nodes.get('Background')
background.inputs['Color'].default_value = (0.026, 0.034, 0.037, 1.0)
background.inputs['Strength'].default_value = 0.62

render_lights = []
for x in [-24.0, 0.0, 24.0]:
    for y in [-18.0, -10.0, -2.0, 6.0, 14.0, 21.0]:
        if courtyard(x, y):
            continue
        data = bpy.data.lights.new(f'Render light {x} {y}', type='AREA')
        data.energy = 125.0
        data.shape = 'RECTANGLE'
        data.size = 3.0
        data.size_y = 1.2
        light = bpy.data.objects.new(data.name, data)
        bpy.context.scene.collection.objects.link(light)
        light.location = (x, y, 2.35)
        light.rotation_euler = (0.0, 0.0, 0.0)
        render_lights.append(light)
for x, y in [(-12.5, -1.0), (-12.5, 8.0), (12.5, -1.0), (12.5, 8.0)]:
    data = bpy.data.lights.new(f'Courtyard daylight {x} {y}', type='POINT')
    data.energy = 260.0
    data.color = (0.58, 0.72, 0.76)
    data.shadow_soft_size = 4.0
    light = bpy.data.objects.new(data.name, data)
    bpy.context.scene.collection.objects.link(light)
    light.location = (x, y, 3.4)
    render_lights.append(light)

# Export only the composed hospital collection, without render lights/camera.
bpy.ops.object.select_all(action='DESELECT')
for obj in scene_collection.objects:
    if obj.type == 'MESH':
        obj.select_set(True)
mesh_objects = [obj for obj in scene_collection.objects if obj.type == 'MESH']
if not mesh_objects:
    raise RuntimeError('Authored St. Agnes composition produced no meshes.')
bpy.context.view_layer.objects.active = mesh_objects[0]

output_glb = os.path.join(output_directory, 'st-agnes-authored.glb')
bpy.ops.export_scene.gltf(
    filepath=output_glb,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_materials='EXPORT',
    export_cameras=False,
    export_lights=False,
)

# Perspective review cameras show actual corridors and rooms at player height.
camera_data = bpy.data.cameras.new('Review Camera')
camera = bpy.data.objects.new('Review Camera', camera_data)
bpy.context.scene.collection.objects.link(camera)
bpy.context.scene.camera = camera
camera_data.type = 'PERSP'
camera_data.lens = 20
camera_data.clip_start = 0.04
camera_data.clip_end = 120


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


scene = bpy.context.scene
try:
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
except TypeError:
    scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'Medium High Contrast'
scene.view_settings.exposure = 0.75
scene.view_settings.gamma = 1.0

views = {
    'lobby.png': ((0.0, -21.0, 1.62), (0.0, -13.4, 1.35)),
    'central-corridor.png': ((0.0, -11.5, 1.62), (0.0, 18.0, 1.38)),
    'ward-a.png': ((-24.0, -10.5, 1.62), (-24.0, 17.0, 1.38)),
    'ward-b.png': ((24.0, 18.5, 1.62), (24.0, -8.0, 1.38)),
    'patient-room.png': ((-28.3, 6.0, 1.58), (-33.0, 7.0, 0.85)),
    'emergency.png': ((20.0, -20.8, 1.62), (32.0, -16.5, 1.0)),
}
for filename, (camera_position, target) in views.items():
    camera.location = camera_position
    look_at(camera, target)
    scene.render.filepath = os.path.join(output_directory, filename)
    bpy.ops.render.render(write_still=True)

stats = {
    'mesh_objects': len(mesh_objects),
    'triangles': sum(len(obj.data.polygons) for obj in mesh_objects),
    'materials': sorted({slot.material.name for obj in mesh_objects for slot in obj.material_slots if slot.material}),
    'glb_bytes': os.path.getsize(output_glb),
    'footprint': {'width': 76, 'depth': 46, 'ceiling_height': 2.5},
}
with open(os.path.join(output_directory, 'st-agnes-authored-stats.json'), 'w', encoding='utf-8') as handle:
    json.dump(stats, handle, indent=2)

with open(os.path.join(output_directory, 'LICENSE-NOTICE.txt'), 'w', encoding='utf-8') as handle:
    handle.write(
        'St. Agnes authored scene uses the Free Modular 3D hospital environment by Madduck.\n'
        'Source: https://madduck.itch.io/modular-3d-hospital-environment\n'
        'The creator permits use and modification in commercial and non-commercial game projects.\n'
        'This file is a composed in-game scene, not a redistribution of the source asset pack.\n'
    )

print(f'Composed authored St. Agnes: {stats}')
