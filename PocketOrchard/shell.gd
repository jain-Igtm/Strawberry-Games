extends Control
## The LCD is always 160 x 144. Controls live outside it and support multitouch.
const Game = preload('res://game.gd')
var viewport: SubViewport
var display: TextureRect
var game: Node2D
var lcd:=Rect2()
var regions: Dictionary={}
var fingers: Dictionary={}
var run_fingers: Dictionary={}
var keyboard: Dictionary={}
var pad_center:=Vector2.ZERO
var pad_size:=48.0
var font: Font=ThemeDB.fallback_font
var small_screen:=false

func _ready() -> void:
	viewport=SubViewport.new()
	viewport.size=Vector2i(160,144)
	viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS
	viewport.canvas_item_default_texture_filter=Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_NEAREST
	add_child(viewport)
	game=Game.new()
	viewport.add_child(game)
	display=TextureRect.new()
	display.texture=viewport.get_texture()
	display.texture_filter=CanvasItem.TEXTURE_FILTER_NEAREST
	display.mouse_filter=Control.MOUSE_FILTER_IGNORE
	add_child(display)
	resized.connect(layout)
	layout()
	set_process_input(true)

func layout() -> void:
	var s:=get_viewport_rect().size
	var portrait:=s.y>s.x*1.05
	small_screen=s.x<700
	var scale_factor:=minf((s.x-36)/160.0,(s.y*0.55-24)/144.0) if portrait else minf((s.x*0.58)/160.0,(s.y-88)/144.0)
	# Prefer an integer physical pixel ratio; never smooth or crop the LCD.
	var physical:=get_viewport().get_stretch_transform().get_scale().x
	if physical>0: scale_factor=maxf(1.0/physical,floor(scale_factor*physical)/physical)
	var dims:=Vector2(160,144)*scale_factor
	lcd=Rect2(Vector2((s.x-dims.x)/2,36 if portrait else (s.y-dims.y)/2-5).floor(),dims)
	display.position=lcd.position; display.size=lcd.size
	regions.clear()
	if portrait:
		var cy:=lcd.end.y+(s.y-lcd.end.y)*0.51
		pad_center=Vector2(s.x*0.24,cy)
		pad_size=minf(s.x*0.115,(s.y-lcd.end.y)*0.2)
		var r:=pad_size*0.85
		regions['jump']=Rect2(Vector2(s.x*0.79-r,cy-r*1.6),Vector2(r*2,r*2))
		regions['run']=Rect2(Vector2(s.x*0.62-r,cy-r*0.15),Vector2(r*2,r*2))
		regions['select']=Rect2(s.x*0.34,s.y-54,s.x*0.13,30)
		regions['start']=Rect2(s.x*0.53,s.y-54,s.x*0.13,30)
	else:
		var gutter: float=lcd.position.x
		pad_center=Vector2(maxf(62,gutter*0.50),s.y*0.58)
		pad_size=minf(42,gutter*0.27)
		var r:=pad_size*0.92
		regions['jump']=Rect2(Vector2(s.x-gutter*0.32-r,s.y*0.43-r),Vector2(r*2,r*2))
		regions['run']=Rect2(Vector2(s.x-gutter*0.70-r,s.y*0.65-r),Vector2(r*2,r*2))
		regions['select']=Rect2(s.x*0.34,s.y-33,s.x*0.13,25)
		regions['start']=Rect2(s.x*0.53,s.y-33,s.x*0.13,25)
	regions['mute']=Rect2(s.x-66,8,58,25)
	queue_redraw()

func map_key(code: int) -> String:
	match code:
		KEY_LEFT,KEY_A: return 'left'
		KEY_RIGHT,KEY_D: return 'right'
		KEY_UP,KEY_W: return 'up'
		KEY_DOWN,KEY_S: return 'down'
		KEY_Z,KEY_SPACE: return 'jump'
		KEY_X,KEY_SHIFT: return 'run'
		KEY_ENTER,KEY_ESCAPE: return 'start'
		KEY_TAB: return 'select'
		KEY_M: return 'mute'
	return ''

func _input(event: InputEvent) -> void:
	if event is InputEventKey and not event.echo:
		var action:=map_key(event.physical_keycode)
		if action!='': keyboard[event.physical_keycode]={'action':action,'held':event.pressed}
	elif event is InputEventJoypadButton:
		var action: String={JOY_BUTTON_A:'jump',JOY_BUTTON_B:'run',JOY_BUTTON_X:'run',JOY_BUTTON_START:'start',JOY_BUTTON_BACK:'select',JOY_BUTTON_DPAD_LEFT:'left',JOY_BUTTON_DPAD_RIGHT:'right',JOY_BUTTON_DPAD_UP:'up',JOY_BUTTON_DPAD_DOWN:'down'}.get(event.button_index,'')
		if action!='': keyboard[10000+event.button_index]={'action':action,'held':event.pressed}
	elif event is InputEventScreenTouch:
		if event.pressed: fingers[event.index]=event.position
		else: fingers.erase(event.index); run_fingers.erase(event.index)
	elif event is InputEventScreenDrag:
		if fingers.has(event.index): fingers[event.index]=event.position
	elif event is InputEventMouseButton and event.button_index==MOUSE_BUTTON_LEFT:
		if event.pressed: fingers[-1]=event.position
		else: fingers.erase(-1); run_fingers.erase(-1)
	elif event is InputEventMouseMotion and fingers.has(-1): fingers[-1]=event.position
	update_controls()

