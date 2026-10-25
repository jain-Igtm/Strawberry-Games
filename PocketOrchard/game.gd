extends Node2D
const Art = preload('res://art.gd')
const World = preload('res://world.gd')
const Sound = preload('res://sound.gd')
const TILE := 16
const WALK := 66.0
const RUN := 104.0
const GRAVITY := 590.0
const MAX_FALL := 245.0
var art=Art.new()
var sound: Node
var world: RefCounted
var controls: Dictionary = {}
var previous: Dictionary = {}
var state := 'title'
var resume_state := 'play'
var timer := 0.0
var clock := 0.0
var stage := 0
var unlocked := 0
var best := 0
var menu := 0
var score := 0
var seeds := 0
var lives := 5
var power := 0
var pos := Vector2(32,99)
var vel := Vector2.ZERO
var camera_x := 0.0
var facing := 1
var grounded := false
var coyote := 0.0
var jump_buffer := 0.0
var controllable_jump := false
var invincible := 0.0
var shoot_cooldown := 0.0
var freeze := 0.0
var stage_time := 300.0
var checked := false
var checkpoint_pos := Vector2.ZERO
var secret_count := 0
var saved_world: RefCounted
var return_pos := Vector2.ZERO
var particles: Array = []
var popups: Array = []
var items: Array = []
var shots: Array = []
var bumps: Dictionary = {}
var boss := {'hp':5,'p':Vector2(2430,84),'v':Vector2.ZERO,'age':0.0,'hurt':0.0,'ground':true}
var clear_bonus := 0
var save_path := 'user://orchard.cfg'
var quiet_test := false

func _ready() -> void:
	texture_filter=CanvasItem.TEXTURE_FILTER_NEAREST
	sound=Sound.new()
	add_child(sound)
	load_progress()
	load_stage(0,false)
	state='title'
	sound.play_song(0)

func load_progress() -> void:
	var cfg:=ConfigFile.new()
	if cfg.load(save_path)==OK:
		unlocked=clampi(int(cfg.get_value('save','unlocked',0)),0,5)
		best=int(cfg.get_value('save','best',0))
		var gray: bool=cfg.get_value('settings','gray',false)
		art.build(gray)
		sound.muted=bool(cfg.get_value('settings','muted',false))

func save_progress() -> void:
	if quiet_test: return
	var cfg:=ConfigFile.new()
	cfg.set_value('save','unlocked',unlocked)
	cfg.set_value('save','best',maxi(score,best))
	cfg.set_value('settings','gray',art.ink==Art.GRAY)
	cfg.set_value('settings','muted',sound.muted)
	cfg.save(save_path)

func held(action: String) -> bool:
	return bool(controls.get(action,false))

func pressed(action: String) -> bool:
	return held(action) and not bool(previous.get(action,false))

func height() -> float:
	return 13.0 if power==0 else 23.0

func body() -> Rect2:
	return Rect2(pos,Vector2(10,height()))

func change_power(value: int) -> void:
	var feet:=pos.y+height()
	power=value
	pos.y=feet-height()

func load_stage(n: int, intro: bool = true) -> void:
	stage=n
	world=World.new()
	world.build(n)
	pos=world.spawn-Vector2(0,height())
	vel=Vector2.ZERO
	camera_x=0
	grounded=false
	coyote=0; jump_buffer=0; controllable_jump=false
	checked=false
	stage_time=300
	invincible=0
	freeze=0
	particles.clear(); popups.clear(); items.clear(); shots.clear(); bumps.clear()
	saved_world=null
	boss={'hp':5,'p':Vector2(2430,84),'v':Vector2.ZERO,'age':0.0,'hurt':0.0,'ground':true}
	state='intro' if intro else 'play'
	timer=1.4
	if sound: sound.play_song(stage/2)

func new_game(n: int = 0) -> void:
	lives=5; seeds=0; score=0; power=0; secret_count=0
	load_stage(n)

func _physics_process(dt: float) -> void:
	step(dt)
	previous=controls.duplicate()
	queue_redraw()

