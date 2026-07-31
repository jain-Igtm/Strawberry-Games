import bpy
import json
import math
import os
import sys
from mathutils import Vector


def argument_value(name, default=None):
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for index, value in enumerate(args):
        if value == name and index + 1 < len(args):
            return args[index + 1]
    return default


output_directory = os.path.abspath(argument_value('--output', 'authored-st-agnes-lite-output'))
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


def configure_authored_material(material):
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new('ShaderNodeOutputMaterial')
    shader = nodes.new('ShaderNodeBsdfPrincipled')
    output.location = (420, 0)
    shader.location = (80, 0)
    links.new(shader.outputs['BSDF'], output.inputs['Surface'])
    shader.inputs['Roughness'].default_value = 0.72
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
        shader.inputs['Roughness'].default_value = 0.18
        shader.inputs['Alpha'].default_value = 0.34
        enable_transparency(material)
    elif material.name == 'Ceiling_light':
        shader.inputs['Emission Color'].default_value = (0.82, 0.94, 1.0, 1.0)
        shader.inputs['Emission Strength'].default_value = 1.4
        shader.inputs['Roughness'].default_value = 0.26
    elif material.name == 'Exit_sign':
        shader.inputs['Emission Color'].default_value = (0.12, 0.9, 0.24, 1.0)
        shader.inputs['Emission Strength'].default_value = 0.8
    elif material.name == 'IV_bag':
        shader.inputs['Alpha'].default_value = 0.72
        shader.inputs['Roughness'].default_value = 0.24
        enable_transparency(material)


for material in bpy.data.materials:
    configure_authored_material(material)

source_objects = list(bpy.context.scene.objects)
prototypes = {obj.name: obj for obj in source_objects if obj.type == 'MESH'}
required = {
    'Tile_Wall', 'Tile_Wall_Doorway_1', 'Tile_Wall_Window', 'Tile_Corner',
    'Ceiling_Light', 'Bench', 'Chair', 'Wheel_chair', 'Table',
    'Cabinet_1', 'Cabinet_2', 'Cabinet_3', 'Bed', 'Door_1', 'Door_swing',
    'Landline_phone', 'Plant_leaves', 'Magazine', 'Exit_sign',
    'Iv_bag_holder', 'IV_bag',
}
for name in required:
    if name not in prototypes:
        raise RuntimeError(f'Missing authored prototype: {name}')

for obj in source_objects:
    obj.hide_render = True
    obj.hide_viewport = True

hospital_collection = bpy.data.collections.new('ST_AGNES_AUTHORED_LITE')
bpy.context.scene.collection.children.link(hospital_collection)
created = []


def clone(name, x, y, z=None, rotation_z=0.0, scale=(1.0, 1.0, 1.0)):
    prototype = prototypes[name]
    obj = prototype.copy()
    obj.data = prototype.data
    hospital_collection.objects.link(obj)
    obj.location = (x, y, prototype.location.z if z is None else z)
    obj.rotation_euler = prototype.rotation_euler.copy()
    obj.rotation_euler.z += rotation_z
    obj.scale = (
        prototype.scale.x * scale[0],
        prototype.scale.y * scale[1],
        prototype.scale.z * scale[2],
    )
    obj.name = f'STAGNES_{name}_{len(created):04d}'
    obj.hide_render = False
    obj.hide_viewport = False
    created.append(obj)
    return obj


def make_tiled_material(name, relative_texture, repeats_x, repeats_y, roughness=0.78):
    texture_path = os.path.join(textures_root, relative_texture)
    if not os.path.exists(texture_path):
        raise RuntimeError(f'Missing structural texture: {texture_path}')
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    shader = nodes.new('ShaderNodeBsdfPrincipled')
    image_node = nodes.new('ShaderNodeTexImage')
    texcoord = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeMapping')
    image_node.image = bpy.data.images.load(texture_path, check_existing=True)
    image_node.extension = 'REPEAT'
    mapping.inputs['Scale'].default_value = (max(repeats_x, 1.0), max(repeats_y, 1.0), 1.0)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = 0.0
    links.new(texcoord.outputs['Generated'], mapping.inputs['Vector'])
    links.new(mapping.outputs['Vector'], image_node.inputs['Vector'])
    links.new(image_node.outputs['Color'], shader.inputs['Base Color'])
    links.new(shader.outputs['BSDF'], output.inputs['Surface'])
    return material