func update_controls() -> void:
	var values: Dictionary={}
	for entry in keyboard.values():
		if entry.held: values[entry.action]=true
	for finger in fingers:
		var p: Vector2=fingers[finger]
		if regions['run'].has_point(p): run_fingers[finger]=true
		if run_fingers.has(finger) and p.x>get_viewport_rect().size.x*0.5: values['run']=true
		var v: Vector2=p-pad_center
		if absf(v.x)<pad_size*1.8 and absf(v.y)<pad_size*1.8:
			if v.x < -pad_size*0.3: values['left']=true
			if v.x > pad_size*0.3: values['right']=true
			if v.y < -pad_size*0.3: values['up']=true
			if v.y > pad_size*0.3: values['down']=true
		for action in regions:
			if regions[action].has_point(p): values[action]=true
	# Analog controllers work alongside their D-pad.
	if not Input.get_connected_joypads().is_empty():
		var device: int=Input.get_connected_joypads()[0]
		var axis:=Input.get_joy_axis(device,JOY_AXIS_LEFT_X)
		if axis < -0.3: values['left']=true
		if axis > 0.3: values['right']=true
	game.controls=values
	queue_redraw()

func _process(_dt: float) -> void:
	if not Input.get_connected_joypads().is_empty(): update_controls()

func _notification(what: int) -> void:
	if what==NOTIFICATION_APPLICATION_FOCUS_OUT:
		fingers.clear(); run_fingers.clear(); keyboard.clear()
		if game:
			game.controls={}
			if game.state=='play': game.resume_state='play'; game.state='pause'
	elif what==NOTIFICATION_WM_GO_BACK_REQUEST:
		if game:
			if game.state=='play': game.resume_state='play'; game.state='pause'
			elif game.state=='pause': game.state=game.resume_state

func label_text(value: String, p: Vector2, size_px: int, color: Color, centered: bool = true) -> void:
	if centered: p.x-=font.get_string_size(value,HORIZONTAL_ALIGNMENT_LEFT,-1,size_px).x/2
	draw_string(font,p,value,HORIZONTAL_ALIGNMENT_LEFT,-1,size_px,color)

func _draw() -> void:
	if not game: return
	var s:=get_viewport_rect().size
	var pale:=Color('#92a691')
	var dark:=Color('#101b18')
	draw_rect(Rect2(Vector2.ZERO,s),dark)
	var frame:=lcd.grow(12)
	draw_style_box(make_box(Color('#273a31'),12),frame)
	draw_rect(lcd.grow(3),Color('#070e0c'))
	label_text('P O C K E T   O R C H A R D',Vector2(s.x/2,lcd.position.y-17),12,pale)
	var led:=Vector2(lcd.position.x-7,lcd.position.y+7)
	draw_circle(led,2,Color('#a8bb79'))
	# Broad hit areas and a traditional cross make diagonal run+jump comfortable.
	var b:=pad_size
	draw_style_box(make_box(Color('#070e0c'),6),Rect2(pad_center-Vector2(b*1.55,b*0.52),Vector2(b*3.1,b*1.04)))
	draw_style_box(make_box(Color('#070e0c'),6),Rect2(pad_center-Vector2(b*0.52,b*1.55),Vector2(b*1.04,b*3.1)))
	for action in ['left','right','up','down']:
		var offset: Vector2={'left':Vector2(-b,0),'right':Vector2(b,0),'up':Vector2(0,-b),'down':Vector2(0,b)}[action]
		var p:=pad_center+offset
		var active: bool=game.held(action)
		draw_rect(Rect2(p-Vector2(b*0.43,b*0.43),Vector2(b*0.86,b*0.86)),Color('#405c47') if active else Color('#233c30'))
		var tip:=offset.normalized()*b*0.15
		var side:=Vector2(-tip.y,tip.x)
		draw_colored_polygon(PackedVector2Array([p+tip,p-tip+side,p-tip-side]),pale)
	draw_circle(pad_center,b*0.23,Color('#1a2c23'))
	for action in ['jump','run']:
		var r: Rect2=regions[action]
		var p:=r.get_center()
		draw_circle(p+Vector2(0,4),r.size.x/2+2,Color('#060e0b'))
		draw_circle(p,r.size.x/2,Color('#7b9670') if game.held(action) else Color('#405d47'))
		draw_arc(p,r.size.x/2-3,PI,TAU,16,Color('#88a17b'),1,false)
		label_text('A' if action=='jump' else 'B',p+Vector2(0,6),20,Color('#dce8c4'))
		label_text('JUMP' if action=='jump' else 'RUN',p+Vector2(0,r.size.y/2+17),11,pale)
	for action in ['select','start']:
		var r: Rect2=regions[action]
		draw_style_box(make_box(Color('#405849') if game.held(action) else Color('#223a2d'),8),r)
		label_text(action.to_upper(),r.get_center()+Vector2(0,4),11,pale)
	label_text('SOUND' if not game.sound.muted else 'MUTED',regions['mute'].get_center()+Vector2(0,4),10,pale)
	if s.x>s.y and s.x>=850:
		label_text('STRAWBERRY',Vector2(pad_center.x,s.y*0.18),12,pale)
		label_text('GAMES',Vector2(pad_center.x,s.y*0.18+17),12,pale)

func make_box(color: Color, radius: int) -> StyleBoxFlat:
	var box:=StyleBoxFlat.new()
	box.bg_color=color
	box.set_corner_radius_all(radius)
	return box