func step(dt: float) -> void:
	clock+=dt
	if pressed('mute'):
		sound.toggle()
		save_progress()
	if pressed('select') and state in ['title','pause']:
		art.build(art.ink==Art.GREEN)
		save_progress()
	if state=='title':
		if pressed('down') or pressed('up'): menu=1-menu
		if pressed('left') and menu==1: stage=maxi(0,stage-1)
		if pressed('right') and menu==1: stage=mini(unlocked,stage+1)
		if pressed('jump') or pressed('start'):
			new_game(stage if menu==1 else 0)
		elif pressed('run'): state='help'
		return
	if state=='help':
		if pressed('start') or pressed('jump') or pressed('run'): state='title'
		return
	if state=='pause':
		if pressed('start') or pressed('jump'): state=resume_state
		if pressed('up') and held('run'):
			state='title'; stage=0; camera_x=0; sound.play_song(0)
		return
	if pressed('start') and state in ['play','intro']:
		resume_state=state
		state='pause'
		return
	if state=='intro':
		timer-=dt
		if timer<=0 or pressed('jump'): state='play'
		return
	if state=='over' or state=='won':
		if pressed('start') or pressed('jump'):
			state='title'; stage=0; camera_x=0; sound.play_song(0)
		return
	update_fx(dt)
	if state=='dead':
		timer-=dt
		vel.y+=GRAVITY*dt
		pos.y+=vel.y*dt
		if timer<=0: respawn()
		return
	if state=='clear':
		timer-=dt
		if timer<1.8 and clear_bonus>0:
			var award:=mini(40,clear_bonus)
			score+=award; clear_bonus-=award
		if timer<=0:
			score+=clear_bonus; clear_bonus=0
			best=maxi(best,score)
			if stage==5:
				state='won'; sound.music.stop(); save_progress()
			else:
				unlocked=maxi(unlocked,stage+1)
				save_progress(); load_stage(stage+1)
		return
	if state!='play': return
	if freeze>0:
		freeze-=dt
		return
	stage_time-=dt
	if stage_time<=0: die(); return
	invincible=maxf(0,invincible-dt)
	shoot_cooldown=maxf(0,shoot_cooldown-dt)
	jump_buffer=maxf(0,jump_buffer-dt)
	coyote=maxf(0,coyote-dt)
	if pressed('jump'): jump_buffer=0.12
	if grounded: coyote=0.08
	var direction:=int(held('right'))-int(held('left'))
	var max_speed:=RUN if held('run') else WALK
	var acceleration:=420.0 if grounded else 280.0
	if direction!=0:
		vel.x=move_toward(vel.x,direction*max_speed,acceleration*dt)
		facing=direction
	else:
		vel.x=move_toward(vel.x,0,520*dt if grounded else 80*dt)
	if jump_buffer>0 and coyote>0:
		vel.y=-231.0 if absf(vel.x)>80 else -215.0
		jump_buffer=0; coyote=0; grounded=false; controllable_jump=true
		sound.sfx('jump')
	if controllable_jump and not held('jump') and vel.y < -75:
		vel.y=move_toward(vel.y,-75,1500*dt)
	if pressed('run') and power==2 and shoot_cooldown<=0:
		shoot_cooldown=0.28
		shots.append({'p':pos+Vector2(5+facing*7,7),'v':Vector2(140*facing,-30),'life':2.0,'hostile':false})
		sound.sfx('shot')
	update_platforms(dt)
	vel.y=minf(vel.y+GRAVITY*dt,MAX_FALL)
	move_player(dt)
	if grounded: coyote=0.08; controllable_jump=false
	if pos.y>168: die(); return
	update_seeds()
	update_items(dt)
	update_enemies(dt)
	if state!='play': return
	update_shots(dt)
	if stage==5 and not world.bonus: update_boss(dt)
	if state!='play': return
	var bb:=body()
	for yy in range(int(floor(bb.position.y/16)),int(floor((bb.end.y-1)/16))+1):
		for xx in range(int(floor(bb.position.x/16)),int(floor((bb.end.x-1)/16))+1):
			if world.tile_at(xx,yy)==9 and bb.intersects(Rect2(xx*16+2,yy*16+4,12,12)):
				hurt()
	if not checked and not world.bonus and pos.x+10>world.checkpoint.x:
		checked=true
		checkpoint_pos=world.checkpoint-Vector2(0,height())
		popup('SAVED',world.checkpoint-Vector2(0,24))
		sound.sfx('seed')
	if world.entrance.x>0 and bb.intersects(Rect2(world.entrance-Vector2(0,16),Vector2(16,16))) and held('down'):
		enter_secret()
	elif world.bonus and bb.intersects(Rect2(world.exit-Vector2(0,24),Vector2(16,24))) and held('down'):
		leave_secret()
	elif not world.bonus and pos.x+8>world.exit.x and (stage<5 or boss.hp<=0):
		finish_stage()
	camera_x=clampf(move_toward(camera_x,pos.x-57,160*dt),0,world.width*16-160)

