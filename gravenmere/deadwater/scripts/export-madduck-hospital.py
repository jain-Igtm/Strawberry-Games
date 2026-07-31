import bpy
import json
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
background.inputs['Color'].default_value = (0.025, 0.03, 0.035, 1.0)
background.inputs['Strength'].default_value = 0.55

camera_data = bpy.data.cameras.new('Inspection Camera')
camera = bpy.data.objects.new('Inspection Camera', camera_data)
bpy.context.collection.objects.link(camera)
bpy.context.scene.camera = camera
camera_data.type = 'ORTHO'
camera_data.ortho_scale = extent * 1.22
camera_data.lens = 48


def look_at(obj, target):
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def add_area(name, location, energy, size):
    data = bpy.data.lights.new(name, type='AREA')
    data.energy = energy
    data.shape = 'DISK'
    data.size = size
    light = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(light)
    light.location = location
    look_at(light, center)
    return light


add_area('Key', center + Vector((extent * 0.8, -extent * 1.0, extent * 1.25)), 1800, extent * 0.65)
add_area('Fill', center + Vector((-extent * 0.95, -extent * 0.35, extent * 0.65)), 1100, extent * 0.8)
add_area('Rim', center + Vector((0, extent * 1.1, extent * 1.0)), 1400, extent * 0.55)

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
