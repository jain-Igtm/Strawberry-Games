extends SceneTree
var shell: Control
var game: Node2D
var output: String
func _initialize() -> void: call_deferred('run')
func capture(name: String) -> void:
	game.queue_redraw()
	await process_frame
	await RenderingServer.frame_post_draw
	var image: Image=shell.viewport.get_texture().get_image()
	image.resize(640,576,Image.INTERPOLATE_NEAREST)
	image.save_png(output+'/'+name+'.png')
func run() -> void:
	output=OS.get_environment('POCKET_CAPTURE_DIR')
	if output=='': output='/tmp/pocket-orchard-shots'
	DirAccess.make_dir_recursive_absolute(output)
	shell=load('res://main.tscn').instantiate()
	root.add_child(shell)
	game=shell.game
	game.quiet_test=true
	game.set_physics_process(false)
	await process_frame
	game.state='title'
	await capture('title')
	for n in 6:
		game.load_stage(n,false)
		game.camera_x=112 if n==0 else 480
		game.pos=Vector2(game.camera_x+56,99)
		game.grounded=true
		await capture('course-'+str(n+1))
	game.enter_secret()
	await capture('seed-cellar')
	game.leave_secret()
	game.load_stage(5,false)
	game.camera_x=2320; game.pos=Vector2(2375,99)
	await capture('boss')
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(output+'/landscape.png')
	root.size=Vector2i(540,960)
	shell.layout()
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(output+'/portrait.png')
	shell.queue_free()
	await process_frame
	quit()