func move_player(dt: float) -> void:
	# Axis-separated collision. A fixed 60 Hz step never crosses a whole tile.
	pos.x+=vel.x*dt
	var r:=body()
	for y in range(int(floor(r.position.y/16)),int(floor((r.end.y-0.01)/16))+1):
		for x in range(int(floor(r.position.x/16)),int(floor((r.end.x-0.01)/16))+1):
			if world.solid(x,y):
				if vel.x>0: pos.x=x*16-10
				elif vel.x<0: pos.x=(x+1)*16
				vel.x=0
	pos.x=clampf(pos.x,0,world.width*16-10)
	var old_bottom:=pos.y+height()
	var old_top:=pos.y
	pos.y+=vel.y*dt
	grounded=false
	r=body()
	var hit_blocks: Array=[]
	for y in range(int(floor(r.position.y/16)),int(floor((r.end.y-0.01)/16))+1):
		for x in range(int(floor(r.position.x/16)),int(floor((r.end.x-0.01)/16))+1):
			if world.solid(x,y,vel.y<0):
				if vel.y>=0 and old_bottom<=y*16+4:
					pos.y=y*16-height(); vel.y=0; grounded=true
				elif vel.y<0 and old_top>=(y+1)*16-5:
					pos.y=(y+1)*16; hit_blocks.append(Vector2i(x,y))
	if not hit_blocks.is_empty():
		vel.y=0
		# Only the block closest to the player's center receives the bump.
		hit_blocks.sort_custom(func(a,b): return absf(a.x*16+8-pos.x-5)<absf(b.x*16+8-pos.x-5))
		bump_block(hit_blocks[0])
	if vel.y>=0:
		for platform in world.platforms:
			var p: Vector2=platform.p
			if pos.x+10>p.x and pos.x<p.x+platform.w and old_bottom<=platform.old.y+2 and pos.y+height()>=p.y:
				pos.y=p.y-height(); vel.y=0; grounded=true
		for tx in range(int(floor(pos.x/16)),int(floor((pos.x+9)/16))+1):
			var base_y:=int(floor((pos.y+height())/16))
			for ty in [base_y-1,base_y]:
				if world.tile_at(tx,ty)==10 and pos.y<ty*16+15 and pos.y+height()>=ty*16+4:
					pos.y=ty*16+4-height(); vel.y=-315; grounded=false; coyote=0; controllable_jump=false
					sound.sfx('spring'); burst(Vector2(tx*16+8,ty*16+4),6,1)

func update_platforms(dt: float) -> void:
	for platform in world.platforms:
		var old: Vector2=platform.p
		platform.old=old
		platform.phase+=dt*1.5
		var offset: float=(sin(platform.phase)*0.5+0.5)*platform.distance
		platform.p=platform.origin+(Vector2(0,offset) if platform.vertical else Vector2(offset,0))
		if grounded and absf(pos.y+height()-old.y)<2 and pos.x+10>old.x and pos.x<old.x+platform.w:
			pos+=platform.p-old

func bump_block(cell: Vector2i) -> void:
	var kind: int=world.tiles.get(cell,0)
	var p:=Vector2(cell)*16
	if kind in [4,5,11,12]:
		world.tiles[cell]=6
		bumps[cell]=0.15
		if kind in [4,12]:
			add_seed(); burst(p+Vector2(8,-8),5,1); popup('100',p-Vector2(0,12))
		else:
			items.append({'p':p+Vector2(2,-14),'v':Vector2(30*facing,0),'kind':1 if kind==5 else 2,'age':0.0})
			sound.sfx('power')
	elif kind==3 and power>0:
		world.tiles.erase(cell)
		burst(p+Vector2(8,8),10,3)
		score+=50; sound.sfx('bump')
	else:
		bumps[cell]=0.12; sound.sfx('bump')
	for enemy in world.enemies:
		if enemy.alive and absf(enemy.p.y+13-p.y)<5 and enemy.p.x+13>p.x and enemy.p.x<p.x+16:
			kill_enemy(enemy)

func update_seeds() -> void:
	for seed in world.seeds:
		if not seed.taken and body().intersects(Rect2(seed.p,Vector2(10,11))):
			seed.taken=true; add_seed(); burst(seed.p+Vector2(5,5),4,1)

func add_seed() -> void:
	seeds+=1; score+=100; sound.sfx('seed')
	if seeds>=100:
		seeds-=100; lives+=1; popup('1 UP',pos-Vector2(0,10)); sound.sfx('life')

func update_items(dt: float) -> void:
	for item in items:
		item.age+=dt
		item.v.y=minf(item.v.y+GRAVITY*dt,MAX_FALL)
		item.p.x+=item.v.x*dt
		var tx:=int(floor((item.p.x+(13 if item.v.x>0 else 0))/16))
		if world.solid(tx,int(floor((item.p.y+7)/16))): item.v.x=-item.v.x
		var old: float=item.p.y+13
		item.p.y+=item.v.y*dt
		for x in [int(floor(item.p.x/16)),int(floor((item.p.x+12)/16))]:
			var y:=int(floor((item.p.y+13)/16))
			if world.solid(x,y) and old<=y*16+5:
				item.p.y=y*16-13; item.v.y=0
		if body().intersects(Rect2(item.p,Vector2(13,13))):
			change_power(maxi(power,item.kind)); invincible=0.8; freeze=0.12
			score+=1000; popup('1000',item.p); sound.sfx('power'); item.age=100
	items=items.filter(func(item): return item.age<25 and item.p.y<170)