def make_slab(name, x, y, width, depth, z, height, texture, tile_size, ceiling=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z))
    slab = bpy.context.object
    slab.name = name
    slab.dimensions = (width, depth, height)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    material = make_tiled_material(
        f'{name}_material',
        texture,
        width / tile_size,
        depth / tile_size,
        0.9 if ceiling else 0.72,
    )
    slab.data.materials.append(material)
    for collection in list(slab.users_collection):
        collection.objects.unlink(slab)
    hospital_collection.objects.link(slab)
    slab.hide_render = False
    created.append(slab)
    return slab


# Six slabs replace roughly 1,700 individual floor/ceiling tiles.
rear_zones = [
    ('WEST_WING', -27.0, 8.0, 22.0, 30.0),
    ('WEST_INNER', -7.0, 8.0, 6.0, 30.0),
    ('CENTRAL', 0.0, 8.0, 8.0, 30.0),
    ('EAST_INNER', 7.0, 8.0, 6.0, 30.0),
    ('EAST_WING', 27.0, 8.0, 22.0, 30.0),
]
make_slab('FLOOR_FRONT', 0.0, -15.0, 76.0, 16.0, -0.06, 0.12, 'Floors_1/Floors_1_BaseColor.png', 2.0)
make_slab('CEILING_FRONT', 0.0, -15.0, 76.0, 16.0, 2.55, 0.10, 'ceiling_1/Ceiling_1_BaseColor.png', 2.0, True)
for label, x, y, width, depth in rear_zones:
    make_slab(f'FLOOR_{label}', x, y, width, depth, -0.06, 0.12, 'Floors_1/Floors_1_BaseColor.png', 2.0)
    make_slab(f'CEILING_{label}', x, y, width, depth, 2.55, 0.10, 'ceiling_1/Ceiling_1_BaseColor.png', 2.0, True)


def place_door(x, y, rotation_z=0.0, open_door=False):
    if open_door:
        clone('Door_swing', x, y, 0.0, rotation_z + math.radians(62))
    else:
        clone('Door_1', x, y, 0.0, rotation_z)


def run_x(y, centers, doors=(), windows=(), open_doors=()):
    doors = set(doors)
    windows = set(windows)
    open_doors = set(open_doors)
    for x in centers:
        if x in doors or x in open_doors:
            clone('Tile_Wall_Doorway_1', x, y, 0.0)
            place_door(x, y, 0.0, x in open_doors)
        elif x in windows:
            clone('Tile_Wall_Window', x, y, 0.0)
        else:
            clone('Tile_Wall', x, y, 0.0)


def run_y(x, centers, doors=(), windows=(), open_doors=()):
    doors = set(doors)
    windows = set(windows)
    open_doors = set(open_doors)
    for y in centers:
        if y in doors or y in open_doors:
            clone('Tile_Wall_Doorway_1', x, y, 0.0, math.pi / 2)
            place_door(x, y, math.pi / 2, y in open_doors)
        elif y in windows:
            clone('Tile_Wall_Window', x, y, 0.0, math.pi / 2)
        else:
            clone('Tile_Wall', x, y, 0.0, math.pi / 2)


x_grid = list(range(-37, 38, 2))
y_grid = list(range(-22, 23, 2))
front_windows = {x for index, x in enumerate(x_grid) if index % 2 == 0 and abs(x) > 5}
rear_windows = {x for index, x in enumerate(x_grid) if index % 2 == 1 and abs(x) > 5}
side_windows = {y for index, y in enumerate(y_grid) if index % 2 == 0 and y not in {-8, 8}}
run_x(-23, x_grid, doors={27}, windows=front_windows, open_doors={-1, 1})
run_x(23, x_grid, windows=rear_windows, open_doors={-1, 1})
run_y(-38, y_grid, doors={-8}, windows=side_windows)
run_y(38, y_grid, doors={-8}, windows=side_windows)

# Lobby / admissions / administration / ER boundary.
run_x(-13, x_grid, doors={-15, 15}, open_doors={-25, -1, 25})
run_y(-18, range(-22, -12, 2), open_doors={-18})
run_y(18, range(-22, -12, 2), open_doors={-18})
run_y(-30, range(-22, -12, 2), doors={-18})
run_y(30, range(-22, -12, 2), doors={-18})

# Main transfer spine and ward corridors.
central_y = list(range(-12, 23, 2))
run_y(-4, central_y, doors={20}, open_doors={-8, 0, 8, 16})
run_y(4, central_y, doors={20}, open_doors={-8, 0, 8, 16})
for x in [-26, -22, 22, 26]:
    run_y(x, central_y, doors={20}, open_doors={-8, 0, 8, 16})

