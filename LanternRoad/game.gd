extends Node2D

const W := 480.0
const H := 270.0
const GROUND := 219.0
const SPEED := 112.0
const GRAVITY := 620.0
const JUMP := -260.0
const REGION_LENGTH := 1200.0
var region := 0
var player := Vector2(60, GROUND)
var velocity := Vector2.ZERO
var facing := 1
var hp := 5
var shards := 0
var defeated := 0
var quest := 0
var dialogue := ""
var dialogue_options: Array[String] = []
var talking_to := ""
var enemies: Array[Dictionary] = []
var particles: Array[Dictionary] = []
var attack_timer := 0.0
var invuln := 0.0
var game_time := 0.0
var cam := 0.0
var dead := false
var won := false
var touch := {}
var font: Font = ThemeDB.fallback_font
var save_path := "user://lanternroad.save"
var title_screen := true
var platforms: Array[Rect2] = []
var pickups: Array[Dictionary] = []
var collected_ids: Dictionary = {}
var story_flags: Dictionary = {}
var standing_platform := false
var jump_was_down := false
var attack_was_down := false
var notice := ""
var notice_timer := 0.0
var regions := ["BRIARHOLLOW", "THE WEEPING WOOD", "THE SUNKEN BELFRY"]
var region_colors := [Color("#8db7a1"), Color("#496e74"), Color("#41415d")]
var npcs := [
	{"x": 170.0, "name": "Mira", "color": Color("#dba97b")},
	{"x": 440.0, "name": "Tobin", "color": Color("#94bad9")},
	{"x": 780.0, "name": "Bell Keeper", "color": Color("#c6a2cb")}
]

func _ready() -> void:
	load_game()
	enter_region(region, false)
	queue_redraw()

func save_game() -> void:
	var file := FileAccess.open(save_path, FileAccess.WRITE)
	if file:
		file.store_var({"quest": quest, "shards": shards, "region": region, "hp": hp, "defeated": defeated, "collected_ids": collected_ids, "story_flags": story_flags})

func load_game() -> void:
	if not FileAccess.file_exists(save_path):
		return
	var file := FileAccess.open(save_path, FileAccess.READ)
	if file:
		var data = file.get_var()
		if data is Dictionary:
			quest = int(data.get("quest", 0))
			shards = int(data.get("shards", 0))
			region = clampi(int(data.get("region", 0)), 0, 2)
			hp = int(data.get("hp", 5))
			defeated = int(data.get("defeated", 0))
			collected_ids = data.get("collected_ids", {})
			story_flags = data.get("story_flags", {})

func enter_region(which: int, from_edge: bool) -> void:
	region = clampi(which, 0, 2)
	player = Vector2(1100 if from_edge else 65, GROUND)
	velocity = Vector2.ZERO
	enemies.clear()
	platforms.clear()
	pickups.clear()
	for i in range(5):
		var px := 195.0 + i * 198.0
		var py := 170.0 if i % 2 == 0 else 185.0
		platforms.append(Rect2(px, py, 98, 8))
	for i in range(9):
		var item_id := "%d:%d" % [region, i]
		if not collected_ids.has(item_id):
			pickups.append({"id": item_id, "x": 117.0 + i * 125.0, "y": (151.0 if i % 3 == 0 else GROUND - 22.0)})
	if region == 1:
		for i in range(5):
			enemies.append({"x": 260.0 + i * 170.0, "y": GROUND, "hp": 2, "dir": -1, "cool": 0.0, "alive": true, "type": 0})
	elif region == 2:
		for i in range(3):
			enemies.append({"x": 280.0 + i * 200.0, "y": GROUND, "hp": 3, "dir": 1, "cool": 0.0, "alive": true, "type": 1})
		enemies.append({"x": 1000.0, "y": GROUND, "hp": 10, "dir": -1, "cool": 0.0, "alive": true, "type": 2})
	save_game()