func update_enemies(dt: float) -> void:
	for enemy in world.enemies:
		if not enemy.alive:
			enemy.flat=maxf(0,enemy.flat-dt)
			continue
		if absf(enemy.p.x-pos.x)>200: continue
		enemy.age+=dt
		if enemy.kind=='moth':
			enemy.p.x+=enemy.v.x*dt
			enemy.p.y=enemy.home+sin(enemy.age*4)*15
			if world.solid(int(floor(enemy.p.x/16)),int(floor(enemy.p.y/16))) or enemy.p.x<4: enemy.v.x=-enemy.v.x
		else:
			var on_floor: bool=world.solid(int(floor((enemy.p.x+6)/16)),int(floor((enemy.p.y+14)/16)))
			if enemy.kind=='hopper' and on_floor and fmod(enemy.age,1.7)<dt:
				enemy.v.y=-155
			if enemy.patrol and on_floor:
				var ahead:=int(floor((enemy.p.x+(16 if enemy.v.x>0 else -2))/16))
				if not world.solid(ahead,int(floor((enemy.p.y+15)/16))): enemy.v.x=-enemy.v.x
			enemy.p.x+=enemy.v.x*dt
			var edge_x:=int(floor((enemy.p.x+(13 if enemy.v.x>0 else 0))/16))
			if world.solid(edge_x,int(floor((enemy.p.y+6)/16))) or enemy.p.x<1:
				enemy.v.x=-enemy.v.x; enemy.p.x+=enemy.v.x*dt*2
			var bottom: float=enemy.p.y+13
			enemy.v.y=minf(enemy.v.y+GRAVITY*dt,MAX_FALL)
			enemy.p.y+=enemy.v.y*dt
			for x in [int(floor(enemy.p.x/16)),int(floor((enemy.p.x+12)/16))]:
				var y:=int(floor((enemy.p.y+13)/16))
				if enemy.v.y>=0 and world.solid(x,y) and bottom<=y*16+5:
					enemy.p.y=y*16-13; enemy.v.y=0
		if enemy.p.y>170: enemy.alive=false
		if not enemy.alive: continue
		var er:=Rect2(enemy.p+Vector2(1,2),Vector2(12,11))
		if body().intersects(er):
			if vel.y>0 and pos.y+height()-vel.y*dt<=enemy.p.y+6:
				kill_enemy(enemy); vel.y=-205 if held('jump') else -145; grounded=false; coyote=0; controllable_jump=false
			else: hurt()
			if state!='play': return

func kill_enemy(enemy: Dictionary) -> void:
	enemy.alive=false; enemy.flat=0.25
	score+=200; popup('200',enemy.p); burst(enemy.p+Vector2(7,7),4,2); sound.sfx('stomp')

func update_shots(dt: float) -> void:
	for shot in shots:
		shot.life-=dt
		var before: Vector2=shot.p
		shot.p.x+=shot.v.x*dt
		if world.solid(int(floor(shot.p.x/16)),int(floor(shot.p.y/16))):
			shot.life=0; burst(shot.p,4,2); continue
		shot.v.y=minf(shot.v.y+450*dt,200)
		shot.p.y+=shot.v.y*dt
		if world.solid(int(floor(shot.p.x/16)),int(floor(shot.p.y/16))) and shot.v.y>0:
			shot.p.y=floor(shot.p.y/16)*16-2; shot.v.y=-120
		elif world.solid(int(floor(shot.p.x/16)),int(floor(shot.p.y/16))):
			shot.p=before; shot.v.y=50
		if shot.hostile:
			if body().grow(-1).has_point(shot.p): shot.life=0; hurt()
		else:
			for enemy in world.enemies:
				if enemy.alive and Rect2(enemy.p,Vector2(13,13)).grow(2).has_point(shot.p):
					kill_enemy(enemy); shot.life=0; break
			if stage==5 and not world.bonus and boss.hp>0 and Rect2(boss.p,Vector2(26,28)).has_point(shot.p):
				shot.life=0; hit_boss()
	shots=shots.filter(func(s): return s.life>0 and s.p.y<160 and absf(s.p.x-pos.x)<210)