# Room divisions. These create real depth without filling every metre with geometry.
for y in [-5, 3, 11, 19]:
    run_x(y, range(-37, -26, 2))
    run_x(y, range(-21, -16, 2))
    run_x(y, range(-9, -4, 2))
    run_x(y, range(5, 10, 2))
    run_x(y, range(17, 22, 2))
    run_x(y, range(27, 38, 2))

# Courtyard glazing and rear connector.
for x in [-16, -10, 10, 16]:
    run_y(x, range(-4, 17, 2), windows=set(range(-4, 17, 2)))
for x, y, rotation in [
    (-16, -5, 0), (-10, -5, math.pi / 2), (-16, 17, -math.pi / 2), (-10, 17, math.pi),
    (10, -5, 0), (16, -5, math.pi / 2), (10, 17, -math.pi / 2), (16, 17, math.pi),
]:
    clone('Tile_Corner', x, y, 0.0, rotation)
run_x(21, range(-21, 22, 2), open_doors={-17, -1, 17})

# Authored ceiling fixtures, deliberately sparse.
for x in [-30, -24, -7, 0, 7, 24, 30]:
    for y in [-19, -11, -3, 5, 13, 21]:
        if (x in {-7, 7}) and (-5 < y < 17):
            continue
        if (x * 3 + y) % 17 == 0:
            continue
        clone('Ceiling_Light', x, y, 2.44)


def place_bed(x, y, rotation_z=0.0, disturbed=False):
    clone('Bed', x, y, None, rotation_z + (math.radians(7) if disturbed else 0.0))


def place_iv(x, y, rotation_z=0.0):
    holder = prototypes['Iv_bag_holder']
    bag = prototypes['IV_bag']
    clone('Iv_bag_holder', x, y, holder.location.z, rotation_z)
    dx = bag.location.x - holder.location.x
    dy = bag.location.y - holder.location.y
    clone(
        'IV_bag',
        x + dx * math.cos(rotation_z) - dy * math.sin(rotation_z),
        y + dx * math.sin(rotation_z) + dy * math.cos(rotation_z),
        bag.location.z,
        rotation_z,
    )


# Lobby: admissions island, waiting areas and abandoned mobility equipment.
for x in [-3.0, 0.0, 3.0]:
    clone('Table', x, -16.2)
for x in [-5.4, 5.4]:
    clone('Cabinet_1', x, -14.7)
clone('Landline_phone', -2.1, -15.3)
for x in [-12.5, 12.5]:
    for y in [-20.0, -17.2]:
        clone('Bench', x, y, None, math.pi / 2)
clone('Wheel_chair', 15.8, -18.7, None, math.radians(-18))
clone('Wheel_chair', -15.3, -14.8, None, math.radians(25))

# Ward A and B patient rooms.
for side in [-1, 1]:
    outer_x = 32.0 * side
    inner_x = 19.0 * side
    bed_rotation = math.pi / 2 if side < 0 else -math.pi / 2
    for index, y in enumerate([-9.0, -1.0, 7.0, 15.0]):
        place_bed(outer_x, y, bed_rotation, disturbed=(side > 0 and index == 2))
        place_iv(outer_x - 2.1 * side, y + 1.0)
        clone('Cabinet_2', outer_x + 2.0 * side, y + 1.4)
        clone('Chair', outer_x - 1.7 * side, y - 2.0)
        if y in {-1.0, 15.0}:
            place_bed(inner_x, y, -bed_rotation, disturbed=(side < 0 and y == 15.0))
            clone('Cabinet_3', inner_x + 1.3 * side, y + 1.5)

# Nurse stations.
for station_x in [-24.0, 24.0]:
    for offset_y in [4.8, 7.2]:
        clone('Table', station_x, offset_y)
    for offset_x in [-1.5, 1.5]:
        clone('Chair', station_x + offset_x, 6.0, None, math.pi)
    clone('Cabinet_1', station_x, 9.3)
    clone('Landline_phone', station_x - 0.8, 5.2)
    clone('Plant_leaves', station_x + 2.1, 9.0)

# Emergency department, denser than the wards.
for index, (x, y, rotation) in enumerate([
    (23.5, -19.0, 0.0), (28.0, -19.0, 0.0), (33.0, -19.0, 0.0),
    (23.5, -15.0, math.pi), (28.0, -15.0, math.pi), (33.0, -15.0, math.pi),
]):
    place_bed(x, y, rotation, disturbed=(index == 4))
    place_iv(x + 1.2, y + 1.5)
for x in [21.0, 26.0, 31.0, 35.0]:
    clone('Cabinet_2', x, -13.9)
clone('Wheel_chair', 20.5, -14.7, None, math.radians(-28))

