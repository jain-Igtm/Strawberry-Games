extends SceneTree
## Search actual fixed-step movement for a route through every course.
## Combat is covered by test_game; this isolates geometry with a small player.
const Game=preload('res://game.gd')
var g: Node2D
var max_nodes:=1800
func _initialize() -> void: call_deferred('run')
func snapshot() -> Dictionary:
	return {'p':g.pos,'v':g.vel,'ground':g.grounded,'clock':g.clock,'platforms':g.world.platforms.duplicate(true),'actions':[]}
func restore(s: Dictionary) -> void:
	g.pos=s.p;g.vel=s.v;g.grounded=s.ground;g.clock=s.clock
	g.world.platforms=s.platforms.duplicate(true)
	g.coyote=0.08 if g.grounded else 0.0
	g.jump_buffer=0;g.controllable_jump=false;g.previous={};g.state='play'
	g.invincible=10000;g.freeze=0;g.stage_time=300;g.power=0
	g.items.clear();g.shots.clear();g.particles.clear();g.popups.clear()
func simulate(s: Dictionary, wait: int, jump: bool) -> Dictionary:
	restore(s)
	for frame in 105:
		g.controls={'right':true,'run':true,'jump':jump and frame>=wait}
		g.step(1.0/60);g.previous=g.controls.duplicate()
		if g.state=='clear':
			var done:=snapshot();done['clear']=true;return done
		if g.state=='dead' or g.pos.y>150: return {}
		if frame>=wait+3 and g.grounded:
			var landed:=snapshot()
			landed['clear']=false
			return landed
	return {}
func run() -> void:
	g=Game.new();g.quiet_test=true;root.add_child(g);g.set_physics_process(false)
	g.sound.muted=true
	var failed:=false
	for n in 6:
		g.load_stage(n,false);g.world.enemies.clear();g.boss.hp=0
		g.grounded=true
		var queue: Array=[snapshot()]
		var visited: Dictionary={}
		var count:=0
		var found:=false
		var farthest:=0.0
		while not queue.is_empty() and count<max_nodes:
			# Prefer forward progress, retaining earlier take-off alternatives.
			queue.sort_custom(func(a,b): return a.p.x>b.p.x)
			var s: Dictionary=queue.pop_front()
			count+=1
			farthest=maxf(farthest,s.p.x)
			var key:=str(int(s.p.x/4))+':'+str(int(s.p.y/4))+':'+str(int(fmod(s.clock,4.2)*4))
			if visited.has(key): continue
			visited[key]=true
			for wait in [0,3,6,9,12,15,18,21,24,30]:
				var next:=simulate(s,wait,true)
				if next.is_empty(): continue
				if next.clear: found=true;break
				if next.p.x>s.p.x+1: queue.append(next)
			if found: break
			var walk:=simulate(s,5,false)
			if not walk.is_empty():
				if walk.clear: found=true;break
				if walk.p.x>s.p.x+1: queue.append(walk)
		print('COURSE ',n+1,': ', 'ROUTE VERIFIED' if found else 'NO ROUTE', ' (',count,' states, furthest ',int(farthest),')')
		if not found: failed=true
	g.queue_free()
	await process_frame
	quit(1 if failed else 0)