func update_boss(dt: float) -> void:
	if pos.x<2260 or boss.hp<=0: return
	boss.age+=dt; boss.hurt=maxf(0,boss.hurt-dt)
	if boss.ground and fmod(boss.age,2.1)<dt:
		boss.v.y=-200; boss.v.x=-42 if pos.x<boss.p.x else 42; boss.ground=false
	boss.v.y+=GRAVITY*dt
	boss.p+=boss.v*dt
	boss.p.x=clampf(boss.p.x,2290,2540)
	if boss.p.y>=84:
		boss.p.y=84; boss.v=Vector2.ZERO; boss.ground=true
		if fmod(boss.age,2.1)>0.4:
			for d in [-1,1]:
				shots.append({'p':boss.p+Vector2(13+d*14,21),'v':Vector2(d*65,-25),'life':2.4,'hostile':true})
			boss.age=ceil(boss.age/2.1)*2.1
	if body().intersects(Rect2(boss.p+Vector2(1,2),Vector2(24,26))):
		if vel.y>0 and pos.y+height()-vel.y*dt<=boss.p.y+8:
			hit_boss(); vel.y=-225; grounded=false; coyote=0
		else: hurt()

func hit_boss() -> void:
	if boss.hurt>0 or boss.hp<=0: return
	boss.hp-=1; boss.hurt=0.8; freeze=0.08; sound.sfx('stomp')
	burst(boss.p+Vector2(13,12),12,3)
	if boss.hp<=0:
		score+=5000; shots=shots.filter(func(s): return not s.hostile)
		popup('5000',boss.p); sound.sfx('clear'); burst(boss.p,25,2)

func hurt() -> void:
	if invincible>0 or state!='play': return
	if power>0:
		change_power(0); invincible=1.8; freeze=0.12; sound.sfx('hurt')
	else: die()

func die() -> void:
	if state!='play': return
	state='dead'; timer=1.6; vel=Vector2(0,-170); lives-=1
	sound.music.stop(); sound.sfx('lose')

func respawn() -> void:
	power=0; invincible=1.8; freeze=0; vel=Vector2.ZERO
	if lives<=0:
		state='over'; best=maxi(best,score); save_progress(); return
	var keep_checked:=checked
	var keep_time:=stage_time
	load_stage(stage,false)
	if keep_checked:
		checked=true; pos=world.checkpoint-Vector2(0,height()); camera_x=pos.x-57
		stage_time=maxf(120,keep_time)
	invincible=1.8

func enter_secret() -> void:
	return_pos=pos+Vector2(17,0)
	saved_world=world
	world=World.new(); world.build(stage,true)
	pos=world.spawn-Vector2(0,height()); vel=Vector2.ZERO; camera_x=0
	items.clear(); shots.clear(); particles.clear(); secret_count+=1
	sound.sfx('power'); popup('SECRET!',pos+Vector2(10,-20))

func leave_secret() -> void:
	if saved_world==null: return
	world=saved_world; saved_world=null
	pos=return_pos; vel=Vector2.ZERO; camera_x=clampf(pos.x-57,0,world.width*16-160)
	items.clear(); shots.clear(); particles.clear(); sound.sfx('power')

func finish_stage() -> void:
	state='clear'; timer=3.2
	clear_bonus=int(stage_time)*10
	sound.music.stop(); sound.sfx('clear'); burst(pos,22,1)

func burst(p: Vector2, amount: int, color: int) -> void:
	for i in amount:
		var a:=float(i)*2.399
		particles.append({'p':p,'v':Vector2(cos(a)*30,sin(a)*30-30),'life':0.35+float(i%4)*0.08,'ink':color})

func popup(value: String, p: Vector2) -> void:
	popups.append({'value':value,'p':p,'life':0.8})

func update_fx(dt: float) -> void:
	for p in particles:
		p.life-=dt; p.v.y+=130*dt; p.p+=p.v*dt
	particles=particles.filter(func(p): return p.life>0)
	for p in popups:
		p.life-=dt; p.p.y-=14*dt
	popups=popups.filter(func(p): return p.life>0)
	for cell in bumps.keys():
		bumps[cell]-=dt
		if bumps[cell]<=0: bumps.erase(cell)

func screen(p: Vector2) -> Vector2:
	return (p-Vector2(camera_x,0)).floor()