# Admin and restrained environmental storytelling.
for x in [-34.0, -26.0, -22.0]:
    clone('Table', x, -18.0)
    clone('Chair', x, -16.5, None, math.pi)
    clone('Cabinet_1', x, -21.2)
for x in [-13.0, 13.0]:
    for y in [-1.0, 7.0, 15.0]:
        clone('Plant_leaves', x, y, None, 0.0, (1.25, 1.25, 1.25))
for x, y, rotation in [
    (2.0, -9.5, 0.4), (-2.0, 12.0, -0.7), (-25.0, 13.0, 0.2), (25.5, 1.0, -0.4),
]:
    clone('Magazine', x, y, 0.035, rotation, (1.5, 1.5, 1.5))
for x, y, rotation in [
    (0.0, -21.8, 0.0), (0.0, 21.8, math.pi),
    (-24.0, -11.8, 0.0), (-24.0, 21.8, math.pi),
    (24.0, -11.8, 0.0), (24.0, 21.8, math.pi),
]:
    clone('Exit_sign', x, y, 2.12, rotation)
clone('Wheel_chair', 1.8, 17.2, None, math.radians(68))
clone('Bench', -6.8, -9.2, None, math.radians(13))
clone('Cabinet_3', 6.2, 12.3, None, math.radians(-22))

# Delete the source catalog now that linked instances exist.
for obj in source_objects:
    bpy.data.objects.remove(obj, do_unlink=True)

# Export the composed in-game scene before adding review-only lighting.
bpy.ops.object.select_all(action='DESELECT')
mesh_objects = [obj for obj in hospital_collection.objects if obj.type == 'MESH']
for obj in mesh_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = mesh_objects[0]
output_glb = os.path.join(output_directory, 'st-agnes-authored-lite.glb')
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

# Scale-independent review lighting.
world = bpy.context.scene.world or bpy.data.worlds.new('St Agnes Review World')
bpy.context.scene.world = world
world.use_nodes = True
background = world.node_tree.nodes.get('Background')
background.inputs['Color'].default_value = (0.045, 0.055, 0.06, 1.0)
background.inputs['Strength'].default_value = 0.78

sun_data = bpy.data.lights.new('Review Sun', type='SUN')
sun_data.energy = 2.2
sun_data.angle = math.radians(22)
sun = bpy.data.objects.new('Review Sun', sun_data)
bpy.context.scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(35), math.radians(-24), math.radians(-28))

for x, y, energy in [
    (0, -17, 420), (-24, -4, 320), (-24, 8, 320), (-24, 18, 300),
    (24, -4, 320), (24, 8, 320), (24, 18, 300), (0, 8, 300),
]:
    data = bpy.data.lights.new(f'Review Area {x} {y}', type='AREA')
    data.energy = energy
    data.shape = 'DISK'
    data.size = 5.0
    light = bpy.data.objects.new(data.name, data)
    bpy.context.scene.collection.objects.link(light)
    light.location = (x, y, 2.25)
    light.rotation_euler = (0.0, 0.0, 0.0)

camera_data = bpy.data.cameras.new('Review Camera')
camera = bpy.data.objects.new('Review Camera', camera_data)
bpy.context.scene.collection.objects.link(camera)
bpy.context.scene.camera = camera
camera_data.type = 'PERSP'
camera_data.lens = 19
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
scene.render.resolution_x = 1120
scene.render.resolution_y = 630
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'Medium High Contrast'
scene.view_settings.exposure = 0.85
scene.view_settings.gamma = 1.0

views = {
    'lobby.png': ((0.0, -21.0, 1.62), (0.0, -13.4, 1.35)),
    'ward-a.png': ((-24.0, -10.5, 1.62), (-24.0, 17.0, 1.38)),
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
    'polygons': sum(len(obj.data.polygons) for obj in mesh_objects),
    'materials': sorted({
        slot.material.name
        for obj in mesh_objects
        for slot in obj.material_slots
        if slot.material
    }),
    'glb_bytes': os.path.getsize(output_glb),
    'footprint': {'width': 76, 'depth': 46, 'ceiling_height': 2.5},
}
with open(os.path.join(output_directory, 'st-agnes-authored-lite-stats.json'), 'w', encoding='utf-8') as handle:
    json.dump(stats, handle, indent=2)
with open(os.path.join(output_directory, 'LICENSE-NOTICE.txt'), 'w', encoding='utf-8') as handle:
    handle.write(
        'St. Agnes uses the Free Modular 3D hospital environment by Madduck.\n'
        'The creator permits use and modification inside commercial and non-commercial game projects.\n'
        'This is a composed in-game scene, not a redistribution of the source pack.\n'
    )
print(json.dumps(stats, indent=2))
