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


input_path = os.path.abspath(argument_value('--input'))
output_directory = os.path.abspath(argument_value('--output', 'authored-st-agnes-polished-output'))
os.makedirs(output_directory, exist_ok=True)
if not os.path.exists(input_path):
    raise RuntimeError(f'Missing composed hospital GLB: {input_path}')

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=input_path)


def principled_node(material):
    if not material.use_nodes:
        material.use_nodes = True
    for node in material.node_tree.nodes:
        if node.type == 'BSDF_PRINCIPLED':
            return node
    return None


def make_clean_ceiling(material):
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    shader = nodes.new('ShaderNodeBsdfPrincipled')
    noise = nodes.new('ShaderNodeTexNoise')
    ramp = nodes.new('ShaderNodeValToRGB')
    texcoord = nodes.new('ShaderNodeTexCoord')
    output.location = (420, 0)
    shader.location = (120, 0)
    noise.location = (-430, 50)
    ramp.location = (-150, 50)
    noise.inputs['Scale'].default_value = 58.0
    noise.inputs['Detail'].default_value = 2.0
    noise.inputs['Roughness'].default_value = 0.72
    ramp.color_ramp.elements[0].position = 0.25
    ramp.color_ramp.elements[0].color = (0.52, 0.56, 0.55, 1.0)
    ramp.color_ramp.elements[1].position = 0.78
    ramp.color_ramp.elements[1].color = (0.68, 0.71, 0.69, 1.0)
    shader.inputs['Roughness'].default_value = 0.96
    shader.inputs['Metallic'].default_value = 0.0
    links.new(texcoord.outputs['Generated'], noise.inputs['Vector'])
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], shader.inputs['Base Color'])
    links.new(shader.outputs['BSDF'], output.inputs['Surface'])


for material in bpy.data.materials:
    if material.name.startswith('CEILING_') and material.name.endswith('_material'):
        make_clean_ceiling(material)
    elif material.name.startswith('Ceiling_light'):
        shader = principled_node(material)
        if shader:
            if 'Emission Color' in shader.inputs:
                shader.inputs['Emission Color'].default_value = (0.62, 0.76, 0.79, 1.0)
            if 'Emission Strength' in shader.inputs:
                shader.inputs['Emission Strength'].default_value = 0.22
            shader.inputs['Roughness'].default_value = 0.38
    elif material.name.startswith('Walls_1'):
        shader = principled_node(material)
        if shader:
            shader.inputs['Roughness'].default_value = 0.86
    elif material.name.startswith('Floors_1') or material.name.startswith('FLOOR_'):
        shader = principled_node(material)
        if shader:
            shader.inputs['Roughness'].default_value = 0.78


# Tighten the three authored admissions tables into a continuous counter.
reception_tables = [
    obj for obj in bpy.context.scene.objects
    if obj.type == 'MESH'
    and 'Table' in obj.name
    and abs(obj.location.y + 16.2) < 0.35
    and abs(obj.location.x) < 4.5
]
reception_tables.sort(key=lambda obj: obj.location.x)
for obj, x in zip(reception_tables, [-2.25, 0.0, 2.25]):
    obj.location.x = x
    obj.location.y = -15.8


def solid_material(name, color, roughness=0.72, emission=None):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    shader = nodes.new('ShaderNodeBsdfPrincipled')
    shader.inputs['Base Color'].default_value = color
    shader.inputs['Roughness'].default_value = roughness
    if emission:
        shader.inputs['Emission Color'].default_value = emission
        shader.inputs['Emission Strength'].default_value = 0.45
    links.new(shader.outputs['BSDF'], output.inputs['Surface'])
    return material


sign_back = solid_material('STAGNES_SIGN_BACK', (0.035, 0.09, 0.075, 1.0), 0.62)
sign_text = solid_material(
    'STAGNES_SIGN_TEXT',
    (0.78, 0.86, 0.8, 1.0),
    0.42,
    (0.48, 0.66, 0.55, 1.0),
)
er_back = solid_material('STAGNES_ER_BACK', (0.28, 0.035, 0.026, 1.0), 0.65)
er_text = solid_material(
    'STAGNES_ER_TEXT',
    (0.95, 0.72, 0.62, 1.0),
    0.4,
    (0.7, 0.18, 0.09, 1.0),
)


def add_sign(text, location, width, facing='south', emergency=False):
    x, y, z = location
    backing_material = er_back if emergency else sign_back
    text_material = er_text if emergency else sign_text

    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z))
    backing = bpy.context.object
    backing.name = f'STAGNES_SIGN_{text}_BACK'
    if facing in {'south', 'north'}:
        backing.dimensions = (width, 0.08, 0.62)
    else:
        backing.dimensions = (0.08, width, 0.62)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    backing.data.materials.append(backing_material)

    bpy.ops.object.text_add(location=(x, y, z - 0.02))
    label = bpy.context.object
    label.name = f'STAGNES_SIGN_{text}_TEXT'
    label.data.body = text
    label.data.align_x = 'CENTER'
    label.data.align_y = 'CENTER'
    label.data.size = min(0.34, width / max(len(text), 1) * 0.75)
    label.data.extrude = 0.006
    label.data.bevel_depth = 0.002
    label.data.materials.append(text_material)
    if facing == 'south':
        label.rotation_euler = (math.pi / 2, 0.0, 0.0)
        label.location.y -= 0.048
    elif facing == 'north':
        label.rotation_euler = (-math.pi / 2, 0.0, math.pi)
        label.location.y += 0.048
    elif facing == 'west':
        label.rotation_euler = (math.pi / 2, 0.0, -math.pi / 2)
        label.location.x -= 0.048
    else:
        label.rotation_euler = (math.pi / 2, 0.0, math.pi / 2)
        label.location.x += 0.048
    bpy.context.view_layer.objects.active = label
    label.select_set(True)
    bpy.ops.object.convert(target='MESH')
    return backing, label