func _draw() -> void:
	if world==null: return
	draw_background()
	draw_world()
	if state not in ['title','help','intro','over','won']:
		for item in items: art.sprite(self,'berry' if item.kind==1 else 'flower',screen(item.p)-Vector2(2,1))
		for enemy in world.enemies:
			if not enemy.alive:
				if enemy.flat>0: draw_rect(Rect2(screen(enemy.p)+Vector2(0,10),Vector2(13,3)),art.ink[3])
				continue
			if absf(enemy.p.x-camera_x-80)>100: continue
			var key: String=enemy.kind
			if key=='beetle' and int(clock*8)%2==0: key='beetle2'
			art.sprite(self,key,screen(enemy.p)-Vector2(1,2),enemy.v.x>0)
		if stage==5 and not world.bonus: draw_boss()
		for shot in shots:
			var p:=screen(shot.p)
			draw_rect(Rect2(p-Vector2(2,2),Vector2(5,5)),art.ink[3])
			draw_rect(Rect2(p-Vector2(1,1),Vector2(2,2)),art.ink[0])
		if invincible<=0 or int(clock*20)%2==0 or state=='dead': draw_pip()
		for p in particles: draw_rect(Rect2(screen(p.p),Vector2(2,2)),art.ink[p.ink])
		for p in popups: art.text(self,p.value,screen(p.p),3)
	draw_hud()
	match state:
		'title': draw_title()
		'help': draw_help()
		'intro': draw_intro()
		'pause': draw_pause()
		'clear': draw_clear()
		'over': draw_end(false)
		'won': draw_end(true)

func draw_background() -> void:
	var night: bool=stage>=4 and not world.bonus
	var cellar: bool=stage==3 or stage==5 or world.bonus
	draw_rect(Rect2(0,0,160,144),art.ink[1 if night else 0])
	if cellar:
		draw_rect(Rect2(0,14,160,130),art.ink[2])
		for i in range(-1,8):
			var x:=i*32-int(camera_x*0.3)%32
			draw_rect(Rect2(x,23,17,89),art.ink[3])
			draw_rect(Rect2(x+2,25,13,85),art.ink[1])
			for y in range(28,108,8):
				draw_line(Vector2(x+3,y),Vector2(x+13,y),art.ink[2],1)
			if i%2==0:
				art.sprite(self,'gear',Vector2(x,42))
		return
	if night:
		draw_rect(Rect2(118,24,15,15),art.ink[0])
		draw_rect(Rect2(115,22,12,13),art.ink[1])
		for i in 13:
			var p:=Vector2(fposmod(i*37-camera_x*0.1,160),19+i*17%48)
			draw_rect(Rect2(p,Vector2(1,1)),art.ink[0])
	else:
		for i in 5:
			var x:=i*48-int(camera_x*0.15)%48-8
			var y:=23+(i%3)*9
			draw_rect(Rect2(x+5,y,16,3),art.ink[1])
			draw_rect(Rect2(x,y+3,28,5),art.ink[1])
			draw_rect(Rect2(x+3,y+8,22,2),art.ink[1])
	for i in range(-1,5):
		var x:=i*64-int(camera_x*0.25)%64
		var points:=PackedVector2Array([Vector2(x-12,112),Vector2(x-12,96),Vector2(x-6,96),Vector2(x-6,84),Vector2(x,84),Vector2(x,74),Vector2(x+8,74),Vector2(x+8,67),Vector2(x+24,67),Vector2(x+24,74),Vector2(x+32,74),Vector2(x+32,84),Vector2(x+38,84),Vector2(x+38,96),Vector2(x+44,96),Vector2(x+44,112)])
		draw_colored_polygon(points,art.ink[2 if night else 1])
		for j in 4:
			draw_rect(Rect2(x+7+j*6,83+j%2*6,1,2),art.ink[1 if night else 2])
	# Orchard trees have stepped silhouettes; foreground remains easy to read.
	for i in range(-1,6):
		var x:=i*46-int(camera_x*0.55)%46
		draw_rect(Rect2(x+16,84,4,28),art.ink[2])
		draw_rect(Rect2(x+8,74,20,16),art.ink[2])
		draw_rect(Rect2(x+4,78,28,8),art.ink[2])
		draw_rect(Rect2(x+11,70,14,4),art.ink[2])
		draw_rect(Rect2(x+9,76,16,8),art.ink[1])
		for j in 3: draw_rect(Rect2(x+10+j*5,78+(j%2)*4,2,2),art.ink[0])
		if stage==2:
			draw_rect(Rect2(x+14,52,10,33),art.ink[2])
			draw_line(Vector2(x+6,54),Vector2(x+32,72),art.ink[3],2)
			draw_line(Vector2(x+10,74),Vector2(x+28,49),art.ink[3],2)

