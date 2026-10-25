extends SceneTree
const Game = preload('res://game.gd')
const World = preload('res://world.gd')
var game: Node2D
var failures: Array=[]
var checks:=0
const DT:=1.0/60.0

func _initialize() -> void:
	call_deferred('run')

func check(condition: bool, description: String) -> void:
	checks+=1
	if not condition:
		failures.append(description)
		push_error(description)

func tick(input: Dictionary={}, count: int=1) -> void:
	for i in count:
		game.controls=input.duplicate()
		game.step(DT)
		game.previous=game.controls.duplicate()

func flat() -> void:
	game.load_stage(0,false)
	game.world.tiles.clear(); game.world.enemies.clear(); game.world.seeds.clear(); game.world.platforms.clear()
	game.world.floor_span(0,150,7)
	game.power=0; game.pos=Vector2(32,99); game.vel=Vector2.ZERO
	game.previous={}; game.invincible=0; game.freeze=0
	tick({},2)

func run() -> void:
	game=Game.new()
	game.quiet_test=true
	game.save_path='user://orchard-automated-tests.cfg'
	root.add_child(game)
	game.set_physics_process(false)
	await process_frame
	game.sound.muted=true
	flat()
	check(game.grounded,'Player rests on the tile floor.')
	var full_top:=99.0
	for i in 50:
		tick({'jump':i<35})
		full_top=minf(full_top,game.pos.y)
	flat()
	var short_top:=99.0
	for i in 50:
		tick({'jump':i<3})
		short_top=minf(short_top,game.pos.y)
	check(short_top-full_top>14,'Holding jump gives a meaningfully higher arc than tapping.')
	flat(); tick({'right':true},35)
	var walk_distance: float=game.pos.x-32
	flat(); tick({'right':true,'run':true},35)
	check(game.pos.x-32>walk_distance*1.35,'Run builds more speed than walking.')
	var running_speed: float=game.vel.x
	tick({},6)
	check(game.vel.x<running_speed*0.65,'Ground friction permits a predictable stop.')
	flat()
	game.world.put(5,6,7)
	tick({'right':true,'run':true},60)
	check(game.pos.x<=70.01,'A running player cannot pass through a wall.')
	flat()
	game.world.put(2,4,4)
	var before: int=game.seeds
	tick({'jump':true},35)
	check(game.world.tile_at(2,4)==6 and game.seeds==before+1,'Jumping into a seed block pays out once and leaves a solid used block.')
	tick({},35); tick({'jump':true},35)
	check(game.seeds==before+1,'A used block never gives duplicate seeds.')
	flat()
	var feet: float=game.pos.y+game.height()
	game.change_power(2)
	check(is_equal_approx(game.pos.y+game.height(),feet),'Growing preserves the player foot position.')
	game.hurt()
	check(game.power==0 and game.state=='play','Damage consumes the power-up before a life.')
	var life_count: int=game.lives
	game.hurt()
	check(game.lives==life_count,'Damage invulnerability prevents repeated losses.')
	flat()
	game.world.put(3,6,10)
	tick({'right':true},20)
	check(game.vel.y < -100 and game.pos.y<70,'Approaching a spring from the ground launches Pip.')
	flat()
	game.world.tiles.clear(); game.world.mover(2,7,3,false,0)
	game.world.platforms[0].p=Vector2(56,112)
	game.world.platforms[0].old=Vector2(56,112)
	game.pos=Vector2(63,99); game.grounded=true
	var relative: float=game.pos.x-game.world.platforms[0].p.x
	tick({},10)
	check(absf((game.pos.x-game.world.platforms[0].p.x)-relative)<0.1 and game.grounded,'Moving platforms carry a standing rider without drift.')
	flat()
	game.world.foe(3)
	game.pos=Vector2(48,68); game.vel=Vector2(0,120); game.grounded=false; game.coyote=0
	tick({'jump':true},15)
	check(not game.world.enemies[0].alive and game.state=='play','A descending stomp defeats an enemy and bounces safely.')
	flat()
	game.change_power(2)
	tick({'run':true})
	check(game.shots.size()==1,'The pollen suit fires on a new B press.')
	tick({'run':true},2)
	check(game.shots.size()==1,'Holding run does not flood the screen with projectiles.')
	flat()
	game.checked=true; game.pos=Vector2(500,180)
	game.state='play'; var old_lives: int=game.lives
	tick()
	check(game.state=='dead' and game.lives==old_lives-1,'Falling into a pit loses exactly one life.')
	game.respawn()
	check(game.checked and absf(game.pos.x-game.world.checkpoint.x)<1,'Death restores the active checkpoint.')
	flat()
	game.pos=Vector2(500,99); game.enter_secret()
	check(game.world.bonus and game.pos.x==24,'Secret doors lead to a separate bonus room.')
	game.leave_secret()
	check(not game.world.bonus and game.pos.x==517,'The bonus exit restores the same course and return position.')
	flat()
	game.seeds=99; var before_lives: int=game.lives
	game.add_seed()
	check(game.seeds==0 and game.lives==before_lives+1,'Collecting 100 seeds awards a life.')
	game.load_stage(5,false)
	for i in 5:
		game.boss.hurt=0
		game.hit_boss()
	check(game.boss.hp==0,'The final boss can be defeated with five distinct hits.')
	for n in 6:
		game.load_stage(n,false)
		check(game.world.solid(int(game.world.exit.x/16),7),'Course '+str(n+1)+' has a safe finish.')
		check(game.world.solid(int(game.world.checkpoint.x/16),7),'Course '+str(n+1)+' has a safe checkpoint respawn.')
		check(game.world.entrance.x>0,'Course '+str(n+1)+' has an optional secret entrance.')
		game.pos=game.world.exit+Vector2(1,-13)
		game.boss.hp=0; game.freeze=0
		tick()
		check(game.state=='clear','Course '+str(n+1)+' can trigger its completion.')
	# Check every authored floor gap against the actual full-speed jump envelope.
	for n in 6:
		var w=World.new(); w.build(n)
		var gap:=0
		for x in range(1,w.width-1):
			if not w.solid(x,7): gap+=1
			else:
				if gap>0: check(gap<=5,'Course '+str(n+1)+' has no unbridgeable main-path chasm at '+str(x))
				gap=0
	print('POCKET ORCHARD: ',checks,' checks; ',failures.size(),' failures. Jump heights: ',99-full_top,' / ',99-short_top)
	game.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