add_sign('ADMISSIONS', (0.0, -13.18, 2.05), 4.8, 'south')
add_sign('WARD A', (-24.0, -7.18, 2.05), 3.4, 'south')
add_sign('WARD B', (24.0, -7.18, 2.05), 3.4, 'south')
add_sign('EMERGENCY', (27.0, -13.18, 2.05), 4.4, 'south', True)


# Merge by spatial zone and role. Windows remain separate for transparent sorting.
def zone_for(obj):
    x, y = obj.location.x, obj.location.y
    if y < -7.0:
        return 'front'
    if y > 19.5 and -22.0 < x < 22.0:
        return 'rear'
    if x < -16.0:
        return 'west'
    if x > 16.0:
        return 'east'
    if x < -4.0:
        return 'west_inner'
    if x > 4.0:
        return 'east_inner'
    return 'central'


def role_for(obj):
    name = obj.name
    materials = {slot.material.name for slot in obj.material_slots if slot.material}
    if 'Window' in materials or 'Window' in name:
        return 'glass'
    if name.startswith('FLOOR_'):
        return 'floor'
    if name.startswith('CEILING_'):
        return 'ceiling'
    if 'Ceiling_Light' in name:
        return 'fixtures'
    if any(token in name for token in ['Tile_Wall', 'Tile_Corner', 'Door_', 'Doorway', 'STAGNES_SIGN']):
        return 'architecture'
    return 'props'


mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
pre_batch_count = len(mesh_objects)
groups = defaultdict(list)
for obj in mesh_objects:
    groups[(zone_for(obj), role_for(obj))].append(obj)

for (zone, role), objects in groups.items():
    if len(objects) < 2:
        objects[0].name = f'STAGNES_{zone}_{role}'
        continue
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    objects[0].name = f'STAGNES_{zone}_{role}'

mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
post_batch_count = len(mesh_objects)

# Export polished, spatially batched game scene before review-only lights/camera.
bpy.ops.object.select_all(action='DESELECT')
for obj in mesh_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = mesh_objects[0]
output_glb = os.path.join(output_directory, 'st-agnes-authored-polished.glb')
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

# Balanced review lighting: soft ambient, restrained practicals, no white blowout.
world = bpy.context.scene.world or bpy.data.worlds.new('St Agnes Polished World')
bpy.context.scene.world = world
world.use_nodes = True
background = world.node_tree.nodes.get('Background')
background.inputs['Color'].default_value = (0.035, 0.045, 0.048, 1.0)
background.inputs['Strength'].default_value = 0.48

sun_data = bpy.data.lights.new('Soft exterior daylight', type='SUN')
sun_data.energy = 0.55
sun_data.angle = math.radians(28)
sun = bpy.data.objects.new('Soft exterior daylight', sun_data)
bpy.context.scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(38), math.radians(-25), math.radians(-32))

light_specs = [
    (0, -17, 115, 5.5),
    (-24, -8, 85, 4.5), (-24, 0, 85, 4.5), (-24, 8, 85, 4.5), (-24, 16, 80, 4.5),
    (24, -8, 85, 4.5), (24, 0, 85, 4.5), (24, 8, 85, 4.5), (24, 16, 80, 4.5),
    (0, -8, 78, 4.0), (0, 2, 78, 4.0), (0, 12, 78, 4.0),
    (-32, 7, 60, 3.4), (32, 7, 60, 3.4),
    (27, -18, 92, 4.5),
]
for x, y, energy, size in light_specs:
    data = bpy.data.lights.new(f'Interior practical {x} {y}', type='AREA')
    data.energy = energy
    data.shape = 'DISK'
    data.size = size
    light = bpy.data.objects.new(data.name, data)
    bpy.context.scene.collection.objects.link(light)
    light.location = (x, y, 2.27)

camera_data = bpy.data.cameras.new('Polished Review Camera')
camera = bpy.data.objects.new('Polished Review Camera', camera_data)
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
if hasattr(scene, 'eevee'):
    scene.eevee.use_gtao = True
    scene.eevee.gtao_distance = 3.0
    scene.eevee.gtao_factor = 1.15
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'Medium High Contrast'
scene.view_settings.exposure = 0.12
scene.view_settings.gamma = 1.0

views = {
    'polished-lobby.png': ((0.0, -21.0, 1.62), (0.0, -13.4, 1.35)),
    'polished-ward-a.png': ((-24.0, -10.5, 1.62), (-24.0, 17.0, 1.38)),
    'polished-patient-room.png': ((-28.3, 6.0, 1.58), (-33.0, 7.0, 0.85)),
    'polished-emergency.png': ((20.0, -20.8, 1.62), (32.0, -16.5, 1.0)),
}
for filename, (camera_position, target) in views.items():
    camera.location = camera_position
    look_at(camera, target)
    scene.render.filepath = os.path.join(output_directory, filename)
    bpy.ops.render.render(write_still=True)

stats = {
    'objects_before_batching': pre_batch_count,
    'objects_after_batching': post_batch_count,
    'polygons': sum(len(obj.data.polygons) for obj in mesh_objects),
    'glb_bytes': os.path.getsize(output_glb),
    'footprint': {'width': 76, 'depth': 46, 'ceiling_height': 2.5},
}
with open(os.path.join(output_directory, 'st-agnes-authored-polished-stats.json'), 'w', encoding='utf-8') as handle:
    json.dump(stats, handle, indent=2)
print(json.dumps(stats, indent=2))