func draw_world() -> void:
	var a:=int(floor(camera_x/16))
	for x in range(a,a+11):
		for y in 9:
			var t: int=world.tile_at(x,y)
			if t==0 or t==12: continue
			var key: String={1:'grass',2:'soil',3:'brick',4:'block',5:'block',6:'used',7:'stone',8:'wood',9:'spike',10:'spring',11:'block'}.get(t,'stone')
			var cell:=Vector2i(x,y)
			var dy:=0.0
			if bumps.has(cell): dy=-sin(bumps[cell]/0.15*PI)*3
			art.sprite(self,key,screen(Vector2(x*16,y*16+dy)))
	for platform in world.platforms:
		art.sprite(self,'wood',screen(platform.p))
		art.sprite(self,'wood',screen(platform.p)+Vector2(16,0))
	for seed in world.seeds:
		if seed.taken or absf(seed.p.x-camera_x-80)>100: continue
		var p:=screen(seed.p)-Vector2(3,2)
		var frame:=int(clock*7)%4
		if frame==1 or frame==3:
			draw_rect(Rect2(p+Vector2(6,2),Vector2(3,9)),art.ink[3])
			draw_rect(Rect2(p+Vector2(7,3),Vector2(1,7)),art.ink[0])
		else: art.sprite(self,'seed',p)
	if not world.bonus:
		art.sprite(self,'checkpoint',screen(world.checkpoint)-Vector2(3,16))
		if checked: draw_rect(Rect2(screen(world.checkpoint)+Vector2(5,-12),Vector2(4,3)),art.ink[0])
	if world.entrance.x>0:
		art.sprite(self,'door',screen(world.entrance)-Vector2(0,16))
		if absf(pos.x-world.entrance.x)<24:
			art.text(self,'DOWN',screen(world.entrance)-Vector2(0,23))
	var ex:=screen(world.exit)
	if world.bonus:
		art.sprite(self,'door',ex-Vector2(0,16))
		art.text(self,'DOWN',ex-Vector2(0,23))
	else:
		# Bell at the end of each route, rather than a copied flagpole/castle.
		draw_rect(Rect2(ex+Vector2(-1,-47),Vector2(3,47)),art.ink[3])
		draw_rect(Rect2(ex+Vector2(22,-47),Vector2(3,47)),art.ink[3])
		draw_rect(Rect2(ex+Vector2(-4,-49),Vector2(32,4)),art.ink[3])
		draw_rect(Rect2(ex+Vector2(4,-44),Vector2(16,3)),art.ink[2])
		draw_rect(Rect2(ex+Vector2(6,-41),Vector2(12,9)),art.ink[3])
		draw_rect(Rect2(ex+Vector2(4,-33),Vector2(16,3)),art.ink[3])
		draw_rect(Rect2(ex+Vector2(7,-40),Vector2(3,5)),art.ink[0])
		draw_rect(Rect2(ex+Vector2(10,-29),Vector2(4,3)),art.ink[2])
		if pos.x>world.exit.x-35:
			art.text(self,'RING!',ex+Vector2(3,-59))

func draw_pip() -> void:
	var key: String='pip'
	if not grounded: key='jump'
	elif absf(vel.x)>8: key='walk1' if int(clock*12)%2 else 'walk2'
	var p:=screen(pos)-Vector2(3,2)
	art.sprite(self,key,p,facing<0,Vector2(16,16 if power==0 else 26))
	if power==2:
		draw_rect(Rect2(p+Vector2(4,12),Vector2(8,2)),art.ink[0])
		draw_rect(Rect2(p+Vector2(7,12),Vector2(2,2)),art.ink[3])

func draw_boss() -> void:
	if boss.hp<=0: return
	if boss.hurt>0 and int(clock*20)%2==0: return
	var p:=screen(boss.p)
	art.sprite(self,'gear',p+Vector2(0,12))
	art.sprite(self,'gear',p+Vector2(14,12))
	draw_rect(Rect2(p+Vector2(2,0),Vector2(24,20)),art.ink[3])
	draw_rect(Rect2(p+Vector2(4,2),Vector2(20,15)),art.ink[1])
	draw_rect(Rect2(p+Vector2(7,5),Vector2(5,5)),art.ink[0])
	draw_rect(Rect2(p+Vector2(16,5),Vector2(5,5)),art.ink[0])
	draw_rect(Rect2(p+Vector2(9,6),Vector2(2,3)),art.ink[3])
	draw_rect(Rect2(p+Vector2(17,6),Vector2(2,3)),art.ink[3])
	for i in 3: draw_rect(Rect2(p+Vector2(8+i*5,13),Vector2(2,3)),art.ink[3])
	for i in boss.hp: draw_rect(Rect2(p+Vector2(2+i*5,-5),Vector2(3,2)),art.ink[3])

func draw_hud() -> void:
	draw_rect(Rect2(0,0,160,14),art.ink[0])
	draw_rect(Rect2(0,13,160,1),art.ink[3])
	art.text(self,'PIP '+str(lives),Vector2(3,2))
	art.text(self,'S '+('%02d'%seeds),Vector2(34,2))
	art.text(self,str(stage/2+1)+'-'+str(stage%2+1),Vector2(78,2))
	art.text(self,'T '+str(maxi(0,int(stage_time))),Vector2(115,2))
	art.text(self,'%06d'%score,Vector2(3,8),2)
	art.text(self,World.REGIONS[stage],Vector2(53,8),2)