func _physics_process(delta: float) -> void:
	game_time += delta
	notice_timer = maxf(0.0, notice_timer - delta)
	if title_screen:
		queue_redraw()
		return
	if not dialogue.is_empty() or dead or won:
		queue_redraw()
		return
	attack_timer = maxf(0.0, attack_timer - delta)
	invuln = maxf(0.0, invuln - delta)
	var direction := int(Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT) or touch.get("right", false)) - int(Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT) or touch.get("left", false))
	if direction != 0:
		facing = direction
	velocity.x = direction * SPEED
	var jump_down: bool = Input.is_key_pressed(KEY_SPACE) or Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP) or touch.get("jump", false)
	if jump_down and not jump_was_down and (player.y >= GROUND - 0.1 or standing_platform):
		velocity.y = JUMP
		standing_platform = false
	jump_was_down = jump_down
	velocity.y += GRAVITY * delta
	var old_y := player.y
	player += velocity * delta
	standing_platform = false
	if velocity.y >= 0:
		for ledge in platforms:
			if player.x + 6 >= ledge.position.x and player.x - 6 <= ledge.end.x and old_y <= ledge.position.y and player.y >= ledge.position.y:
				player.y = ledge.position.y
				velocity.y = 0
				standing_platform = true
	for item in pickups.duplicate():
		if absf(player.x - float(item.x)) < 13 and absf(player.y - float(item.y)) < 24:
			shards += 1
			collected_ids[str(item.id)] = true
			pickups.erase(item)
			if shards % 5 == 0:
				hp = mini(5, hp + 1)
				show_notice("Five fragments restore one heart.")
			else:
				show_notice("Lantern fragment found.")
			save_game()
	if player.y > GROUND:
		player.y = GROUND
		velocity.y = 0
	if player.x > REGION_LENGTH:
		if region < 2:
			enter_region(region + 1, false)
		else:
			player.x = REGION_LENGTH
	elif player.x < 0:
		if region > 0:
			enter_region(region - 1, true)
		else:
			player.x = 0
	var attack_down: bool = Input.is_key_pressed(KEY_J) or touch.get("attack", false)
	if attack_down and not attack_was_down:
		attack()
	attack_was_down = attack_down
	for i in range(enemies.size()):
		var e: Dictionary = enemies[i]
		if not e.alive:
			continue
		e.cool = maxf(0.0, float(e.cool) - delta)
		var distance := player.x - float(e.x)
		if absf(distance) < 160:
			e.dir = signf(distance)
		e.x = clampf(float(e.x) + float(e.dir) * (24 if int(e.type) == 2 else 39) * delta, 100, 1140)
		if absf(distance) < (28 if int(e.type) == 2 else 17) and float(e.cool) <= 0:
			e.cool = 1.4
			hurt()
		enemies[i] = e
	cam = clampf(player.x - W * 0.45, 0, REGION_LENGTH - W)
	queue_redraw()

func attack() -> void:
	if attack_timer > 0:
		return
	attack_timer = 0.33
	for i in range(enemies.size()):
		var e: Dictionary = enemies[i]
		if not e.alive:
			continue
		if absf(float(e.x) - player.x) < 39 and (float(e.x) - player.x) * facing >= -7:
			e.hp = int(e.hp) - 1
			e.x = clampf(float(e.x) + facing * 23, 0, REGION_LENGTH)
			if int(e.hp) <= 0:
				e.alive = false
				defeated += 1
				shards += 1
				if int(e.type) == 2:
					won = true
					quest = 3
					save_game()
			enemies[i] = e

func hurt() -> void:
	if invuln > 0:
		return
	hp -= 1
	invuln = 1.1
	if hp <= 0:
		dead = true

func interact() -> void:
	if not dialogue.is_empty():
		select_dialogue(0)
		return
	if region != 0:
		if region == 1 and absf(player.x - 720) < 55 and not story_flags.has("blue_lantern"):
			story_flags["blue_lantern"] = true
			quest = maxi(quest, 2)
			dialogue = "A blue lantern hangs from a root. Inside is a note: THE BELL KNOWS OUR NAMES."
			dialogue_options = ["Take the note."]
			talking_to = "clue"
			save_game()
			return
		if region == 1 and absf(player.x - 1010) < 48 and not story_flags.has("fox"):
			story_flags["fox"] = true
			shards += 3
			dialogue = "A silver fox uncovers a hidden lantern cache. Three fragments are yours."
			dialogue_options = ["Thank you."]
			talking_to = "clue"
			save_game()
			return
		if region == 2 and absf(player.x - 660) < 40 and not story_flags.has("inscription"):
			story_flags["inscription"] = true
			dialogue = "The inscription reads: 'We are not your prisoners. We are your memories.'"
			dialogue_options = ["Remember."]
			talking_to = "clue"
			save_game()
			return
		if region == 2 and player.x > 830:
			dialogue = "The ancient bell hums beneath the stone. Something is listening."
			dialogue_options = ["Continue"]
			talking_to = "ruins"
		return
	for npc in npcs:
		if absf(float(npc.x) - player.x) < 45:
			talking_to = str(npc.name)
			if talking_to == "Mira":
				dialogue = "Mira: Three people went into the woods. Only their lanterns came back."
				dialogue_options = ["Who were they?", "I'll investigate."]
			elif talking_to == "Tobin":
				dialogue = "Tobin: I heard a bell under the ground. Our tower hasn't rung in sixty years."
				dialogue_options = ["Where is the tower?", "Why are you afraid?"]
			else:
				dialogue = "Keeper: The bell was buried to keep a promise. Something has broken it."
				dialogue_options = ["What promise?", "How can I stop it?"]
			return

