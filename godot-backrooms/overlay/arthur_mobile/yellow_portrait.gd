extends Node3D

static var _texture_cache: Dictionary = {}

func configure(seed: int) -> void:
	var variant: int = ((seed % 12) + 12) % 12
	if not _texture_cache.has(variant):
		_texture_cache[variant] = _build_texture(variant)
	var material := StandardMaterial3D.new()
	material.albedo_texture = _texture_cache[variant] as Texture2D
	material.roughness = 0.82
	material.metallic = 0.0
	var picture := get_node("Picture") as MeshInstance3D
	picture.material_override = material

func _build_texture(variant: int) -> ImageTexture:
	const W := 96
	const H := 128
	var image := Image.create(W, H, false, Image.FORMAT_RGBA8)
	var bg_a := Color(0.30 + float(variant % 3) * 0.025, 0.245, 0.155, 1.0)
	var bg_b := Color(0.105, 0.085, 0.055, 1.0)
	for y in range(H):
		var t := float(y) / float(H - 1)
		var row_color := bg_a.lerp(bg_b, t * 0.62)
		for x in range(W):
			var grain := float(_noise_int(x, y, variant) % 17) / 255.0
			image.set_pixel(x, y, row_color.lightened(grain))

	var cx := 48 + ((variant * 7) % 11) - 5
	var head_y := 43 + ((variant * 5) % 7) - 3
	var head_rx := 15 + (variant % 4)
	var head_ry := 21 + ((variant >> 1) % 4)
	var skin := Color(0.57, 0.45, 0.30, 1.0).lerp(Color(0.74, 0.64, 0.45, 1.0), float(variant % 5) / 6.0)
	var hair := Color(0.075 + float(variant % 3) * 0.025, 0.062, 0.047, 1.0)
	var cloth := Color(0.12, 0.14 + float(variant % 4) * 0.018, 0.115, 1.0)

	for y in range(16, 73):
		for x in range(20, 77):
			var dx := float(x - cx) / float(head_rx)
			var dy := float(y - head_y) / float(head_ry)
			if dx * dx + dy * dy <= 1.0:
				image.set_pixel(x, y, skin.darkened(maxf(0.0, absf(dx) * 0.12 + maxf(0.0, dy) * 0.06)))
				if y < head_y - head_ry * 0.34 or (absf(dx) > 0.78 and y < head_y + 3):
					image.set_pixel(x, y, hair)

	var shoulder_y := 70
	for y in range(shoulder_y, 119):
		var spread := int(17 + float(y - shoulder_y) * 0.48)
		for x in range(maxi(5, cx - spread), mini(W - 5, cx + spread)):
			image.set_pixel(x, y, cloth.lightened(float(_noise_int(x, y, variant + 17) % 8) / 255.0))

	var eye_y := head_y - 2
	var eye_dx := 6 + (variant % 2)
	_draw_disc(image, cx - eye_dx, eye_y, 2, Color(0.035, 0.03, 0.025, 1.0))
	_draw_disc(image, cx + eye_dx, eye_y, 2, Color(0.035, 0.03, 0.025, 1.0))
	if variant % 4 == 0:
		image.set_pixel(cx - eye_dx, eye_y, Color(0.72, 0.63, 0.42, 1.0))
		image.set_pixel(cx + eye_dx, eye_y, Color(0.72, 0.63, 0.42, 1.0))

	var mouth_y := head_y + 11
	for x in range(cx - 5, cx + 6):
		if (x + variant) % 2 == 0:
			image.set_pixel(x, mouth_y, Color(0.20, 0.115, 0.08, 1.0))

	for y in range(H):
		for x in range(W):
			var edge := minf(minf(float(x), float(W - 1 - x)), minf(float(y), float(H - 1 - y)))
			if edge < 13.0:
				var vignette := 1.0 - edge / 13.0
				image.set_pixel(x, y, image.get_pixel(x, y).darkened(vignette * 0.42))

	for scratch in range(2 + variant % 4):
		var sx := 8 + (_noise_int(scratch, variant, 91) % (W - 16))
		for y in range(7, H - 8):
			if _noise_int(sx, y, variant + scratch) % 5 != 0:
				image.set_pixel(sx, y, image.get_pixel(sx, y).lightened(0.055))

	return ImageTexture.create_from_image(image)

func _draw_disc(image: Image, cx: int, cy: int, radius: int, color: Color) -> void:
	for y in range(cy - radius, cy + radius + 1):
		for x in range(cx - radius, cx + radius + 1):
			if x >= 0 and y >= 0 and x < image.get_width() and y < image.get_height():
				if (x - cx) * (x - cx) + (y - cy) * (y - cy) <= radius * radius:
					image.set_pixel(x, y, color)

func _noise_int(x: int, y: int, seed: int) -> int:
	var n := x * 374761393 + y * 668265263 + seed * 1442695041
	n = (n ^ (n >> 13)) * 1274126177
	return absi(n ^ (n >> 16))