func panel(rect: Rect2) -> void:
	draw_rect(rect,art.ink[3])
	draw_rect(rect.grow(-1),art.ink[0])
	draw_rect(rect.grow(-3),art.ink[3],false,1)

func draw_title() -> void:
	draw_rect(Rect2(0,0,160,144),art.ink[0])
	# Tiny leaves frame a game title that remains legible on the real LCD size.
	for i in 8:
		var x:=i*23-6
		draw_rect(Rect2(x,5+i%2*3,12,3),art.ink[2])
		draw_rect(Rect2(x+3,3+i%2*3,6,7),art.ink[1])
	art.centered(self,'POCKET',18,3,3)
	art.centered(self,'ORCHARD',37,3,3)
	art.centered(self,'A LITTLE BIG ADVENTURE',59,2)
	art.sprite(self,'pip',Vector2(71,69))
	art.sprite(self,'seed',Vector2(50,70))
	art.sprite(self,'seed',Vector2(94,70))
	art.text(self,'>' if menu==0 else ' ',Vector2(36,93))
	art.text(self,'NEW ADVENTURE',Vector2(46,93))
	art.text(self,'>' if menu==1 else ' ',Vector2(36,104))
	art.text(self,'COURSE '+str(stage/2+1)+'-'+str(stage%2+1),Vector2(46,104))
	art.centered(self,'B: HOW TO PLAY',117,2)
	art.centered(self,'STRAWBERRY GAMES',130,3)
	art.centered(self,'2026',138,2)

func draw_help() -> void:
	draw_rect(Rect2(0,0,160,144),art.ink[0])
	art.centered(self,'PIP HAS A DELIVERY!',8,3)
	var lines: Array = ['RETURN SEEDS. RING EVERY BELL.', '', 'D-PAD / ARROWS : MOVE','A / Z / SPACE : JUMP','HOLD A FOR A HIGHER JUMP','B / X / SHIFT : RUN','SLIDE B TO A : RUN + JUMP','POLLEN SUIT + B : SHOOT','DOWN AT A DOOR : ENTER','','BERRIES MAKE PIP GROW.','FLOWERS GIVE A POLLEN SUIT.','100 SEEDS EARN A LIFE.','START / ENTER : PAUSE','SELECT / TAB : LCD PALETTE','M : SOUND ON / OFF']
	for i in lines.size(): art.text(self,lines[i],Vector2(5,22+i*7),3)
	art.centered(self,'A: BACK',137,2)

func draw_intro() -> void:
	draw_rect(Rect2(0,14,160,130),art.ink[0])
	art.centered(self,'WORLD '+str(stage/2+1),27,2)
	art.centered(self,World.REGIONS[stage],40)
	art.centered(self,str(stage/2+1)+'-'+str(stage%2+1),58,3,3)
	art.centered(self,World.NAMES[stage],83)
	art.sprite(self,'pip',Vector2(58,100))
	art.text(self,'X '+str(lives),Vector2(83,106))
	if stage==0: art.centered(self,'HOLD B TO RUN. HOLD A TO LEAP.',128,2)

func draw_pause() -> void:
	panel(Rect2(10,37,140,77))
	art.centered(self,'PAUSED',48,3,2)
	art.centered(self,'START: RESUME',68)
	art.centered(self,'SELECT: LCD PALETTE',79,2)
	art.centered(self,'M: SOUND '+('OFF' if sound.muted else 'ON'),89,2)
	art.centered(self,'HOLD UP+B: TITLE',101,2)

func draw_clear() -> void:
	panel(Rect2(12,30,136,55))
	art.centered(self,'BELL RUNG!',41,3,2)
	art.centered(self,'TIME BONUS '+str(clear_bonus),61)
	art.centered(self,'DELIVERY COMPLETE',73,2)

func draw_end(won: bool) -> void:
	draw_rect(Rect2(0,0,160,144),art.ink[0])
	art.centered(self,'THE ORCHARD' if won else 'REST A WHILE,',20,3,2)
	art.centered(self,'WAKES UP!' if won else 'LITTLE PIP.',36,3,2)
	art.sprite(self,'pip',Vector2(72,57))
	if won:
		art.centered(self,'EVERY BELL IS RINGING.',82)
		art.centered(self,'THE SEEDS ARE HOME.',92)
	else:
		art.centered(self,'YOUR COURSES ARE SAVED.',82)
		art.centered(self,'TRY COURSE SELECT.',92)
	art.centered(self,'SCORE '+str(score),106,2)
	art.centered(self,'BEST '+str(maxi(best,score)),116,2)
	art.centered(self,'A: TITLE',134)
