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


output_directory = os.path.abspath(argument_value('--output', 'asset-inspection/madduck-output'))
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
    'Window': (0.34, 0.58, 0.65, 0.36),
    'Phone_ExitSign': (0.12, 0.15, 0.16, 1.0),
    'Plant': (0.16, 0.31, 0.17, 1.0),
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

    shader.inputs['Roughness'].default_value = 0.72
    shader.inputs['Metallic'].default_value = 0.02

    relative_texture = texture_map.get(material.name)
    if relative_texture:
        texture_path = os.path.join(textures_root, relative_texture)
        if os.path.exists(texture_path):
            image = bpy.data.images.load(texture_path, check_existing=True)
            texture = nodes.new('ShaderNodeTexImage')
            texture.image = image
            texture.location = (-420, 40)
            links.new(texture.outputs['Color'], shader.inputs['Base Color'])
            links.new(texture.outputs['Alpha'], shader.inputs['Alpha'])
        else:
            print(f'WARNING: missing texture for {material.name}: {texture_path}')
            shader.inputs['Base Color'].default_value = (0.58, 0.6, 0.58, 1.0)
    else:
        shader.inputs['Base Color'].default_value = fallback_colors.get(
            material.name,
            (0.58, 0.6, 0.58, 1.0),
        )

    if material.name == 'Window':
        shader.inputs['Roughness'].default_value = 0.18
        shader.inputs['Metallic'].default_value = 0.0
        shader.inputs['Alpha'].default_value = 0.32
        enable_transparency(material)
    elif material.name == 'Ceiling_light':
        shader.inputs['Emission Color'].default_value = (0.85, 0.95, 1.0, 1.0)
        shader.inputs['Emission Strength'].default_value = 1.2
        shader.inputs['Roughness'].default_value = 0.32
    elif material.name == 'Exit_sign':
        shader.inputs['Emission Color'].default_value = (0.2, 0.8, 0.28, 1.0)
        shader.inputs['Emission Strength'].default_value = 0.55
    elif material.name == 'IV_bag':
        shader.inputs['Roughness'].default_value = 0.24
        shader.inputs['Alpha'].default_value = 0.72
        enable_transparency(material)


for material in bpy.data.materials:
    configure_material(material)

mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
if not mesh_objects:
    raise RuntimeError('The downloaded Blender scene contains no mesh objects.')

inventory = []
for obj in mesh_objects:
    inventory.append({
        'name': obj.name,
        'dimensions': [round(value, 5) for value in obj.dimensions],
        'location': [round(value, 5) for value in obj.location],
        'vertices': len(obj.data.vertices),
        'polygons': len(obj.data.polygons),
        'materials': [slot.material.name if slot.material else None for slot in obj.material_slots],
    })

with open(os.path.join(output_directory, 'inventory.json'), 'w', encoding='utf-8') as handle:
    json.dump(inventory, handle, indent=2)

for obj in bpy.context.scene.objects:
    obj.select_set(obj.type == 'MESH')

bpy.context.view_layer.objects.active = mesh_objects[0]
bpy.ops.export_scene.gltf(
    filepath=os.path.join(output_directory, 'madduck-hospital-assets.glb'),
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_materials='EXPORT',
    export_cameras=False,
    export_lights=False,
)

minimum = Vector((float('inf'), float('inf'), float('inf')))
maximum = Vector((float('-inf'), float('-inf'), float('-inf')))
for obj in mesh_objects:
    for corner in obj.bound_box:
        world_corner = obj.matrix_world @ Vector(corner)
        minimum.x = min(minimum.x, world_corner.x)
        minimum.y = min(minimum.y, world_corner.y)
        minimum.z = min(minimum.z, world_corner.z)
        maximum.x = max(maximum.x, world_corner.x)
        maximum.y = max(maximum.y, world_corner.y)
        maximum.z = max(maximum.z, world_corner.z)

center = (minimum + maximum) * 0.5
span = maximum - minimum
extent = max(span.x, span.y, span.z, 1.0)

for obj in list(bpy.context.scene.objects):
    if obj.type in {'CAMERA', 'LIGHT'}:
        bpy.data.objects.remove(obj, do_unlink=True)

world = bpy.context.scene.world or bpy.data.worlds.new('Inspection World')
bpy.context.scene.world = world
world.use_nodes = True
background = world.node_tree.nodes.get('Background')
background.inputs['Color'].default_value = (0.055, 0.065, 0.075, 1.0)
background.inputs['Strength'].default_value = 1.05

camera_data = bpy.data.cameras.new('Inspection Camera')
camera = bpy.data.objects.new('Inspection Camera', camera_data)
bpy.context.collection.objects.link(camera)
bpy.context.scene.camera = camera
camera_data.type = 'ORTHO'
camera_data.ortho_scale = extent * 1.16
camera_data.lens = 48


def look_at(obj, target):
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


sun_data = bpy.data.lights.new('Inspection Sun', type='SUN')
sun_data.energy = 4.0
sun_data.angle = math.radians(18)
sun = bpy.data.objects.new('Inspection Sun', sun_data)
bpy.context.collection.objects.link(sun)
sun.rotation_euler = (math.radians(38), math.radians(-28), math.radians(-34))

fill_data = bpy.data.lights.new('Inspection Fill', type='AREA')
fill_data.energy = 3500
fill_data.shape = 'DISK'
fill_data.size = extent * 1.2
fill = bpy.data.objects.new('Inspection Fill', fill_data)
bpy.context.collection.objects.link(fill)
fill.location = center + Vector((-extent * 0.55, -extent * 0.45, extent * 0.8))
look_at(fill, center)

scene = bpy.context.scene
try:
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
except TypeError:
    scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1600
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'Medium High Contrast'
scene.view_settings.exposure = 1.0
scene.view_settings.gamma = 1.0

views = {
    'asset-sheet-isometric.png': Vector((1.25, -1.45, 1.05)),
    'asset-sheet-front.png': Vector((0.0, -1.8, 0.45)),
    'asset-sheet-top.png': Vector((0.001, -0.001, 2.2)),
}

for filename, direction in views.items():
    camera.location = center + direction.normalized() * extent * 2.0
    look_at(camera, center)
    scene.render.filepath = os.path.join(output_directory, filename)
    bpy.ops.render.render(write_still=True)

with open(os.path.join(output_directory, 'scene-bounds.json'), 'w', encoding='utf-8') as handle:
    json.dump({
        'minimum': list(minimum),
        'maximum': list(maximum),
        'center': list(center),
        'span': list(span),
        'mesh_count': len(mesh_objects),
    }, handle, indent=2)

print(f'Exported {len(mesh_objects)} hospital mesh objects to {output_directory}')