func select_dialogue(choice: int) -> void:
	if talking_to == "Mira" and choice == 1:
		story_flags["mira_promise"] = true
		quest = maxi(quest, 1)
		dialogue = "Mira: Bring them home, if there is still a way."
		dialogue_options = ["I promise."]
		talking_to = "followup"
		save_game()
	elif talking_to == "Mira" and choice == 0:
		dialogue = "Mira: My brother Eren, the miller, and a girl from the north road. Look for their blue lanterns."
		dialogue_options = ["I will."]
		talking_to = "followup"
	elif talking_to == "Tobin" and choice == 1:
		dialogue = "Tobin: Because the last person who heard it forgot his own name."
		dialogue_options = ["I understand."]
		talking_to = "followup"
	elif talking_to == "Tobin" and choice == 0:
		dialogue = "Tobin: There is a stair beneath the old roots, past the weeping wood."
		dialogue_options = ["Thank you."]
		talking_to = "followup"
	elif talking_to == "Bell Keeper" and choice == 1:
		dialogue = "Keeper: The old bell cannot be destroyed. But its guardian can be made to listen."
		dialogue_options = ["I'll try."]
		talking_to = "followup"
	elif talking_to == "Bell Keeper" and choice == 0:
		dialogue = "Keeper: We promised the thing below that the village would remember its name."
		dialogue_options = ["What is its name?"]
		talking_to = "keeper_answer"
	elif talking_to == "keeper_answer":
		dialogue = "Keeper: We forgot. The missing people may have remembered for us."
		dialogue_options = ["I'll go."]
		talking_to = "followup"
	else:
		if quest == 0:
			quest = 1
		dialogue = ""
		dialogue_options.clear()
		talking_to = ""
		save_game()

func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if title_screen:
			title_screen = false
			return
		if not dialogue.is_empty() and event.keycode in [KEY_1, KEY_2]:
			select_dialogue(0 if event.keycode == KEY_1 else 1)
		elif event.keycode == KEY_E:
			interact()
		elif event.keycode == KEY_ESCAPE:
			dialogue = ""
		elif event.keycode == KEY_R and (dead or won):
			dead = false
			won = false
			hp = 5
			if quest == 3:
				quest = 2
			enter_region(0, false)
	if event is InputEventScreenTouch:
		if title_screen and event.pressed:
			title_screen = false
			return
		var p: Vector2 = get_canvas_transform().affine_inverse() * event.position
		var names := ["left", "right", "jump", "attack", "interact"]
		var rects := [Rect2(12, 218, 43, 42), Rect2(61, 218, 43, 42), Rect2(328, 218, 43, 42), Rect2(378, 218, 43, 42), Rect2(428, 218, 43, 42)]
		for i in range(names.size()):
			if rects[i].has_point(p):
				if names[i] == "interact" and event.pressed:
					if dead or won:
						dead = false
						won = false
						hp = 5
						enter_region(0, false)
					else:
						interact()
				else:
					touch[names[i]] = event.pressed
		if event.pressed and not dialogue.is_empty() and p.y > 148 and p.y < 215:
			select_dialogue(1 if p.x > 235 and dialogue_options.size() > 1 else 0)

func show_notice(message: String) -> void:
	notice = message
	notice_timer = 2.5

func rect(x: float, y: float, w: float, h: float, c: Color) -> void:
	draw_rect(Rect2(x, y, w, h), c)

func label_at(s: String, x: float, y: float, size: int = 11, color: Color = Color.WHITE) -> void:
	draw_string(font, Vector2(x, y), s, HORIZONTAL_ALIGNMENT_LEFT, -1, size, color)

