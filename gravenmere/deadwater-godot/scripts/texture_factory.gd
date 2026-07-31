class_name TextureFactory
extends RefCounted

const SIZE := 128

static func make_material(kind: String, repeat_scale: float = 1.0) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_texture = _make_surface(kind)
	material.roughness = 0.96
	material.metallic = 0.0
	material.texture_repeat = true
	material.uv1_scale = Vector3(repeat_scale, repeat_scale, repeat_scale)
	if kind == "metal" or kind == "roof":
		material.metallic = 0.32
		material.roughness = 0.72
	if kind == "glass":
		material.metallic = 0.2
		material.roughness = 0.24
		material.emission_enabled = true
		material.emission = Color(0.16, 0.08, 0.05)
		material.emission_energy_multiplier = 0.45
	return material

static func make_tree_material(dead: bool = false) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_texture = _make_tree_texture(dead)
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
	material.alpha_scissor_threshold = 0.18
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	material.roughness = 1.0
	return material

static func make_plume_texture() -> ImageTexture:
	var image := Image.create(256, 256, false, Image.FORMAT_RGBA8)
	image.fill(Color(0, 0, 0, 0))
	var solid := Color(0.145, 0.145, 0.145, 1.0)
	for y in range(256):
		for x in range(256):
			var nx := (float(x) - 128.0) / 128.0
			var ny := (float(y) - 128.0) / 128.0
			var cap := pow(nx / 0.78, 2.0) + pow((ny + 0.36) / 0.34, 2.0) <= 1.0
			var shoulder_left := pow((nx + 0.48) / 0.42, 2.0) + pow((ny + 0.17) / 0.28, 2.0) <= 1.0
			var shoulder_right := pow((nx - 0.48) / 0.42, 2.0) + pow((ny + 0.17) / 0.28, 2.0) <= 1.0
			var stem_width := lerpf(0.18, 0.08, clamp((ny + 0.05) / 0.82, 0.0, 1.0))
			var stem := abs(nx) <= stem_width and ny > -0.08 and ny < 0.80
			var base := pow(nx / 0.34, 2.0) + pow((ny - 0.62) / 0.23, 2.0) <= 1.0
			if cap or shoulder_left or shoulder_right or stem or base:
				image.set_pixel(x, y, solid)
	return ImageTexture.create_from_image(image)

static func _make_surface(kind: String) -> ImageTexture:
	var image := Image.create(SIZE, SIZE, false, Image.FORMAT_RGBA8)
	var base := _base_color(kind)
	for y in range(SIZE):
		for x in range(SIZE):
			var n := _noise(x, y, hash(kind))
			var shift := (n - 0.5) * 0.16
			var color := base.lightened(shift) if shift >= 0.0 else base.darkened(-shift)
			image.set_pixel(x, y, color)

	match kind:
		"asphalt":
			_draw_asphalt(image)
		"brick":
			_draw_bricks(image)
		"boards":
			_draw_boards(image)
		"concrete", "hospital":
			_draw_concrete(image, kind == "hospital")
		"metal", "roof":
			_draw_metal(image)
		"grass":
			_draw_grass(image)
		"glass":
			_draw_glass(image)

	image.generate_mipmaps()
	return ImageTexture.create_from_image(image)

static func _base_color(kind: String) -> Color:
	match kind:
		"asphalt":
			return Color8(48, 46, 44)
		"sidewalk":
			return Color8(103, 97, 90)
		"brick":
			return Color8(100, 54, 43)
		"boards":
			return Color8(76, 86, 80)
		"concrete":
			return Color8(92, 87, 80)
		"hospital":
			return Color8(154, 153, 142)
		"metal":
			return Color8(78, 78, 74)
		"roof":
			return Color8(39, 41, 42)
		"wood":
			return Color8(103, 72, 48)
		"grass":
			return Color8(54, 58, 39)
		"glass":
			return Color8(26, 36, 41)
		"cloth":
			return Color8(55, 57, 56)
		_:
			return Color8(120, 116, 108)

static func _noise(x: int, y: int, seed: int) -> float:
	var value := sin(float(x) * 12.9898 + float(y) * 78.233 + float(seed % 997)) * 43758.5453
	return value - floor(value)