func _draw() -> void:
	var sky: Color = region_colors[region]
	rect(0, 0, W, H, sky)
	rect(0, 0, W, 75, sky.lightened(0.16))
	for i in range(18):
		var x := fposmod(float(i * 89) - cam * 0.24, W + 100) - 50
		var y := 98 + sin(float(i) * 3.7) * 19
		draw_circle(Vector2(x, y), 32, sky.darkened(0.12))
	for i in range(22):
		var x := fposmod(float(i * 67) - cam * 0.53, W + 90) - 45
		if region < 2:
			rect(x, 100, 9, 125, Color("#354f49") if region == 1 else Color("#52745e"))
			draw_circle(Vector2(x + 5, 113), 24, Color("#365c51") if region == 1 else Color("#6a9473"))
		else:
			rect(x, 86, 17, 138, Color("#34354c"))
			rect(x - 9, 84, 34, 10, Color("#5c5869"))
	rect(0, GROUND + 1, W, H - GROUND, Color("#343e3d") if region == 2 else Color("#4e6045"))
	rect(0, GROUND + 1, W, 5, Color("#778e60") if region != 2 else Color("#68637a"))
	for i in range(100):
		var x := float(i * 19) - cam
		if x > -15 and x < W:
			rect(x, GROUND + 13 + (i % 3) * 7, 8, 3, Color("#374b39") if region != 2 else Color("#292b43"))
	if region == 0:
		for i in range(7):
			var x := float(i * 165 + 70) - cam
			rect(x, 155, 83, 65, Color("#b39a77"))
			rect(x + 9, 177, 19, 42, Color("#5b504a"))
			rect(x + 49, 171, 17, 17, Color("#d7d29d"))
			draw_colored_polygon(PackedVector2Array([Vector2(x - 8, 158), Vector2(x + 41, 126), Vector2(x + 91, 158)]), Color("#754f56"))
		for npc in npcs:
			var x: float = float(npc.x) - cam
			draw_character(x, GROUND, npc.color, false)
			label_at(str(npc.name), x - 19, GROUND - 36, 9)
	elif region == 1:
		for i in range(8):
			var x := float(i * 155 + 100) - cam
			rect(x, 168, 17, 51, Color("#584d4a"))
			draw_circle(Vector2(x + 8, 157), 30, Color("#294f4b"))
			draw_circle(Vector2(x - 8, 166), 21, Color("#3a685b"))
	else:
		for i in range(7):
			var x := float(i * 177 + 90) - cam
			rect(x, 159, 24, 61, Color("#646078"))
			rect(x - 7, 153, 38, 8, Color("#8d8293"))
	for ledge in platforms:
		var lx := ledge.position.x - cam
		rect(lx, ledge.position.y, ledge.size.x, ledge.size.y, Color("#646076") if region == 2 else Color("#7d6952"))
		rect(lx, ledge.position.y, ledge.size.x, 3, Color("#aba0a9") if region == 2 else Color("#acb882"))
	for item in pickups:
		var sx: float = float(item.x) - cam
		var sy: float = float(item.y) + sin(game_time * 3.0 + sx) * 3.0
		draw_colored_polygon(PackedVector2Array([Vector2(sx, sy - 7), Vector2(sx + 5, sy), Vector2(sx, sy + 7), Vector2(sx - 5, sy)]), Color("#fce5a4"))
		draw_circle(Vector2(sx, sy), 2, Color.WHITE)
	for e in enemies:
		if not e.alive:
			continue
		var x: float = float(e.x) - cam
		var boss: bool = int(e.type) == 2
		var color := Color("#bd7897") if boss else (Color("#a9b3cf") if region == 2 else Color("#9b826a"))
		draw_circle(Vector2(x, GROUND - (22 if boss else 10)), 20 if boss else 11, color)
		rect(x - (14 if boss else 7), GROUND - (16 if boss else 7), 28 if boss else 14, 13 if boss else 7, color.darkened(0.28))
		draw_circle(Vector2(x + (7 if boss else 4) * float(e.dir), GROUND - (25 if boss else 12)), 2, Color("#f5e6ae"))
		if boss:
			rect(x - 24, GROUND - 51, 48, 4, Color("#382b39"))
			rect(x - 24, GROUND - 51, 48 * float(e.hp) / 10.0, 4, Color("#e6a0a8"))
	if invuln <= 0 or int(game_time * 13) % 2 == 0:
		draw_character(player.x - cam, player.y, Color("#e5b78e"), true)
	if attack_timer > 0.15:
		draw_arc(Vector2(player.x - cam + facing * 15, player.y - 19), 23, -1.2 if facing > 0 else 1.9, 1.2 if facing > 0 else 4.3, 10, Color("#fff0b0"), 3)
	rect(0, 0, W, 25, Color(0.08, 0.1, 0.15, 0.82))
	label_at(regions[region], 8, 16, 11, Color("#f5e6bd"))
	for i in range(5):
		label_at("♥" if i < hp else "·", 248 + i * 17, 17, 14, Color("#f3a2a0"))
	label_at("✦ %d" % shards, 368, 17, 12, Color("#ffe1a0"))
	if quest > 0 and not won:
		label_at("Find the bell beneath the woods", 130, 37, 9, Color("#f7e6b7"))
	if notice_timer > 0:
		rect(116, 46, 270, 20, Color("#1c2233"))
		label_at(notice, 124, 60, 10, Color("#ffe3a4"))
	if not dialogue.is_empty():
		rect(13, 151, 454, 64, Color("#1c2233"))
		draw_rect(Rect2(13, 151, 454, 64), Color("#d9c6a0"), false, 2)
		var words := dialogue.split(" ")
		var line := ""
		var lines: Array[String] = []
		for word in words:
			if (line + " " + word).length() > 67:
				lines.append(line)
				line = word
			else:
				line += (" " if line != "" else "") + word
		lines.append(line)
		for i in range(mini(lines.size(), 2)):
			label_at(lines[i], 23, 169 + i * 14, 10)
		for i in range(mini(dialogue_options.size(), 2)):
			label_at(("> " if i == 0 else "  ") + dialogue_options[i], 24 + i * 200, 204, 9, Color("#ffe4a6"))
	if title_screen:
		rect(0, 0, W, H, Color("#1d2635"))
		for i in range(35):
			draw_circle(Vector2(float((i * 61) % 478), float((i * 73) % 260)), 1.0, Color("#929fb8"))
		draw_circle(Vector2(238, 94), 42, Color("#cfbe99"))
		draw_circle(Vector2(250, 84), 42, Color("#1d2635"))
		label_at("THE LANTERN ROAD", 86, 131, 24, Color("#f5d9a7"))
		label_at("A village. A promise. A buried bell.", 127, 158, 11)
		label_at("TAP OR PRESS A KEY TO BEGIN", 146, 194, 11, Color("#ffe1a0"))
		label_at("MOVE A/D   JUMP SPACE   ATTACK J   TALK E", 103, 241, 10)
		return
	if dead or won:
		rect(40, 77, 400, 100, Color("#202337"))
		label_at("THE BELL REMEMBERS" if won else "YOUR LANTERN WENT DARK", 103, 114, 17, Color("#ffe1ac"))
		if won:
			label_at("The villagers have a path home." if story_flags.has("blue_lantern") else "The bell falls silent. Questions remain.", 110, 131, 10)
		label_at("Press R or tap TALK to restart", 134, 147, 11)
	var names := ["<", ">", "JUMP", "HIT", "TALK"]
	var xs := [12.0, 61.0, 328.0, 378.0, 428.0]
	for i in range(5):
		rect(xs[i], 218, 43, 42, Color(0.12, 0.15, 0.23, 0.55))
		draw_rect(Rect2(xs[i], 218, 43, 42), Color("#dfd0ae"), false, 1)
		label_at(names[i], xs[i] + (6 if i > 1 else 15), 244, 9)

func draw_character(x: float, y: float, skin: Color, hero: bool) -> void:
	rect(x - 5, y - 24, 10, 11, skin)
	rect(x - 6, y - 28, 12, 6, Color("#483d42") if hero else Color("#62505d"))
	rect(x - 7, y - 13, 14, 13, Color("#54758d") if hero else Color("#835e75"))
	rect(x - 6, y, 5, 3, Color("#333b4c"))
	rect(x + 2, y, 5, 3, Color("#333b4c"))
	rect(x + (2 if facing > 0 else -3), y - 21, 2, 2, Color("#292a32"))
	if hero:
		rect(x - 10, y - 11, 3, 10, Color("#d5a56c"))