static func _draw_asphalt(image: Image) -> void:
	for index in range(34):
		var x := int(_noise(index, 19, 91) * SIZE)
		var y := int(_noise(index, 43, 77) * SIZE)
		var length := 8 + int(_noise(index, 71, 51) * 24.0)
		for step in range(length):
			var px := clampi(x + step, 0, SIZE - 1)
			var py := clampi(y + int(sin(float(step) * 0.55) * 2.0), 0, SIZE - 1)
			image.set_pixel(px, py, Color8(28, 27, 26))

static func _draw_bricks(image: Image) -> void:
	var mortar := Color8(39, 29, 27)
	for y in range(0, SIZE, 20):
		for x in range(SIZE):
			for thickness in range(3):
				image.set_pixel(x, clampi(y + thickness, 0, SIZE - 1), mortar)
		var offset := 0 if int(y / 20) % 2 == 0 else 18
		for x in range(offset, SIZE, 36):
			for py in range(y, min(y + 20, SIZE)):
				for thickness in range(3):
					image.set_pixel(clampi(x + thickness, 0, SIZE - 1), py, mortar)

static func _draw_boards(image: Image) -> void:
	for x in range(0, SIZE, 16):
		for y in range(SIZE):
			image.set_pixel(x, y, Color8(44, 49, 46))
			if x + 1 < SIZE:
				image.set_pixel(x + 1, y, Color8(57, 63, 59))

static func _draw_concrete(image: Image, tiled: bool) -> void:
	for index in range(140):
		var x := int(_noise(index, 61, 22) * SIZE)
		var y := int(_noise(index, 73, 28) * SIZE)
		var shade := 70 + int(_noise(index, 97, 31) * 42.0)
		image.set_pixel(x, y, Color8(shade, shade, shade))
	if tiled:
		for x in range(0, SIZE, 32):
			for y in range(SIZE):
				image.set_pixel(x, y, Color8(115, 114, 108))
		for y in range(0, SIZE, 32):
			for x in range(SIZE):
				image.set_pixel(x, y, Color8(115, 114, 108))

static func _draw_metal(image: Image) -> void:
	for y in range(0, SIZE, 24):
		for x in range(SIZE):
			image.set_pixel(x, y, Color8(38, 39, 38))
	for x in range(12, SIZE, 32):
		for y in range(12, SIZE, 24):
			for oy in range(-2, 3):
				for ox in range(-2, 3):
					if ox * ox + oy * oy <= 4:
						image.set_pixel(clampi(x + ox, 0, SIZE - 1), clampi(y + oy, 0, SIZE - 1), Color8(118, 111, 98))

static func _draw_grass(image: Image) -> void:
	for index in range(340):
		var x := int(_noise(index, 13, 111) * SIZE)
		var y := int(_noise(index, 31, 117) * SIZE)
		var dark := _noise(index, 47, 119) > 0.62
		image.set_pixel(x, y, Color8(33, 38, 25) if dark else Color8(74, 75, 45))

static func _draw_glass(image: Image) -> void:
	for x in range(0, SIZE, 32):
		for y in range(SIZE):
			image.set_pixel(x, y, Color8(70, 74, 72))
	for y in range(0, SIZE, 48):
		for x in range(SIZE):
			image.set_pixel(x, y, Color8(58, 62, 61))

static func _make_tree_texture(dead: bool) -> ImageTexture:
	var image := Image.create(128, 256, false, Image.FORMAT_RGBA8)
	image.fill(Color(0, 0, 0, 0))
	var trunk := Color8(67, 50, 39)
	var foliage := Color8(24, 35, 27) if not dead else Color8(48, 45, 40)
	for y in range(82, 248):
		var width := 5 + int((float(y) / 256.0) * 5.0)
		for x in range(64 - width, 64 + width):
			image.set_pixel(x, y, trunk)
	for tier in range(7):
		var center_y := 42 + tier * 25
		var half_width := 20 + tier * 6
		var height := 42
		for y in range(center_y, min(center_y + height, 240)):
			var t := float(y - center_y) / float(height)
			var row_half := int(lerpf(2.0, float(half_width), t))
			for x in range(64 - row_half, 64 + row_half):
				if _noise(x, y, tier * 29) > 0.07:
					image.set_pixel(x, y, foliage)
	image.generate_mipmaps()
	return ImageTexture.create_from_image(image)
